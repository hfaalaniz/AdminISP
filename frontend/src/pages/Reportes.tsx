import { useState, useEffect, useCallback } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../services/api';
import toast from 'react-hot-toast';
import { exportFinancieroPDF, exportClientesPDF, exportOrdenesPDF, exportRedPDF } from '../services/pdfReporte';

// ── Types ─────────────────────────────────────────────────────────────────────
interface DateRange { desde: string; hasta: string }

type Tab = 'financiero' | 'clientes' | 'ordenes' | 'red' | 'listados';

interface FinancieroData {
  ingresos_por_mes: { mes: string; cantidad: number; total: number }[];
  por_estado: { estado_pago: string; cantidad: number; total: number }[];
  por_plan: { plan: string; cantidad: number; total: number }[];
  morosos: { id: number; nombre: string; email: string; telefono: string; facturas_vencidas: number; deuda_total: number }[];
}

interface ClientesData {
  altas_por_mes: { mes: string; altas: number }[];
  por_estado: { estado: string; cantidad: number }[];
  por_plan: { plan: string; cantidad: number }[];
  con_deuda: { id: number; nombre: string; email: string; estado: string; facturas_pendientes: number; deuda: number }[];
}

interface OrdenesData {
  por_mes: { mes: string; cantidad: number }[];
  por_estado: { estado: string; cantidad: number }[];
  por_tipo: { tipo: string; cantidad: number }[];
  por_tecnico: { tecnico: string; total: number; completadas: number; pendientes: number; en_curso: number }[];
  tiempo_promedio_horas: number | null;
}

