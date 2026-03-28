import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { planesApi, ofertasApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { PlanForm } from '../components/forms/PlanForm';
import type { Plan, OfertaInstalacion } from '../types';

const TIPO_COLOR: Record<string, string> = { gratis: 'bg-emerald-100 text-emerald-700', precio_fijo: 'bg-blue-100 text-blue-700', cuotas: 'bg-purple-100 text-purple-700' };
const TIPO_LABEL: Record<string, string> = { gratis: 'Gratis', precio_fijo: 'Precio fijo', cuotas: 'En cuotas' };
const fmt = (n: number) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

export const Planes = () => {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [ofertas, setOfertas] = useState<OfertaInstalacion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editPlan, setEditPlan] = useState<Plan | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = () => {
    setLoading(true);
    planesApi.listar().then((r) => setPlanes(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch();
    ofertasApi.listar().then((r) => setOfertas(r.data)).catch(() => null);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await planesApi.eliminar(deleteId);
      toast.success('Plan eliminado');
      setDeleteId(null);
      fetch();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally {
      setDeleting(false);
    }
  };

  // Ofertas que aplican a un plan: plan_ids vacío = todas, si tiene elementos debe incluir el planId
  const ofertasParaPlan = (planId: number) =>
    ofertas.filter(o => o.activa && (!o.plan_ids || o.plan_ids.length === 0 || o.plan_ids.includes(planId)));

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={() => { setEditPlan(undefined); setShowForm(true); }}>+ Nuevo plan</Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <p className="text-gray-400 col-span-3">Cargando...</p>
        ) : planes.map((p) => {
          const ofertasPlan = ofertasParaPlan(p.id);
          return (
            <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.nombre}</h3>
                  {p.descripcion && <p className="text-xs text-gray-500 mt-0.5">{p.descripcion}</p>}
                </div>
                <Badge status={p.activo ? 'activo' : 'inactivo'} />
              </div>
              <div className="flex gap-4 text-sm text-gray-600 mb-4">
                <span>↓ {p.velocidad_down} Mbps</span>
                <span>↑ {p.velocidad_up} Mbps</span>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-3">
                ${Number(p.precio_mensual).toLocaleString()}<span className="text-sm font-normal text-gray-500">/mes</span>
              </div>
              {ofertasPlan.length > 0 ? (
                <div className="mb-4 space-y-1.5">
                  {ofertasPlan.map(o => {
                    const ahorro = o.precio_original && Number(o.precio_original) > Number(o.precio_total)
                      ? Number(o.precio_original) - Number(o.precio_total) : 0;
                    const pct = o.precio_original && Number(o.precio_original) > 0
                      ? Math.round((ahorro / Number(o.precio_original)) * 100) : 0;
                    return (
                      <div key={o.id} className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5">
                        {o.destacada && <span className="text-yellow-500 text-xs">★</span>}
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${TIPO_COLOR[o.tipo]}`}>{TIPO_LABEL[o.tipo]}</span>
                        <span className="text-xs font-medium text-gray-800 truncate">{o.nombre}</span>
                        <span className="text-xs font-bold text-gray-700 shrink-0 ml-auto">
                          {Number(o.precio_total) === 0
                            ? <span className="text-emerald-600">GRATIS</span>
                            : o.cuotas > 1
                              ? `${o.cuotas}x ${fmt(Number(o.precio_total) / o.cuotas)}`
                              : fmt(Number(o.precio_total))}
                        </span>
                        {pct > 0 && <span className="text-[10px] font-bold bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full shrink-0">{pct}% OFF</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 mb-4">Sin ofertas de instalación asignadas</p>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => { setEditPlan(p); setShowForm(true); }}>Editar</Button>
                <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleteId(p.id)}>Eliminar</Button>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <Modal title={editPlan ? 'Editar plan' : 'Nuevo plan'} onClose={() => setShowForm(false)}>
          <PlanForm plan={editPlan} onSuccess={fetch} onClose={() => setShowForm(false)} />
        </Modal>
      )}
      {deleteId && (
        <ConfirmDialog
          title="Eliminar plan"
          message="¿Eliminar este plan? Si tiene clientes asociados se desactivará en lugar de eliminarse."
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={deleting}
        />
      )}
    </div>
  );
};
