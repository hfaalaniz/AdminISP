import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PRIMARY = [41, 98, 255] as const;
const DARK = [17, 24, 39] as const;
const SURFACE = [31, 41, 55] as const;
const TEXT = [255, 255, 255] as const;
const MUTED = [156, 163, 175] as const;
const GREEN = [16, 185, 129] as const;
const RED = [239, 68, 68] as const;
const YELLOW = [245, 158, 11] as const;

const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('es-AR');

// ── helpers ───────────────────────────────────────────────────────────────────

function initDoc(title: string, desde: string, hasta: string) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(...DARK);
  doc.rect(0, 0, W, 297, 'F');

  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, W, 18, 'F');

  doc.setTextColor(...TEXT);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('AdminISP', 10, 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(title, W / 2, 12, { align: 'center' });
  doc.text(`${fmtDate(desde)} — ${fmtDate(hasta)}`, W - 10, 12, { align: 'right' });

  return { doc, y: 26, W };
}

function sectionTitle(doc: jsPDF, text: string, y: number, W: number): number {
  doc.setFillColor(...SURFACE);
  doc.roundedRect(10, y, W - 20, 8, 2, 2, 'F');
  doc.setTextColor(...PRIMARY);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(text, 14, y + 5.5);
  return y + 12;
}

function kpiRow(doc: jsPDF, items: { label: string; value: string; color?: readonly [number,number,number] }[], y: number, W: number): number {
  const colW = (W - 20) / items.length;
  items.forEach((item, i) => {
    const x = 10 + i * colW;
    doc.setFillColor(...SURFACE);
    doc.roundedRect(x + 1, y, colW - 2, 16, 2, 2, 'F');
    doc.setTextColor(...(item.color ?? MUTED));
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x + (colW - 2) / 2 + 1, y + 5, { align: 'center' });
    doc.setTextColor(...TEXT);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(String(item.value), x + (colW - 2) / 2 + 1, y + 13, { align: 'center' });
  });
  return y + 20;
}

function table(
  doc: jsPDF,
  headers: string[],
  rows: (string | number)[][],
  y: number,
  W: number,
  colWidths?: number[]
): number {
  const margin = 10;
  const tableW = W - margin * 2;
  const cw = colWidths ?? headers.map(() => tableW / headers.length);

  // Header row
  doc.setFillColor(...PRIMARY);
  doc.rect(margin, y, tableW, 7, 'F');
  doc.setTextColor(...TEXT);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  let xOff = margin + 2;
  headers.forEach((h, i) => {
    doc.text(h, xOff, y + 5);
    xOff += cw[i];
  });
  y += 7;

  rows.forEach((row, ri) => {
    // Page break check
    if (y > 270) {
      doc.addPage();
      doc.setFillColor(...DARK);
      doc.rect(0, 0, W, 297, 'F');
      y = 15;
    }

    doc.setFillColor(ri % 2 === 0 ? 31 : 37, ri % 2 === 0 ? 41 : 47, ri % 2 === 0 ? 55 : 63);
    doc.rect(margin, y, tableW, 6.5, 'F');
    doc.setTextColor(...TEXT);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    xOff = margin + 2;
    row.forEach((cell, i) => {
      doc.text(String(cell ?? '—'), xOff, y + 4.5);
      xOff += cw[i];
    });
    y += 6.5;
  });

  return y + 4;
}

