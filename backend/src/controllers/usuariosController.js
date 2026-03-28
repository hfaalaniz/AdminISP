const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, nombre, email, rol, activo, created_at FROM usuarios ORDER BY created_at DESC'
    );
    res.json(rows);
  } catch (err) { next(err); }
};

const listarTecnicos = async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, nombre, email FROM usuarios WHERE rol = 'tecnico' AND activo = TRUE ORDER BY nombre"
    );
    res.json(rows);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, email, password, rol } = req.body;
    if (!nombre || !email || !password || !rol) {
      return res.status(400).json({ error: 'Nombre, email, contraseña y rol son requeridos' });
    }
    const roles = ['admin', 'operador', 'tecnico'];
    if (!roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await query(
      `INSERT INTO usuarios (nombre, email, password_hash, rol)
       VALUES ($1,$2,$3,$4) RETURNING id, nombre, email, rol, activo, created_at`,
      [nombre, email.toLowerCase().trim(), hash, rol]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { nombre, email, rol } = req.body;
    const fields = [];
    const params = [];
    if (nombre) { params.push(nombre); fields.push(`nombre = $${params.length}`); }
    if (email)  { params.push(email.toLowerCase().trim()); fields.push(`email = $${params.length}`); }
    if (rol) {
      const roles = ['admin', 'operador', 'tecnico'];
      if (!roles.includes(rol)) return res.status(400).json({ error: 'Rol inválido' });
      params.push(rol); fields.push(`rol = $${params.length}`);
    }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE usuarios SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}
       RETURNING id, nombre, email, rol, activo, created_at`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const cambiarEstado = async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puede desactivarse a sí mismo' });
    }
    const { activo } = req.body;
    if (typeof activo !== 'boolean') return res.status(400).json({ error: 'Campo activo requerido (boolean)' });
    const { rows } = await query(
      'UPDATE usuarios SET activo = $1, updated_at = NOW() WHERE id = $2 RETURNING id, nombre, email, rol, activo',
      [activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { new_password } = req.body;
    if (!new_password) return res.status(400).json({ error: 'Nueva contraseña requerida' });
    const hash = await bcrypt.hash(new_password, 10);
    const { rows } = await query(
      'UPDATE usuarios SET password_hash = $1, updated_at = NOW() WHERE id = $2 RETURNING id',
      [hash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ message: 'Contraseña actualizada' });
  } catch (err) { next(err); }
};

module.exports = { listar, listarTecnicos, crear, actualizar, cambiarEstado, resetPassword };
