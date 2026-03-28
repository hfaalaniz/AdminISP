const { query } = require('../config/database');

const stats = async (req, res, next) => {
  try {
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const { rows } = await query(
      `WITH
        clientes_stats AS (
          SELECT
            COUNT(*) AS total_clientes,
            COUNT(*) FILTER (WHERE estado = 'activo') AS clientes_activos,
            COUNT(*) FILTER (WHERE estado = 'suspendido') AS clientes_suspendidos
          FROM clientes
        ),
        conexion_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE estado = 'conectado') AS conexiones_ok,
            COUNT(*) FILTER (WHERE estado = 'con_problemas') AS conexiones_problema
          FROM conexiones
        ),
        factura_stats AS (
          SELECT
            COUNT(*) FILTER (WHERE estado_pago = 'pendiente') AS facturas_pendientes,
            COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'pendiente'), 0) AS monto_pendiente,
            COALESCE(SUM(monto) FILTER (WHERE estado_pago = 'pagado' AND periodo = $1), 0) AS monto_cobrado_mes
          FROM facturas
        )
      SELECT * FROM clientes_stats, conexion_stats, factura_stats`,
      [periodo]
    );

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

module.exports = { stats };
