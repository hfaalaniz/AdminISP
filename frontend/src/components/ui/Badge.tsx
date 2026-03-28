import type { CustomerStatus, ConnectionStatus, PaymentStatus } from '../../types';

type Status = CustomerStatus | ConnectionStatus | PaymentStatus | string;

const colors: Record<string, string> = {
  activo: 'bg-green-100 text-green-800',
  suspendido: 'bg-yellow-100 text-yellow-800',
  inactivo: 'bg-gray-100 text-gray-600',
  conectado: 'bg-green-100 text-green-800',
  desconectado: 'bg-red-100 text-red-800',
  con_problemas: 'bg-orange-100 text-orange-800',
  pendiente: 'bg-yellow-100 text-yellow-800',
  pagado: 'bg-green-100 text-green-800',
  vencido: 'bg-red-100 text-red-800',
  // Órdenes estado
  en_curso: 'bg-blue-100 text-blue-800',
  completada: 'bg-green-100 text-green-800',
  cancelada: 'bg-gray-100 text-gray-600',
  // Órdenes tipo
  conexion: 'bg-green-100 text-green-800',
  instalacion: 'bg-purple-100 text-purple-800',
  reparacion: 'bg-orange-100 text-orange-800',
  diagnostico: 'bg-cyan-100 text-cyan-800',
  otro: 'bg-gray-100 text-gray-600',
  // Prioridad
  baja: 'bg-gray-100 text-gray-600',
  normal: 'bg-blue-100 text-blue-700',
  alta: 'bg-orange-100 text-orange-700',
  urgente: 'bg-red-100 text-red-700',
};

const labels: Record<string, string> = {
  con_problemas: 'Con problemas',
  en_curso: 'En curso',
  conexion: 'Conexión',
  instalacion: 'Instalación',
  reparacion: 'Reparación',
  diagnostico: 'Diagnóstico',
};

export const Badge = ({ status }: { status: Status }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${colors[status] ?? 'bg-gray-100 text-gray-600'}`}>
    {labels[status] ?? status}
  </span>
);
