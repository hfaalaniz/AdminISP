const { query } = require('../config/database');
const { audit } = require('../middleware/monitor');

const listar = async (req, res, next) => {
  try {
    const { estado = '', search = '', page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (estado) {
      params.push(estado);
      conditions.push(`cn.estado = $${params.length}`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(cl.nombre ILIKE $${params.length} OR cn.ip_asignada ILIKE $${params.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(
      `SELECT COUNT(*) FROM conexiones cn JOIN clientes cl ON cn.cliente_id = cl.id ${where}`,
      params
    );

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT cn.*, cl.nombre AS cliente_nombre, cl.estado AS cliente_estado
       FROM conexiones cn
       JOIN clientes cl ON cn.cliente_id = cl.id
       ${where}
       ORDER BY cn.updated_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rows,
      total: Number(countRes.rows[0].count),
      page: Number(page),
      totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

const obtenerPorCliente = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM conexiones WHERE cliente_id = $1', [req.params.cliente_id]);
    if (!rows[0]) return res.status(404).json({ error: 'Conexión no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const upsert = async (req, res, next) => {
  try {
    const { cliente_id } = req.params;
    const { ip_asignada, mac_address, puerto_olt, tecnologia, estado, velocidad_real, observaciones } = req.body;

    const { rows } = await query(
      `INSERT INTO conexiones (cliente_id, ip_asignada, mac_address, puerto_olt, tecnologia, estado, velocidad_real, observaciones, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
       ON CONFLICT (cliente_id) DO UPDATE SET
         ip_asignada = EXCLUDED.ip_asignada,
         mac_address = EXCLUDED.mac_address,
         puerto_olt = EXCLUDED.puerto_olt,
         tecnologia = EXCLUDED.tecnologia,
         estado = EXCLUDED.estado,
         velocidad_real = EXCLUDED.velocidad_real,
         observaciones = EXCLUDED.observaciones,
         updated_at = NOW()
       RETURNING *`,
      [cliente_id, ip_asignada || null, mac_address || null, puerto_olt || null,
       tecnologia || 'fibra', estado || 'conectado', velocidad_real || null, observaciones || null]
    );
    audit(req, 'upsert', 'conexion', Number(cliente_id), { estado: estado || 'conectado', ip_asignada: ip_asignada || null });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtenerPorCliente, upsert };
