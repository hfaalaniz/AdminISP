const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');

const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

const fechaLarga = (d) => {
  const dt = new Date(d);
  return `${dt.getDate()} de ${MESES[dt.getMonth()]} de ${dt.getFullYear()}`;
};

const generar = ({ isp, cliente, plan, equipos }) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const buffers = [];
    doc.on('data', (b) => buffers.push(b));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // ancho útil
    const nroContrato = `${new Date().getFullYear()}-${String(cliente.id).padStart(5, '0')}`;
    const fechaHoy = fechaLarga(new Date());

    // ── ENCABEZADO ────────────────────────────────────────────────────
    // Logo
    let logoDrawn = false;
    if (isp.logo_url) {
      const logoFile = path.join(__dirname, '../../uploads', path.basename(isp.logo_url));
      if (fs.existsSync(logoFile)) {
        try {
          doc.image(logoFile, 50, 45, { width: 80, height: 60, fit: [80, 60], align: 'center', valign: 'center' });
          logoDrawn = true;
        } catch (_) { /* fall through to placeholder */ }
      }
    }
    if (!logoDrawn) {
      doc.rect(50, 45, 80, 60).dash(3, { space: 3 }).stroke('#aaaaaa').undash();
      doc.font('Helvetica').fontSize(8).fillColor('#aaaaaa')
        .text('Logo', 50, 71, { width: 80, align: 'center' });
    }

    // Datos ISP
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#1a1a2e')
      .text(isp.nombre_empresa, 145, 45);
    doc.font('Helvetica').fontSize(8).fillColor('#444444');
    if (isp.cuit)      doc.text(`CUIT: ${isp.cuit}`, 145, 62);
    if (isp.domicilio) doc.text(`Domicilio: ${isp.domicilio}`, 145, 72);
    if (isp.telefono)  doc.text(`Tel: ${isp.telefono}`, 145, 82);
    if (isp.email)     doc.text(`Email: ${isp.email}`, 145, 92);
    doc.text(`${isp.localidad}, ${isp.provincia}`, 145, 102);

    // Línea separadora
    doc.moveTo(50, 115).lineTo(545, 115).lineWidth(1).strokeColor('#1a1a2e').stroke();

    // ── TÍTULO ────────────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#1a1a2e')
      .text('CONTRATO DE PRESTACIÓN DE SERVICIOS DE INTERNET', 50, 125, { align: 'center', width: W });
    doc.font('Helvetica').fontSize(9).fillColor('#555555')
      .text(`N° ${nroContrato}  —  Fecha: ${fechaHoy}`, 50, 142, { align: 'center', width: W });

    doc.moveTo(50, 158).lineTo(545, 158).lineWidth(0.5).strokeColor('#cccccc').stroke();

    // ── SECCIÓN 1: DATOS DEL CLIENTE ──────────────────────────────────
    let y = 168;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('1. DATOS DEL CLIENTE', 50, y);
    y += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor('#222222');

    const fila2col = (label1, val1, label2, val2, yy) => {
      doc.font('Helvetica-Bold').text(label1, 50, yy, { continued: true })
        .font('Helvetica').text(` ${val1 || '—'}`, { continued: false });
      if (label2) {
        doc.font('Helvetica-Bold').text(label2, 300, yy, { continued: true })
          .font('Helvetica').text(` ${val2 || '—'}`, { continued: false });
      }
    };

    fila2col('Nombre:', cliente.nombre, 'DNI:', cliente.dni, y); y += 13;
    fila2col('Dirección:', cliente.direccion, 'Barrio:', cliente.barrio, y); y += 13;
    fila2col('Ciudad:', cliente.ciudad, 'Teléfono:', cliente.telefono, y); y += 13;
    fila2col('Email:', cliente.email, '', '', y); y += 8;

    doc.moveTo(50, y + 8).lineTo(545, y + 8).lineWidth(0.5).strokeColor('#cccccc').stroke();
    y += 18;

    // ── SECCIÓN 2: SERVICIO CONTRATADO ────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('2. SERVICIO CONTRATADO', 50, y);
    y += 14;
    doc.font('Helvetica').fontSize(8.5).fillColor('#222222');
    fila2col('Plan:', plan ? plan.nombre : '—', 'Precio mensual:', plan ? `$${Number(plan.precio_mensual).toLocaleString('es-AR')}` : '—', y); y += 13;
    if (plan) {
      fila2col('Velocidad bajada:', `${plan.velocidad_down} Mbps`, 'Velocidad subida:', `${plan.velocidad_up} Mbps`, y); y += 13;
    }
    fila2col('Fecha de alta:', fechaLarga(cliente.fecha_alta || new Date()), '', '', y); y += 8;

    doc.moveTo(50, y + 8).lineTo(545, y + 8).lineWidth(0.5).strokeColor('#cccccc').stroke();
    y += 18;

    // ── SECCIÓN 3: EQUIPOS EN COMODATO ───────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('3. EQUIPOS ENTREGADOS EN COMODATO', 50, y);
    y += 12;

    // Cabecera tabla
    const cols = [160, 110, 110, 115];
    const headers = ['Equipo', 'Marca', 'Modelo', 'N° de Serie'];
    let x = 50;
    doc.rect(50, y, W, 16).fill('#1a1a2e');
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#ffffff');
    headers.forEach((h, i) => {
      doc.text(h, x + 4, y + 4, { width: cols[i] - 8 });
      x += cols[i];
    });
    y += 16;

    // Filas
    equipos.forEach((eq, idx) => {
      const bg = idx % 2 === 0 ? '#f7f8fa' : '#ffffff';
      doc.rect(50, y, W, 15).fill(bg);
      doc.font('Helvetica').fontSize(8).fillColor('#222222');
      x = 50;
      [eq.nombre, eq.marca || '—', eq.modelo || '—', eq.nro_serie || '___________________'].forEach((val, i) => {
        doc.text(val, x + 4, y + 4, { width: cols[i] - 8 });
        x += cols[i];
      });
      y += 15;
    });

    // Borde tabla
    doc.rect(50, y - (equipos.length * 15 + 16), W, equipos.length * 15 + 16)
      .lineWidth(0.5).strokeColor('#cccccc').stroke();

    y += 6;
    const tieneSeriales = equipos.some((eq) => eq.nro_serie);
    if (!tieneSeriales) {
      doc.font('Helvetica').fontSize(7.5).fillColor('#777777')
        .text('* El número de serie se completa en el momento de la instalación por el técnico habilitado.', 50, y);
      y += 18;
    } else {
      y += 6;
    }

    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
    y += 10;

    // ── SECCIÓN 4: CLÁUSULAS ──────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#1a1a2e').text('4. CLÁUSULAS Y CONDICIONES GENERALES', 50, y);
    y += 12;

    const clausulas = [
      {
        titulo: '1. OBJETO DEL CONTRATO.',
        texto: `${isp.nombre_empresa}, en adelante "EL PRESTADOR", y el/la Sr./Sra. identificado/a precedentemente, en adelante "EL ABONADO", acuerdan la prestación del servicio de acceso a Internet bajo las modalidades, velocidades y precio estipulados en la cláusula 2, conforme lo establecido por la Ley N° 27.078 (Ley Argentina Digital) y las resoluciones de ENACOM vigentes.`,
      },
      {
        titulo: '2. VIGENCIA Y MODALIDAD.',
        texto: 'El presente contrato tiene vigencia mensual y se renueva automáticamente salvo notificación fehaciente de rescisión con un mínimo de quince (15) días corridos de anticipación. El servicio se presta con carácter personal e intransferible al domicilio indicado por EL ABONADO.',
      },
      {
        titulo: '3. OBLIGACIONES DE PAGO.',
        texto: 'EL ABONADO abonará el precio mensual indicado dentro de los primeros diez (10) días corridos de cada mes. La mora en el pago faculta a EL PRESTADOR a suspender el servicio sin necesidad de interpelación judicial o extrajudicial previa. EL PRESTADOR podrá actualizar el precio del servicio con un preaviso mínimo de treinta (30) días, notificado por correo electrónico o medios equivalentes.',
      },
      {
        titulo: '4. COMODATO DE EQUIPOS.',
        texto: 'Los equipos entregados según el detalle consignado en el presente contrato son entregados en comodato, conservando EL PRESTADOR la propiedad exclusiva de los mismos. EL ABONADO se obliga a: (a) conservar los equipos en buen estado y utilizarlos únicamente para el acceso al servicio contratado; (b) no ceder, transferir ni gravar los equipos; (c) restituir los equipos en perfectas condiciones al momento de rescisión o suspensión definitiva. En caso de daño, robo o extravío atribuible a EL ABONADO, éste deberá abonar el valor de reposición del equipo.',
      },
      {
        titulo: '5. NIVELES DE SERVICIO Y LIMITACIONES.',
        texto: 'EL PRESTADOR garantiza disponibilidad del servicio no inferior al noventa y cinco por ciento (95%) mensual, excluidos mantenimientos programados. Las velocidades contratadas son velocidades de referencia sujetas a condiciones técnicas de la red. EL PRESTADOR no será responsable por interrupciones causadas por fuerza mayor, fenómenos climáticos extremos, cortes en el suministro eléctrico, o fallas en infraestructura de terceros.',
      },
      {
        titulo: '6. POLÍTICA DE USO ACEPTABLE.',
        texto: 'EL ABONADO se compromete a no utilizar el servicio para actividades que contravengan la legislación argentina vigente, incluyendo distribución de contenido ilegal, ataques informáticos, spam masivo, o cualquier uso que afecte la calidad del servicio para otros usuarios. El incumplimiento de esta cláusula habilitará la rescisión inmediata del contrato sin derecho a reembolso.',
      },
      {
        titulo: '7. PROTECCIÓN DE DATOS PERSONALES.',
        texto: `Los datos personales recabados serán tratados conforme a la Ley N° 25.326 de Protección de los Datos Personales, exclusivamente para la gestión del servicio contratado, facturación y comunicaciones relacionadas. EL ABONADO podrá ejercer los derechos de acceso, rectificación y supresión dirigiéndose a ${isp.nombre_empresa} por los canales indicados en el encabezado de este contrato.`,
      },
      {
        titulo: '8. JURISDICCIÓN Y ACEPTACIÓN.',
        texto: `El presente contrato se rige por las leyes de la República Argentina. Para cualquier controversia, las partes se someten a la jurisdicción de los Tribunales Ordinarios de la Provincia de Córdoba, con renuncia expresa a todo otro fuero. La presentación del formulario de inscripción por parte de EL ABONADO, ya sea en forma presencial o a través del sitio web habilitado por EL PRESTADOR, implica la aceptación plena e irrevocable de las presentes condiciones y tiene el mismo valor jurídico que una firma ológrafa, de conformidad con el artículo 288 del Código Civil y Comercial de la Nación Argentina.`,
      },
    ];

    clausulas.forEach((c) => {
      const lineHeight = 11;
      const titleH = 11;
      const bodyH = doc.heightOfString(c.texto, { width: W, lineGap: 1.5 });
      const totalH = titleH + bodyH + 6;

      // Salto de página si no entra
      if (y + totalH > doc.page.height - 120) {
        doc.addPage();
        y = 50;
      }

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#1a1a2e').text(c.titulo, 50, y);
      y += lineHeight;
      doc.font('Helvetica').fontSize(7.8).fillColor('#333333')
        .text(c.texto, 50, y, { width: W, align: 'justify', lineGap: 1.5 });
      y += bodyH + 6;
    });

    // ── FIRMA ─────────────────────────────────────────────────────────
    if (y + 110 > doc.page.height - 50) {
      doc.addPage();
      y = 50;
    }

    y += 10;
    doc.moveTo(50, y).lineTo(545, y).lineWidth(0.5).strokeColor('#cccccc').stroke();
    y += 16;

    doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#1a1a2e')
      .text('CONFORMIDAD DEL ABONADO', 50, y);
    y += 12;
    doc.font('Helvetica').fontSize(8).fillColor('#444444')
      .text('La sola aceptación del presente contrato, ya sea mediante firma ológrafa, envío del formulario digital o manifestación de voluntad por cualquier medio fehaciente, implica conformidad plena con todas las cláusulas aquí establecidas, constituyendo instrumento vinculante entre las partes conforme el art. 288 CCyCN.', 50, y, { width: W, align: 'justify' });
    y += 36;

    // Líneas de firma
    const firmaY = y + 20;
    doc.moveTo(50, firmaY).lineTo(240, firmaY).lineWidth(0.8).strokeColor('#333333').stroke();
    doc.moveTo(305, firmaY).lineTo(545, firmaY).lineWidth(0.8).strokeColor('#333333').stroke();

    doc.font('Helvetica').fontSize(7.5).fillColor('#555555')
      .text('Firma del Abonado', 50, firmaY + 4)
      .text('Aclaración:', 50, firmaY + 14)
      .text('DNI:', 50, firmaY + 24);

    doc.font('Helvetica').fontSize(7.5).fillColor('#555555')
      .text(`${isp.nombre_empresa}`, 305, firmaY + 4)
      .text('Representante autorizado', 305, firmaY + 14);

    doc.font('Helvetica').fontSize(7).fillColor('#aaaaaa')
      .text(`Contrato N° ${nroContrato} — Generado el ${fechaHoy} — ${isp.nombre_empresa} — ${isp.localidad}, ${isp.provincia}`,
        50, doc.page.height - 40, { width: W, align: 'center' });

    doc.end();
  });
};

module.exports = { generar };
