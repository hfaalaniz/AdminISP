import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clientesApi, planesApi, facturasApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Pagination } from '../components/ui/Pagination';
import { ClienteForm } from '../components/forms/ClienteForm';
import type { Cliente, Plan } from '../types';

export const Clientes = () => {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [estado, setEstado] = useState('');
  const [planId, setPlanId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editCliente, setEditCliente] = useState<Cliente | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [generandoFactura, setGenerandoFactura] = useState<number | null>(null);

  const periodoActual = (() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  })();

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (search) params.search = search;
      if (estado) params.estado = estado;
      if (planId) params.plan_id = planId;
      const r = await clientesApi.listar(params);
      setClientes(r.data.data);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } finally {
      setLoading(false);
    }
  }, [page, search, estado, planId]);

  useEffect(() => { fetch(); }, [fetch]);
  useEffect(() => { planesApi.listar().then((r) => setPlanes(r.data)); }, []);

  const handleGenerarFactura = async (clienteId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setGenerandoFactura(clienteId);
    try {
      await facturasApi.generarParaCliente(clienteId);
      toast.success('Factura generada');
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al generar factura');
    } finally {
      setGenerandoFactura(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await clientesApi.eliminar(deleteId);
      toast.success('Cliente eliminado');
      setDeleteId(null);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Buscar por nombre, email, DNI..."
            className="border border-gray-300 rounded-md px-3 py-2 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            <option value="activo">Activo</option>
            <option value="suspendido">Suspendido</option>
            <option value="inactivo">Inactivo</option>
          </select>
          <select value={planId} onChange={(e) => { setPlanId(e.target.value); setPage(1); }} className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los planes</option>
            {planes.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <Button onClick={() => { setEditCliente(undefined); setShowForm(true); }}>+ Nuevo cliente</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Teléfono</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Portal</th>
              <th className="px-4 py-3 text-left">Conexión</th>
              <th className="px-4 py-3 text-left">Alta</th>
              <th className="px-4 py-3 text-left">Factura {periodoActual}</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Cargando...</td></tr>
            ) : clientes.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-gray-400">Sin resultados</td></tr>
            ) : clientes.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/clientes/${c.id}`)}>
                <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}<div className="text-xs text-gray-400">{c.email}</div></td>
                <td className="px-4 py-3 text-gray-600">{c.telefono ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{c.plan_nombre ?? <span className="text-gray-400">Sin plan</span>}</td>
                <td className="px-4 py-3"><Badge status={c.estado} /></td>
                <td className="px-4 py-3">
                  {c.sesion_activa
                    ? <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>En línea</span>
                    : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  {c.conexion_estado ? <Badge status={c.conexion_estado} /> : <span className="text-xs text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">{c.fecha_alta?.slice(0, 10)}</td>
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  {c.estado === 'activo' && c.plan_nombre ? (
                    <Button
                      variant="ghost" size="sm"
                      className="text-blue-600 hover:bg-blue-50"
                      disabled={generandoFactura === c.id}
                      onClick={(e) => handleGenerarFactura(c.id, e)}
                    >
                      {generandoFactura === c.id ? '...' : '+ Factura'}
                    </Button>
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => { setEditCliente(c); setShowForm(true); }}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleteId(c.id)}>Eliminar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>
      </div>

      {showForm && (
        <Modal title={editCliente ? 'Editar cliente' : 'Nuevo cliente'} onClose={() => setShowForm(false)} size="lg">
          <ClienteForm cliente={editCliente} onSuccess={fetch} onClose={() => setShowForm(false)} />
        </Modal>
      )}

      {deleteId && (
        <ConfirmDialog
          title="Eliminar cliente"
          message="¿Estás seguro? Se eliminarán también sus conexiones y facturas."
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
};
