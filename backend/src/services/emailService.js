const nodemailer = require('nodemailer');

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const fechaLarga = (d) => { const dt = new Date(d); return `${dt.getDate()} de ${MESES[dt.getMonth()]} de ${dt.getFullYear()}`; };

const getTransporter = () => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  });
};

const sendOrdenCompletadaEmail = async ({ cliente, isp, orden, conexion }) => {
  if (!cliente?.email) return;
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠ Email no enviado: GMAIL_USER o GMAIL_APP_PASSWORD no configurados');
    return;
  }

  const fechaCompletada = orden.fecha_completada ? fechaLarga(orden.fecha_completada) : fechaLarga(new Date());
  const planNombre = cliente.plan_nombre || '—';
  const velocidadDown = cliente.velocidad_down || '—';
  const velocidadUp = cliente.velocidad_up || '—';
  const ipAsignada = conexion?.ip_asignada || '—';

  const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:#1a1a2e;padding:28px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:0.5px;">${isp.nombre_empresa}</h1>
            <p style="color:#8888aa;margin:6px 0 0;font-size:13px;">${isp.localidad}, ${isp.provincia}</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">

            <h2 style="color:#1a1a2e;margin:0 0 12px;font-size:20px;">
              🎉 ¡Tu servicio está activo, ${cliente.nombre}!
            </h2>
            <p style="color:#555;line-height:1.7;margin:0 0 20px;">
              Nos complace informarte que la instalación de tu servicio de internet ha sido completada
              con éxito el <strong>${fechaCompletada}</strong>. A partir de este momento podés
              disfrutar de tu conexión de manera inmediata.
            </p>
            <p style="color:#555;line-height:1.7;margin:0 0 24px;">
              Gracias por elegirnos. Es un placer ser parte de tu conectividad y nos comprometemos
              a brindarte el mejor servicio posible.
            </p>

            <!-- Service data box -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;border-left:4px solid #1a1a2e;border-radius:0 6px 6px 0;margin-bottom:24px;">
              <tr><td style="padding:18px 20px;">
                <h3 style="color:#1a1a2e;margin:0 0 14px;font-size:15px;">📋 Datos de tu servicio</h3>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:5px 0;color:#666;font-size:14px;width:40%;">Plan contratado:</td>
                    <td style="padding:5px 0;color:#222;font-size:14px;font-weight:bold;">${planNombre}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#666;font-size:14px;">Velocidad:</td>
                    <td style="padding:5px 0;color:#222;font-size:14px;">${velocidadDown} Mbps bajada / ${velocidadUp} Mbps subida</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#666;font-size:14px;">IP asignada:</td>
                    <td style="padding:5px 0;color:#222;font-size:14px;font-family:monospace;">${ipAsignada}</td>
                  </tr>
                  <tr>
                    <td style="padding:5px 0;color:#666;font-size:14px;">Fecha de activación:</td>
                    <td style="padding:5px 0;color:#222;font-size:14px;">${fechaCompletada}</td>
                  </tr>
                </table>
              </td></tr>
            </table>

            <!-- Service conditions summary -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbf0;border:1px solid #ffe082;border-radius:6px;margin-bottom:24px;">
              <tr><td style="padding:16px 20px;">
                <h3 style="color:#7a5c00;margin:0 0 10px;font-size:14px;">📌 Condiciones del servicio</h3>
                <ul style="color:#555;font-size:13px;line-height:1.8;margin:0;padding-left:18px;">
                  <li>El servicio se factura mensualmente los primeros 10 días de cada mes.</li>
                  <li>Los equipos instalados son propiedad de ${isp.nombre_empresa} entregados en comodato.</li>
                  <li>Ante cualquier problema técnico, comunicate con nosotros de inmediato.</li>
                  <li>La rescisión del servicio requiere aviso con 15 días de anticipación.</li>
                </ul>
              </td></tr>
            </table>

            <!-- Contact -->
            <p style="color:#555;font-size:14px;margin:0 0 8px;"><strong>¿Necesitás ayuda?</strong> Contactanos:</p>
            <table cellpadding="0" cellspacing="0">
              ${isp.telefono ? `<tr><td style="padding:3px 0;color:#555;font-size:14px;">📞 ${isp.telefono}</td></tr>` : ''}
              ${isp.email ? `<tr><td style="padding:3px 0;color:#555;font-size:14px;">✉️ ${isp.email}</td></tr>` : ''}
            </table>

            <p style="color:#555;line-height:1.7;margin:24px 0 0;">
              Nuevamente gracias por confiar en <strong>${isp.nombre_empresa}</strong>.<br>
              ¡Esperamos que disfrutes tu conexión!
            </p>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9f9f9;padding:16px 32px;border-top:1px solid #eee;">
            <p style="font-size:11px;color:#999;margin:0;line-height:1.6;text-align:center;">
              Este mensaje fue generado automáticamente. Los datos personales son tratados conforme a la Ley N° 25.326.<br>
              ${isp.nombre_empresa}${isp.cuit ? ` — CUIT: ${isp.cuit}` : ''} — ${isp.domicilio ? isp.domicilio + ', ' : ''}${isp.localidad}, ${isp.provincia}.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transporter.sendMail({
      from: `"${isp.nombre_empresa}" <${process.env.GMAIL_USER}>`,
      to: cliente.email,
      subject: `✅ Tu servicio de internet está activo — ${isp.nombre_empresa}`,
      html,
    });
    console.log(`✓ Email enviado a ${cliente.email}`);
  } catch (err) {
    console.error(`✗ Error enviando email a ${cliente.email}:`, err.message);
  }
};

