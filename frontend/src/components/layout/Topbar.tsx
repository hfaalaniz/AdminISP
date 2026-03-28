import { useAuth } from '../../context/AuthContext';
import { Button } from '../ui/Button';

interface Props { title: string; }

export const Topbar = ({ title }: Props) => {
  const { user, logout } = useAuth();
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">{user?.nombre}</span>
        <Button variant="ghost" size="sm" onClick={logout}>Salir</Button>
      </div>
    </header>
  );
};