async function captureChart(elementId: string): Promise<string | null> {
  const el = document.getElementById(elementId);
  if (!el) return null;
  try {
    const canvas = await html2canvas(el, {
      backgroundColor: '#1f2937',
      scale: 2,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}

async function addChart(doc: jsPDF, imgData: string | null, y: number, W: number, h = 55): Promise<number> {
  if (!imgData) return y;
  doc.setFillColor(...SURFACE);
  doc.roundedRect(10, y, W - 20, h, 2, 2, 'F');
  doc.addImage(imgData, 'PNG', 12, y + 1, W - 24, h - 2);
  return y + h + 4;
}

// ── PDF Generators ────────────────────────────────────────────────────────────

export async function exportFinancieroPDF(data: any, desde: string, hasta: string) {
  const { doc, W } = initDoc('Reporte Financiero', desde, hasta);
  let y = 26;

  const pagado = data.por_estado.find((e: any) => e.estado_pago === 'pagado');
  const pendiente = data.por_estado.find((e: any) => e.estado_pago === 'pendiente');
  const vencido = data.por_estado.find((e: any) => e.estado_pago === 'vencido');

  y = kpiRow(doc, [
    { label: 'Total recaudado', value: fmt(pagado?.total ?? 0), color: GREEN },
    { label: 'Facturas pagadas', value: pagado?.cantidad ?? 0, color: GREEN },
    { label: 'Facturas pendientes', value: pendiente?.cantidad ?? 0, color: YELLOW },
    { label: 'Facturas vencidas', value: vencido?.cantidad ?? 0, color: RED },
  ], y, W);

  // Chart ingresos por mes
  const chartImg = await captureChart('chart-financiero-ingresos');
  y = sectionTitle(doc, 'Ingresos por mes', y, W);
  y = await addChart(doc, chartImg, y, W, 60);

  // Tabla ingresos por mes
  y = sectionTitle(doc, 'Detalle ingresos por mes', y, W);
  y = table(doc,
    ['Mes', 'Facturas', 'Total'],
    data.ingresos_por_mes.map((r: any) => [r.mes, r.cantidad, fmt(r.total)]),
    y, W, [60, 60, 70]
  );

  // Tabla por plan
  if (data.por_plan.length > 0) {
    y = sectionTitle(doc, 'Ingresos por plan', y, W);
    y = table(doc,
      ['Plan', 'Facturas', 'Total'],
      data.por_plan.map((r: any) => [r.plan ?? 'Sin plan', r.cantidad, fmt(r.total)]),
      y, W, [80, 40, 70]
    );
  }

  // Tabla morosos
  if (data.morosos.length > 0) {
    y = sectionTitle(doc, 'Clientes morosos', y, W);
    y = table(doc,
      ['Cliente', 'Email', 'Teléfono', 'Fact. vencidas', 'Deuda total'],
      data.morosos.map((r: any) => [r.nombre, r.email ?? '—', r.telefono ?? '—', r.facturas_vencidas, fmt(r.deuda_total)]),
      y, W, [45, 50, 30, 25, 30]
    );
  }

  footer(doc, W);
  doc.save(`reporte_financiero_${desde}_${hasta}.pdf`);
}

export async function exportClientesPDF(data: any, desde: string, hasta: string) {
  const { doc, W } = initDoc('Reporte de Clientes', desde, hasta);
  let y = 26;

  const total = data.por_estado.reduce((s: number, e: any) => s + Number(e.cantidad), 0);
  const activos = data.por_estado.find((e: any) => e.estado === 'activo');
  const suspendidos = data.por_estado.find((e: any) => e.estado === 'suspendido');

  y = kpiRow(doc, [
    { label: 'Total clientes', value: total, color: PRIMARY },
    { label: 'Activos', value: activos?.cantidad ?? 0, color: GREEN },
    { label: 'Suspendidos', value: suspendidos?.cantidad ?? 0, color: YELLOW },
    { label: 'Con deuda', value: data.con_deuda.length, color: RED },
  ], y, W);

  const chartImg = await captureChart('chart-clientes-altas');
  y = sectionTitle(doc, 'Altas por mes', y, W);
  y = await addChart(doc, chartImg, y, W, 60);

  y = sectionTitle(doc, 'Altas por mes (detalle)', y, W);
  y = table(doc,
    ['Mes', 'Nuevos clientes'],
    data.altas_por_mes.map((r: any) => [r.mes, r.altas]),
    y, W, [100, 90]
  );

  y = sectionTitle(doc, 'Distribución por plan', y, W);
  y = table(doc,
    ['Plan', 'Clientes'],
    data.por_plan.map((r: any) => [r.plan ?? 'Sin plan', r.cantidad]),
    y, W, [120, 70]
  );

  if (data.con_deuda.length > 0) {
    y = sectionTitle(doc, 'Clientes con deuda', y, W);
    y = table(doc,
      ['Cliente', 'Email', 'Estado', 'Facturas', 'Deuda'],
      data.con_deuda.map((r: any) => [r.nombre, r.email ?? '—', r.estado, r.facturas_pendientes, fmt(Number(r.deuda))]),
      y, W, [50, 55, 25, 20, 30]
    );
  }

  footer(doc, W);
  doc.save(`reporte_clientes_${desde}_${hasta}.pdf`);
}

export async function exportOrdenesPDF(data: any, desde: string, hasta: string) {
  const { doc, W } = initDoc('Reporte de Órdenes de Trabajo', desde, hasta);
  let y = 26;

  const total = data.por_estado.reduce((s: number, e: any) => s + Number(e.cantidad), 0);
  const completadas = data.por_estado.find((e: any) => e.estado === 'completada');
  const pendientes = data.por_estado.find((e: any) => e.estado === 'pendiente');

  y = kpiRow(doc, [
    { label: 'Total órdenes', value: total, color: PRIMARY },
    { label: 'Completadas', value: completadas?.cantidad ?? 0, color: GREEN },
    { label: 'Pendientes', value: pendientes?.cantidad ?? 0, color: YELLOW },
    { label: 'Tiempo promedio', value: data.tiempo_promedio_horas ? `${data.tiempo_promedio_horas}h` : 'N/A', color: PRIMARY },
  ], y, W);

  const chartImg = await captureChart('chart-ordenes-mes');
  y = sectionTitle(doc, 'Órdenes por mes', y, W);
  y = await addChart(doc, chartImg, y, W, 60);

  y = sectionTitle(doc, 'Por estado', y, W);
  y = table(doc,
    ['Estado', 'Cantidad'],
    data.por_estado.map((r: any) => [r.estado, r.cantidad]),
    y, W, [120, 70]
  );

  y = sectionTitle(doc, 'Por tipo', y, W);
  y = table(doc,
    ['Tipo', 'Cantidad'],
    data.por_tipo.map((r: any) => [r.tipo, r.cantidad]),
    y, W, [120, 70]
  );

  if (data.por_tecnico.length > 0) {
    y = sectionTitle(doc, 'Rendimiento por técnico', y, W);
    y = table(doc,
      ['Técnico', 'Total', 'Completadas', 'En curso', 'Pendientes'],
      data.por_tecnico.map((r: any) => [r.tecnico ?? 'Sin asignar', r.total, r.completadas, r.en_curso, r.pendientes]),
      y, W, [55, 25, 35, 30, 35]
    );
  }

  footer(doc, W);
  doc.save(`reporte_ordenes_${desde}_${hasta}.pdf`);
}

export async function exportRedPDF(data: any, desde: string, hasta: string) {
  const { doc, W } = initDoc('Reporte de Red', desde, hasta);
  let y = 26;

  const conectados = data.por_estado.find((e: any) => e.estado === 'conectado');
  const problemas = data.por_estado.find((e: any) => e.estado === 'con_problemas');

  y = kpiRow(doc, [
    { label: 'Conectados', value: conectados?.cantidad ?? 0, color: GREEN },
    { label: 'Con problemas', value: problemas?.cantidad ?? 0, color: RED },
    { label: 'Sin conexión config.', value: data.clientes_sin_conexion.length, color: YELLOW },
    { label: 'Tecnologías', value: data.por_tecnologia.length, color: PRIMARY },
  ], y, W);

  y = sectionTitle(doc, 'Estado de conexiones', y, W);
  y = table(doc,
    ['Estado', 'Cantidad'],
    data.por_estado.map((r: any) => [r.estado, r.cantidad]),
    y, W, [120, 70]
  );

  y = sectionTitle(doc, 'Por tecnología', y, W);
  y = table(doc,
    ['Tecnología', 'Cantidad'],
    data.por_tecnologia.map((r: any) => [r.tecnologia, r.cantidad]),
    y, W, [120, 70]
  );

  if (data.actividad.length > 0) {
    y = sectionTitle(doc, 'Actividad de conexiones', y, W);
    y = table(doc,
      ['Estado', 'Activos 1h', 'Activos 24h', 'Sin actividad'],
      data.actividad.map((r: any) => [r.estado, r.activos_1h, r.activos_24h, r.sin_actividad]),
      y, W, [55, 40, 40, 45]
    );
  }

  if (data.clientes_sin_conexion.length > 0) {
    y = sectionTitle(doc, 'Clientes activos sin conexión configurada', y, W);
    y = table(doc,
      ['Cliente', 'Email', 'Plan'],
      data.clientes_sin_conexion.map((r: any) => [r.nombre, r.email ?? '—', r.plan ?? '—']),
      y, W, [65, 75, 50]
    );
  }

  footer(doc, W);
  doc.save(`reporte_red_${desde}_${hasta}.pdf`);
}

function footer(doc: jsPDF, W: number) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 287, W, 10, 'F');
    doc.setTextColor(...MUTED);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('AdminISP — Reporte generado automáticamente', 10, 293);
    doc.text(`Página ${i} de ${pageCount}`, W - 10, 293, { align: 'right' });
  }
}
