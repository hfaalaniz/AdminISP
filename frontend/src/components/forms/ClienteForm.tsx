import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { clientesApi, planesApi } from '../../services/api';
import { Input } from '../ui/Input';
import { PasswordInput } from '../ui/PasswordInput';
import { Button } from '../ui/Button';
import type { Cliente, Plan } from '../../types';

interface Props {
  cliente?: Cliente;
  onSuccess: () => void;
  onClose: () => void;
}

// ── DNI Upload ────────────────────────────────────────────────────────────────
const DniUpload = ({ label, file, currentUrl, onChange }: {
  label: string;
  file: File | null;
  currentUrl?: string;
  onChange: (f: File | null) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : currentUrl ?? null;
  const hasNew = !!file;

  return (
    <div>
      <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className={`relative cursor-pointer rounded-lg border-2 border-dashed overflow-hidden transition-colors
          ${preview ? 'border-blue-300 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50'}`}
        style={{ minHeight: '110px' }}
      >
        {preview ? (
          <img src={preview} alt={label} className="w-full h-28 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-28 gap-1.5 text-center px-3">
            <span className="text-2xl">🪪</span>
            <p className="text-xs text-gray-400 leading-tight">Clic para subir<br /><span className="text-gray-300">JPG, PNG o WEBP · máx. 5 MB</span></p>
          </div>
        )}
        {preview && (
          <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1 flex items-center justify-between">
            <span className="text-xs text-white truncate max-w-[70%]">
              {hasNew ? file!.name : 'Imagen actual'}
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); if (ref.current) ref.current.value = ''; onChange(null); }}
              className="text-red-300 hover:text-red-200 text-xs font-bold ml-1"
            >
              {hasNew ? '✕' : '↺ cambiar'}
            </button>
          </div>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }}
      />
    </div>
  );
};

// ── Form ──────────────────────────────────────────────────────────────────────
export const ClienteForm = ({ cliente, onSuccess, onClose }: Props) => {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: cliente?.nombre ?? '',
    email: cliente?.email ?? '',
    telefono: cliente?.telefono ?? '',
    dni: cliente?.dni ?? '',
    direccion: cliente?.direccion ?? '',
    barrio: cliente?.barrio ?? '',
    ciudad: cliente?.ciudad ?? '',
    plan_id: cliente?.plan_id?.toString() ?? '',
    notas: cliente?.notas ?? '',
    password: '',
    passwordConfirm: '',
  });
  const [dniFrente, setDniFrente] = useState<File | null>(null);
  const [dniDorso, setDniDorso] = useState<File | null>(null);

  useEffect(() => {
    planesApi.listar(true).then((r) => setPlanes(r.data));
  }, []);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error('Nombre requerido');
    if (form.password && form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    if (form.password !== form.passwordConfirm) return toast.error('Las contraseñas no coinciden');
    setLoading(true);
    try {
      const { passwordConfirm, password, ...rest } = form;

      const fd = new FormData();
      Object.entries({ ...rest, plan_id: form.plan_id ? Number(form.plan_id) : '' }).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
      });
      if (password) fd.append('password', password);
      if (dniFrente) fd.append('dni_frente', dniFrente);
      if (dniDorso) fd.append('dni_dorso', dniDorso);

      if (cliente) {
        await clientesApi.actualizar(cliente.id, fd);
        toast.success('Cliente actualizado');
      } else {
        await clientesApi.crear(fd);
        toast.success('Cliente creado');
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
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Input label="Nombre completo *" value={form.nombre} onChange={set('nombre')} placeholder="Juan García" />
        </div>
        <Input label="Email" type="email" value={form.email} onChange={set('email')} placeholder="juan@email.com" />
        <Input label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="+54 9 11 1234-5678" />
        <Input label="DNI / CUIT" value={form.dni} onChange={set('dni')} placeholder="20123456789" />
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Plan de servicio</label>
          <select value={form.plan_id} onChange={set('plan_id')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin plan</option>
            {planes.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre} — ${p.precio_mensual}/mes</option>
            ))}
          </select>
        </div>
        <Input label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Av. Corrientes 1234" />
        <Input label="Barrio" value={form.barrio} onChange={set('barrio')} />
        <Input label="Ciudad" value={form.ciudad} onChange={set('ciudad')} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Notas</label>
        <textarea value={form.notas} onChange={set('notas')} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Fotos del DNI */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500 mb-3">Fotografías del documento de identidad</p>
        <div className="grid grid-cols-2 gap-4">
          <DniUpload
            label="Frente del DNI"
            file={dniFrente}
            currentUrl={cliente?.dni_frente_url}
            onChange={setDniFrente}
          />
          <DniUpload
            label="Dorso del DNI"
            file={dniDorso}
            currentUrl={cliente?.dni_dorso_url}
            onChange={setDniDorso}
          />
        </div>
      </div>

      {/* Contraseña */}
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500 mb-3">
          {cliente ? 'Contraseña de acceso al portal (dejá vacío para no cambiarla)' : 'Contraseña de acceso al portal del cliente (opcional)'}
        </p>
        <div className="grid grid-cols-2 gap-4">
          <PasswordInput
            label={cliente ? 'Nueva contraseña' : 'Contraseña'}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="••••••••"
            autoComplete="new-password"
          />
          <PasswordInput
            label="Confirmar contraseña"
            value={form.passwordConfirm}
            onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))}
            placeholder="••••••••"
            autoComplete="new-password"
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : cliente ? 'Actualizar' : 'Crear cliente'}</Button>
      </div>
    </form>
  );
};
