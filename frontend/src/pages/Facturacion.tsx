import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { facturasApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { FacturaForm } from '../components/forms/FacturaForm';
import type { Factura } from '../types';

export const Facturacion = () => {
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [showPago, setShowPago] = useState<Factura | null>(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (estado) params.estado_pago = estado;
      const r = await facturasApi.listar(params);
      setFacturas(r.data.data);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, estado]);

  useEffect(() => { fetch(); }, [fetch]);

  const generarMensual = async () => {
    setGenerating(true);
    try {
      const r = await facturasApi.generarMensual();
      toast.success(r.data.message);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al generar');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagado">Pagado</option>
            <option value="vencido">Vencido</option>
          </select>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">Las facturas se generan automáticamente el 1° de cada mes</span>
          <Button onClick={generarMensual} disabled={generating} variant="secondary">
            {generating ? 'Generando...' : 'Generar ahora'}
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Período</th>
              <th className="px-4 py-3 text-left">Monto</th>
              <th className="px-4 py-3 text-left">Vencimiento</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Forma de pago</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : facturas.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Sin facturas</td></tr>
            ) : facturas.map((f) => (
              <tr key={f.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{f.cliente_nombre}</td>
                <td className="px-4 py-3 text-gray-600">{f.periodo}</td>
                <td className="px-4 py-3 font-medium">${Number(f.monto).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{f.fecha_vencimiento?.slice(0, 10)}</td>
                <td className="px-4 py-3"><Badge status={f.estado_pago} /></td>
                <td className="px-4 py-3 text-gray-500 capitalize">{f.metodo_pago ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {f.estado_pago !== 'pagado' && (
                    <Button size="sm" onClick={() => setShowPago(f)}>Registrar pago</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>
      </div>

      {showPago && (
        <Modal title="Registrar pago" onClose={() => setShowPago(null)} size="sm">
          <FacturaForm factura={showPago} onSuccess={fetch} onClose={() => setShowPago(null)} />
        </Modal>
      )}
    </div>
  );
};
