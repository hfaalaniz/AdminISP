import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { conexionesApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Pagination } from '../components/ui/Pagination';

type ConexionRow = {
  id: number; cliente_id: number; cliente_nombre: string; cliente_estado: string;
  ip_asignada?: string; mac_address?: string; puerto_olt?: string;
  tecnologia: string; estado: string; updated_at?: string;
};

export const Conexiones = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ConexionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (estado) params.estado = estado;
      if (search) params.search = search;
      const r = await conexionesApi.listar(params);
      setRows(r.data.data as ConexionRow[]);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, estado, search]);

  useEffect(() => { fetch(); }, [fetch]);

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Buscar cliente o IP..." className="border border-gray-300 rounded-md px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Todos</option>
          <option value="conectado">Conectado</option>
          <option value="desconectado">Desconectado</option>
          <option value="con_problemas">Con problemas</option>
        </select>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">IP</th>
              <th className="px-4 py-3 text-left">MAC</th>
              <th className="px-4 py-3 text-left">Puerto</th>
              <th className="px-4 py-3 text-left">Tecnología</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin registros</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/clientes/${r.cliente_id}`)}>
                <td className="px-4 py-3 font-medium text-gray-900">{r.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-600 font-mono">{r.ip_asignada ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 font-mono text-xs">{r.mac_address ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{r.puerto_olt ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600 capitalize">{r.tecnologia}</td>
                <td className="px-4 py-3"><Badge status={r.estado} /></td>
                <td className="px-4 py-3 text-gray-400 text-xs">{r.updated_at ? new Date(r.updated_at).toLocaleString('es-AR') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>
      </div>
    </div>
  );
};