const TIPO_CONFIG = {
  corte_programado: { icon: '🔌', color: '#e65100', label: 'Corte programado' },
  suspension:       { icon: '⛔', color: '#c62828', label: 'Suspensión de servicio' },
  problema_red:     { icon: '⚠️', color: '#f57f17', label: 'Problema en la red' },
  mantenimiento:    { icon: '🔧', color: '#1565c0', label: 'Mantenimiento' },
  aviso_pago:       { icon: '💳', color: '#6a1b9a', label: 'Aviso de pago' },
  personalizado:    { icon: '📢', color: '#1a1a2e', label: 'Comunicado' },
};

const sendNotificacion = async ({ destinatarios, titulo, mensaje, tipo, isp }) => {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('⚠ Email no enviado: GMAIL_USER o GMAIL_APP_PASSWORD no configurados');
    return 0;
  }

  const cfg = TIPO_CONFIG[tipo] || TIPO_CONFIG.personalizado;
  let enviados = 0;

  for (const dest of destinatarios) {
    if (!dest.email) continue;
    const html = `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:30px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:#1a1a2e;padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;">${isp.nombre_empresa}</h1>
            <p style="color:#8888aa;margin:6px 0 0;font-size:13px;">${isp.localidad}, ${isp.provincia}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0;">
            <div style="background:${cfg.color};padding:14px 32px;display:flex;align-items:center;gap:12px;">
              <span style="font-size:22px;">${cfg.icon}</span>
              <span style="color:#fff;font-weight:bold;font-size:15px;">${cfg.label}</span>
            </div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="color:#333;font-size:14px;margin:0 0 8px;">Estimado/a <strong>${dest.nombre}</strong>,</p>
            <h2 style="color:#1a1a2e;font-size:18px;margin:0 0 16px;">${titulo}</h2>
            <div style="color:#555;font-size:14px;line-height:1.8;white-space:pre-line;background:#f8f9fa;border-radius:6px;padding:16px 20px;border-left:4px solid ${cfg.color};">${mensaje}</div>
            <p style="color:#888;font-size:12px;margin:24px 0 0;">
              Para consultas comunicate con nosotros:
              ${isp.telefono ? `&nbsp;📞 ${isp.telefono}` : ''}
              ${isp.email ? `&nbsp;✉️ ${isp.email}` : ''}
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:14px 32px;border-top:1px solid #eee;">
            <p style="font-size:11px;color:#aaa;margin:0;text-align:center;">
              ${isp.nombre_empresa}${isp.cuit ? ` — CUIT: ${isp.cuit}` : ''} — ${isp.localidad}, ${isp.provincia}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    try {
      await transporter.sendMail({
        from: `"${isp.nombre_empresa}" <${process.env.GMAIL_USER}>`,
        to: dest.email,
        subject: `${cfg.icon} ${titulo} — ${isp.nombre_empresa}`,
        html,
      });
      enviados++;
    } catch (err) {
      console.error(`✗ Error enviando notificación a ${dest.email}:`, err.message);
    }
  }

  return enviados;
};

module.exports = { sendOrdenCompletadaEmail, sendNotificacion };
