const { query } = require('../config/database');
const { sendNotificacion } = require('../services/emailService');

// POST /notificaciones — create and send
const enviar = async (req, res, next) => {
  try {
    const { tipo, titulo, mensaje, destinatarios, cliente_id } = req.body;
    if (!tipo || !titulo || !mensaje || !destinatarios) {
      return res.status(400).json({ error: 'tipo, titulo, mensaje y destinatarios son requeridos' });
    }
    if (destinatarios === 'cliente' && !cliente_id) {
      return res.status(400).json({ error: 'cliente_id requerido para destino individual' });
    }

    const { rows: ispRows } = await query('SELECT * FROM configuracion_isp WHERE id = 1');
    const isp = ispRows[0] || { nombre_empresa: 'AdminISP', localidad: '', provincia: '' };

    // Determine recipient list
    let clientesQuery;
    if (destinatarios === 'todos') {
      clientesQuery = await query('SELECT id, nombre, email FROM clientes WHERE email IS NOT NULL');
    } else if (destinatarios === 'activos') {
      clientesQuery = await query("SELECT id, nombre, email FROM clientes WHERE estado = 'activo' AND email IS NOT NULL");
    } else if (destinatarios === 'suspendidos') {
      clientesQuery = await query("SELECT id, nombre, email FROM clientes WHERE estado = 'suspendido' AND email IS NOT NULL");
    } else {
      clientesQuery = await query('SELECT id, nombre, email FROM clientes WHERE id = $1 AND email IS NOT NULL', [cliente_id]);
    }

    const listaDestinos = clientesQuery.rows;

    // Save notification to DB
    const { rows } = await query(
      `INSERT INTO notificaciones (tipo, titulo, mensaje, destinatarios, cliente_id, enviado_por)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [tipo, titulo, mensaje, destinatarios, cliente_id || null, req.user.id]
    );
    const notif = rows[0];

    // Send emails async (fire and forget count)
    const enviados = await sendNotificacion({ destinatarios: listaDestinos, titulo, mensaje, tipo, isp });

    await query('UPDATE notificaciones SET emails_enviados = $1 WHERE id = $2', [enviados, notif.id]);

    res.status(201).json({ ...notif, emails_enviados: enviados, total_destinatarios: listaDestinos.length });
  } catch (err) { next(err); }
};

// GET /notificaciones — list all (admin)
const listar = async (req, res, next) => {
  try {
    const { page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const countRes = await query('SELECT COUNT(*) FROM notificaciones');
    const { rows } = await query(
      `SELECT n.*, u.nombre AS enviado_por_nombre, c.nombre AS cliente_nombre
       FROM notificaciones n
       LEFT JOIN usuarios u ON n.enviado_por = u.id
       LEFT JOIN clientes c ON n.cliente_id = c.id
       ORDER BY n.created_at DESC
       LIMIT $1 OFFSET $2`,
      [Number(limit), offset]
    );

    res.json({
      data: rows,
      total: Number(countRes.rows[0].count),
      page: Number(page),
      totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)),
    });
  } catch (err) { next(err); }
};

// DELETE /notificaciones/:id
const eliminar = async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM notificaciones WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Notificación no encontrada' });
    res.json({ message: 'Eliminada' });
  } catch (err) { next(err); }
};

// GET /cliente/notificaciones — notifications for this client
const listarParaCliente = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT n.id, n.tipo, n.titulo, n.mensaje, n.created_at,
              (SELECT leida_at FROM notificaciones_leidas nl WHERE nl.notificacion_id = n.id AND nl.cliente_id = $1) AS leida_at
       FROM notificaciones n
       WHERE n.destinatarios IN ('todos','activos','suspendidos')
          OR (n.destinatarios = 'cliente' AND n.cliente_id = $1)
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [req.clienteId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

// POST /cliente/notificaciones/:id/leer
const marcarLeida = async (req, res, next) => {
  try {
    await query(
      `INSERT INTO notificaciones_leidas (cliente_id, notificacion_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.clienteId, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { enviar, listar, eliminar, listarParaCliente, marcarLeida };
