const { query } = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const { activo } = req.query;
    const where = activo === 'true' ? 'WHERE activo = TRUE' : '';
    const { rows } = await query(`SELECT * FROM planes ${where} ORDER BY precio_mensual ASC`);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM planes WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { nombre, velocidad_down, velocidad_up, precio_mensual, descripcion } = req.body;
    if (!nombre || !velocidad_down || !velocidad_up || !precio_mensual) {
      return res.status(400).json({ error: 'Campos requeridos: nombre, velocidad_down, velocidad_up, precio_mensual' });
    }
    const { rows } = await query(
      `INSERT INTO planes (nombre, velocidad_down, velocidad_up, precio_mensual, descripcion)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [nombre, velocidad_down, velocidad_up, precio_mensual, descripcion || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const actualizar = async (req, res, next) => {
  try {
    const fields = ['nombre', 'velocidad_down', 'velocidad_up', 'precio_mensual', 'descripcion', 'activo'];
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
      `UPDATE planes SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const eliminar = async (req, res, next) => {
  try {
    // Soft delete if any client references this plan
    const { rows: refs } = await query('SELECT 1 FROM clientes WHERE plan_id = $1 LIMIT 1', [req.params.id]);
    if (refs.length) {
      const { rows } = await query('UPDATE planes SET activo = FALSE, updated_at = NOW() WHERE id = $1 RETURNING *', [req.params.id]);
      return res.json({ ...rows[0], message: 'Plan desactivado (tiene clientes asociados)' });
    }
    const { rows } = await query('DELETE FROM planes WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Plan no encontrado' });
    res.json({ message: 'Plan eliminado' });
  } catch (err) {
    next(err);
  }
};

module.exports = { listar, obtener, crear, actualizar, eliminar };
