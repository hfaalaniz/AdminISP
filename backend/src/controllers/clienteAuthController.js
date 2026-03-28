const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { generarPDF } = require('./contratoController');

// POST /public/registro — inscription with password
const registro = async (req, res, next) => {
  try {
    const { nombre, email, telefono, dni, direccion, barrio, ciudad, plan_id, password } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (!email) return res.status(400).json({ error: 'Email requerido para crear cuenta' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });

    // Check duplicate email
    const { rows: dup } = await query('SELECT id FROM clientes WHERE email = $1', [email.toLowerCase().trim()]);
    if (dup[0]) return res.status(409).json({ error: 'Ya existe una cuenta con ese email' });

    const password_hash = await bcrypt.hash(password, 10);

    const dniFrente = req.files?.dni_frente?.[0];
    const dniDorso  = req.files?.dni_dorso?.[0];
    const dni_frente_url = dniFrente ? `/uploads/${dniFrente.filename}` : null;
    const dni_dorso_url  = dniDorso  ? `/uploads/${dniDorso.filename}`  : null;

    const { rows } = await query(
      `INSERT INTO clientes (nombre, email, telefono, dni, direccion, barrio, ciudad, plan_id, password_hash, dni_frente_url, dni_dorso_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [nombre, email.toLowerCase().trim(), telefono || null, dni || null,
       direccion || null, barrio || null, ciudad || null, plan_id || null, password_hash,
       dni_frente_url, dni_dorso_url]
    );
    const cliente = rows[0];

    // Create connection work order
    try {
      await query(
        `INSERT INTO ordenes_trabajo (cliente_id, tipo, descripcion, prioridad)
         VALUES ($1, 'conexion', 'Conexión generada automáticamente por inscripción', 'normal')`,
        [cliente.id]
      );
    } catch (err) {
      console.error('Error creando orden de conexión:', err.message);
    }

    await query('UPDATE clientes SET sesion_activa = TRUE, updated_at = NOW() WHERE id = $1', [cliente.id]);
    await query('INSERT INTO sesiones_clientes (cliente_id) VALUES ($1)', [cliente.id]);

    // Issue JWT for client portal
    const token = jwt.sign(
      { id: cliente.id, email: cliente.email, rol: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email },
    });
  } catch (err) { next(err); }
};

// POST /public/login-cliente
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email y contraseña requeridos' });

    const { rows } = await query('SELECT * FROM clientes WHERE email = $1', [email.toLowerCase().trim()]);
    const cliente = rows[0];

    if (!cliente || !cliente.password_hash) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }
    if (!(await bcrypt.compare(password, cliente.password_hash))) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    await query('UPDATE clientes SET sesion_activa = TRUE, updated_at = NOW() WHERE id = $1', [cliente.id]);
    await query('INSERT INTO sesiones_clientes (cliente_id) VALUES ($1)', [cliente.id]);

    const token = jwt.sign(
      { id: cliente.id, email: cliente.email, rol: 'cliente' },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      cliente: { id: cliente.id, nombre: cliente.nombre, email: cliente.email },
    });
  } catch (err) { next(err); }
};

// POST /cliente/logout
const logout = async (req, res, next) => {
  try {
    await query('UPDATE clientes SET sesion_activa = FALSE, updated_at = NOW() WHERE id = $1', [req.clienteId]);
    await query(
      `UPDATE sesiones_clientes
       SET fin = NOW(), duracion_seg = EXTRACT(EPOCH FROM (NOW() - inicio))::INTEGER
       WHERE cliente_id = $1 AND fin IS NULL
       ORDER BY inicio DESC
       LIMIT 1`,
      [req.clienteId]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /cliente/me — client portal data
const me = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT c.id, c.nombre, c.email, c.telefono, c.dni, c.direccion, c.barrio, c.ciudad,
              c.estado, c.fecha_alta, c.contrato_listo,
              p.nombre AS plan_nombre, p.velocidad_down, p.velocidad_up, p.precio_mensual
       FROM clientes c
       LEFT JOIN planes p ON c.plan_id = p.id
       WHERE c.id = $1`,
      [req.clienteId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows: conexRows } = await query(
      'SELECT ip_asignada, tecnologia, estado, ultimo_ping FROM conexiones WHERE cliente_id = $1',
      [req.clienteId]
    );

    const { rows: ordenRows } = await query(
      `SELECT id, tipo, estado, prioridad, created_at, fecha_programada, fecha_completada
       FROM ordenes_trabajo WHERE cliente_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [req.clienteId]
    );

    res.json({ ...rows[0], conexion: conexRows[0] || null, ordenes: ordenRows });
  } catch (err) { next(err); }
};

// PUT /cliente/password — change own password
const cambiarPassword = async (req, res, next) => {
  try {
    const { password_actual, password_nueva } = req.body;
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }
    if (password_nueva.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const { rows } = await query('SELECT password_hash FROM clientes WHERE id = $1', [req.clienteId]);
    if (!rows[0] || !rows[0].password_hash) {
      return res.status(400).json({ error: 'Esta cuenta no tiene contraseña configurada' });
    }
    if (!(await bcrypt.compare(password_actual, rows[0].password_hash))) {
      return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hash = await bcrypt.hash(password_nueva, 10);
    await query('UPDATE clientes SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.clienteId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// GET /cliente/contrato — download PDF only if contrato_listo
const descargarContrato = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT contrato_listo FROM clientes WHERE id = $1', [req.clienteId]);
    if (!rows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });
    if (!rows[0].contrato_listo) {
      return res.status(403).json({ error: 'El contrato aún no está disponible. Se habilitará una vez que el técnico complete la instalación.' });
    }

    const buffer = await generarPDF(req.clienteId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato_${req.clienteId}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { registro, login, logout, me, descargarContrato, cambiarPassword };
