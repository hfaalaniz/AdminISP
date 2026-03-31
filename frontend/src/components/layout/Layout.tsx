import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

const titles: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/planes': 'Planes de Servicio',
  '/conexiones': 'Conexiones',
  '/facturacion': 'Facturación',
  '/configuracion': 'Configuración',
  '/usuarios': 'Usuarios',
  '/ordenes': 'Órdenes de Trabajo',
  '/roles': 'Roles y Permisos',
};

export const Layout = () => {
  const location = useLocation();
  const base = '/' + location.pathname.split('/')[1];
  const title = titles[base] ?? 'AdminISP';

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
