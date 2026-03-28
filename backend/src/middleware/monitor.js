const { query } = require('../config/database');

// ── Request + Performance logger ─────────────────────────────────────────────
const requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration_ms = Date.now() - start;
    const skip = req.path.startsWith('/uploads') || req.path === '/api/monitor/vitals';
    if (skip) return;

    const user_id  = req.user?.id   ?? null;
    const user_rol = req.user?.rol  ?? null;
    const ip       = req.ip || req.socket?.remoteAddress || null;
    const status   = res.statusCode;
    const method   = req.method;
    const path     = req.path.slice(0, 255);
    const ua       = (req.headers['user-agent'] || '').slice(0, 255);

    query(
      `INSERT INTO request_logs (method, path, status, duration_ms, user_id, user_rol, ip, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [method, path, status, duration_ms, user_id, user_rol, ip, ua]
    ).catch(() => null);

    // Backend performance: slow requests > 500ms
    if (duration_ms > 500) {
      query(
        `INSERT INTO performance_logs (source, metric, value, path, context)
         VALUES ('backend','slow_request',$1,$2,$3)`,
        [duration_ms, path, JSON.stringify({ method, status })]
      ).catch(() => null);
    }
  });

  next();
};

// ── Audit helper (llamado desde controllers) ──────────────────────────────────
const audit = (req, action, entity, entity_id, detail = null) => {
  const user_id     = req.user?.id     ?? null;
  const user_nombre = req.user?.nombre ?? req.user?.email ?? null;
  const user_rol    = req.user?.rol    ?? null;
  const ip          = req.ip || req.socket?.remoteAddress || null;

  query(
    `INSERT INTO audit_logs (action, entity, entity_id, user_id, user_nombre, user_rol, detail, ip)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [action, entity, entity_id ?? null, user_id, user_nombre, user_rol,
     detail ? JSON.stringify(detail) : null, ip]
  ).catch(() => null);
};

module.exports = { requestLogger, audit };
