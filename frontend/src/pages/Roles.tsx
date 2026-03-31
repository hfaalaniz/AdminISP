import { useEffect, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Modulo {
  key: string;
  label: string;
  acciones: string[];
}

type Permisos = Record<string, Record<string, Record<string, boolean>>>;

const ROLES = ['admin', 'operador', 'tecnico'] as const;
type Rol = typeof ROLES[number];

const ROL_LABEL: Record<Rol, string> = {
  admin: 'Administrador',
  operador: 'Operador',
  tecnico: 'Técnico',
};

const ACCION_LABEL: Record<string, string> = {
  ver: 'Ver',
  crear: 'Crear',
  editar: 'Editar',
  eliminar: 'Eliminar',
  cobrar: 'Cobrar',
  asignar: 'Asignar',
  gestionar: 'Gestionar',
  descargar: 'Descargar',
};

export const Roles = () => {
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [permisos, setPermisos] = useState<Permisos>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [rolActivo, setRolActivo] = useState<Rol>('operador');

  useEffect(() => {
    cargar();
  }, []);

  const cargar = async () => {
    try {
      const { data } = await api.get('/roles');
      setModulos(data.modulos);
      setPermisos(data.permisos);
    } catch {
      toast.error('Error al cargar permisos');
    } finally {
      setLoading(false);
    }
  };

  const togglePermiso = async (rol: Rol, modulo: string, accion: string) => {
    if (rol === 'admin') return; // admin es inmutable
    const actual = permisos[rol]?.[modulo]?.[accion] ?? false;
    const key = `${rol}.${modulo}.${accion}`;
    setSaving(key);

    // Optimistic update
    setPermisos(prev => ({
      ...prev,
      [rol]: {
        ...prev[rol],
        [modulo]: {
          ...prev[rol][modulo],
          [accion]: !actual,
        },
      },
    }));

    try {
      await api.put(`/roles/${rol}/${modulo}/${accion}`, { habilitado: !actual });
      toast.success('Permiso actualizado');
    } catch {
      // Revert on error
      setPermisos(prev => ({
        ...prev,
        [rol]: {
          ...prev[rol],
          [modulo]: {
            ...prev[rol][modulo],
            [accion]: actual,
          },
        },
      }));
      toast.error('Error al actualizar permiso');
    } finally {
      setSaving(null);
    }
  };

  const habilitadosEnRol = (rol: Rol) => {
    let total = 0, habilitados = 0;
    for (const mod of modulos) {
      for (const acc of mod.acciones) {
        total++;
        if (permisos[rol]?.[mod.key]?.[acc]) habilitados++;
      }
    }
    return { total, habilitados };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Cargando permisos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Roles y Permisos</h1>
        <p className="text-gray-500 text-sm mt-1">Configurá qué puede hacer cada rol en el sistema.</p>
      </div>

      {/* Tabs de roles */}
      <div className="flex gap-3">
        {ROLES.map(rol => {
          const { total, habilitados } = habilitadosEnRol(rol);
          const isAdmin = rol === 'admin';
          return (
            <button
              key={rol}
              onClick={() => setRolActivo(rol)}
              className={`flex-1 rounded-xl border p-4 text-left transition-all ${
                rolActivo === rol
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-gray-900">{ROL_LABEL[rol]}</span>
                {isAdmin && (
                  <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">
                    Acceso total
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500">
                {isAdmin ? 'Todos los permisos habilitados' : `${habilitados} de ${total} acciones`}
              </div>
              {!isAdmin && (
                <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-500 rounded-full transition-all"
                    style={{ width: `${total > 0 ? (habilitados / total) * 100 : 0}%` }}
                  />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Advertencia admin */}
      {rolActivo === 'admin' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
          El rol <strong>Administrador</strong> siempre tiene acceso completo al sistema y sus permisos no pueden modificarse.
        </div>
      )}

      {/* Tabla de permisos */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-5 py-3 font-semibold text-gray-600 w-48">Módulo</th>
              <th className="text-left px-5 py-3 font-semibold text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {modulos.map(modulo => (
              <tr key={modulo.key} className="hover:bg-gray-50 transition-colors">
                <td className="px-5 py-4">
                  <span className="font-medium text-gray-800">{modulo.label}</span>
                </td>
                <td className="px-5 py-4">
                  <div className="flex flex-wrap gap-3">
                    {modulo.acciones.map(accion => {
                      const habilitado = permisos[rolActivo]?.[modulo.key]?.[accion] ?? false;
                      const key = `${rolActivo}.${modulo.key}.${accion}`;
                      const cargando = saving === key;
                      const esAdmin = rolActivo === 'admin';

                      return (
                        <label
                          key={accion}
                          className={`flex items-center gap-2 select-none ${esAdmin ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                        >
                          <button
                            type="button"
                            disabled={esAdmin || cargando}
                            onClick={() => togglePermiso(rolActivo, modulo.key, accion)}
                            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                              habilitado
                                ? 'bg-blue-500 focus:ring-blue-300'
                                : 'bg-gray-300 focus:ring-gray-300'
                            } ${esAdmin || cargando ? 'opacity-60' : ''}`}
                            aria-checked={habilitado}
                            role="switch"
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                                habilitado ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                            {cargando && (
                              <span className="absolute inset-0 flex items-center justify-center">
                                <span className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" />
                              </span>
                            )}
                          </button>
                          <span className={`text-xs ${habilitado ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                            {ACCION_LABEL[accion] ?? accion}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400">
        Los cambios se guardan automáticamente. Los permisos afectan el acceso de nuevos inicios de sesión.
      </p>
    </div>
  );
};
