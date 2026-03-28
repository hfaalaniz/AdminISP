import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const adminNav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/ordenes', label: 'Órdenes de Trabajo', icon: '🔧' },
  { to: '/clientes', label: 'Clientes', icon: '👥' },
  { to: '/planes', label: 'Planes', icon: '📦' },
  { to: '/conexiones', label: 'Conexiones', icon: '🌐' },
  { to: '/facturacion', label: 'Facturación', icon: '💳' },
  { to: '/usuarios', label: 'Usuarios', icon: '🧑‍💼' },
  { to: '/notificaciones', label: 'Notificaciones', icon: '📣' },
  { to: '/monitoreo', label: 'Monitoreo', icon: '🔍' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙️' },
  { to: '/backup', label: 'Base de Datos', icon: '🗄️' },
];

const tecnicoNav = [
  { to: '/', label: 'Dashboard', icon: '📊' },
  { to: '/ordenes', label: 'Mis órdenes', icon: '🔧' },
];

export const Sidebar = () => {
  const { user } = useAuth();
  const nav = user?.rol === 'tecnico' ? tecnicoNav : adminNav;

  return (
    <aside className="w-56 bg-gray-900 text-white flex flex-col h-screen sticky top-0">
      <div className="px-6 py-5 border-b border-gray-700">
        <div className="text-lg font-bold text-white">AdminISP</div>
        <div className="text-xs text-gray-400 mt-0.5 capitalize">{user?.rol ?? 'usuario'}</div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {nav.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <span>{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
