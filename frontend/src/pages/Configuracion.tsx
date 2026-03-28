import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { configuracionApi, equiposApi, ofertasApi, planesApi } from '../services/api';
import api from '../services/api';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { ConfiguracionISP, Equipo, OfertaInstalacion, Plan } from '../types';

const EquipoForm = ({ equipo, onSuccess, onClose }: { equipo?: Equipo; onSuccess: () => void; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nombre: equipo?.nombre ?? '',
    marca: equipo?.marca ?? '',
    modelo: equipo?.modelo ?? '',
    descripcion: equipo?.descripcion ?? '',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error('Nombre requerido');
    setLoading(true);
    try {
      if (equipo) {
        await equiposApi.actualizar(equipo.id, form);
        toast.success('Equipo actualizado');
      } else {
        await equiposApi.crear(form);
        toast.success('Equipo creado');
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
      <Input label="Nombre del equipo *" value={form.nombre} onChange={set('nombre')} placeholder="ONT" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Marca" value={form.marca} onChange={set('marca')} placeholder="Huawei" />
        <Input label="Modelo" value={form.modelo} onChange={set('modelo')} placeholder="HG8310M" />
      </div>
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
        <textarea value={form.descripcion} onChange={set('descripcion')} rows={2}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : equipo ? 'Actualizar' : 'Crear'}</Button>
      </div>
    </form>
  );
};

export const Configuracion = () => {
  const [isp, setIsp] = useState<ConfiguracionISP>({ nombre_empresa: '', localidad: '', provincia: '' });
  const [savingIsp, setSavingIsp] = useState(false);
  const [equipos, setEquipos] = useState<Equipo[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editEquipo, setEditEquipo] = useState<Equipo | undefined>();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [deletingLogo, setDeletingLogo] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [planes, setPlanes] = useState<Plan[]>([]);
  const [ofertas, setOfertas] = useState<OfertaInstalacion[]>([]);
  const [showOfertaForm, setShowOfertaForm] = useState(false);
  const [editOferta, setEditOferta] = useState<OfertaInstalacion | undefined>();
  const [deleteOfertaId, setDeleteOfertaId] = useState<number | null>(null);
  const [deletingOferta, setDeletingOferta] = useState(false);
  const [ofertaForm, setOfertaForm] = useState({ nombre: '', descripcion: '', tipo: 'gratis' as OfertaInstalacion['tipo'], precio_total: '', precio_original: '', cuotas: '1', activa: true, orden: '0', destacada: false, badge_texto: '', fecha_inicio: '', fecha_fin: '', plan_ids: [] as number[] });
  const [savingOferta, setSavingOferta] = useState(false);

  const loadIsp = () => configuracionApi.obtener().then((r) => setIsp(r.data));
  const loadEquipos = () => equiposApi.listar().then((r) => setEquipos(r.data));
  const loadOfertas = () => ofertasApi.listar().then((r) => setOfertas(r.data)).catch(() => null);
  const loadPlanes = () => planesApi.listar().then((r) => setPlanes(r.data)).catch(() => null);

  useEffect(() => { loadIsp(); loadEquipos(); loadOfertas(); loadPlanes(); }, []);

  const setIspField = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setIsp((f) => ({ ...f, [k]: e.target.value }));

  const saveIsp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingIsp(true);
    try {
      await configuracionApi.actualizar(isp);
      toast.success('Configuración guardada');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al guardar');
    } finally {
      setSavingIsp(false);
    }
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('logo', file);
      await api.post('/configuracion/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Logo actualizado');
      loadIsp();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al subir el logo');
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = '';
    }
  };

  const handleLogoDelete = async () => {
    setDeletingLogo(true);
    try {
      await api.delete('/configuracion/logo');
      toast.success('Logo eliminado');
      loadIsp();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar el logo');
    } finally { setDeletingLogo(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await equiposApi.eliminar(deleteId);
      toast.success('Equipo eliminado');
      setDeleteId(null);
      loadEquipos();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al eliminar');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Datos ISP */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Datos de la empresa</h2>
        <form onSubmit={saveIsp} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre de la empresa *" value={isp.nombre_empresa} onChange={setIspField('nombre_empresa')} />
            <Input label="CUIT" value={isp.cuit ?? ''} onChange={setIspField('cuit')} placeholder="20-12345678-9" />
            <Input label="Domicilio" value={isp.domicilio ?? ''} onChange={setIspField('domicilio')} placeholder="Av. Principal 123" />
            <Input label="Teléfono" value={isp.telefono ?? ''} onChange={setIspField('telefono')} />
            <Input label="Email" type="email" value={isp.email ?? ''} onChange={setIspField('email')} />
            <Input label="Localidad" value={isp.localidad} onChange={setIspField('localidad')} />
            <Input label="Provincia" value={isp.provincia} onChange={setIspField('provincia')} />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={savingIsp}>{savingIsp ? 'Guardando...' : 'Guardar cambios'}</Button>
          </div>
        </form>
      </div>

      {/* Logo */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-1">Logo de la empresa</h2>
        <p className="text-xs text-gray-500 mb-4">Aparece en el encabezado del contrato PDF. Recomendado: PNG o JPG, fondo blanco, relación 4:3.</p>
        <div className="flex items-center gap-6">
          <div className="w-32 h-24 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 overflow-hidden shrink-0">
            {isp.logo_url ? (
              <img src={isp.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
            ) : (
              <span className="text-gray-400 text-xs text-center leading-tight px-2">Sin logo</span>
            )}
          </div>
          <div className="space-y-2">
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => handleLogoUpload(e.target.files?.[0] ?? null)}
            />
            <Button variant="secondary" onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
              {uploadingLogo ? 'Subiendo...' : isp.logo_url ? 'Cambiar logo' : 'Subir logo'}
            </Button>
            {isp.logo_url && (
              <Button variant="ghost" className="text-red-500 hover:bg-red-50 block" onClick={handleLogoDelete} disabled={deletingLogo}>
                {deletingLogo ? 'Eliminando...' : 'Eliminar logo'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Equipos en comodato */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Equipos en comodato</h2>
            <p className="text-xs text-gray-500 mt-0.5">Estos equipos aparecen en el contrato generado al inscribirse</p>
          </div>
          <Button onClick={() => { setEditEquipo(undefined); setShowForm(true); }}>+ Agregar equipo</Button>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Marca</th>
              <th className="px-4 py-3 text-left">Modelo</th>
              <th className="px-4 py-3 text-left">Descripción</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {equipos.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Sin equipos registrados</td></tr>
            ) : equipos.map((eq) => (
              <tr key={eq.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{eq.nombre}</td>
                <td className="px-4 py-3 text-gray-600">{eq.marca ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{eq.modelo ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{eq.descripcion ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${eq.activo ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                    {eq.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => { setEditEquipo(eq); setShowForm(true); }}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => setDeleteId(eq.id)}>Eliminar</Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editEquipo ? 'Editar equipo' : 'Nuevo equipo'} onClose={() => setShowForm(false)}>
          <EquipoForm equipo={editEquipo} onSuccess={loadEquipos} onClose={() => setShowForm(false)} />
        </Modal>
      )}
      {deleteId && (
        <ConfirmDialog
          title="Eliminar equipo"
          message="¿Eliminar este equipo? Ya no aparecerá en los contratos nuevos."
          onConfirm={handleDelete}
          onClose={() => setDeleteId(null)}
          loading={deleting}
        />
      )}

      {/* ── Ofertas de instalación ── */}
      <OfertasSection
        ofertas={ofertas}
        planes={planes}
        showForm={showOfertaForm}
        editOferta={editOferta}
        ofertaForm={ofertaForm}
        savingOferta={savingOferta}
        deleteOfertaId={deleteOfertaId}
        deletingOferta={deletingOferta}
        setOfertaForm={setOfertaForm}
        onNew={() => { setEditOferta(undefined); setOfertaForm({ nombre: '', descripcion: '', tipo: 'gratis', precio_total: '', precio_original: '', cuotas: '1', activa: true, orden: '0', destacada: false, badge_texto: '', fecha_inicio: '', fecha_fin: '', plan_ids: [] }); setShowOfertaForm(true); }}
        onEdit={(o) => { setEditOferta(o); setOfertaForm({ nombre: o.nombre, descripcion: o.descripcion ?? '', tipo: o.tipo, precio_total: String(o.precio_total), precio_original: String(o.precio_original ?? ''), cuotas: String(o.cuotas), activa: o.activa, orden: String(o.orden), destacada: o.destacada, badge_texto: o.badge_texto ?? '', fecha_inicio: o.fecha_inicio ?? '', fecha_fin: o.fecha_fin ?? '', plan_ids: o.plan_ids ?? [] }); setShowOfertaForm(true); }}
        onCloseForm={() => setShowOfertaForm(false)}
        onSubmitOferta={async (e) => {
          e.preventDefault();
          if (!ofertaForm.nombre.trim()) return toast.error('Nombre requerido');
          setSavingOferta(true);
          try {
            const data = { ...ofertaForm, precio_total: Number(ofertaForm.precio_total) || 0, precio_original: ofertaForm.precio_original ? Number(ofertaForm.precio_original) : undefined, cuotas: Number(ofertaForm.cuotas) || 1, orden: Number(ofertaForm.orden) || 0 };
            if (editOferta) { await ofertasApi.actualizar(editOferta.id, data); toast.success('Oferta actualizada'); }
            else { await ofertasApi.crear(data); toast.success('Oferta creada'); }
            setShowOfertaForm(false); loadOfertas();
          } catch (err: any) { toast.error(err.response?.data?.error ?? 'Error al guardar');
          } finally { setSavingOferta(false); }
        }}
        onDeleteOferta={async () => {
          if (!deleteOfertaId) return;
          setDeletingOferta(true);
          try { await ofertasApi.eliminar(deleteOfertaId); toast.success('Oferta eliminada'); setDeleteOfertaId(null); loadOfertas();
          } catch { toast.error('Error al eliminar');
          } finally { setDeletingOferta(false); }
        }}
        onConfirmDelete={(id) => setDeleteOfertaId(id)}
        onCancelDelete={() => setDeleteOfertaId(null)}
      />
    </div>
  );
};

// ── Ofertas section component ─────────────────────────────────────────────────
const fmt = (n: number) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });
const TIPO_COLOR: Record<string, string> = { gratis: 'bg-emerald-100 text-emerald-700', precio_fijo: 'bg-blue-100 text-blue-700', cuotas: 'bg-purple-100 text-purple-700' };

const TIPOS = [
  {
    id: 'gratis',
    label: 'Bonificada / Gratis',
    icon: '🎁',
    desc: 'La instalación no tiene costo para el cliente.',
    color: 'border-emerald-400 bg-emerald-50 text-emerald-700',
    idle: 'border-gray-200 hover:border-emerald-300',
  },
  {
    id: 'precio_fijo',
    label: 'Precio fijo',
    icon: '💳',
    desc: 'El cliente paga un monto único al contratar.',
    color: 'border-blue-400 bg-blue-50 text-blue-700',
    idle: 'border-gray-200 hover:border-blue-300',
  },
  {
    id: 'cuotas',
    label: 'En cuotas',
    icon: '📆',
    desc: 'El costo se divide en cuotas mensuales sin interés.',
    color: 'border-purple-400 bg-purple-50 text-purple-700',
    idle: 'border-gray-200 hover:border-purple-300',
  },
];

const OfertasSection = ({ ofertas, planes, showForm, editOferta, ofertaForm, savingOferta, deleteOfertaId, deletingOferta, setOfertaForm, onNew, onEdit, onCloseForm, onSubmitOferta, onDeleteOferta, onConfirmDelete, onCancelDelete }: {
  ofertas: OfertaInstalacion[]; planes: Plan[]; showForm: boolean; editOferta?: OfertaInstalacion; ofertaForm: any; savingOferta: boolean;
  deleteOfertaId: number | null; deletingOferta: boolean; setOfertaForm: any;
  onNew: () => void; onEdit: (o: OfertaInstalacion) => void; onCloseForm: () => void;
  onSubmitOferta: (e: React.FormEvent) => void; onDeleteOferta: () => void;
  onConfirmDelete: (id: number) => void; onCancelDelete: () => void;
}) => {
  const tipoActual = TIPOS.find(t => t.id === ofertaForm.tipo);
  const precioTotal = Number(ofertaForm.precio_total) || 0;
  const precioOrig  = Number(ofertaForm.precio_original) || 0;
  const cuotas      = Number(ofertaForm.cuotas) || 1;
  const tieneAhorro = precioOrig > precioTotal && precioTotal >= 0;
  const pctAhorro   = tieneAhorro ? Math.round(((precioOrig - precioTotal) / precioOrig) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800">Ofertas de instalación</h3>
          <p className="text-xs text-gray-400 mt-0.5">Se muestran al cliente durante la inscripción online.</p>
        </div>
        <Button size="sm" onClick={onNew}>+ Nueva oferta</Button>
      </div>

      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Oferta</th>
            <th className="px-4 py-3 text-left">Tipo</th>
            <th className="px-4 py-3 text-left">Precio ofrecido</th>
            <th className="px-4 py-3 text-left">Precio normal</th>
            <th className="px-4 py-3 text-left">Ahorro</th>
            <th className="px-4 py-3 text-left">Estado</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {ofertas.length === 0 ? (
            <tr><td colSpan={7} className="text-center py-6 text-gray-400">Sin ofertas. Creá una para que aparezca en la inscripción.</td></tr>
          ) : ofertas.map((o) => {
            const ahorro = o.precio_original && Number(o.precio_original) > Number(o.precio_total)
              ? Number(o.precio_original) - Number(o.precio_total) : 0;
            const pct = o.precio_original && Number(o.precio_original) > 0
              ? Math.round((ahorro / Number(o.precio_original)) * 100) : 0;
            return (
              <tr key={o.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {o.destacada && <span title="Destacada" className="text-yellow-500 text-sm">★</span>}
                    <div>
                      <p className="font-medium text-gray-900">{o.nombre}</p>
                      {o.badge_texto && <p className="text-xs text-blue-500">{o.badge_texto}</p>}
                      {o.descripcion && <p className="text-xs text-gray-400">{o.descripcion}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${TIPO_COLOR[o.tipo]}`}>{TIPOS.find(t=>t.id===o.tipo)?.label ?? o.tipo}</span></td>
                <td className="px-4 py-3 font-semibold">
                  {Number(o.precio_total) === 0
                    ? <span className="text-emerald-600">GRATIS</span>
                    : o.cuotas > 1
                      ? <span>{o.cuotas}x {fmt(Number(o.precio_total)/o.cuotas)}<span className="text-xs text-gray-400 ml-1">= {fmt(Number(o.precio_total))}</span></span>
                      : fmt(Number(o.precio_total))}
                </td>
                <td className="px-4 py-3 text-gray-400 line-through text-sm">{o.precio_original ? fmt(Number(o.precio_original)) : '—'}</td>
                <td className="px-4 py-3">
                  {ahorro > 0
                    ? <span className="text-xs font-bold bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">{pct}% · {fmt(ahorro)}</span>
                    : <span className="text-gray-300">—</span>}
                </td>
                <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.activa ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.activa ? 'Activa' : 'Inactiva'}</span></td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => onEdit(o)}>Editar</Button>
                  <Button variant="ghost" size="sm" className="text-red-500 hover:bg-red-50" onClick={() => onConfirmDelete(o.id)}>Eliminar</Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {showForm && (
        <Modal title={editOferta ? 'Editar oferta' : 'Nueva oferta de instalación'} onClose={onCloseForm} size="lg">
          <form onSubmit={onSubmitOferta} className="space-y-5">

            {/* Selector visual de tipo */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-3">Tipo de oferta <span className="text-red-500">*</span></label>
              <div className="grid grid-cols-3 gap-3">
                {TIPOS.map((t) => (
                  <button key={t.id} type="button"
                    onClick={() => setOfertaForm((f: any) => ({ ...f, tipo: t.id, cuotas: t.id !== 'cuotas' ? '1' : f.cuotas, precio_total: t.id === 'gratis' ? '0' : f.precio_total }))}
                    className={`rounded-xl border-2 p-3 text-left transition-all ${ofertaForm.tipo === t.id ? t.color + ' ring-2 ring-offset-1 ring-current' : t.idle + ' bg-white'}`}>
                    <div className="text-xl mb-1">{t.icon}</div>
                    <div className="text-xs font-bold leading-tight">{t.label}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5 leading-tight">{t.desc}</div>
                  </button>
                ))}
              </div>
              {tipoActual && (
                <p className="text-xs text-gray-400 mt-2 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-semibold">{tipoActual.icon} {tipoActual.label}:</span> {tipoActual.desc}
                </p>
              )}
            </div>

            {/* Nombre y descripción */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Nombre de la oferta <span className="text-red-500">*</span></label>
                <input value={ofertaForm.nombre} onChange={(e) => setOfertaForm((f: any) => ({ ...f, nombre: e.target.value }))}
                  placeholder={ofertaForm.tipo === 'gratis' ? 'Ej: Instalación bonificada' : ofertaForm.tipo === 'cuotas' ? 'Ej: 6 cuotas sin interés' : 'Ej: Instalación contado'}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Descripción <span className="text-gray-400 font-normal">(opcional)</span></label>
                <input value={ofertaForm.descripcion} onChange={(e) => setOfertaForm((f: any) => ({ ...f, descripcion: e.target.value }))}
                  placeholder="Ej: Válido solo para nuevos clientes del mes de enero"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            {/* Precios */}
            {ofertaForm.tipo !== 'gratis' && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50">
                <p className="text-sm font-semibold text-gray-700">Precios</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      {ofertaForm.tipo === 'cuotas' ? 'Precio total a cobrar' : 'Precio ofrecido'}
                      <span className="text-red-500 ml-0.5">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" value={ofertaForm.precio_total} onChange={(e) => setOfertaForm((f: any) => ({ ...f, precio_total: e.target.value }))}
                        placeholder="0" className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">
                      Precio normal <span className="text-gray-400 font-normal">(para mostrar tachado)</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input type="number" min="0" value={ofertaForm.precio_original} onChange={(e) => setOfertaForm((f: any) => ({ ...f, precio_original: e.target.value }))}
                        placeholder="Ej: 15000" className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                  </div>
                </div>

                {/* Preview ahorro */}
                {tieneAhorro && (
                  <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <span className="text-yellow-600 text-sm">🏷️</span>
                    <span className="text-sm text-yellow-700">
                      El cliente verá un <strong>{pctAhorro}% de descuento</strong> ({fmt(precioOrig - precioTotal)} de ahorro)
                    </span>
                  </div>
                )}

                {ofertaForm.tipo === 'cuotas' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 block mb-1">Cantidad de cuotas</label>
                    <div className="flex items-center gap-3">
                      <input type="number" min="2" max="24" value={ofertaForm.cuotas} onChange={(e) => setOfertaForm((f: any) => ({ ...f, cuotas: e.target.value }))}
                        className="w-24 border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      {precioTotal > 0 && cuotas > 1 && (
                        <span className="text-sm text-purple-700 bg-purple-50 border border-purple-200 rounded-lg px-3 py-1.5 font-medium">
                          {cuotas} cuotas de {fmt(precioTotal / cuotas)} sin interés
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Precio original para gratis (para mostrar ahorro) */}
            {ofertaForm.tipo === 'gratis' && (
              <div className="border border-emerald-200 rounded-xl p-4 bg-emerald-50 space-y-2">
                <p className="text-sm font-semibold text-emerald-700">Precio normal (opcional)</p>
                <p className="text-xs text-emerald-600">Si indicás el precio habitual, el cliente verá cuánto se está ahorrando.</p>
                <div className="relative max-w-xs">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                  <input type="number" min="0" value={ofertaForm.precio_original} onChange={(e) => setOfertaForm((f: any) => ({ ...f, precio_original: e.target.value }))}
                    placeholder="Ej: 12000" className="w-full border border-gray-300 rounded-md pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
                {precioOrig > 0 && (
                  <p className="text-xs text-emerald-700 font-medium">El cliente verá que ahorra {fmt(precioOrig)}</p>
                )}
              </div>
            )}

            {/* Destacar + badge */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-semibold text-gray-700">Destacar esta oferta</p>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={ofertaForm.destacada} onChange={(e) => setOfertaForm((f: any) => ({ ...f, destacada: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Marcar como opción destacada</p>
                  <p className="text-xs text-gray-400">Aparecerá con borde resaltado y badge en la tarjeta del cliente.</p>
                </div>
              </label>
              {ofertaForm.destacada && (
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Texto del badge <span className="text-gray-400 font-normal">(por defecto "★ Más conveniente")</span></label>
                  <input value={ofertaForm.badge_texto} onChange={(e) => setOfertaForm((f: any) => ({ ...f, badge_texto: e.target.value }))}
                    placeholder="★ Más conveniente"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
            </div>

            {/* Planes aplicables */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">Planes a los que aplica</p>
                <p className="text-xs text-gray-400 mb-3">Si no seleccionás ninguno, la oferta aplica a todos los planes.</p>
              </div>
              {planes.filter(p => p.activo).length === 0 ? (
                <p className="text-xs text-gray-400">No hay planes activos.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {planes.filter(p => p.activo).map(p => {
                    const checked = ofertaForm.plan_ids.includes(p.id);
                    return (
                      <label key={p.id} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <input type="checkbox" checked={checked}
                          onChange={() => setOfertaForm((f: any) => ({
                            ...f,
                            plan_ids: checked ? f.plan_ids.filter((id: number) => id !== p.id) : [...f.plan_ids, p.id]
                          }))}
                          className="w-4 h-4 rounded text-blue-600 shrink-0" />
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${checked ? 'text-blue-700' : 'text-gray-700'}`}>{p.nombre}</p>
                          <p className="text-xs text-gray-400">${Number(p.precio_mensual).toLocaleString()}/mes · {p.velocidad_down}/{p.velocidad_up} Mbps</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
              {ofertaForm.plan_ids.length === 0 && (
                <p className="text-xs text-emerald-600 bg-emerald-50 rounded-lg px-3 py-2">✓ Aplica a todos los planes</p>
              )}
            </div>

            {/* Vigencia */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-0.5">Vigencia</p>
                <p className="text-xs text-gray-400">Opcional. La oferta solo se mostrará dentro de este rango de fechas.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de inicio</label>
                  <input type="date" value={ofertaForm.fecha_inicio} onChange={(e) => setOfertaForm((f: any) => ({ ...f, fecha_inicio: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 block mb-1">Fecha de fin</label>
                  <input type="date" value={ofertaForm.fecha_fin} onChange={(e) => setOfertaForm((f: any) => ({ ...f, fecha_fin: e.target.value }))}
                    min={ofertaForm.fecha_inicio || undefined}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {ofertaForm.fecha_inicio && ofertaForm.fecha_fin && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">
                  Activa del {new Date(ofertaForm.fecha_inicio + 'T12:00:00').toLocaleDateString('es-AR')} al {new Date(ofertaForm.fecha_fin + 'T12:00:00').toLocaleDateString('es-AR')}
                </p>
              )}
              {(ofertaForm.fecha_inicio || ofertaForm.fecha_fin) && (
                <button type="button" onClick={() => setOfertaForm((f: any) => ({ ...f, fecha_inicio: '', fecha_fin: '' }))}
                  className="text-xs text-gray-400 hover:text-red-500 transition">✕ Quitar fechas</button>
              )}
            </div>

            {/* Orden y estado */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Orden de aparición</label>
                <input type="number" min="0" value={ofertaForm.orden} onChange={(e) => setOfertaForm((f: any) => ({ ...f, orden: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-gray-400 mt-1">Número más bajo = aparece primero</p>
              </div>
              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={ofertaForm.activa} onChange={(e) => setOfertaForm((f: any) => ({ ...f, activa: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-gray-700">Activa</p>
                    <p className="text-xs text-gray-400">Visible en la inscripción</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="secondary" type="button" onClick={onCloseForm}>Cancelar</Button>
              <Button type="submit" disabled={savingOferta}>{savingOferta ? 'Guardando...' : editOferta ? 'Guardar cambios' : 'Crear oferta'}</Button>
            </div>
          </form>
        </Modal>
      )}

      {deleteOfertaId && (
        <ConfirmDialog
          title="Eliminar oferta"
          message="¿Eliminar esta oferta? No afecta las facturas ya generadas."
          onConfirm={onDeleteOferta}
          onClose={onCancelDelete}
          loading={deletingOferta}
        />
      )}
    </div>
  );
};
