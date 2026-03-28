const { query } = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM equipos ORDER BY id ASC');
    res.json(rows);
  } catch (err) { next(err); }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, marca, modelo, descripcion } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    const { rows } = await query(
      'INSERT INTO equipos (nombre, marca, modelo, descripcion) VALUES ($1,$2,$3,$4) RETURNING *',
      [nombre, marca || null, modelo || null, descripcion || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const fields = ['nombre', 'marca', 'modelo', 'descripcion', 'activo'];
    const updates = [];
    const params = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f]);
        updates.push(`${f} = $${params.length}`);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE equipos SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM equipos WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Equipo no encontrado' });
    res.json({ message: 'Equipo eliminado' });
  } catch (err) { next(err); }
};

module.exports = { listar, crear, actualizar, eliminar };
