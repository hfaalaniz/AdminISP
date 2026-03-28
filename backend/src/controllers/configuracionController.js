const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');

const obtener = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM configuracion_isp WHERE id = 1');
    res.json(rows[0] || {});
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const fields = ['nombre_empresa', 'cuit', 'domicilio', 'telefono', 'email', 'localidad', 'provincia'];
    const updates = [];
    const params = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f] || null);
        updates.push(`${f} = $${params.length}`);
      }
    });
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    const { rows } = await query(
      `UPDATE configuracion_isp SET ${updates.join(', ')}, updated_at = NOW() WHERE id = 1 RETURNING *`,
      params
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const subirLogo = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    // Delete old logo if exists
    const { rows } = await query('SELECT logo_url FROM configuracion_isp WHERE id = 1');
    const oldLogoUrl = rows[0]?.logo_url;
    if (oldLogoUrl) {
      const oldFile = path.join(__dirname, '../../uploads', path.basename(oldLogoUrl));
      if (fs.existsSync(oldFile)) fs.unlinkSync(oldFile);
    }

    const logo_url = `/uploads/${req.file.filename}`;
    const { rows: updated } = await query(
      'UPDATE configuracion_isp SET logo_url = $1, updated_at = NOW() WHERE id = 1 RETURNING *',
      [logo_url]
    );
    res.json(updated[0]);
  } catch (err) { next(err); }
};

const eliminarLogo = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT logo_url FROM configuracion_isp WHERE id = 1');
    const logoUrl = rows[0]?.logo_url;
    if (logoUrl) {
      const file = path.join(__dirname, '../../uploads', path.basename(logoUrl));
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    const { rows: updated } = await query(
      'UPDATE configuracion_isp SET logo_url = NULL, updated_at = NOW() WHERE id = 1 RETURNING *'
    );
    res.json(updated[0]);
  } catch (err) { next(err); }
};

module.exports = { obtener, actualizar, subirLogo, eliminarLogo };
