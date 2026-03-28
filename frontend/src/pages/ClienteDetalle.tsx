import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { clientesApi, conexionesApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { ClienteForm } from '../components/forms/ClienteForm';
import { FacturaForm } from '../components/forms/FacturaForm';
import type { ClienteDetalle as ClienteDetalleType, Factura, SesionCliente } from '../types';

const formatDuracion = (seg: number) => {
  if (seg < 60) return `${seg}s`;
  if (seg < 3600) return `${Math.floor(seg / 60)}m ${seg % 60}s`;
  const h = Math.floor(seg / 3600);
  const m = Math.floor((seg % 3600) / 60);
  return `${h}h ${m}m`;
};

export const ClienteDetalle = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ClienteDetalleType | null>(null);
  const [sesiones, setSesiones] = useState<SesionCliente[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showConexion, setShowConexion] = useState(false);
  const [showPago, setShowPago] = useState<Factura | null>(null);
  const [connForm, setConnForm] = useState<{ ip_asignada: string; mac_address: string; puerto_olt: string; tecnologia: string; estado: 'conectado' | 'desconectado' | 'con_problemas'; observaciones: string }>({ ip_asignada: '', mac_address: '', puerto_olt: '', tecnologia: 'fibra', estado: 'conectado', observaciones: '' });
  const [savingConn, setSavingConn] = useState(false);

  const load = () => clientesApi.obtener(Number(id)).then((r) => {
    setData(r.data);
    if (r.data.conexion) {
      setConnForm({
        ip_asignada: r.data.conexion.ip_asignada ?? '',
        mac_address: r.data.conexion.mac_address ?? '',
        puerto_olt: r.data.conexion.puerto_olt ?? '',
        tecnologia: r.data.conexion.tecnologia ?? 'fibra',
        estado: r.data.conexion.estado ?? 'conectado',
        observaciones: r.data.conexion.observaciones ?? '',
      });
    }
  });

  useEffect(() => {
    load();
    clientesApi.listarSesiones(Number(id)).then((r) => setSesiones(r.data)).catch(() => null);
  }, [id]);

  const cambiarEstado = async (estado: string) => {
    try {
      await clientesApi.cambiarEstado(Number(id), estado);
      toast.success('Estado actualizado');
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    }
  };

  const saveConexion = async () => {
    setSavingConn(true);
    try {
      await conexionesApi.upsert(Number(id), connForm);
      toast.success('Conexión actualizada');
      setShowConexion(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally {
      setSavingConn(false);
    }
  };

  if (!data) return <div className="text-gray-500">Cargando...</div>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/clientes')}>&larr; Volver</Button>
        <h2 className="text-xl font-semibold text-gray-900">{data.nombre}</h2>
        <Badge status={data.estado} />
      </div>

      {/* Info */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Datos del cliente</h3>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowEdit(true)}>Editar</Button>
            {data.estado !== 'activo' && <Button size="sm" onClick={() => cambiarEstado('activo')}>Activar</Button>}
            {data.estado !== 'suspendido' && <Button variant="danger" size="sm" onClick={() => cambiarEstado('suspendido')}>Suspender</Button>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          {[
            ['Email', data.email],
            ['Teléfono', data.telefono],
            ['DNI', data.dni],
            ['Dirección', data.direccion],
            ['Barrio', data.barrio],
            ['Ciudad', data.ciudad],
            ['Plan', data.plan_nombre],
            ['Alta', data.fecha_alta?.slice(0, 10)],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-gray-500">{label}</p>
              <p className="font-medium text-gray-800">{val ?? '—'}</p>
            </div>
          ))}
        </div>
        {data.notas && <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded p-2">{data.notas}</p>}
      </div>

      {/* Conexion */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">Conexión</h3>
          <Button variant="secondary" size="sm" onClick={() => setShowConexion(true)}>Editar conexión</Button>
        </div>
        {data.conexion ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              ['IP asignada', data.conexion.ip_asignada],
              ['MAC', data.conexion.mac_address],
              ['Puerto OLT', data.conexion.puerto_olt],
              ['Tecnología', data.conexion.tecnologia],
              ['Estado', null],
            ].map(([label, val]) => (
              <div key={label as string}>
                <p className="text-gray-500">{label}</p>
                {label === 'Estado'
                  ? <Badge status={data.conexion!.estado} />
                  : <p className="font-medium text-gray-800">{val ?? '—'}</p>}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-sm">Sin registro de conexión</p>
        )}
      </div>

      {/* Facturas */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Historial de facturación</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Período</th>
              <th className="px-4 py-3 text-left">Monto</th>
              <th className="px-4 py-3 text-left">Vencimiento</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Pago</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.facturas.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-6 text-gray-400">Sin facturas</td></tr>
            ) : data.facturas.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-3 font-medium">{f.periodo}</td>
                <td className="px-4 py-3">${Number(f.monto).toLocaleString()}</td>
                <td className="px-4 py-3 text-gray-500">{f.fecha_vencimiento?.slice(0, 10)}</td>
                <td className="px-4 py-3"><Badge status={f.estado_pago} /></td>
                <td className="px-4 py-3 text-gray-500">{f.metodo_pago ?? '—'}</td>
                <td className="px-4 py-3 text-right">
                  {f.estado_pago !== 'pagado' && (
                    <Button size="sm" onClick={() => setShowPago(f)}>Registrar pago</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Historial de sesiones del portal */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Historial de sesiones (portal)</h3>
          {data.sesion_activa && (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>En línea ahora
            </span>
          )}
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Inicio de sesión</th>
              <th className="px-4 py-3 text-left">Cierre de sesión</th>
              <th className="px-4 py-3 text-left">Duración</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sesiones.length === 0 ? (
              <tr><td colSpan={3} className="text-center py-6 text-gray-400">Sin sesiones registradas</td></tr>
            ) : sesiones.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 text-gray-700">{new Date(s.inicio).toLocaleString('es-AR')}</td>
                <td className="px-4 py-3 text-gray-500">
                  {s.fin
                    ? new Date(s.fin).toLocaleString('es-AR')
                    : <span className="inline-flex items-center gap-1 text-green-600 font-medium"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>Activa</span>}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {s.duracion_seg != null ? formatDuracion(s.duracion_seg) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showEdit && (
        <Modal title="Editar cliente" onClose={() => setShowEdit(false)} size="lg">
          <ClienteForm cliente={data} onSuccess={load} onClose={() => setShowEdit(false)} />
        </Modal>
      )}

      {showConexion && (
        <Modal title="Editar conexión" onClose={() => setShowConexion(false)}>
          <div className="space-y-4">
            {[
              { k: 'ip_asignada', label: 'IP asignada', placeholder: '192.168.1.100' },
              { k: 'mac_address', label: 'MAC address', placeholder: 'AA:BB:CC:DD:EE:FF' },
              { k: 'puerto_olt', label: 'Puerto OLT/Switch', placeholder: '1/1/3' },
            ].map(({ k, label, placeholder }) => (
              <div key={k}>
                <label className="text-sm font-medium text-gray-700 block mb-1">{label}</label>
                <input value={(connForm as any)[k]} onChange={(e) => setConnForm((f) => ({ ...f, [k]: e.target.value }))} placeholder={placeholder} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            ))}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Tecnología</label>
                <select value={connForm.tecnologia} onChange={(e) => setConnForm((f) => ({ ...f, tecnologia: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="fibra">Fibra óptica</option>
                  <option value="inalambrico">Inalámbrico</option>
                  <option value="cable">Cable</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">Estado</label>
                <select value={connForm.estado} onChange={(e) => setConnForm((f) => ({ ...f, estado: e.target.value as 'conectado' | 'desconectado' | 'con_problemas' }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="conectado">Conectado</option>
                  <option value="desconectado">Desconectado</option>
                  <option value="con_problemas">Con problemas</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Observaciones</label>
              <textarea value={connForm.observaciones} onChange={(e) => setConnForm((f) => ({ ...f, observaciones: e.target.value }))} rows={2} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowConexion(false)}>Cancelar</Button>
              <Button onClick={saveConexion} disabled={savingConn}>{savingConn ? 'Guardando...' : 'Guardar'}</Button>
            </div>
          </div>
        </Modal>
      )}

      {showPago && (
        <Modal title="Registrar pago" onClose={() => setShowPago(null)} size="sm">
          <FacturaForm factura={showPago} onSuccess={load} onClose={() => setShowPago(null)} />
        </Modal>
      )}
    </div>
  );
};
