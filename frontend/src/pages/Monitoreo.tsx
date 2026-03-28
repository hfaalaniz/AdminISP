import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { Pagination } from '../components/ui/Pagination';

// ── Types ─────────────────────────────────────────────────────────────────────
interface Summary {
  requests: { total: number; errors_5xx: number; errors_4xx: number; avg_ms: number; max_ms: number };
  errors: { source: string; count: number }[];
  slow_endpoints: { path: string; method: string; avg_ms: number; calls: number }[];
  vitals: { metric: string; avg: number }[];
}
interface RequestLog { id: number; method: string; path: string; status: number; duration_ms: number; user_id: number | null; user_rol: string | null; ip: string | null; created_at: string }
interface ErrorLog   { id: number; source: string; level: string; message: string; stack: string | null; path: string | null; method: string | null; user_id: number | null; user_rol: string | null; context: Record<string, unknown> | null; created_at: string }
interface AuditLog   { id: number; action: string; entity: string; entity_id: number | null; user_id: number | null; user_nombre: string | null; user_rol: string | null; detail: Record<string, unknown> | null; ip: string | null; created_at: string }
interface PerfLog    { id: number; source: string; metric: string; value: number; path: string | null; context: Record<string, unknown> | null; created_at: string }
interface PerfStats  { metric: string; source: string; avg: number; max: number; count: number }

type Tab = 'resumen' | 'requests' | 'errores' | 'auditoria' | 'performance';

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtDate = (d: string) => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' });
const statusColor = (s: number) =>
  s >= 500 ? 'text-red-600 bg-red-50' : s >= 400 ? 'text-yellow-700 bg-yellow-50' : 'text-green-700 bg-green-50';
const methodColor = (m: string) =>
  ({ GET: 'text-blue-700 bg-blue-50', POST: 'text-green-700 bg-green-50', PUT: 'text-yellow-700 bg-yellow-50', PATCH: 'text-orange-700 bg-orange-50', DELETE: 'text-red-700 bg-red-50' }[m] ?? 'text-gray-600 bg-gray-100');

const VITALS_THRESHOLDS: Record<string, { good: number; poor: number; unit: string }> = {
  LCP:  { good: 2500, poor: 4000, unit: 'ms' },
  FCP:  { good: 1800, poor: 3000, unit: 'ms' },
  CLS:  { good: 0.1,  poor: 0.25, unit: '' },
  TTFB: { good: 800,  poor: 1800, unit: 'ms' },
  INP:  { good: 200,  poor: 500,  unit: 'ms' },
};
const vitalColor = (metric: string, value: number) => {
  const t = VITALS_THRESHOLDS[metric];
  if (!t) return 'text-gray-600';
  if (value <= t.good) return 'text-green-600';
  if (value <= t.poor) return 'text-yellow-600';
  return 'text-red-600';
};

