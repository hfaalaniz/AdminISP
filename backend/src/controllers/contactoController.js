const nodemailer = require('nodemailer');
const { query } = require('../config/database');

const enviar = async (req, res, next) => {
  try {
    const { nombre, email, telefono, mensaje } = req.body;
    if (!nombre?.trim() || !mensaje?.trim()) {
      return res.status(400).json({ error: 'Nombre y mensaje son requeridos' });
    }

    const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
    if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
      return res.status(500).json({ error: 'Email no configurado en el servidor' });
    }

    // Obtener datos del ISP para personalizar los correos
    const { rows } = await query('SELECT * FROM configuracion_isp WHERE id = 1');
    const isp = rows[0] || {};
    const empresa = isp.nombre_empresa || 'AdminISP';
    const ispTel = isp.telefono || '';
    const ispEmail = isp.email || GMAIL_USER;
    const ispDomicilio = isp.domicilio || '';
    const ispLocalidad = isp.localidad || '';

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });

    const fecha = new Date().toLocaleString('es-AR', {
      timeZone: 'America/Argentina/Cordoba',
      dateStyle: 'full',
      timeStyle: 'short',
    });

    // ── Correo al ISP ─────────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"Sitio Web ${empresa}" <${GMAIL_USER}>`,
      to: GMAIL_USER,
      replyTo: email || GMAIL_USER,
      subject: `🔔 Nueva consulta de ${nombre}`,
      html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0891b2,#2563eb);padding:32px 36px">
      <p style="margin:0 0 4px;color:rgba(255,255,255,0.7);font-size:13px;text-transform:uppercase;letter-spacing:1px">Nueva consulta web</p>
      <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800">${empresa}</h1>
    </div>

    <!-- Alerta -->
    <div style="background:#ecfdf5;border-left:4px solid #10b981;padding:14px 36px;font-size:14px;color:#065f46">
      📨 &nbsp;Recibiste una nueva consulta desde el sitio web el <strong>${fecha}</strong>
    </div>

    <!-- Datos del contacto -->
    <div style="padding:32px 36px">
      <h2 style="margin:0 0 20px;font-size:16px;color:#1e293b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">Datos del contacto</h2>
      <table style="width:100%;border-collapse:collapse;font-size:15px">
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0;color:#64748b;width:130px;font-weight:500">👤 Nombre</td>
          <td style="padding:12px 0;color:#1e293b;font-weight:700">${nombre}</td>
        </tr>
        ${email ? `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0;color:#64748b;font-weight:500">✉️ Email</td>
          <td style="padding:12px 0;color:#1e293b"><a href="mailto:${email}" style="color:#0891b2;text-decoration:none;font-weight:600">${email}</a></td>
        </tr>` : ''}
        ${telefono ? `
        <tr style="border-bottom:1px solid #f1f5f9">
          <td style="padding:12px 0;color:#64748b;font-weight:500">📞 Teléfono</td>
          <td style="padding:12px 0;color:#1e293b"><a href="tel:${telefono}" style="color:#0891b2;text-decoration:none;font-weight:600">${telefono}</a></td>
        </tr>` : ''}
      </table>
    </div>

    <!-- Mensaje -->
    <div style="padding:0 36px 32px">
      <h2 style="margin:0 0 14px;font-size:16px;color:#1e293b;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">💬 Mensaje</h2>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;font-size:15px;color:#334155;line-height:1.7;white-space:pre-wrap">${mensaje}</div>
    </div>

    <!-- CTA -->
    ${email ? `
    <div style="padding:0 36px 32px;text-align:center">
      <a href="mailto:${email}?subject=Re: Tu consulta a ${empresa}" style="display:inline-block;background:linear-gradient(135deg,#0891b2,#2563eb);color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;text-decoration:none">
        Responder a ${nombre} →
      </a>
    </div>` : ''}

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;font-size:12px;color:#94a3b8">
      Este mensaje fue generado automáticamente por el sitio web de <strong>${empresa}</strong><br/>
      ${ispDomicilio ? ispDomicilio + ' · ' : ''}${ispLocalidad}
    </div>
  </div>
</body>
</html>`,
    });

    // ── Correo de confirmación al cliente ─────────────────────────────────────
    if (email) {
      await transporter.sendMail({
        from: `"${empresa}" <${GMAIL_USER}>`,
        to: email,
        subject: `✅ Recibimos tu consulta, ${nombre}`,
        html: `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:'Segoe UI',Arial,sans-serif">
  <div style="max-width:620px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#0891b2,#2563eb);padding:40px 36px;text-align:center">
      <div style="font-size:48px;margin-bottom:12px">📡</div>
      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:800">${empresa}</h1>
      <p style="margin:8px 0 0;color:rgba(255,255,255,0.8);font-size:15px">Internet de alta velocidad</p>
    </div>

    <!-- Saludo -->
    <div style="padding:36px 36px 24px;text-align:center">
      <h2 style="margin:0 0 12px;font-size:22px;color:#1e293b;font-weight:800">¡Hola, ${nombre}! 👋</h2>
      <p style="margin:0;font-size:16px;color:#475569;line-height:1.6">
        Recibimos tu consulta correctamente.<br/>
        Nuestro equipo se va a comunicar con vos a la brevedad.
      </p>
    </div>

    <!-- Resumen consulta -->
    <div style="margin:0 36px 28px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:20px">
      <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:0.5px">Tu mensaje</p>
      <p style="margin:0;font-size:15px;color:#334155;line-height:1.6;white-space:pre-wrap">${mensaje}</p>
    </div>

    <!-- Por qué elegirnos -->
    <div style="padding:0 36px 32px">
      <h3 style="margin:0 0 16px;font-size:15px;color:#1e293b;font-weight:700">¿Por qué elegir ${empresa}?</h3>
      <table style="width:100%;border-collapse:collapse">
        <tr>
          <td style="padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:14px;color:#334155;width:33%">⚡ <strong>Alta velocidad</strong><br/><span style="color:#64748b;font-size:13px">Fibra óptica simétrica</span></td>
          <td style="width:8px"></td>
          <td style="padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:14px;color:#334155;width:33%">🛡️ <strong>Red estable</strong><br/><span style="color:#64748b;font-size:13px">99.9% disponibilidad</span></td>
          <td style="width:8px"></td>
          <td style="padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:14px;color:#334155;width:33%">🤝 <strong>Soporte local</strong><br/><span style="color:#64748b;font-size:13px">Atención personalizada</span></td>
        </tr>
      </table>
    </div>

    <!-- Contacto directo -->
    <div style="margin:0 36px 32px;background:#fafafa;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center">
      <p style="margin:0 0 12px;font-size:14px;color:#64748b">¿Necesitás respuesta urgente? Contactanos directamente:</p>
      <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap">
        ${ispTel ? `<a href="tel:${ispTel}" style="display:inline-block;background:#0891b2;color:#fff;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">📞 ${ispTel}</a>` : ''}
        ${ispEmail ? `<a href="mailto:${ispEmail}" style="display:inline-block;background:#2563eb;color:#fff;font-weight:700;font-size:14px;padding:10px 20px;border-radius:8px;text-decoration:none">✉️ ${ispEmail}</a>` : ''}
      </div>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 36px;text-align:center;font-size:12px;color:#94a3b8">
      <strong style="color:#64748b">${empresa}</strong> · ${ispDomicilio ? ispDomicilio + ' · ' : ''}${ispLocalidad}<br/>
      <span style="font-size:11px">Este es un correo automático, por favor no lo respondas directamente.</span>
    </div>
  </div>
</body>
</html>`,
      });
    }

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

module.exports = { enviar };
