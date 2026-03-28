const { query } = require('../config/database');

const notFound = (req, res) => {
  res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.originalUrl}` });
};

const errorHandler = (err, req, res, next) => {
  console.error(err);

  // Persist to error_logs
  query(
    `INSERT INTO error_logs (source, level, message, stack, path, method, user_id, user_rol)
     VALUES ('backend','error',$1,$2,$3,$4,$5,$6)`,
    [
      (err.message || 'Unknown error').slice(0, 1000),
      (err.stack   || '').slice(0, 4000),
      (req.path    || '').slice(0, 255),
      req.method   || null,
      req.user?.id  ?? null,
      req.user?.rol ?? null,
    ]
  ).catch(() => null);

  // PostgreSQL unique violation
  if (err.code === '23505') {
    const field = err.detail?.match(/\((.+?)\)/)?.[1] || 'campo';
    return res.status(409).json({ error: `Ya existe un registro con ese ${field}` });
  }
  // PostgreSQL foreign key violation
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referencia a registro inexistente' });
  }

  res.status(err.status || 500).json({ error: err.message || 'Error interno del servidor' });
};

module.exports = { notFound, errorHandler };