interface RedData {
  por_estado: { estado: string; cantidad: number }[];
  por_tecnologia: { tecnologia: string; cantidad: number }[];
  clientes_sin_conexion: { id: number; nombre: string; email: string; estado: string; plan: string }[];
  actividad: { estado: string; activos_1h: number; activos_24h: number; sin_actividad: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

const fmt = (n: number) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

const defaultRange = (): DateRange => {
  const h = new Date();
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return {
    desde: d.toISOString().split('T')[0],
    hasta: h.toISOString().split('T')[0],
  };
};

function exportCSV(data: Record<string, any>[], filename: string) {
  if (!data.length) return toast.error('No hay datos para exportar');
  const headers = Object.keys(data[0]);
  const rows = data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ────────────────────────────────────────────────────────────
const Card = ({ title, value, sub, color = 'blue' }: { title: string; value: string | number; sub?: string; color?: string }) => {
  const colors: Record<string, string> = {
    blue: 'border-blue-500/30 bg-blue-500/10',
    green: 'border-green-500/30 bg-green-500/10',
    yellow: 'border-yellow-500/30 bg-yellow-500/10',
    red: 'border-red-500/30 bg-red-500/10',
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-gray-400 text-xs mb-1">{title}</p>
      <p className="text-white text-2xl font-bold">{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );
};

const SectionTitle = ({ title, onExport }: { title: string; onExport?: () => void }) => (
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-white font-semibold">{title}</h3>
    {onExport && (
      <button onClick={onExport} className="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors">
        ⬇️ CSV
      </button>
    )}
  </div>
);

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'financiero', label: 'Financiero', icon: '💰' },
  { id: 'clientes', label: 'Clientes', icon: '👥' },
  { id: 'ordenes', label: 'Órdenes', icon: '🔧' },
  { id: 'red', label: 'Red', icon: '🌐' },
  { id: 'listados', label: 'Listados', icon: '📋' },
];

// ── Main Component ────────────────────────────────────────────────────────────
export const Reportes = () => {
  const [tab, setTab] = useState<Tab>('financiero');
  const [range, setRange] = useState<DateRange>(defaultRange());
  const [loading, setLoading] = useState(false);

  const [financieroData, setFinancieroData] = useState<FinancieroData | null>(null);
  const [clientesData, setClientesData] = useState<ClientesData | null>(null);
  const [ordenesData, setOrdenesData] = useState<OrdenesData | null>(null);
  const [redData, setRedData] = useState<RedData | null>(null);
  const [listadoTipo, setListadoTipo] = useState<string>('clientes');
  const [listadoData, setListadoData] = useState<Record<string, any>[]>([]);
  const [listadoSearch, setListadoSearch] = useState('');

  const fetchListado = useCallback(async (tipo: string) => {
    setLoading(true);
    try {
      const { data } = await api.get(`/reportes/listados?tipo=${tipo}`);
      setListadoData(data);
    } catch {
      toast.error('Error cargando listado');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = `desde=${range.desde}&hasta=${range.hasta}`;
    try {
      if (tab === 'listados') { await fetchListado(listadoTipo); return; }
      const endpoints: Record<string, string> = {
        financiero: `/reportes/financiero?${params}`,
        clientes: `/reportes/clientes?${params}`,
        ordenes: `/reportes/ordenes?${params}`,
        red: `/reportes/red?${params}`,
      };
      const { data } = await api.get(endpoints[tab]);
      if (tab === 'financiero') setFinancieroData(data);
      if (tab === 'clientes') setClientesData(data);
      if (tab === 'ordenes') setOrdenesData(data);
      if (tab === 'red') setRedData(data);
    } catch {
      toast.error('Error cargando reporte');
    } finally {
      setLoading(false);
    }
  }, [tab, range, listadoTipo, fetchListado]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-white">Reportes</h1>
        <div className="flex items-center gap-3 flex-wrap">
          <input type="date" value={range.desde} onChange={e => setRange(r => ({ ...r, desde: e.target.value }))}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm" />
          <span className="text-gray-400 text-sm">—</span>
          <input type="date" value={range.hasta} onChange={e => setRange(r => ({ ...r, hasta: e.target.value }))}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm" />
          <button onClick={fetchData} disabled={loading}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            {loading ? 'Cargando...' : 'Actualizar'}
          </button>
          <button
            disabled={loading}
            onClick={async () => {
              try {
                if (tab === 'financiero' && financieroData) await exportFinancieroPDF(financieroData, range.desde, range.hasta);
                else if (tab === 'clientes' && clientesData) await exportClientesPDF(clientesData, range.desde, range.hasta);
                else if (tab === 'ordenes' && ordenesData) await exportOrdenesPDF(ordenesData, range.desde, range.hasta);
                else if (tab === 'red' && redData) await exportRedPDF(redData, range.desde, range.hasta);
              } catch { toast.error('Error generando PDF'); }
            }}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors">
            📄 Exportar PDF
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700 pb-0">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t.id ? 'border-blue-500 text-white' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            <span>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {loading && <div className="text-gray-400 text-sm py-8 text-center">Cargando reporte...</div>}

      {/* ── Financiero ── */}
      {!loading && tab === 'financiero' && financieroData && (
        <div className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Total recaudado"
              value={fmt(financieroData.por_estado.find(e => e.estado_pago === 'pagado')?.total ?? 0)}
              color="green" />
            <Card title="Facturas pagadas"
              value={financieroData.por_estado.find(e => e.estado_pago === 'pagado')?.cantidad ?? 0}
              color="blue" />
            <Card title="Facturas pendientes"
              value={financieroData.por_estado.find(e => e.estado_pago === 'pendiente')?.cantidad ?? 0}
              color="yellow" />
            <Card title="Clientes morosos"
              value={financieroData.morosos.length}
              color="red" />
          </div>

          {/* Ingresos por mes */}
          <div className="bg-gray-800 rounded-xl p-5">
            <SectionTitle title="Ingresos por mes"
              onExport={() => exportCSV(financieroData.ingresos_por_mes, 'ingresos_por_mes.csv')} />
            <div id="chart-financiero-ingresos">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={financieroData.ingresos_por_mes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} />
                <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="total" name="Recaudado" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Por estado */}
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Facturas por estado"
                onExport={() => exportCSV(financieroData.por_estado, 'facturas_por_estado.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={financieroData.por_estado} dataKey="cantidad" nameKey="estado_pago" cx="50%" cy="50%" outerRadius={80} label={({ estado_pago, percent }) => `${estado_pago} ${(percent * 100).toFixed(0)}%`}>
                    {financieroData.por_estado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Por plan */}
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Ingresos por plan"
                onExport={() => exportCSV(financieroData.por_plan, 'ingresos_por_plan.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={financieroData.por_plan} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => '$' + (v / 1000).toFixed(0) + 'k'} />
                  <YAxis type="category" dataKey="plan" tick={{ fill: '#9ca3af', fontSize: 11 }} width={80} />
                  <Tooltip formatter={(v: number) => fmt(v)} contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey="total" name="Total" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Morosos */}
          {financieroData.morosos.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title={`Clientes morosos (${financieroData.morosos.length})`}
                onExport={() => exportCSV(financieroData.morosos, 'morosos.csv')} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-700">
                      <th className="text-left py-2 pr-4">Cliente</th>
                      <th className="text-left py-2 pr-4">Email</th>
                      <th className="text-left py-2 pr-4">Teléfono</th>
                      <th className="text-right py-2 pr-4">Facturas</th>
                      <th className="text-right py-2">Deuda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {financieroData.morosos.map(m => (
                      <tr key={m.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 pr-4 text-white">{m.nombre}</td>
                        <td className="py-2 pr-4 text-gray-300">{m.email}</td>
                        <td className="py-2 pr-4 text-gray-300">{m.telefono}</td>
                        <td className="py-2 pr-4 text-right text-yellow-400">{m.facturas_vencidas}</td>
                        <td className="py-2 text-right text-red-400 font-medium">{fmt(m.deuda_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Clientes ── */}
      {!loading && tab === 'clientes' && clientesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Total clientes" value={clientesData.por_estado.reduce((s, e) => s + Number(e.cantidad), 0)} color="blue" />
            <Card title="Activos" value={clientesData.por_estado.find(e => e.estado === 'activo')?.cantidad ?? 0} color="green" />
            <Card title="Suspendidos" value={clientesData.por_estado.find(e => e.estado === 'suspendido')?.cantidad ?? 0} color="yellow" />
            <Card title="Con deuda" value={clientesData.con_deuda.length} color="red" />
          </div>

          {/* Altas por mes */}
          <div className="bg-gray-800 rounded-xl p-5">
            <SectionTitle title="Altas por mes"
              onExport={() => exportCSV(clientesData.altas_por_mes, 'altas_por_mes.csv')} />
            <div id="chart-clientes-altas">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={clientesData.altas_por_mes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Line type="monotone" dataKey="altas" name="Nuevos clientes" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} />
              </LineChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Por estado"
                onExport={() => exportCSV(clientesData.por_estado, 'clientes_por_estado.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={clientesData.por_estado} dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={80}
                    label={({ estado, percent }) => `${estado} ${(percent * 100).toFixed(0)}%`}>
                    {clientesData.por_estado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Por plan"
                onExport={() => exportCSV(clientesData.por_plan, 'clientes_por_plan.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={clientesData.por_plan}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="plan" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey="cantidad" name="Clientes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {clientesData.con_deuda.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title={`Clientes con deuda (${clientesData.con_deuda.length})`}
                onExport={() => exportCSV(clientesData.con_deuda, 'clientes_con_deuda.csv')} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-700">
                      <th className="text-left py-2 pr-4">Cliente</th>
                      <th className="text-left py-2 pr-4">Email</th>
                      <th className="text-left py-2 pr-4">Estado</th>
                      <th className="text-right py-2 pr-4">Facturas</th>
                      <th className="text-right py-2">Deuda</th>
                    </tr>
                  </thead>
                  <tbody>
                    {clientesData.con_deuda.map(c => (
                      <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 pr-4 text-white">{c.nombre}</td>
                        <td className="py-2 pr-4 text-gray-300">{c.email}</td>
                        <td className="py-2 pr-4">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${c.estado === 'activo' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {c.estado}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-right text-yellow-400">{c.facturas_pendientes}</td>
                        <td className="py-2 text-right text-red-400 font-medium">{fmt(Number(c.deuda))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Órdenes ── */}
      {!loading && tab === 'ordenes' && ordenesData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Total órdenes" value={ordenesData.por_estado.reduce((s, e) => s + Number(e.cantidad), 0)} color="blue" />
            <Card title="Completadas" value={ordenesData.por_estado.find(e => e.estado === 'completada')?.cantidad ?? 0} color="green" />
            <Card title="Pendientes" value={ordenesData.por_estado.find(e => e.estado === 'pendiente')?.cantidad ?? 0} color="yellow" />
            <Card title="Tiempo promedio" value={ordenesData.tiempo_promedio_horas ? `${ordenesData.tiempo_promedio_horas}h` : 'N/A'} sub="resolución" color="blue" />
          </div>

          <div className="bg-gray-800 rounded-xl p-5">
            <SectionTitle title="Órdenes por mes"
              onExport={() => exportCSV(ordenesData.por_mes, 'ordenes_por_mes.csv')} />
            <div id="chart-ordenes-mes">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ordenesData.por_mes}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="mes" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                <Bar dataKey="cantidad" name="Órdenes" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Por estado"
                onExport={() => exportCSV(ordenesData.por_estado, 'ordenes_por_estado.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ordenesData.por_estado} dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={80}
                    label={({ estado, percent }) => `${estado} ${(percent * 100).toFixed(0)}%`}>
                    {ordenesData.por_estado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Por tipo"
                onExport={() => exportCSV(ordenesData.por_tipo, 'ordenes_por_tipo.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={ordenesData.por_tipo}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="tipo" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Bar dataKey="cantidad" name="Cantidad" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {ordenesData.por_tecnico.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Rendimiento por técnico"
                onExport={() => exportCSV(ordenesData.por_tecnico, 'rendimiento_tecnicos.csv')} />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={ordenesData.por_tecnico}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="tecnico" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  <Legend wrapperStyle={{ color: '#9ca3af', fontSize: 12 }} />
                  <Bar dataKey="completadas" name="Completadas" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="en_curso" name="En curso" stackId="a" fill="#3b82f6" />
                  <Bar dataKey="pendientes" name="Pendientes" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Red ── */}
      {!loading && tab === 'red' && redData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card title="Conectados" value={redData.por_estado.find(e => e.estado === 'conectado')?.cantidad ?? 0} color="green" />
            <Card title="Con problemas" value={redData.por_estado.find(e => e.estado === 'con_problemas')?.cantidad ?? 0} color="red" />
            <Card title="Sin conexión configurada" value={redData.clientes_sin_conexion.length} color="yellow" />
            <Card title="Tecnologías" value={redData.por_tecnologia.length} color="blue" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Estado de conexiones"
                onExport={() => exportCSV(redData.por_estado, 'conexiones_por_estado.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={redData.por_estado} dataKey="cantidad" nameKey="estado" cx="50%" cy="50%" outerRadius={80}
                    label={({ estado, percent }) => `${estado} ${(percent * 100).toFixed(0)}%`}>
                    {redData.por_estado.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Por tecnología"
                onExport={() => exportCSV(redData.por_tecnologia, 'conexiones_por_tecnologia.csv')} />
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={redData.por_tecnologia} dataKey="cantidad" nameKey="tecnologia" cx="50%" cy="50%" outerRadius={80}
                    label={({ tecnologia, percent }) => `${tecnologia} ${(percent * 100).toFixed(0)}%`}>
                    {redData.por_tecnologia.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {redData.actividad.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title="Actividad de conexiones" />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-700">
                      <th className="text-left py-2 pr-4">Estado</th>
                      <th className="text-right py-2 pr-4">Activos última hora</th>
                      <th className="text-right py-2 pr-4">Activos últimas 24h</th>
                      <th className="text-right py-2">Sin actividad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redData.actividad.map((a, i) => (
                      <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 pr-4 text-white capitalize">{a.estado}</td>
                        <td className="py-2 pr-4 text-right text-green-400">{a.activos_1h}</td>
                        <td className="py-2 pr-4 text-right text-blue-400">{a.activos_24h}</td>
                        <td className="py-2 text-right text-red-400">{a.sin_actividad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {redData.clientes_sin_conexion.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-5">
              <SectionTitle title={`Clientes activos sin conexión configurada (${redData.clientes_sin_conexion.length})`}
                onExport={() => exportCSV(redData.clientes_sin_conexion, 'sin_conexion.csv')} />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 text-xs border-b border-gray-700">
                      <th className="text-left py-2 pr-4">Cliente</th>
                      <th className="text-left py-2 pr-4">Email</th>
                      <th className="text-left py-2">Plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {redData.clientes_sin_conexion.map(c => (
                      <tr key={c.id} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 pr-4 text-white">{c.nombre}</td>
                        <td className="py-2 pr-4 text-gray-300">{c.email}</td>
                        <td className="py-2 text-gray-300">{c.plan ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Listados ── */}
      {tab === 'listados' && (
        <div className="space-y-4">
          {/* Selector de listado */}
          <div className="flex flex-wrap gap-3 items-center">
            {[
              { id: 'clientes', label: 'Clientes' },
              { id: 'conexiones', label: 'Conexiones' },
              { id: 'pagos', label: 'Pagos' },
              { id: 'morosos', label: 'Morosos' },
              { id: 'ordenes', label: 'Órdenes' },
              { id: 'usuarios', label: 'Usuarios' },
            ].map(l => (
              <button key={l.id}
                onClick={() => { setListadoTipo(l.id); setListadoSearch(''); fetchListado(l.id); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  listadoTipo === l.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}>
                {l.label}
              </button>
            ))}
            <div className="ml-auto flex gap-2">
              <input
                type="text"
                placeholder="Buscar..."
                value={listadoSearch}
                onChange={e => setListadoSearch(e.target.value)}
                className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-1.5 text-sm w-48"
              />
              <button
                onClick={() => exportCSV(listadoData, `${listadoTipo}.csv`)}
                className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
              >
                ⬇️ CSV
              </button>
            </div>
          </div>

          {/* Tabla dinámica */}
          {!loading && listadoData.length > 0 && (() => {
            const headers = Object.keys(listadoData[0]);
            const filtered = listadoSearch
              ? listadoData.filter(r => Object.values(r).some(v => String(v ?? '').toLowerCase().includes(listadoSearch.toLowerCase())))
              : listadoData;
            return (
              <div className="bg-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-gray-400 text-sm">{filtered.length} registros</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-600">
                        {headers.map(h => (
                          <th key={h} className="text-left py-2 pr-3 text-gray-400 font-medium capitalize whitespace-nowrap">
                            {h.replace(/_/g, ' ')}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 500).map((row, ri) => (
                        <tr key={ri} className="border-b border-gray-700/40 hover:bg-gray-700/30">
                          {headers.map(h => {
                            const v = row[h];
                            let cls = 'text-gray-300';
                            if (h === 'estado' || h === 'estado_cliente' || h === 'estado_conexion') {
                              if (String(v) === 'activo' || String(v) === 'conectado' || String(v) === 'pagado') cls = 'text-green-400';
                              else if (String(v) === 'suspendido' || String(v) === 'vencido' || String(v) === 'con_problemas') cls = 'text-red-400';
                              else if (String(v) === 'pendiente') cls = 'text-yellow-400';
                            }
                            if (h === 'deuda_total' || h === 'monto') {
                              return <td key={h} className="py-2 pr-3 text-red-400 font-medium whitespace-nowrap">{fmt(Number(v))}</td>;
                            }
                            if (h === 'activo') {
                              return <td key={h} className="py-2 pr-3"><span className={`px-1.5 py-0.5 rounded text-xs ${v ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{v ? 'Sí' : 'No'}</span></td>;
                            }
                            if (typeof v === 'string' && v.includes('T') && v.includes('Z')) {
                              return <td key={h} className="py-2 pr-3 text-gray-400 whitespace-nowrap">{new Date(v).toLocaleDateString('es-AR')}</td>;
                            }
                            return <td key={h} className={`py-2 pr-3 whitespace-nowrap ${cls}`}>{String(v ?? '—')}</td>;
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length > 500 && (
                    <p className="text-gray-400 text-xs mt-3 text-center">Mostrando 500 de {filtered.length} registros. Exportá a CSV para ver todos.</p>
                  )}
                </div>
              </div>
            );
          })()}
          {!loading && listadoData.length === 0 && (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-400">No hay datos para este listado.</div>
          )}
          {loading && <div className="text-gray-400 text-sm py-8 text-center">Cargando...</div>}
        </div>
      )}
    </div>
  );
};