// ── StatCard ──────────────────────────────────────────────────────────────────
const Stat = ({ label, value, sub, color = 'text-gray-900' }: { label: string; value: string | number; sub?: string; color?: string }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

// ── Main ──────────────────────────────────────────────────────────────────────
export const Monitoreo = () => {
  const [tab, setTab] = useState<Tab>('resumen');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [expandedError, setExpandedError] = useState<number | null>(null);

  // Requests
  const [requests, setRequests] = useState<RequestLog[]>([]);
  const [reqTotal, setReqTotal] = useState(0); const [reqPages, setReqPages] = useState(1); const [reqPage, setReqPage] = useState(1);
  const [reqStatus, setReqStatus] = useState(''); const [reqPath, setReqPath] = useState('');

  // Errors
  const [errors, setErrors] = useState<ErrorLog[]>([]);
  const [errTotal, setErrTotal] = useState(0); const [errPages, setErrPages] = useState(1); const [errPage, setErrPage] = useState(1);
  const [errSource, setErrSource] = useState('');

  // Audit
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [audTotal, setAudTotal] = useState(0); const [audPages, setAudPages] = useState(1); const [audPage, setAudPage] = useState(1);
  const [audEntity, setAudEntity] = useState('');

  // Performance
  const [perfs, setPerfs] = useState<PerfLog[]>([]);
  const [perfStats, setPerfStats] = useState<PerfStats[]>([]);
  const [perfTotal, setPerfTotal] = useState(0); const [perfPages, setPerfPages] = useState(1); const [perfPage, setPerfPage] = useState(1);
  const [perfSource, setPerfSource] = useState('');

  // Summary
  useEffect(() => {
    api.get<Summary>('/monitor/summary').then((r) => setSummary(r.data)).catch(() => null);
  }, []);

  const loadRequests = useCallback(() => {
    const p: Record<string, string> = { page: String(reqPage), limit: '50' };
    if (reqStatus) p.status = reqStatus;
    if (reqPath)   p.path   = reqPath;
    api.get('/monitor/requests', { params: p }).then((r: any) => {
      setRequests(r.data.data); setReqTotal(r.data.total); setReqPages(r.data.totalPages);
    }).catch(() => null);
  }, [reqPage, reqStatus, reqPath]);

  const loadErrors = useCallback(() => {
    const p: Record<string, string> = { page: String(errPage), limit: '50' };
    if (errSource) p.source = errSource;
    api.get('/monitor/errors', { params: p }).then((r: any) => {
      setErrors(r.data.data); setErrTotal(r.data.total); setErrPages(r.data.totalPages);
    }).catch(() => null);
  }, [errPage, errSource]);

  const loadAudits = useCallback(() => {
    const p: Record<string, string> = { page: String(audPage), limit: '50' };
    if (audEntity) p.entity = audEntity;
    api.get('/monitor/audit', { params: p }).then((r: any) => {
      setAudits(r.data.data); setAudTotal(r.data.total); setAudPages(r.data.totalPages);
    }).catch(() => null);
  }, [audPage, audEntity]);

  const loadPerfs = useCallback(() => {
    const p: Record<string, string> = { page: String(perfPage), limit: '50' };
    if (perfSource) p.source = perfSource;
    api.get('/monitor/performance', { params: p }).then((r: any) => {
      setPerfs(r.data.data); setPerfStats(r.data.stats ?? []); setPerfTotal(r.data.total); setPerfPages(r.data.totalPages);
    }).catch(() => null);
  }, [perfPage, perfSource]);

  useEffect(() => { if (tab === 'requests')    loadRequests(); }, [tab, loadRequests]);
  useEffect(() => { if (tab === 'errores')     loadErrors();   }, [tab, loadErrors]);
  useEffect(() => { if (tab === 'auditoria')   loadAudits();   }, [tab, loadAudits]);
  useEffect(() => { if (tab === 'performance') loadPerfs();    }, [tab, loadPerfs]);

  const TABS: { id: Tab; label: string }[] = [
    { id: 'resumen',     label: 'Resumen' },
    { id: 'requests',    label: 'Requests HTTP' },
    { id: 'errores',     label: 'Errores' },
    { id: 'auditoria',   label: 'Auditoría' },
    { id: 'performance', label: 'Performance' },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-gray-900">Monitoreo del sistema</h2>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${tab === t.id ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── RESUMEN ── */}
      {tab === 'resumen' && summary && (
        <div className="space-y-5">
          <p className="text-xs text-gray-400">Últimas 24 horas</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Stat label="Requests totales" value={summary.requests.total ?? 0} />
            <Stat label="Errores 5xx" value={summary.requests.errors_5xx ?? 0} color={Number(summary.requests.errors_5xx) > 0 ? 'text-red-600' : 'text-gray-900'} />
            <Stat label="Errores 4xx" value={summary.requests.errors_4xx ?? 0} color={Number(summary.requests.errors_4xx) > 0 ? 'text-yellow-600' : 'text-gray-900'} />
            <Stat label="Tiempo promedio" value={`${summary.requests.avg_ms ?? 0} ms`} />
            <Stat label="Tiempo máximo"   value={`${summary.requests.max_ms ?? 0} ms`} color={Number(summary.requests.max_ms) > 2000 ? 'text-red-600' : 'text-gray-900'} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Errores por fuente */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Errores por fuente (24h)</h3>
              {summary.errors.length === 0
                ? <p className="text-gray-400 text-sm">Sin errores</p>
                : summary.errors.map((e) => (
                  <div key={e.source} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <span className="text-sm capitalize text-gray-700">{e.source}</span>
                    <span className="text-sm font-semibold text-red-600">{e.count}</span>
                  </div>
                ))}
            </div>

            {/* Endpoints más lentos */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Endpoints más lentos (24h)</h3>
              {summary.slow_endpoints.length === 0
                ? <p className="text-gray-400 text-sm">Sin datos</p>
                : summary.slow_endpoints.map((e, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${methodColor(e.method)}`}>{e.method}</span>
                      <span className="text-xs text-gray-600 truncate">{e.path}</span>
                    </div>
                    <span className={`text-sm font-semibold ml-2 shrink-0 ${Number(e.avg_ms) > 1000 ? 'text-red-600' : 'text-yellow-600'}`}>{e.avg_ms}ms</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Web Vitals */}
          {summary.vitals.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Web Vitals — promedio (24h)</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {summary.vitals.map((v) => {
                  const t = VITALS_THRESHOLDS[v.metric];
                  return (
                    <div key={v.metric} className="text-center">
                      <p className={`text-2xl font-bold ${vitalColor(v.metric, Number(v.avg))}`}>
                        {v.avg}{t?.unit ?? ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{v.metric}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── REQUESTS ── */}
      {tab === 'requests' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={reqPath} onChange={(e) => { setReqPath(e.target.value); setReqPage(1); }}
              placeholder="Filtrar por ruta..." className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <select value={reqStatus} onChange={(e) => { setReqStatus(e.target.value); setReqPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todos los estados</option>
              <option value="200">200</option>
              <option value="201">201</option>
              <option value="400">400</option>
              <option value="401">401</option>
              <option value="404">404</option>
              <option value="500">500</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Método</th>
                  <th className="px-4 py-3 text-left">Ruta</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Duración</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {requests.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                  : requests.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2"><span className={`text-xs font-bold px-1.5 py-0.5 rounded ${methodColor(r.method)}`}>{r.method}</span></td>
                      <td className="px-4 py-2 text-gray-700 font-mono text-xs max-w-xs truncate">{r.path}</td>
                      <td className="px-4 py-2"><span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${statusColor(r.status)}`}>{r.status}</span></td>
                      <td className="px-4 py-2 text-gray-600">{r.duration_ms}ms</td>
                      <td className="px-4 py-2 text-gray-500">{r.user_rol ? `${r.user_rol} #${r.user_id}` : '—'}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{r.ip ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={reqPage} totalPages={reqPages} total={reqTotal} onPage={setReqPage} />
            </div>
          </div>
        </div>
      )}

      {/* ── ERRORES ── */}
      {tab === 'errores' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={errSource} onChange={(e) => { setErrSource(e.target.value); setErrPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las fuentes</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fuente</th>
                  <th className="px-4 py-3 text-left">Nivel</th>
                  <th className="px-4 py-3 text-left">Mensaje</th>
                  <th className="px-4 py-3 text-left">Ruta</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {errors.length === 0
                  ? <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin errores</td></tr>
                  : errors.map((e) => (
                    <>
                      <tr key={e.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setExpandedError(expandedError === e.id ? null : e.id)}>
                        <td className="px-4 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${e.source === 'backend' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{e.source}</span></td>
                        <td className="px-4 py-2"><span className={`text-xs font-semibold ${e.level === 'error' ? 'text-red-600' : 'text-yellow-600'}`}>{e.level}</span></td>
                        <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{e.message}</td>
                        <td className="px-4 py-2 text-gray-500 font-mono text-xs">{e.path ?? '—'}</td>
                        <td className="px-4 py-2 text-gray-500">{e.user_rol ? `${e.user_rol} #${e.user_id}` : '—'}</td>
                        <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(e.created_at)}</td>
                      </tr>
                      {expandedError === e.id && e.stack && (
                        <tr key={`${e.id}-stack`}>
                          <td colSpan={6} className="px-4 py-3 bg-gray-50">
                            <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">{e.stack}</pre>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={errPage} totalPages={errPages} total={errTotal} onPage={setErrPage} />
            </div>
          </div>
        </div>
      )}

      {/* ── AUDITORÍA ── */}
      {tab === 'auditoria' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <select value={audEntity} onChange={(e) => { setAudEntity(e.target.value); setAudPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las entidades</option>
              <option value="usuario">Usuario</option>
              <option value="cliente">Cliente</option>
              <option value="conexion">Conexión</option>
              <option value="factura">Factura</option>
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Acción</th>
                  <th className="px-4 py-3 text-left">Entidad</th>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Usuario</th>
                  <th className="px-4 py-3 text-left">Detalle</th>
                  <th className="px-4 py-3 text-left">IP</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {audits.length === 0
                  ? <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin registros</td></tr>
                  : audits.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2"><span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">{a.action}</span></td>
                      <td className="px-4 py-2 capitalize text-gray-700">{a.entity}</td>
                      <td className="px-4 py-2 text-gray-500">{a.entity_id ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-700">{a.user_nombre ?? '—'}<span className="text-xs text-gray-400 ml-1">{a.user_rol && `(${a.user_rol})`}</span></td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs max-w-xs truncate">{a.detail ? JSON.stringify(a.detail) : '—'}</td>
                      <td className="px-4 py-2 text-gray-400 font-mono text-xs">{a.ip ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(a.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={audPage} totalPages={audPages} total={audTotal} onPage={setAudPage} />
            </div>
          </div>
        </div>
      )}

      {/* ── PERFORMANCE ── */}
      {tab === 'performance' && (
        <div className="space-y-4">
          {/* Stats cards */}
          {perfStats.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {perfStats.map((s, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                  <p className="text-xs text-gray-500 mb-1">{s.metric} <span className="text-gray-400">({s.source})</span></p>
                  <p className={`text-xl font-bold ${vitalColor(s.metric, Number(s.avg))}`}>{s.avg}{VITALS_THRESHOLDS[s.metric]?.unit ?? 'ms'}</p>
                  <p className="text-xs text-gray-400 mt-0.5">máx {s.max} · {s.count} muestras</p>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <select value={perfSource} onChange={(e) => { setPerfSource(e.target.value); setPerfPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Todas las fuentes</option>
              <option value="backend">Backend</option>
              <option value="frontend">Frontend</option>
            </select>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Fuente</th>
                  <th className="px-4 py-3 text-left">Métrica</th>
                  <th className="px-4 py-3 text-left">Valor</th>
                  <th className="px-4 py-3 text-left">Ruta</th>
                  <th className="px-4 py-3 text-left">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {perfs.length === 0
                  ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">Sin datos</td></tr>
                  : perfs.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p.source === 'backend' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{p.source}</span></td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700">{p.metric}</td>
                      <td className={`px-4 py-2 font-semibold ${vitalColor(p.metric, Number(p.value))}`}>{p.value}{VITALS_THRESHOLDS[p.metric]?.unit ?? 'ms'}</td>
                      <td className="px-4 py-2 text-gray-500 font-mono text-xs">{p.path ?? '—'}</td>
                      <td className="px-4 py-2 text-gray-400 text-xs">{fmtDate(p.created_at)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <div className="px-4 pb-4">
              <Pagination page={perfPage} totalPages={perfPages} total={perfTotal} onPage={setPerfPage} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
