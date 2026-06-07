import { useState } from 'react';
import toast from 'react-hot-toast';
import { planesApi } from '../../services/api';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Plan } from '../../types';

interface Props {
  plan?: Plan;
  onSuccess: () => void;
  onClose: () => void;
}

export const PlanForm = ({ plan, onSuccess, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: plan?.nombre ?? '',
    velocidad_down: plan?.velocidad_down?.toString() ?? '',
    velocidad_up: plan?.velocidad_up?.toString() ?? '',
    precio_mensual: plan?.precio_mensual?.toString() ?? '',
    descripcion: plan?.descripcion ?? '',
    destacado: plan?.destacado ?? false,
    badge_texto: plan?.badge_texto ?? '',
  });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        nombre: form.nombre,
        velocidad_down: Number(form.velocidad_down),
        velocidad_up: Number(form.velocidad_up),
        precio_mensual: Number(form.precio_mensual),
        descripcion: form.descripcion || undefined,
        destacado: form.destacado,
        badge_texto: form.badge_texto || undefined,
      };
      if (plan) {
        await planesApi.actualizar(plan.id, payload);
        toast.success('Plan actualizado');
      } else {
        await planesApi.crear(payload);
        toast.success('Plan creado');
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Nombre del plan *" value={form.nombre} onChange={set('nombre')} placeholder="Fibra 100 Mbps" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Velocidad bajada (Mbps) *" type="number" value={form.velocidad_down} onChange={set('velocidad_down')} min="1" />
        <Input label="Velocidad subida (Mbps) *" type="number" value={form.velocidad_up} onChange={set('velocidad_up')} min="1" />
      </div>
      <Input label="Precio mensual ($) *" type="number" step="0.01" value={form.precio_mensual} onChange={set('precio_mensual')} min="0" />
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
        <textarea value={form.descripcion} onChange={set('descripcion')} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="border-t pt-3">
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={form.destacado}
            onChange={(e) => setForm((f) => ({ ...f, destacado: e.target.checked }))}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Marcar como destacado <span className="text-yellow-500">★</span></span>
        </label>
        <p className="text-xs text-gray-400 mt-1 ml-7">El plan aparecerá resaltado visualmente en la página pública.</p>
      </div>
      {form.destacado && (
        <Input
          label='Texto del badge (opcional, ej: "★ Más popular")'
          value={form.badge_texto}
          onChange={set('badge_texto')}
          placeholder="★ Más popular"
        />
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : plan ? 'Actualizar' : 'Crear plan'}</Button>
      </div>
    </form>
  );
};
