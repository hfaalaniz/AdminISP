import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ordenesApi, partesApi, usuariosApi, equiposApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import type { OrdenTrabajo, ParteTecnico, EquipoInstalado, ImagenParte, Equipo } from '../types';

const ESTADO_SIGUIENTE: Record<string, string> = { pendiente: 'en_curso', en_curso: 'completada' };
const ESTADO_BTN: Record<string, string> = { pendiente: 'Iniciar trabajo', en_curso: 'Marcar completada' };

// ── Parte Form ─────────────────────────────────────────────────────────────────
const ParteSection = ({ orden, parte, canEdit, onRefresh, catalogoEquipos }: {
  orden: OrdenTrabajo; parte: ParteTecnico | null; canEdit: boolean; onRefresh: () => void; catalogoEquipos: Equipo[];
}) => {
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<{
    trabajo_realizado: string;
    equipos_instalados: EquipoInstalado[];
    observaciones: string;
    estado_conexion_resultante: string;
    fecha_trabajo: string;
  }>({
    trabajo_realizado: parte?.trabajo_realizado ?? '',
    equipos_instalados: parte?.equipos_instalados ?? [],
    observaciones: parte?.observaciones ?? '',
    estado_conexion_resultante: parte?.estado_conexion_resultante ?? '',
    fecha_trabajo: parte?.fecha_trabajo?.slice(0, 10) ?? '',
  });

  const isLocked = parte?.locked ?? false;
  const editable = canEdit && !isLocked;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const addEquipo = () => {
    const primero = catalogoEquipos[0];
    setForm((f) => ({
      ...f,
      equipos_instalados: [...f.equipos_instalados, {
        nombre: primero?.nombre ?? '',
        marca: primero?.marca ?? '',
        modelo: primero?.modelo ?? '',
        nro_serie: '',
      }],
    }));
  };

  const setEquipoFromCatalog = (i: number, equipoId: string) => {
    const eq = catalogoEquipos.find((e) => String(e.id) === equipoId);
    if (!eq) return;
    setForm((f) => {
      const equipos = [...f.equipos_instalados];
      equipos[i] = { nombre: eq.nombre, marca: eq.marca ?? '', modelo: eq.modelo ?? '', nro_serie: equipos[i].nro_serie };
      return { ...f, equipos_instalados: equipos };
    });
  };

  const setNroSerie = (i: number, v: string) =>
    setForm((f) => {
      const equipos = [...f.equipos_instalados];
      equipos[i] = { ...equipos[i], nro_serie: v };
      return { ...f, equipos_instalados: equipos };
    });

  const removeEquipo = (i: number) =>
    setForm((f) => ({ ...f, equipos_instalados: f.equipos_instalados.filter((_, idx) => idx !== i) }));

  const saveDraft = async () => {
    setSaving(true);
    try {
      if (!parte) {
        await partesApi.crear(orden.id, form);
      } else {
        await partesApi.actualizar(parte.id, form);
      }
      toast.success('Borrador guardado');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al guardar');
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      let parteId: number;
      if (!parte) {
        const created = await partesApi.crear(orden.id, form);
        parteId = created.data.id;
      } else {
        await partesApi.actualizar(parte.id, form);
        parteId = parte.id;
      }
      await partesApi.submit(parteId);
      toast.success('Parte enviado y bloqueado');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al enviar');
    } finally { setSubmitting(false); setShowSubmitConfirm(false); }
  };

  const handleUnlock = async () => {
    if (!parte) return;
    try {
      await partesApi.unlock(parte.id);
      toast.success('Parte desbloqueado');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    }
  };

  const handleImageUpload = async (files: FileList | null) => {
    if (!files || !parte) return;
    setUploading(true);
    try {
      await partesApi.subirImagenes(parte.id, Array.from(files));
      toast.success('Imágenes subidas');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al subir imágenes');
    } finally { setUploading(false); }
  };

  const handleDeleteImage = async (img: ImagenParte) => {
    if (!parte) return;
    try {
      await partesApi.eliminarImagen(parte.id, img.filename);
      toast.success('Imagen eliminada');
      onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    }
  };

  const imagenes: ImagenParte[] = parte?.imagenes ?? [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">Parte técnico</h3>
        <div className="flex gap-2">
          {isLocked && isAdmin && (
            <Button variant="secondary" size="sm" onClick={handleUnlock}>Desbloquear</Button>
          )}
          {isLocked && (
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded-full">
              🔒 Bloqueado {parte?.submitted_at ? `— ${new Date(parte.submitted_at).toLocaleString('es-AR')}` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Trabajo realizado */}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Trabajo realizado</label>
        <textarea value={form.trabajo_realizado} onChange={set('trabajo_realizado')} rows={4} disabled={!editable}
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
          placeholder="Describir detalladamente el trabajo realizado..." />
      </div>

      {/* Equipos instalados */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">Equipos instalados</label>
          {editable && catalogoEquipos.length > 0 && (
            <Button variant="secondary" size="sm" onClick={addEquipo}>+ Agregar equipo</Button>
          )}
        </div>
        {form.equipos_instalados.length === 0 ? (
          <p className="text-sm text-gray-400">Sin equipos registrados</p>
        ) : (
          <div className="space-y-2">
            {form.equipos_instalados.map((eq, i) => {
              const catalogoId = catalogoEquipos.find(
                (c) => c.nombre === eq.nombre && (c.modelo ?? '') === (eq.modelo ?? '')
              )?.id;
              return (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <select
                    value={catalogoId ?? ''}
                    onChange={(e) => setEquipoFromCatalog(i, e.target.value)}
                    disabled={!editable}
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-white disabled:text-gray-500"
                  >
                    <option value="">— Seleccionar equipo —</option>
                    {catalogoEquipos.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.marca ? ` — ${c.marca}` : ''}{c.modelo ? ` ${c.modelo}` : ''}
                      </option>
                    ))}
                  </select>
                  <input
                    value={eq.nro_serie}
                    onChange={(e) => setNroSerie(i, e.target.value)}
                    disabled={!editable}
                    placeholder="N° de Serie"
                    className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-white disabled:text-gray-500"
                  />
                  {editable && (
                    <button onClick={() => removeEquipo(i)} className="text-red-400 hover:text-red-600 text-lg font-bold px-1">×</button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones + estado conexión + fecha */}
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="text-sm font-medium text-gray-700 block mb-1">Observaciones</label>
          <textarea value={form.observaciones} onChange={set('observaciones')} rows={2} disabled={!editable}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Estado de conexión resultante</label>
          <select value={form.estado_conexion_resultante} onChange={set('estado_conexion_resultante')} disabled={!editable}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50">
            <option value="">— Seleccionar —</option>
            <option value="conectado">Conectado</option>
            <option value="con_problemas">Con problemas</option>
            <option value="desconectado">Desconectado</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha del trabajo</label>
          <input type="date" value={form.fecha_trabajo} onChange={set('fecha_trabajo')} disabled={!editable}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50" />
        </div>
      </div>

      {/* Botones guardar/enviar */}
      {editable && (
        <div className="flex gap-2 pt-2 border-t border-gray-100">
          <Button variant="secondary" onClick={saveDraft} disabled={saving}>{saving ? 'Guardando...' : 'Guardar borrador'}</Button>
          <Button onClick={() => setShowSubmitConfirm(true)}>Enviar y bloquear parte</Button>
        </div>
      )}

      {/* Imágenes */}
      {parte && (
        <div className="border-t border-gray-100 pt-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-gray-700">Imágenes ({imagenes.length}/10)</h4>
            {(!isLocked || isAdmin) && imagenes.length < 10 && (
              <>
                <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  {uploading ? 'Subiendo...' : '+ Subir imágenes'}
                </Button>
                <input ref={fileInputRef} type="file" multiple accept="image/*" className="hidden"
                  onChange={(e) => handleImageUpload(e.target.files)} />
              </>
            )}
          </div>
          {imagenes.length === 0 ? (
            <p className="text-sm text-gray-400">Sin imágenes</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {imagenes.map((img) => (
                <div key={img.filename} className="relative group">
                  <img src={img.url} alt={img.originalname} className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                  {(!isLocked || isAdmin) && (
                    <button onClick={() => handleDeleteImage(img)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      ×
                    </button>
                  )}
                  <p className="text-xs text-gray-400 truncate mt-1">{img.originalname ?? img.filename}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showSubmitConfirm && (
        <ConfirmDialog
          title="Enviar parte técnico"
          message="Una vez enviado el parte quedará bloqueado. Solo el admin podrá desbloquearlo. ¿Confirmar?"
          onConfirm={handleSubmit}
          onClose={() => setShowSubmitConfirm(false)}
          loading={submitting}
        />
      )}
    </div>
  );
};

// ── Main page ──────────────────────────────────────────────────────────────────
export const OrdenDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.rol === 'admin';
  const [orden, setOrden] = useState<OrdenTrabajo | null>(null);
  const [tecnicos, setTecnicos] = useState<{ id: number; nombre: string }[]>([]);
  const [catalogoEquipos, setCatalogoEquipos] = useState<Equipo[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [changingEstado, setChangingEstado] = useState(false);

  const load = () => ordenesApi.obtener(Number(id)).then((r) => setOrden(r.data));
  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (isAdmin) usuariosApi.listarTecnicos().then((r) => setTecnicos(r.data)); }, [isAdmin]);
  useEffect(() => { equiposApi.listar().then((r) => setCatalogoEquipos(r.data.filter((e) => e.activo))); }, []);

  const cambiarEstado = async (estado: string) => {
    setChangingEstado(true);
    try {
      await ordenesApi.cambiarEstado(Number(id), estado);
      toast.success('Estado actualizado');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally { setChangingEstado(false); }
  };

  if (!orden) return <div className="text-gray-400">Cargando...</div>;

  const canEdit = isAdmin || Number(orden.tecnico_id) === Number(user?.id);
  const siguienteEstado = ESTADO_SIGUIENTE[orden.estado];
  const esTecnicoAsignado = user?.rol === 'tecnico' && Number(orden.tecnico_id) === Number(user?.id);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/ordenes')}>&larr; Órdenes</Button>
        <span className="text-gray-400 text-sm">/ Orden #{orden.id}</span>
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge status={orden.tipo} />
              <Badge status={orden.estado} />
              <Badge status={orden.prioridad} />
            </div>
            <h2 className="text-xl font-bold text-gray-900">{orden.cliente_nombre}</h2>
            {orden.descripcion && <p className="text-gray-500 text-sm">{orden.descripcion}</p>}
          </div>
          <div className="flex gap-2 shrink-0">
            {isAdmin && <Button variant="secondary" size="sm" onClick={() => setShowEditModal(true)}>Editar</Button>}
            {siguienteEstado && (isAdmin || esTecnicoAsignado) && (
              <Button size="sm" onClick={() => cambiarEstado(siguienteEstado)} disabled={changingEstado}>
                {ESTADO_BTN[orden.estado]}
              </Button>
            )}
            {isAdmin && orden.estado !== 'cancelada' && orden.estado !== 'completada' && (
              <Button variant="danger" size="sm" onClick={() => cambiarEstado('cancelada')} disabled={changingEstado}>
                Cancelar orden
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm border-t border-gray-100 pt-5">
          {[
            ['Técnico', orden.tecnico_nombre ?? 'Sin asignar'],
            ['Creado por', orden.creado_por_nombre ?? '—'],
            ['Fecha programada', orden.fecha_programada ? new Date(orden.fecha_programada).toLocaleString('es-AR') : '—'],
            ['Completada', orden.fecha_completada ? new Date(orden.fecha_completada).toLocaleString('es-AR') : '—'],
            ['Teléfono cliente', orden.cliente_telefono ?? '—'],
            ['Dirección', orden.cliente_direccion ?? '—'],
            ['Plan', orden.plan_nombre ?? '—'],
            ['Velocidad', orden.velocidad_down ? `${orden.velocidad_down}/${orden.velocidad_up} Mbps` : '—'],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-gray-400 text-xs">{label}</p>
              <p className="font-medium text-gray-800">{val}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Parte técnico */}
      {(canEdit || orden.parte) && (
        <ParteSection orden={orden} parte={orden.parte ?? null} canEdit={canEdit} onRefresh={load} catalogoEquipos={catalogoEquipos} />
      )}

      {/* Edit modal */}
      {showEditModal && isAdmin && (
        <EditOrdenModal orden={orden} tecnicos={tecnicos} onSuccess={load} onClose={() => setShowEditModal(false)} />
      )}
    </div>
  );
};

const EditOrdenModal = ({ orden, tecnicos, onSuccess, onClose }: {
  orden: OrdenTrabajo;
  tecnicos: { id: number; nombre: string }[];
  onSuccess: () => void;
  onClose: () => void;
}) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    descripcion: orden.descripcion ?? '',
    prioridad: orden.prioridad,
    tecnico_id: orden.tecnico_id?.toString() ?? '',
    fecha_programada: orden.fecha_programada ? new Date(orden.fecha_programada).toISOString().slice(0, 16) : '',
  });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await ordenesApi.actualizar(orden.id, {
        descripcion: form.descripcion || undefined,
        prioridad: form.prioridad as any,
        tecnico_id: form.tecnico_id ? Number(form.tecnico_id) as any : undefined,
        fecha_programada: form.fecha_programada || undefined,
      });
      toast.success('Orden actualizada');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="Editar orden" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Prioridad</label>
          <select value={form.prioridad} onChange={set('prioridad')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {['baja','normal','alta','urgente'].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase()+p.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Técnico asignado</label>
          <select value={form.tecnico_id} onChange={set('tecnico_id')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sin asignar</option>
            {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Fecha programada</label>
          <input type="datetime-local" value={form.fecha_programada} onChange={set('fecha_programada')}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">Descripción</label>
          <textarea value={form.descripcion} onChange={set('descripcion')} rows={3}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Guardar'}</Button>
        </div>
      </form>
    </Modal>
  );
};
