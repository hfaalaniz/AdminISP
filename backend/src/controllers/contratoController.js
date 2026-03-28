const { query } = require('../config/database');
const pdfService = require('../services/pdfService');

const generarPDF = async (clienteId) => {
  const [{ rows: cRows }, { rows: ispRows }, { rows: eqRows }, { rows: parteRows }] = await Promise.all([
    query(`SELECT c.*, p.nombre AS plan_nombre, p.velocidad_down, p.velocidad_up, p.precio_mensual
           FROM clientes c LEFT JOIN planes p ON c.plan_id = p.id WHERE c.id = $1`, [clienteId]),
    query('SELECT * FROM configuracion_isp WHERE id = 1'),
    query('SELECT * FROM equipos WHERE activo = TRUE ORDER BY id ASC'),
    query(`SELECT pt.equipos_instalados FROM partes_tecnicos pt
           JOIN ordenes_trabajo ot ON pt.orden_id = ot.id
           WHERE ot.cliente_id = $1 AND pt.locked = TRUE
           ORDER BY pt.submitted_at DESC LIMIT 1`, [clienteId]),
  ]);

  const cliente = cRows[0];
  if (!cliente) throw new Error('Cliente no encontrado');

  const isp = ispRows[0] || { nombre_empresa: 'AdminISP', localidad: 'Villa Santa Cruz del Lago', provincia: 'Córdoba' };
  const plan = cliente.plan_id ? {
    nombre: cliente.plan_nombre,
    velocidad_down: cliente.velocidad_down,
    velocidad_up: cliente.velocidad_up,
    precio_mensual: cliente.precio_mensual,
  } : null;

  // Use installed equipment from submitted parte if available, otherwise fall back to catalog
  let equipos = eqRows;
  if (parteRows[0]?.equipos_instalados?.length > 0) {
    equipos = parteRows[0].equipos_instalados;
  }

  return pdfService.generar({ isp, cliente, plan, equipos });
};

const descargar = async (req, res, next) => {
  try {
    const buffer = await generarPDF(Number(req.params.id));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contrato_${req.params.id}.pdf"`);
    res.send(buffer);
  } catch (err) { next(err); }
};

module.exports = { generarPDF, descargar };
