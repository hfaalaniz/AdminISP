const { query } = require('../config/database');

const listar = async (req, res, next) => {
  try {
    const soloActivas = req.query.activa === 'true';
    const planId      = req.query.plan_id ? Number(req.query.plan_id) : null;

    const conditions = [];
    if (soloActivas) {
      conditions.push('activa = TRUE');
      // Vigencia: solo las que están dentro del rango o sin rango definido
      conditions.push(`(fecha_inicio IS NULL OR fecha_inicio <= CURRENT_DATE)`);
      conditions.push(`(fecha_fin   IS NULL OR fecha_fin   >= CURRENT_DATE)`);
    }
    if (planId) {
      // plan_ids vacío = aplica a todos; si tiene elementos, el plan debe estar incluido
      conditions.push(`(array_length(plan_ids, 1) IS NULL OR plan_ids = '{}' OR $1 = ANY(plan_ids))`);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const params = planId ? [planId] : [];
    const { rows } = await query(
      `SELECT * FROM ofertas_instalacion ${where} ORDER BY orden ASC, id ASC`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
};

const _params = (b) => [
  b.nombre,
  b.descripcion || null,
  b.tipo,
  Number(b.precio_total) || 0,
  b.precio_original ? Number(b.precio_original) : null,
  Number(b.cuotas) || 1,
  b.activa !== false,
  Number(b.orden) || 0,
  b.destacada === true,
  b.badge_texto || null,
  b.fecha_inicio || null,
  b.fecha_fin    || null,
  Array.isArray(b.plan_ids) ? b.plan_ids.map(Number) : [],
];

const crear = async (req, res, next) => {
  try {
    const { nombre, tipo } = req.body;
    if (!nombre) return res.status(400).json({ error: 'Nombre requerido' });
    if (!['gratis', 'precio_fijo', 'cuotas'].includes(tipo))
      return res.status(400).json({ error: 'Tipo inválido' });

    const { rows } = await query(
      `INSERT INTO ofertas_instalacion
         (nombre, descripcion, tipo, precio_total, precio_original, cuotas,
          activa, orden, destacada, badge_texto, fecha_inicio, fecha_fin, plan_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      _params(req.body)
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE ofertas_instalacion
       SET nombre=$1, descripcion=$2, tipo=$3, precio_total=$4, precio_original=$5, cuotas=$6,
           activa=$7, orden=$8, destacada=$9, badge_texto=$10,
           fecha_inicio=$11, fecha_fin=$12, plan_ids=$13, updated_at=NOW()
       WHERE id=$14 RETURNING *`,
      [..._params(req.body), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const eliminar = async (req, res, next) => {
  try {
    const { rows } = await query(
      'DELETE FROM ofertas_instalacion WHERE id=$1 RETURNING id',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Oferta no encontrada' });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

module.exports = { listar, crear, actualizar, eliminar };
