const { query } = require('../config/database');
const { sendOrdenCompletadaEmail } = require('../services/emailService');

const TRANSITIONS = {
  pendiente:  ['en_curso', 'cancelada'],
  en_curso:   ['completada', 'cancelada'],
  completada: [],
  cancelada:  [],
};

const listar = async (req, res, next) => {
  try {
    const { estado = '', tipo = '', prioridad = '', cliente_id = '', page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    // Technicians see only their assigned orders
    if (req.user.rol === 'tecnico') {
      params.push(req.user.id);
      conditions.push(`ot.tecnico_id = $${params.length}`);
    }
    if (estado)     { params.push(estado);           conditions.push(`ot.estado = $${params.length}`); }
    if (tipo)       { params.push(tipo);             conditions.push(`ot.tipo = $${params.length}`); }
    if (prioridad)  { params.push(prioridad);        conditions.push(`ot.prioridad = $${params.length}`); }
    if (cliente_id) { params.push(Number(cliente_id)); conditions.push(`ot.cliente_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM ordenes_trabajo ot ${where}`, params);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT ot.*,
        c.nombre AS cliente_nombre,
        t.nombre AS tecnico_nombre
       FROM ordenes_trabajo ot
       JOIN clientes c ON ot.cliente_id = c.id
       LEFT JOIN usuarios t ON ot.tecnico_id = t.id
       ${where}
       ORDER BY
         CASE ot.prioridad WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END,
         ot.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ data: rows, total: Number(countRes.rows[0].count), page: Number(page), totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)) });
  } catch (err) { next(err); }
};

const obtener = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT ot.*,
        c.nombre AS cliente_nombre, c.email AS cliente_email, c.telefono AS cliente_telefono,
        c.direccion AS cliente_direccion, c.plan_id,
        p.nombre AS plan_nombre, p.velocidad_down, p.velocidad_up,
        t.nombre AS tecnico_nombre,
        u.nombre AS creado_por_nombre
       FROM ordenes_trabajo ot
       JOIN clientes c ON ot.cliente_id = c.id
       LEFT JOIN planes p ON c.plan_id = p.id
       LEFT JOIN usuarios t ON ot.tecnico_id = t.id
       LEFT JOIN usuarios u ON ot.created_by = u.id
       WHERE ot.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = rows[0];

    if (req.user.rol === 'tecnico' && Number(orden.tecnico_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    const { rows: parteRows } = await query(
      'SELECT * FROM partes_tecnicos WHERE orden_id = $1', [req.params.id]
    );
    res.json({ ...orden, parte: parteRows[0] || null });
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const { cliente_id, tipo, descripcion, prioridad, fecha_programada, tecnico_id } = req.body;
    if (!cliente_id || !tipo) return res.status(400).json({ error: 'cliente_id y tipo son requeridos' });
    const { rows } = await query(
      `INSERT INTO ordenes_trabajo (cliente_id, tecnico_id, created_by, tipo, descripcion, prioridad, fecha_programada)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [cliente_id, tecnico_id || null, req.user.id, tipo, descripcion || null,
       prioridad || 'normal', fecha_programada || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo el admin puede editar órdenes' });
    const fields = ['tipo', 'descripcion', 'prioridad', 'fecha_programada', 'tecnico_id'];
    const updates = [];
    const params = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f] || null);
        updates.push(`${f} = $${params.length}`);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE ordenes_trabajo SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    const { estado } = req.body;
    const { rows: current } = await query('SELECT * FROM ordenes_trabajo WHERE id = $1', [req.params.id]);
    if (!current[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = current[0];

    if (req.user.rol === 'tecnico' && Number(orden.tecnico_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }
    if (req.user.rol === 'tecnico' && ['cancelada'].includes(estado)) {
      return res.status(403).json({ error: 'Solo el admin puede cancelar órdenes' });
    }
    if (!TRANSITIONS[orden.estado]?.includes(estado)) {
      return res.status(400).json({ error: `No se puede pasar de '${orden.estado}' a '${estado}'` });
    }

    const extra = estado === 'completada' ? ', fecha_completada = NOW()' : '';
    const { rows } = await query(
      `UPDATE ordenes_trabajo SET estado = $1, updated_at = NOW()${extra} WHERE id = $2 RETURNING *`,
      [estado, req.params.id]
    );
    const ordenActualizada = rows[0];

    // Trigger email when completed
    if (estado === 'completada') {
      try {
        const [{ rows: cRows }, { rows: ispRows }, { rows: connRows }] = await Promise.all([
          query(`SELECT c.*, p.nombre AS plan_nombre, p.velocidad_down, p.velocidad_up
                 FROM clientes c LEFT JOIN planes p ON c.plan_id = p.id WHERE c.id = $1`, [orden.cliente_id]),
          query('SELECT * FROM configuracion_isp WHERE id = 1'),
          query('SELECT * FROM conexiones WHERE cliente_id = $1', [orden.cliente_id]),
        ]);
        await sendOrdenCompletadaEmail({
          cliente: cRows[0],
          isp: ispRows[0] || {},
          orden: ordenActualizada,
          conexion: connRows[0] || null,
        });
      } catch (emailErr) {
        console.error('Error enviando email de completado:', emailErr.message);
      }
    }

    res.json(ordenActualizada);
  } catch (err) { next(err); }
};

module.exports = { listar, obtener, crear, actualizar, cambiarEstado };
