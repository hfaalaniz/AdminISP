import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Layout } from './components/layout/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Clientes } from './pages/Clientes';
import { ClienteDetalle } from './pages/ClienteDetalle';
import { Planes } from './pages/Planes';
import { Conexiones } from './pages/Conexiones';
import { Facturacion } from './pages/Facturacion';
import { Configuracion } from './pages/Configuracion';
import { Usuarios } from './pages/Usuarios';
import { Ordenes } from './pages/Ordenes';
import { OrdenDetalle } from './pages/OrdenDetalle';
import { Inscripcion } from './pages/Inscripcion';
import { Notificaciones } from './pages/Notificaciones';
import { Monitoreo } from './pages/Monitoreo';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  if (user?.rol !== 'admin') return <Navigate to="/ordenes" replace />;
  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="clientes/:id" element={<ClienteDetalle />} />
            <Route path="planes" element={<Planes />} />
            <Route path="conexiones" element={<Conexiones />} />
            <Route path="facturacion" element={<AdminRoute><Facturacion /></AdminRoute>} />
            <Route path="configuracion" element={<AdminRoute><Configuracion /></AdminRoute>} />
            <Route path="usuarios" element={<AdminRoute><Usuarios /></AdminRoute>} />
            <Route path="ordenes" element={<Ordenes />} />
            <Route path="ordenes/:id" element={<OrdenDetalle />} />
            <Route path="notificaciones" element={<AdminRoute><Notificaciones /></AdminRoute>} />
            <Route path="monitoreo" element={<AdminRoute><Monitoreo /></AdminRoute>} />
          </Route>
          <Route path="/inscripcion" element={<Inscripcion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
