const { query } = require('../config/database');
const { generarPDF } = require('./contratoController');
const bcrypt = require('bcryptjs');
const { audit } = require('../middleware/monitor');

// Genera facturas de instalación según la oferta elegida
const generarFacturasInstalacion = async (clienteId, ofertaId) => {
  if (!ofertaId) return;
  const { rows } = await query('SELECT * FROM ofertas_instalacion WHERE id=$1 AND activa=TRUE', [ofertaId]);
  const oferta = rows[0];
  if (!oferta || oferta.tipo === 'gratis' || Number(oferta.precio_total) === 0) return;

  const cuotas     = Math.max(1, Number(oferta.cuotas) || 1);
  const montoCuota = (Number(oferta.precio_total) / cuotas).toFixed(2);
  const hoy        = new Date();

  for (let i = 0; i < cuotas; i++) {
    const vence = new Date(hoy);
    vence.setMonth(vence.getMonth() + i);
    const periodo = `instalacion-${vence.getFullYear()}-${String(vence.getMonth() + 1).padStart(2, '0')}-c${i + 1}`;
    await query(
      `INSERT INTO facturas (cliente_id, periodo, monto, estado_pago, fecha_vencimiento, tipo, cuota_numero, cuota_total, oferta_id, notas)
       VALUES ($1,$2,$3,'pendiente',$4,'instalacion',$5,$6,$7,$8)
       ON CONFLICT DO NOTHING`,
      [clienteId, periodo, montoCuota, vence.toISOString().slice(0, 10),
       i + 1, cuotas, ofertaId,
       `${oferta.nombre}${cuotas > 1 ? ` — cuota ${i + 1}/${cuotas}` : ''}`]
    );
  }
};

const listar = async (req, res, next) => {
  try {
    const { search = '', estado = '', plan_id = '', page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(c.nombre ILIKE $${params.length} OR c.email ILIKE $${params.length} OR c.dni ILIKE $${params.length} OR c.telefono ILIKE $${params.length})`);
    }
    if (estado) {
      params.push(estado);
      conditions.push(`c.estado = $${params.length}`);
    }
    if (plan_id) {
      params.push(Number(plan_id));
      conditions.push(`c.plan_id = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(
      `SELECT COUNT(*) FROM clientes c ${where}`,
      params
    );
    const total = Number(countRes.rows[0].count);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT c.*, p.nombre AS plan_nombre, p.precio_mensual AS plan_precio, p.velocidad_down, p.velocidad_up,
              cn.estado AS conexion_estado
       FROM clientes c
       LEFT JOIN planes p ON c.plan_id = p.id
       LEFT JOIN LATERAL (
         SELECT estado FROM conexiones WHERE cliente_id = c.id ORDER BY id DESC LIMIT 1
       ) cn ON true
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: rows, total, page: Number(page), totalPages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows: clienteRows } = await query(
      `SELECT c.*, p.nombre AS plan_nombre, p.precio_mensual AS plan_precio, p.velocidad_down, p.velocidad_up
       FROM clientes c LEFT JOIN planes p ON c.plan_id = p.id
       WHERE c.id = $1`,
      [id]
    );
    if (!clienteRows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const [{ rows: conexRows }, { rows: factRows }] = await Promise.all([
      query('SELECT * FROM conexiones WHERE cliente_id = $1', [id]),
      query('SELECT * FROM facturas WHERE cliente_id = $1 ORDER BY periodo DESC LIMIT 24', [id]),
    ]);

    res.json({ ...clienteRows[0], conexion: conexRows[0] || null, facturas: factRows });
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, email, telefono, dni, direccion, barrio, ciudad, coordenadas, plan_id, notas, password, oferta_id } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });

    const dniFrente = req.files?.dni_frente?.[0];
    const dniDorso  = req.files?.dni_dorso?.[0];
    const dni_frente_url = dniFrente ? `/uploads/${dniFrente.filename}` : null;
    const dni_dorso_url  = dniDorso  ? `/uploads/${dniDorso.filename}`  : null;

    let password_hash = null;
    if (password) password_hash = await bcrypt.hash(password, 10);

    const { rows } = await query(
      `INSERT INTO clientes (nombre, email, telefono, dni, direccion, barrio, ciudad, coordenadas, plan_id, notas, password_hash, dni_frente_url, dni_dorso_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [nombre, email || null, telefono || null, dni || null, direccion || null,
       barrio || null, ciudad || null, coordenadas || null, plan_id || null, notas || null,
       password_hash, dni_frente_url, dni_dorso_url]
    );
    const cliente = rows[0];

    // Generar facturas de instalación según oferta elegida
    try {
      await generarFacturasInstalacion(cliente.id, oferta_id || null);
    } catch (instErr) {
      console.error('Error generando facturas de instalación:', instErr.message);
    }

    // Crear orden de conexión automáticamente
    try {
      await query(
        `INSERT INTO ordenes_trabajo (cliente_id, tipo, descripcion, prioridad, created_by)
         VALUES ($1, 'conexion', 'Conexión generada automáticamente por inscripción', 'normal', NULL)`,
        [cliente.id]
      );
    } catch (ordenErr) {
      console.error('Error creando orden de conexión:', ordenErr.message);
    }

    // Generar PDF en background — no bloquea la respuesta si falla
    let contrato_url = null;
    try {
      await generarPDF(cliente.id); // pre-valida que los datos están bien
      contrato_url = `/api/public/contrato/${cliente.id}`;
    } catch (pdfErr) {
      console.error('Error generando PDF:', pdfErr.message);
    }
    audit(req, 'crear', 'cliente', cliente.id, { nombre: cliente.nombre, email: cliente.email });
    res.status(201).json({ ...cliente, contrato_url });
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['nombre', 'email', 'telefono', 'dni', 'direccion', 'barrio', 'ciudad', 'coordenadas', 'plan_id', 'notas'];
    const updates = [];
    const params = [];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f] || null);
        updates.push(`${f} = $${params.length}`);
      }
    });

    if (req.body.password) {
      const hash = await bcrypt.hash(req.body.password, 10);
      params.push(hash);
      updates.push(`password_hash = $${params.length}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(id);
    const { rows } = await query(
      `UPDATE clientes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    audit(req, 'actualizar', 'cliente', rows[0].id, { campos: Object.keys(req.body) });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM clientes WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    audit(req, 'eliminar', 'cliente', rows[0].id, null);
    res.json({ message: 'Cliente eliminado' });
  } catch (err) {
    next(err);
  }
};

const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const estados = ['activo', 'suspendido', 'inactivo'];
    if (!estados.includes(estado)) return res.status(400).json({ error: 'Estado inválido' });

    const { rows } = await query(
      'UPDATE clientes SET estado = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [estado, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    audit(req, 'cambiar_estado', 'cliente', rows[0].id, { estado });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const listarSesiones = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT id, inicio, fin, duracion_seg
       FROM sesiones_clientes
       WHERE cliente_id = $1
       ORDER BY inicio DESC
       LIMIT 50`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar, cambiarEstado, listarSesiones };
