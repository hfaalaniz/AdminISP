const jwt = require('jsonwebtoken');
const { query } = require('../config/database');

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

const requireRole = (role) => (req, res, next) => {
  if (req.user?.rol !== role) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

const requireAnyRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.rol)) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
};

const clienteAuthMiddleware = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.rol !== 'cliente') return res.status(403).json({ error: 'Acceso denegado' });
    req.clienteId = payload.id;
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

// checkPermiso(modulo, accion) — verifica contra la tabla permisos_roles
const checkPermiso = (modulo, accion) => async (req, res, next) => {
  // admin siempre pasa (los permisos de admin son inmutables en la práctica)
  if (req.user?.rol === 'admin') return next();
  try {
    const { rows } = await query(
      'SELECT habilitado FROM permisos_roles WHERE rol = $1 AND modulo = $2 AND accion = $3',
      [req.user?.rol, modulo, accion]
    );
    if (rows.length && rows[0].habilitado) return next();
    return res.status(403).json({ error: 'Permiso denegado' });
  } catch {
    return res.status(500).json({ error: 'Error verificando permisos' });
  }
};

module.exports = { authMiddleware, requireRole, requireAnyRole, clienteAuthMiddleware, checkPermiso };
