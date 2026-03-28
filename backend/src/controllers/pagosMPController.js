const { MercadoPagoConfig, Preference, Payment } = require('mercadopago');
const { query } = require('../config/database');
const { _reactivarSiPagado } = require('./facturasController');

const getMPClient = () => {
  if (!process.env.MP_ACCESS_TOKEN) throw new Error('MP_ACCESS_TOKEN no configurado');
  return new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
};

// POST /cliente/pagar/:facturaId — creates MP preference, returns checkout URL
const iniciarPago = async (req, res, next) => {
  try {
    const { facturaId } = req.params;

    const { rows } = await query(
      `SELECT f.*, c.nombre AS cliente_nombre, c.email AS cliente_email
       FROM facturas f JOIN clientes c ON f.cliente_id = c.id
       WHERE f.id = $1 AND f.cliente_id = $2`,
      [facturaId, req.clienteId]
    );
    const factura = rows[0];
    if (!factura) return res.status(404).json({ error: 'Factura no encontrada' });
    if (factura.estado_pago === 'pagado') return res.status(400).json({ error: 'La factura ya fue pagada' });

    const client = getMPClient();
    const preference = new Preference(client);

    const baseUrl = process.env.CLIENT_URL || 'http://localhost:5177';

    const result = await preference.create({
      body: {
        items: [{
          id: String(factura.id),
          title: `Servicio de internet — ${factura.periodo}`,
          quantity: 1,
          unit_price: Number(factura.monto),
          currency_id: 'ARS',
        }],
        payer: {
          name: factura.cliente_nombre,
          email: factura.cliente_email || undefined,
        },
        back_urls: {
          success: `${baseUrl}?pago=success&factura=${factura.id}`,
          failure: `${baseUrl}?pago=failure&factura=${factura.id}`,
          pending: `${baseUrl}?pago=pending&factura=${factura.id}`,
        },
        auto_return: 'approved',
        external_reference: String(factura.id),
        statement_descriptor: 'Servicio Internet',
      },
    });

    res.json({ init_point: result.init_point, preference_id: result.id });
  } catch (err) {
    if (err.message === 'MP_ACCESS_TOKEN no configurado') {
      return res.status(503).json({ error: 'Pago online no disponible. Contactá al proveedor.' });
    }
    next(err);
  }
};

// POST /public/mp-webhook — receives MP payment notification
const webhook = async (req, res) => {
  try {
    const { type, data } = req.body;

    if (type !== 'payment' || !data?.id) return res.sendStatus(200);

    const client = getMPClient();
    const paymentClient = new Payment(client);
    const payment = await paymentClient.get({ id: data.id });

    if (payment.status !== 'approved') return res.sendStatus(200);

    const facturaId = payment.external_reference;
    if (!facturaId) return res.sendStatus(200);

    const { rows } = await query(
      `UPDATE facturas SET
         estado_pago = 'pagado',
         fecha_pago = NOW(),
         metodo_pago = 'mercadopago',
         referencia_pago = $1,
         updated_at = NOW()
       WHERE id = $2 AND estado_pago != 'pagado'
       RETURNING cliente_id`,
      [String(payment.id), facturaId]
    );

    if (rows[0]) await _reactivarSiPagado(rows[0].cliente_id);

    res.sendStatus(200);
  } catch (err) {
    console.error('MP webhook error:', err.message);
    res.sendStatus(200); // always 200 to avoid MP retries
  }
};

// GET /cliente/facturas — client's invoice history
const listarFacturasCliente = async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT f.id, f.periodo, f.monto, f.estado_pago, f.fecha_vencimiento, f.fecha_pago, f.metodo_pago
       FROM facturas f
       WHERE f.cliente_id = $1
       ORDER BY f.periodo DESC
       LIMIT 24`,
      [req.clienteId]
    );
    res.json(rows);
  } catch (err) { next(err); }
};

module.exports = { iniciarPago, webhook, listarFacturasCliente };
