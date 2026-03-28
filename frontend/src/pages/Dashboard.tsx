import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';
import { StatCard } from '../components/ui/StatCard';
import type { DashboardStats } from '../types';

export const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    dashboardApi.stats().then((r) => setStats(r.data));
  }, []);

  if (!stats) return <div className="text-gray-500">Cargando...</div>;

  const fmt = (n: number) => `$${Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })}`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total clientes" value={stats.total_clientes} icon="👥" color="bg-blue-50 text-blue-600" />
        <StatCard label="Clientes activos" value={stats.clientes_activos} icon="✅" color="bg-green-50 text-green-600" />
        <StatCard label="Suspendidos" value={stats.clientes_suspendidos} icon="⚠️" color="bg-yellow-50 text-yellow-600" />
        <StatCard label="Conexiones OK" value={stats.conexiones_ok} icon="🌐" color="bg-teal-50 text-teal-600" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Con problemas" value={stats.conexiones_problema} icon="🔴" color="bg-red-50 text-red-600" />
        <StatCard label="Facturas pendientes" value={stats.facturas_pendientes} icon="📄" color="bg-orange-50 text-orange-600" />
        <StatCard label="Monto pendiente" value={fmt(stats.monto_pendiente)} icon="💰" color="bg-orange-50 text-orange-600" />
        <StatCard label="Cobrado este mes" value={fmt(stats.monto_cobrado_mes)} icon="💵" color="bg-green-50 text-green-600" />
      </div>
    </div>
  );
};
