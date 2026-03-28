const { query } = require('../config/database');
const { audit } = require('../middleware/monitor');

// Reactivate client if no more overdue invoices remain
const _reactivarSiPagado = async (clienteId) => {
  const { rows } = await query(
    `SELECT id FROM facturas WHERE cliente_id = $1 AND estado_pago = 'vencido' LIMIT 1`,
    [clienteId]
  );
  if (rows.length === 0) {
    await query(
      `UPDATE clientes SET estado = 'activo', updated_at = NOW()
       WHERE id = $1 AND estado = 'suspendido'`,
      [clienteId]
    );
  }
};

const listar = async (req, res, next) => {
  try {
    const { estado_pago = '', cliente_id = '', periodo = '', page = 1, limit = 25 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    const conditions = [];
    const params = [];

    if (estado_pago) {
      params.push(estado_pago);
      conditions.push(`f.estado_pago = $${params.length}`);
    }
    if (cliente_id) {
      params.push(Number(cliente_id));
      conditions.push(`f.cliente_id = $${params.length}`);
    }
    if (periodo) {
      params.push(periodo);
      conditions.push(`f.periodo = $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countRes = await query(`SELECT COUNT(*) FROM facturas f ${where}`, params);

    params.push(Number(limit), offset);
    const { rows } = await query(
      `SELECT f.*, c.nombre AS cliente_nombre, p.nombre AS plan_nombre
       FROM facturas f
       JOIN clientes c ON f.cliente_id = c.id
       LEFT JOIN planes p ON f.plan_id = p.id
       ${where}
       ORDER BY f.periodo DESC, f.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      data: rows,
      total: Number(countRes.rows[0].count),
      page: Number(page),
      totalPages: Math.ceil(Number(countRes.rows[0].count) / Number(limit)),
    });
  } catch (err) {
    next(err);
  }
};

const obtener = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT f.*, c.nombre AS cliente_nombre FROM facturas f
       JOIN clientes c ON f.cliente_id = c.id WHERE f.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const crear = async (req, res, next) => {
  try {
    const { cliente_id, periodo, monto, fecha_vencimiento, notas } = req.body;
    if (!cliente_id || !periodo || !monto || !fecha_vencimiento) {
      return res.status(400).json({ error: 'Campos requeridos: cliente_id, periodo, monto, fecha_vencimiento' });
    }

    // Get client's current plan
    const { rows: clientRows } = await query('SELECT plan_id FROM clientes WHERE id = $1', [cliente_id]);
    if (!clientRows[0]) return res.status(404).json({ error: 'Cliente no encontrado' });

    const { rows } = await query(
      `INSERT INTO facturas (cliente_id, plan_id, periodo, monto, fecha_vencimiento, notas)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [cliente_id, clientRows[0].plan_id, periodo, monto, fecha_vencimiento, notas || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const registrarPago = async (req, res, next) => {
  try {
    const { metodo_pago, referencia_pago } = req.body;
    if (!metodo_pago) return res.status(400).json({ error: 'Método de pago requerido' });

    const { rows } = await query(
      `UPDATE facturas SET
         estado_pago = 'pagado', fecha_pago = NOW(),
         metodo_pago = $1, referencia_pago = $2, updated_at = NOW()
       WHERE id = $3 RETURNING *`,
      [metodo_pago, referencia_pago || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Factura no encontrada' });

    audit(req, 'registrar_pago', 'factura', rows[0].id, { cliente_id: rows[0].cliente_id, monto: rows[0].monto, metodo_pago });
    await _reactivarSiPagado(rows[0].cliente_id);
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
};

const generarMensual = async (req, res, next) => {
  try {
    const { count, periodo } = await _generarMensualInterno();
    res.json({ message: `${count} facturas generadas para ${periodo}`, count });
  } catch (err) {
    next(err);
  }
};

// Generates a single invoice for a specific client for the current month
const generarParaCliente = async (req, res, next) => {
  try {
    const { clienteId } = req.params;
    const now = new Date();
    const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const fecha_vencimiento = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

    const { rows: clientRows } = await query(
      `SELECT c.id, c.plan_id, p.precio_mensual
       FROM clientes c JOIN planes p ON c.plan_id = p.id
       WHERE c.id = $1 AND c.estado = 'activo'`,
      [clienteId]
    );
    if (!clientRows[0]) return res.status(400).json({ error: 'Cliente no encontrado o sin plan activo' });

    const existing = await query(
      'SELECT id FROM facturas WHERE cliente_id = $1 AND periodo = $2',
      [clienteId, periodo]
    );
    if (existing.rows[0]) return res.status(409).json({ error: `Ya existe una factura para ${periodo}` });

    const { rows } = await query(
      `INSERT INTO facturas (cliente_id, plan_id, periodo, monto, fecha_vencimiento)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [clienteId, clientRows[0].plan_id, periodo, clientRows[0].precio_mensual, fecha_vencimiento]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
};

// Internal function — used by both the API endpoint and the auto-scheduler
const _generarMensualInterno = async () => {
  const now = new Date();
  const periodo = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const fecha_vencimiento = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-15`;

  // Mark overdue invoices and suspend clients who haven't paid
  await query(
    `UPDATE facturas SET estado_pago = 'vencido', updated_at = NOW()
     WHERE estado_pago = 'pendiente' AND fecha_vencimiento < CURRENT_DATE`
  );
  await query(
    `UPDATE clientes SET estado = 'suspendido', updated_at = NOW()
     WHERE estado = 'activo'
       AND id IN (
         SELECT DISTINCT cliente_id FROM facturas
         WHERE estado_pago = 'vencido'
       )`
  );

  // Insert missing invoices for all active clients with a plan
  const { rows } = await query(
    `INSERT INTO facturas (cliente_id, plan_id, periodo, monto, fecha_vencimiento)
     SELECT c.id, c.plan_id, $1, p.precio_mensual, $2
     FROM clientes c
     JOIN planes p ON c.plan_id = p.id
     WHERE c.estado = 'activo'
       AND NOT EXISTS (
         SELECT 1 FROM facturas f WHERE f.cliente_id = c.id AND f.periodo = $1
       )
     RETURNING id`,
    [periodo, fecha_vencimiento]
  );

  return { count: rows.length, periodo };
};

// Auto-scheduler: runs on startup and on the 1st of each month at 06:00
const iniciarScheduler = () => {
  const ejecutar = async () => {
    try {
      const { count, periodo } = await _generarMensualInterno();
      if (count > 0) console.log(`✓ Auto-facturación: ${count} facturas generadas para ${periodo}`);
    } catch (err) {
      console.error('Error en auto-facturación:', err.message);
    }
  };

  // Run on startup (generates if missing for current month)
  ejecutar();

  // Schedule for 1st of each month at 06:00
  const programarSiguiente = () => {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1, 6, 0, 0, 0);
    const ms = next.getTime() - now.getTime();
    setTimeout(() => { ejecutar(); programarSiguiente(); }, ms);
  };
  programarSiguiente();
};

module.exports = { listar, obtener, crear, registrarPago, generarMensual, generarParaCliente, iniciarScheduler, _reactivarSiPagado };
