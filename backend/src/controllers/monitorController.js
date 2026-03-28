const { query } = require('../config/database');

// ── Request logs ──────────────────────────────────────────────────────────────
const getRequestLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status = '', path = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (status) { params.push(Number(status)); conditions.push(`status = $${params.length}`); }
    if (path)   { params.push(`%${path}%`);    conditions.push(`path ILIKE $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM request_logs ${where}`, params);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT id, method, path, status, duration_ms, user_id, user_rol, ip, created_at
       FROM request_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: rows, total: Number(countRes.rows[0].count), page: Number(page), totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)) });
  } catch (err) { next(err); }
};

// ── Error logs ────────────────────────────────────────────────────────────────
const getErrorLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, source = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const params = [];
    let where = '';
    if (source) { params.push(source); where = `WHERE source = $1`; }

    const countRes = await query(`SELECT COUNT(*) FROM error_logs ${where}`, params);
    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT id, source, level, message, stack, path, method, user_id, user_rol, context, created_at
       FROM error_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: rows, total: Number(countRes.rows[0].count), page: Number(page), totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)) });
  } catch (err) { next(err); }
};

// POST — recibe errores desde el frontend
const reportFrontendError = async (req, res, next) => {
  try {
    const { level = 'error', message, stack, path, context } = req.body;
    if (!message) return res.status(400).json({ error: 'message requerido' });
    const user_id  = req.user?.id  ?? null;
    const user_rol = req.user?.rol ?? null;
    await query(
      `INSERT INTO error_logs (source, level, message, stack, path, user_id, user_rol, context)
       VALUES ('frontend',$1,$2,$3,$4,$5,$6,$7)`,
      [level, message.slice(0, 1000), (stack || '').slice(0, 4000),
       (path || '').slice(0, 255), user_id, user_rol,
       context ? JSON.stringify(context) : null]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ── Audit logs ────────────────────────────────────────────────────────────────
const getAuditLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, entity = '', user_id = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (entity)  { params.push(entity);        conditions.push(`entity = $${params.length}`); }
    if (user_id) { params.push(Number(user_id)); conditions.push(`user_id = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM audit_logs ${where}`, params);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT id, action, entity, entity_id, user_id, user_nombre, user_rol, detail, ip, created_at
       FROM audit_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({ data: rows, total: Number(countRes.rows[0].count), page: Number(page), totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)) });
  } catch (err) { next(err); }
};

// ── Performance logs ──────────────────────────────────────────────────────────
const getPerformanceLogs = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, source = '', metric = '' } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (source) { params.push(source); conditions.push(`source = $${params.length}`); }
    if (metric) { params.push(metric); conditions.push(`metric = $${params.length}`); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM performance_logs ${where}`, params);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT id, source, metric, value, path, context, created_at
       FROM performance_logs ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    // Aggregated stats
    const { rows: stats } = await query(`
      SELECT metric, source,
             ROUND(AVG(value)::numeric, 1) AS avg,
             ROUND(MAX(value)::numeric, 1) AS max,
             COUNT(*) AS count
      FROM performance_logs
      WHERE created_at > NOW() - INTERVAL '24 hours'
      GROUP BY metric, source
      ORDER BY metric
    `);

    res.json({ data: rows, stats, total: Number(countRes.rows[0].count), page: Number(page), totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)) });
  } catch (err) { next(err); }
};

// POST — recibe Web Vitals desde el frontend
const reportVitals = async (req, res, next) => {
  try {
    const { metric, value, path, context } = req.body;
    if (!metric || value == null) return res.status(400).json({ error: 'metric y value requeridos' });
    await query(
      `INSERT INTO performance_logs (source, metric, value, path, context)
       VALUES ('frontend',$1,$2,$3,$4)`,
      [metric.slice(0, 50), Number(value), (path || '').slice(0, 255),
       context ? JSON.stringify(context) : null]
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ── Dashboard summary ─────────────────────────────────────────────────────────
const getSummary = async (req, res, next) => {
  try {
    const [reqStats, errStats, slowStats, vitalsStats] = await Promise.all([
      // Request stats last 24h
      query(`
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END) AS errors_5xx,
          SUM(CASE WHEN status >= 400 AND status < 500 THEN 1 ELSE 0 END) AS errors_4xx,
          ROUND(AVG(duration_ms)::numeric, 1) AS avg_ms,
          ROUND(MAX(duration_ms)::numeric, 1) AS max_ms
        FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours'
      `),
      // Error count by source last 24h
      query(`
        SELECT source, COUNT(*) AS count
        FROM error_logs WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY source
      `),
      // Top slow endpoints last 24h
      query(`
        SELECT path, method, ROUND(AVG(duration_ms)::numeric,1) AS avg_ms, COUNT(*) AS calls
        FROM request_logs WHERE created_at > NOW() - INTERVAL '24 hours'
        GROUP BY path, method ORDER BY avg_ms DESC LIMIT 5
      `),
      // Web Vitals averages last 24h
      query(`
        SELECT metric, ROUND(AVG(value)::numeric,1) AS avg
        FROM performance_logs WHERE source = 'frontend' AND created_at > NOW() - INTERVAL '24 hours'
        GROUP BY metric
      `),
    ]);

    res.json({
      requests: reqStats.rows[0],
      errors:   errStats.rows,
      slow_endpoints: slowStats.rows,
      vitals:   vitalsStats.rows,
    });
  } catch (err) { next(err); }
};

module.exports = { getRequestLogs, getErrorLogs, reportFrontendError, getAuditLogs, getPerformanceLogs, reportVitals, getSummary };
