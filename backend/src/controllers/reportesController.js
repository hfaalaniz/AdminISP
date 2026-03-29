const { query } = require('../config/database');

// GET /api/reportes/financiero
const financiero = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const d = desde || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const h = hasta || new Date().toISOString().split('T')[0];

    const [ingresosMes, porEstado, porPlan, morosos] = await Promise.all([
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', fecha_pago), 'YYYY-MM') AS mes,
          COUNT(*) AS cantidad,
          SUM(monto) AS total
        FROM facturas
        WHERE estado_pago = 'pagado'
          AND fecha_pago BETWEEN $1 AND $2
        GROUP BY mes ORDER BY mes
      `, [d, h]),

      query(`
        SELECT estado_pago, COUNT(*) AS cantidad, COALESCE(SUM(monto), 0) AS total
        FROM facturas
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY estado_pago
      `, [d, h]),

      query(`
        SELECT p.nombre AS plan, COUNT(f.id) AS cantidad, COALESCE(SUM(f.monto), 0) AS total
        FROM facturas f
        LEFT JOIN planes p ON f.plan_id = p.id
        WHERE f.estado_pago = 'pagado' AND f.fecha_pago BETWEEN $1 AND $2
        GROUP BY p.nombre ORDER BY total DESC
      `, [d, h]),

      query(`
        SELECT c.id, c.nombre, c.email, c.telefono,
          COUNT(f.id) AS facturas_vencidas,
          COALESCE(SUM(f.monto), 0) AS deuda_total
        FROM clientes c
        JOIN facturas f ON f.cliente_id = c.id
        WHERE f.estado_pago = 'vencido'
        GROUP BY c.id, c.nombre, c.email, c.telefono
        ORDER BY deuda_total DESC
        LIMIT 50
      `),
    ]);

    res.json({
      ingresos_por_mes: ingresosMes.rows,
      por_estado: porEstado.rows,
      por_plan: porPlan.rows,
      morosos: morosos.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reportes/clientes
const clientes = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const d = desde || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const h = hasta || new Date().toISOString().split('T')[0];

    const [altasPorMes, porEstado, porPlan, conDeuda] = await Promise.all([
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', fecha_alta), 'YYYY-MM') AS mes,
          COUNT(*) AS altas
        FROM clientes
        WHERE fecha_alta BETWEEN $1 AND $2
        GROUP BY mes ORDER BY mes
      `, [d, h]),

      query(`
        SELECT estado, COUNT(*) AS cantidad
        FROM clientes
        GROUP BY estado ORDER BY cantidad DESC
      `),

      query(`
        SELECT p.nombre AS plan, COUNT(c.id) AS cantidad
        FROM clientes c
        LEFT JOIN planes p ON c.plan_id = p.id
        GROUP BY p.nombre ORDER BY cantidad DESC
      `),

      query(`
        SELECT c.id, c.nombre, c.email, c.estado,
          COUNT(f.id) AS facturas_pendientes,
          COALESCE(SUM(f.monto), 0) AS deuda
        FROM clientes c
        JOIN facturas f ON f.cliente_id = c.id
        WHERE f.estado_pago IN ('pendiente', 'vencido')
        GROUP BY c.id, c.nombre, c.email, c.estado
        HAVING COUNT(f.id) > 0
        ORDER BY deuda DESC
        LIMIT 50
      `),
    ]);

    res.json({
      altas_por_mes: altasPorMes.rows,
      por_estado: porEstado.rows,
      por_plan: porPlan.rows,
      con_deuda: conDeuda.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reportes/ordenes
const ordenes = async (req, res) => {
  try {
    const { desde, hasta } = req.query;
    const d = desde || new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString().split('T')[0];
    const h = hasta || new Date().toISOString().split('T')[0];

    const [porMes, porEstado, porTipo, porTecnico, tiempoPromedio] = await Promise.all([
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS mes,
          COUNT(*) AS cantidad
        FROM ordenes_trabajo
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY mes ORDER BY mes
      `, [d, h]),

      query(`
        SELECT estado, COUNT(*) AS cantidad
        FROM ordenes_trabajo
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY estado
      `, [d, h]),

      query(`
        SELECT tipo, COUNT(*) AS cantidad
        FROM ordenes_trabajo
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY tipo ORDER BY cantidad DESC
      `, [d, h]),

      query(`
        SELECT
          u.nombre AS tecnico,
          COUNT(o.id) AS total,
          COUNT(o.id) FILTER (WHERE o.estado = 'completada') AS completadas,
          COUNT(o.id) FILTER (WHERE o.estado = 'pendiente') AS pendientes,
          COUNT(o.id) FILTER (WHERE o.estado = 'en_curso') AS en_curso
        FROM ordenes_trabajo o
        LEFT JOIN usuarios u ON o.tecnico_id = u.id
        WHERE o.created_at BETWEEN $1 AND $2
        GROUP BY u.nombre ORDER BY total DESC
      `, [d, h]),

      query(`
        SELECT
          ROUND(AVG(EXTRACT(EPOCH FROM (fecha_completada - created_at)) / 3600)::numeric, 1) AS horas_promedio
        FROM ordenes_trabajo
        WHERE estado = 'completada'
          AND fecha_completada IS NOT NULL
          AND created_at BETWEEN $1 AND $2
      `, [d, h]),
    ]);

    res.json({
      por_mes: porMes.rows,
      por_estado: porEstado.rows,
      por_tipo: porTipo.rows,
      por_tecnico: porTecnico.rows,
      tiempo_promedio_horas: tiempoPromedio.rows[0]?.horas_promedio ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reportes/red
const red = async (req, res) => {
  try {
    const [porEstado, porTecnologia, sinConexion, ultimaActividad] = await Promise.all([
      query(`
        SELECT estado, COUNT(*) AS cantidad
        FROM conexiones
        GROUP BY estado ORDER BY cantidad DESC
      `),

      query(`
        SELECT tecnologia, COUNT(*) AS cantidad
        FROM conexiones
        GROUP BY tecnologia ORDER BY cantidad DESC
      `),

      query(`
        SELECT c.id, c.nombre, c.email, c.estado, p.nombre AS plan
        FROM clientes c
        LEFT JOIN conexiones con ON con.cliente_id = c.id
        LEFT JOIN planes p ON c.plan_id = p.id
        WHERE con.id IS NULL AND c.estado = 'activo'
        ORDER BY c.nombre
        LIMIT 50
      `),

      query(`
        SELECT
          con.estado,
          COUNT(*) FILTER (WHERE con.ultimo_ping > NOW() - INTERVAL '1 hour') AS activos_1h,
          COUNT(*) FILTER (WHERE con.ultimo_ping > NOW() - INTERVAL '24 hours') AS activos_24h,
          COUNT(*) FILTER (WHERE con.ultimo_ping <= NOW() - INTERVAL '24 hours' OR con.ultimo_ping IS NULL) AS sin_actividad
        FROM conexiones con
        GROUP BY con.estado
      `),
    ]);

    res.json({
      por_estado: porEstado.rows,
      por_tecnologia: porTecnologia.rows,
      clientes_sin_conexion: sinConexion.rows,
      actividad: ultimaActividad.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/reportes/listados
const listados = async (req, res) => {
  try {
    const { tipo } = req.query;

    if (tipo === 'clientes') {
      const r = await query(`
        SELECT c.id, c.nombre, c.email, c.telefono, c.dni, c.direccion, c.barrio, c.ciudad,
          c.estado, c.fecha_alta, p.nombre AS plan,
          COALESCE(con.estado, 'sin conexion') AS conexion,
          con.ip_asignada, con.tecnologia
        FROM clientes c
        LEFT JOIN planes p ON c.plan_id = p.id
        LEFT JOIN conexiones con ON con.cliente_id = c.id
        ORDER BY c.nombre
      `);
      return res.json(r.rows);
    }

    if (tipo === 'conexiones') {
      const r = await query(`
        SELECT c.nombre AS cliente, c.email, c.estado AS estado_cliente,
          con.ip_asignada, con.mac_address, con.puerto_olt, con.tecnologia,
          con.estado AS estado_conexion, con.velocidad_real, con.ultimo_ping, con.observaciones
        FROM conexiones con
        JOIN clientes c ON con.cliente_id = c.id
        ORDER BY c.nombre
      `);
      return res.json(r.rows);
    }

    if (tipo === 'pagos') {
      const r = await query(`
        SELECT f.id, c.nombre AS cliente, c.email, p.nombre AS plan,
          f.periodo, f.monto, f.estado_pago, f.fecha_vencimiento,
          f.fecha_pago, f.metodo_pago, f.tipo
        FROM facturas f
        JOIN clientes c ON f.cliente_id = c.id
        LEFT JOIN planes p ON f.plan_id = p.id
        ORDER BY f.fecha_vencimiento DESC
        LIMIT 1000
      `);
      return res.json(r.rows);
    }

    if (tipo === 'morosos') {
      const r = await query(`
        SELECT c.id, c.nombre, c.email, c.telefono, c.estado,
          COUNT(f.id) AS facturas_vencidas,
          COALESCE(SUM(f.monto), 0) AS deuda_total,
          MIN(f.fecha_vencimiento) AS primera_deuda
        FROM clientes c
        JOIN facturas f ON f.cliente_id = c.id
        WHERE f.estado_pago = 'vencido'
        GROUP BY c.id, c.nombre, c.email, c.telefono, c.estado
        ORDER BY deuda_total DESC
      `);
      return res.json(r.rows);
    }

    if (tipo === 'ordenes') {
      const r = await query(`
        SELECT o.id, c.nombre AS cliente, u.nombre AS tecnico,
          o.tipo, o.estado, o.prioridad, o.descripcion,
          o.fecha_programada, o.fecha_completada, o.created_at
        FROM ordenes_trabajo o
        JOIN clientes c ON o.cliente_id = c.id
        LEFT JOIN usuarios u ON o.tecnico_id = u.id
        ORDER BY o.created_at DESC
        LIMIT 1000
      `);
      return res.json(r.rows);
    }

    if (tipo === 'usuarios') {
      const r = await query(`
        SELECT id, nombre, email, rol, activo, created_at
        FROM usuarios
        ORDER BY nombre
      `);
      return res.json(r.rows);
    }

    res.status(400).json({ error: 'Tipo de listado no válido' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { financiero, clientes, ordenes, red, listados };
