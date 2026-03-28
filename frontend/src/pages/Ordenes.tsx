import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ordenesApi, clientesApi, usuariosApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import { Input } from '../components/ui/Input';
import { useAuth } from '../context/AuthContext';
import type { OrdenTrabajo, Cliente, OrdenTipo, OrdenPrioridad } from '../types';

const TIPOS: OrdenTipo[] = ['conexion', 'instalacion', 'reparacion', 'diagnostico', 'otro'];
const PRIORIDADES: OrdenPrioridad[] = ['baja', 'normal', 'alta', 'urgente'];
const TIPO_LABELS: Record<string, string> = { conexion: 'Conexión', instalacion: 'Instalación', reparacion: 'Reparación', diagnostico: 'Diagnóstico', otro: 'Otro' };

const OrdenForm = ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const [form, setForm] = useState({ cliente_id: '', tipo: 'conexion', descripcion: '', prioridad: 'normal', fecha_programada: '', tecnico_id: '' });

  useEffect(() => {
    clientesApi.listar({ limit: '200' }).then((r) => setClientes(r.data.data));
    usuariosApi.listarTecnicos().then((r) => setTecnicos(r.data));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cliente_id) return toast.error('Seleccioná un cliente');
    setLoading(true);
    try {
      await ordenesApi.crear({
        cliente_id: Number(form.cliente_id) as any,
        tipo: form.tipo as OrdenTipo,
        descripcion: form.descripcion || undefined,
        prioridad: form.prioridad as OrdenPrioridad,
        fecha_programada: form.fecha_programada || undefined,
        tecnico_id: form.tecnico_id ? Number(form.tecnico_id) as any : undefined,
      });
      toast.success('Orden creada');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al crear');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Cliente *</label>
        <select value={form.cliente_id} onChange={set('cliente_id')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Seleccionar cliente...</option>
          {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Tipo *</label>
          <select value={form.tipo} onChange={set('tipo')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Prioridad</label>
          <select value={form.prioridad} onChange={set('prioridad')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {PRIORIDADES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Técnico asignado</label>
        <select value={form.tecnico_id} onChange={set('tecnico_id')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Sin asignar</option>
          {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <Input label="Fecha programada" type="datetime-local" value={form.fecha_programada} onChange={set('fecha_programada')} />
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
        <textarea value={form.descripcion} onChange={set('descripcion')} rows={3}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Descripción del trabajo a realizar..." />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear orden'}</Button>
      </div>
    </form>
  );
};

const PRIORIDAD_COLORS: Record<string, string> = {
  urgente: 'border-l-4 border-red-500',
  alta: 'border-l-4 border-orange-400',
  normal: 'border-l-4 border-blue-400',
  baja: 'border-l-4 border-gray-300',
};

export const Ordenes = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';
  const [ordenes, setOrdenes] = useState<OrdenTrabajo[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '25' };
      if (estado) params.estado = estado;
      if (tipo) params.tipo = tipo;
      const r = await ordenesApi.listar(params);
      setOrdenes(r.data.data);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } finally { setLoading(false); }
  }, [page, estado, tipo]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <select value={estado} onChange={(e) => { setEstado(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="en_curso">En curso</option>
            <option value="completada">Completada</option>
            <option value="cancelada">Cancelada</option>
          </select>
          <select value={tipo} onChange={(e) => { setTipo(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t} value={t}>{TIPO_LABELS[t]}</option>)}
          </select>
        </div>
        {isAdmin && <Button onClick={() => setShowForm(true)}>+ Nueva orden</Button>}
      </div>

      <div className="space-y-3">
        {loading ? (
          <p className="text-gray-400 text-sm py-8 text-center">Cargando...</p>
        ) : ordenes.length === 0 ? (
          <p className="text-gray-400 text-sm py-8 text-center">Sin órdenes</p>
        ) : ordenes.map((o) => (
          <div key={o.id}
            className={`bg-white rounded-xl border border-gray-200 shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow ${PRIORIDAD_COLORS[o.prioridad]}`}
            onClick={() => navigate(`/ordenes/${o.id}`)}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">#{o.id}</span>
                  <Badge status={o.tipo} />
                  <Badge status={o.estado} />
                  <Badge status={o.prioridad} />
                </div>
                <p className="font-semibold text-gray-900">{o.cliente_nombre}</p>
                {o.descripcion && <p className="text-sm text-gray-500 truncate">{o.descripcion}</p>}
              </div>
              <div className="text-right text-xs text-gray-400 shrink-0">
                <p>{o.tecnico_nombre ? `👷 ${o.tecnico_nombre}` : 'Sin técnico'}</p>
                {o.fecha_programada && <p>📅 {new Date(o.fecha_programada).toLocaleDateString('es-AR')}</p>}
                <p className="mt-1">{new Date(o.created_at).toLocaleDateString('es-AR')}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />

      {showForm && (
        <Modal title="Nueva orden de trabajo" onClose={() => setShowForm(false)} size="lg">
          <OrdenForm onSuccess={load} onClose={() => setShowForm(false)} />
        </Modal>
      )}
    </div>
  );
};
