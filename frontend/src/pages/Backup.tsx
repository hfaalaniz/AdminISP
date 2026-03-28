import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api`, timeout: 120000 });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('isp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

interface BackupFile {
  filename: string;
  size: number;
  created_at: string;
}

interface Schedule {
  enabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  hour: number;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
}

export const Backup = () => {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [schedule, setSchedule] = useState<Schedule>({ enabled: false, frequency: 'daily', hour: 2 });
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchBackups();
    fetchSchedule();
  }, []);

  const fetchBackups = async () => {
    try {
      const { data } = await api.get('/backup/list');
      setBackups(data);
    } catch {
      toast.error('Error cargando backups');
    }
  };

  const fetchSchedule = async () => {
    try {
      const { data } = await api.get('/backup/schedule');
      setSchedule(data);
    } catch {}
  };

  const handleDownload = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/backup/download');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Backup descargado');
    } catch {
      toast.error('Error descargando backup');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveServer = async () => {
    setLoading(true);
    try {
      await api.post('/backup/save');
      toast.success('Backup guardado en el servidor');
      fetchBackups();
    } catch {
      toast.error('Error guardando backup');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadServer = async (filename: string) => {
    try {
      const { data } = await api.get(`/backup/server/${filename}`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Error descargando backup');
    }
  };

  const handleDeleteServer = async (filename: string) => {
    try {
      await api.delete(`/backup/server/${filename}`);
      toast.success('Backup eliminado');
      fetchBackups();
    } catch {
      toast.error('Error eliminando backup');
    }
  };

  const handleRestoreFromFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmRestore(`__file__:${file.name}`);
    // Guardar el file en un ref temporal para usarlo después
    (fileInputRef.current as any)._pendingFile = file;
    e.target.value = '';
  };

  const handleRestoreServer = (filename: string) => {
    setConfirmRestore(filename);
  };

  const executeRestore = async () => {
    if (!confirmRestore) return;
    setRestoring(true);
    try {
      if (confirmRestore.startsWith('__file__:')) {
        const file = (fileInputRef.current as any)._pendingFile as File;
        const text = await file.text();
        const data = JSON.parse(text);
        await api.post('/backup/restore', data);
      } else {
        const { data: backupData } = await api.get(`/backup/server/${confirmRestore}`);
        await api.post('/backup/restore', backupData);
      }
      toast.success('Base de datos restaurada exitosamente');
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Error restaurando backup');
    } finally {
      setRestoring(false);
      setConfirmRestore(null);
    }
  };

  const handleSaveSchedule = async () => {
    try {
      await api.post('/backup/schedule', schedule);
      toast.success('Configuración guardada');
    } catch {
      toast.error('Error guardando configuración');
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold text-white">Gestión de Base de Datos</h1>

      {/* Acciones rápidas */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Backup manual</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ⬇️ Descargar al PC
          </button>
          <button
            onClick={handleSaveServer}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            💾 Guardar en servidor
          </button>
          <button
            onClick={handleRestoreFromFile}
            disabled={restoring}
            className="flex items-center gap-2 px-4 py-2.5 bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            📂 Restaurar desde archivo
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileSelected} />
        </div>
        <p className="text-gray-400 text-xs mt-3">
          El backup incluye todas las tablas: clientes, facturas, planes, usuarios, órdenes y más.
        </p>
      </div>

      {/* Backups en servidor */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Backups en servidor</h2>
          <span className="text-xs text-gray-400">{backups.length} archivos</span>
        </div>
        {backups.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay backups guardados en el servidor.</p>
        ) : (
          <div className="space-y-2">
            {backups.map((b) => (
              <div key={b.filename} className="flex items-center justify-between bg-gray-700 rounded-lg px-4 py-3">
                <div>
                  <p className="text-white text-sm font-medium">{b.filename}</p>
                  <p className="text-gray-400 text-xs">{formatDate(b.created_at)} · {formatSize(b.size)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadServer(b.filename)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                  >
                    ⬇️ Descargar
                  </button>
                  <button
                    onClick={() => handleRestoreServer(b.filename)}
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors"
                  >
                    🔄 Restaurar
                  </button>
                  <button
                    onClick={() => handleDeleteServer(b.filename)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs rounded-lg transition-colors"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Backup automático */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4">Backup automático</h2>
        <div className="space-y-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={schedule.enabled}
              onChange={(e) => setSchedule(s => ({ ...s, enabled: e.target.checked }))}
              className="w-4 h-4 accent-blue-500"
            />
            <span className="text-white text-sm">Activar backup automático</span>
          </label>

          {schedule.enabled && (
            <div className="grid grid-cols-2 gap-4 pl-7">
              <div>
                <label className="block text-gray-400 text-xs mb-1.5">Frecuencia</label>
                <select
                  value={schedule.frequency}
                  onChange={(e) => setSchedule(s => ({ ...s, frequency: e.target.value as Schedule['frequency'] }))}
                  className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
                >
                  <option value="hourly">Cada hora</option>
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                </select>
              </div>
              {schedule.frequency !== 'hourly' && (
                <div>
                  <label className="block text-gray-400 text-xs mb-1.5">Hora del backup</label>
                  <select
                    value={schedule.hour}
                    onChange={(e) => setSchedule(s => ({ ...s, hour: parseInt(e.target.value) }))}
                    className="w-full bg-gray-700 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSaveSchedule}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Guardar configuración
          </button>
          <p className="text-gray-400 text-xs">Se conservan los últimos 10 backups automáticos.</p>
        </div>
      </div>

      {/* Modal confirmación restaurar */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-2">⚠️ Confirmar restauración</h3>
            <p className="text-gray-300 text-sm mb-1">
              Esto reemplazará <strong className="text-white">todos los datos actuales</strong> con los del backup:
            </p>
            <p className="text-yellow-400 text-sm font-mono mb-4 break-all">
              {confirmRestore.startsWith('__file__:') ? confirmRestore.replace('__file__:', '') : confirmRestore}
            </p>
            <p className="text-red-400 text-xs mb-6">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmRestore(null)}
                disabled={restoring}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeRestore}
                disabled={restoring}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {restoring ? 'Restaurando...' : 'Sí, restaurar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
