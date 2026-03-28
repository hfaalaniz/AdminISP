const path = require('path');
const fs = require('fs');
const { query } = require('../config/database');

const verificarAcceso = async (parteId, user) => {
  const { rows } = await query(
    `SELECT pt.*, ot.tecnico_id FROM partes_tecnicos pt
     JOIN ordenes_trabajo ot ON pt.orden_id = ot.id WHERE pt.id = $1`,
    [parteId]
  );
  if (!rows[0]) return { error: 'Parte no encontrado', status: 404 };
  if (user.rol === 'tecnico' && Number(rows[0].tecnico_id) !== Number(user.id)) {
    return { error: 'Acceso denegado', status: 403 };
  }
  return { parte: rows[0] };
};

const crear = async (req, res, next) => {
  try {
    const { ordenId } = req.params;

    // Check orden exists and user has access
    const { rows: ordenRows } = await query('SELECT * FROM ordenes_trabajo WHERE id = $1', [ordenId]);
    if (!ordenRows[0]) return res.status(404).json({ error: 'Orden no encontrada' });
    const orden = ordenRows[0];

    if (req.user.rol === 'tecnico' && Number(orden.tecnico_id) !== Number(req.user.id)) {
      return res.status(403).json({ error: 'Acceso denegado' });
    }

    // Check no parte exists
    const { rows: existing } = await query('SELECT id FROM partes_tecnicos WHERE orden_id = $1', [ordenId]);
    if (existing.length) return res.status(409).json({ error: 'Ya existe un parte para esta orden' });

    const { trabajo_realizado, equipos_instalados, observaciones, estado_conexion_resultante, fecha_trabajo } = req.body;
    const { rows } = await query(
      `INSERT INTO partes_tecnicos (orden_id, tecnico_id, trabajo_realizado, equipos_instalados, observaciones, estado_conexion_resultante, fecha_trabajo)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [ordenId, req.user.id,
       trabajo_realizado || null,
       JSON.stringify(equipos_instalados || []),
       observaciones || null,
       estado_conexion_resultante || null,
       fecha_trabajo || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
};

const actualizar = async (req, res, next) => {
  try {
    const { error, status, parte } = await verificarAcceso(req.params.id, req.user);
    if (error) return res.status(status).json({ error });
    if (parte.locked && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'El parte está bloqueado. Solo el admin puede editarlo.' });
    }

    const fields = ['trabajo_realizado', 'observaciones', 'estado_conexion_resultante', 'fecha_trabajo'];
    const updates = [];
    const params = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        params.push(req.body[f] || null);
        updates.push(`${f} = $${params.length}`);
      }
    });
    if (req.body.equipos_instalados !== undefined) {
      params.push(JSON.stringify(req.body.equipos_instalados));
      updates.push(`equipos_instalados = $${params.length}`);
    }
    if (!updates.length) return res.status(400).json({ error: 'Nada que actualizar' });
    params.push(req.params.id);
    const { rows } = await query(
      `UPDATE partes_tecnicos SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING *`,
      params
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const submit = async (req, res, next) => {
  try {
    const { error, status, parte } = await verificarAcceso(req.params.id, req.user);
    if (error) return res.status(status).json({ error });
    if (parte.locked) return res.status(400).json({ error: 'El parte ya fue enviado' });

    const { rows } = await query(
      'UPDATE partes_tecnicos SET locked = TRUE, submitted_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    // Transition orden to completada
    await query(
      `UPDATE ordenes_trabajo SET estado = 'completada', fecha_completada = NOW(), updated_at = NOW()
       WHERE id = $1 AND estado != 'completada'`,
      [parte.orden_id]
    );

    // Mark contract as ready for client download
    const { rows: ordenRows } = await query('SELECT cliente_id FROM ordenes_trabajo WHERE id = $1', [parte.orden_id]);
    if (ordenRows[0]) {
      await query(
        'UPDATE clientes SET contrato_listo = TRUE, updated_at = NOW() WHERE id = $1',
        [ordenRows[0].cliente_id]
      );
    }

    res.json(rows[0]);
  } catch (err) { next(err); }
};

const unlock = async (req, res, next) => {
  try {
    if (req.user.rol !== 'admin') return res.status(403).json({ error: 'Solo el admin puede desbloquear partes' });
    const { rows } = await query(
      'UPDATE partes_tecnicos SET locked = FALSE, submitted_at = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Parte no encontrado' });
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const subirImagenes = async (req, res, next) => {
  try {
    const { error, status, parte } = await verificarAcceso(req.params.id, req.user);
    if (error) return res.status(status).json({ error });
    if (parte.locked && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'El parte está bloqueado' });
    }

    const imagenes = parte.imagenes || [];
    if (imagenes.length + req.files.length > 10) {
      // Remove uploaded files
      req.files.forEach((f) => fs.unlinkSync(f.path));
      return res.status(400).json({ error: `Máximo 10 imágenes. Ya tiene ${imagenes.length}.` });
    }

    const nuevas = req.files.map((f) => ({
      filename: f.filename,
      url: `/uploads/${f.filename}`,
      originalname: f.originalname,
      size: f.size,
    }));

    const actualizadas = [...imagenes, ...nuevas];
    const { rows } = await query(
      'UPDATE partes_tecnicos SET imagenes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [JSON.stringify(actualizadas), req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
};

const eliminarImagen = async (req, res, next) => {
  try {
    const { error, status, parte } = await verificarAcceso(req.params.id, req.user);
    if (error) return res.status(status).json({ error });
    if (parte.locked && req.user.rol !== 'admin') {
      return res.status(403).json({ error: 'El parte está bloqueado' });
    }

    const { filename } = req.params;
    const imagenes = (parte.imagenes || []).filter((img) => img.filename !== filename);

    // Delete file from disk
    const filePath = path.join(__dirname, '../../uploads', filename);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    const { rows } = await query(
      'UPDATE partes_tecnicos SET imagenes = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [JSON.stringify(imagenes), req.params.id]
    );
    res.json(rows[0]);
  } catch (err) { next(err); }
};

module.exports = { crear, actualizar, submit, unlock, subirImagenes, eliminarImagen };
