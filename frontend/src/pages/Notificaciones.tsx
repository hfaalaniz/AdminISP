import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import api from '../services/api';
import { clientesApi } from '../services/api';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Pagination } from '../components/ui/Pagination';
import type { Cliente } from '../types';

const TIPOS = [
  { value: 'corte_programado', label: 'Corte programado',   icon: '🔌', color: 'text-orange-700 bg-orange-50 border-orange-200' },
  { value: 'suspension',       label: 'Suspensión',          icon: '⛔', color: 'text-red-700 bg-red-50 border-red-200' },
  { value: 'problema_red',     label: 'Problema en la red',  icon: '⚠️', color: 'text-yellow-700 bg-yellow-50 border-yellow-200' },
  { value: 'mantenimiento',    label: 'Mantenimiento',       icon: '🔧', color: 'text-blue-700 bg-blue-50 border-blue-200' },
  { value: 'aviso_pago',       label: 'Aviso de pago',       icon: '💳', color: 'text-purple-700 bg-purple-50 border-purple-200' },
  { value: 'personalizado',    label: 'Personalizado',       icon: '📢', color: 'text-gray-700 bg-gray-50 border-gray-200' },
];

const DEST_LABELS: Record<string, string> = {
  todos: 'Todos los clientes',
  activos: 'Solo activos',
  suspendidos: 'Solo suspendidos',
  cliente: 'Cliente individual',
};

interface Notificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  destinatarios: string;
  cliente_nombre?: string;
  enviado_por_nombre?: string;
  emails_enviados: number;
  created_at: string;
}

const TipoBadge = ({ tipo }: { tipo: string }) => {
  const t = TIPOS.find((t) => t.value === tipo) ?? TIPOS[5];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${t.color}`}>
      {t.icon} {t.label}
    </span>
  );
};

const NotifForm = ({ onSuccess, onClose }: { onSuccess: () => void; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [form, setForm] = useState({
    tipo: 'corte_programado',
    titulo: '',
    mensaje: '',
    destinatarios: 'todos',
    cliente_id: '',
  });

  useEffect(() => {
    clientesApi.listar({ limit: '500' }).then((r) => setClientes(r.data.data));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  // Auto-fill title when type changes
  const setTipo = (tipo: string) => {
    const t = TIPOS.find((t) => t.value === tipo);
    setForm((f) => ({ ...f, tipo, titulo: t ? t.label : f.titulo }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.titulo.trim()) return toast.error('El título es requerido');
    if (!form.mensaje.trim()) return toast.error('El mensaje es requerido');
    if (form.destinatarios === 'cliente' && !form.cliente_id) return toast.error('Seleccioná un cliente');
    setLoading(true);
    try {
      const res = await api.post('/notificaciones', {
        ...form,
        cliente_id: form.cliente_id ? Number(form.cliente_id) : undefined,
      });
      toast.success(`Notificación enviada a ${res.data.emails_enviados} destinatario(s)`);
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al enviar');
    } finally { setLoading(false); }
  };

  const tipoActual = TIPOS.find((t) => t.value === form.tipo);

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Tipo */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-2">Tipo de notificación</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button key={t.value} type="button"
              onClick={() => setTipo(t.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                form.tipo === t.value ? t.color + ' ring-2 ring-offset-1 ring-current' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}>
              <span>{t.icon}</span> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Destinatarios */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Destinatarios</label>
        <select value={form.destinatarios} onChange={set('destinatarios')}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="todos">Todos los clientes</option>
          <option value="activos">Solo activos</option>
          <option value="suspendidos">Solo suspendidos</option>
          <option value="cliente">Cliente individual</option>
        </select>
      </div>

      {form.destinatarios === 'cliente' && (
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Cliente</label>
          <select value={form.cliente_id} onChange={set('cliente_id')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Seleccionar cliente...</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}{c.email ? ` — ${c.email}` : ' (sin email)'}</option>)}
          </select>
        </div>
      )}

      {/* Título */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Título</label>
        <input value={form.titulo} onChange={set('titulo')}
          placeholder={tipoActual ? `Ej: ${tipoActual.label} del servicio` : ''}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Mensaje */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Mensaje</label>
        <textarea value={form.mensaje} onChange={set('mensaje')} rows={5}
          placeholder="Escribí el mensaje detallado que recibirán los clientes..."
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'Enviando...' : '📤 Enviar notificación'}
        </Button>
      </div>
    </form>
  );
};

export const Notificaciones = () => {
  const [notifs, setNotifs] = useState<Notificacion[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/notificaciones', { params: { page, limit: 25 } });
      setNotifs(r.data.data);
      setTotal(r.data.total);
      setTotalPages(r.data.totalPages);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta notificación del historial?')) return;
    try {
      await api.delete(`/notificaciones/${id}`);
      toast.success('Eliminada');
      load();
    } catch { toast.error('Error al eliminar'); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{total} notificaciones enviadas</p>
        <Button onClick={() => setShowForm(true)}>+ Nueva notificación</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <p className="text-center py-10 text-gray-400 text-sm">Cargando...</p>
        ) : notifs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">No hay notificaciones enviadas aún</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifs.map((n) => (
              <div key={n.id} className="p-4 hover:bg-gray-50">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <TipoBadge tipo={n.tipo} />
                      <span className="text-xs text-gray-400">
                        → {n.destinatarios === 'cliente' ? n.cliente_nombre : DEST_LABELS[n.destinatarios]}
                      </span>
                      <span className="text-xs text-gray-400">· {n.emails_enviados} emails enviados</span>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">{n.titulo}</p>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-2">{n.mensaje}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Por {n.enviado_por_nombre ?? '—'} · {new Date(n.created_at).toLocaleString('es-AR')}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-50 shrink-0"
                    onClick={() => handleDelete(n.id)}>
                    Eliminar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="px-4 pb-4">
          <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} />
        </div>
      </div>

      {showForm && (
        <Modal title="Nueva notificación" onClose={() => setShowForm(false)} size="lg">
          <NotifForm onSuccess={load} onClose={() => setShowForm(false)} />
        </Modal>
      )}
    </div>
  );
};
