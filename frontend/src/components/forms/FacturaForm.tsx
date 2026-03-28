import { useState } from 'react';
import toast from 'react-hot-toast';
import { facturasApi } from '../../services/api';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Factura } from '../../types';

interface Props {
  factura: Factura;
  onSuccess: () => void;
  onClose: () => void;
}

export const FacturaForm = ({ factura, onSuccess, onClose }: Props) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ metodo_pago: 'efectivo', referencia_pago: '' });

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await facturasApi.registrarPago(factura.id, form);
      toast.success('Pago registrado');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al registrar pago');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
        <p><span className="text-gray-500">Cliente:</span> <strong>{factura.cliente_nombre}</strong></p>
        <p><span className="text-gray-500">Período:</span> {factura.periodo}</p>
        <p><span className="text-gray-500">Monto:</span> <strong>${Number(factura.monto).toLocaleString()}</strong></p>
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Método de pago</label>
        <select value={form.metodo_pago} onChange={set('metodo_pago')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="mp">Mercado Pago</option>
        </select>
      </div>
      <Input label="Referencia / N° comprobante" value={form.referencia_pago} onChange={set('referencia_pago')} placeholder="Opcional" />
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Registrando...' : 'Confirmar pago'}</Button>
      </div>
    </form>
  );
};
