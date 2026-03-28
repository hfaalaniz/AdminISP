import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { usuariosApi } from '../services/api';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { PasswordInput } from '../components/ui/PasswordInput';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import type { Usuario } from '../types';
import { useAuth } from '../context/AuthContext';

const ROLES = ['admin', 'operador', 'tecnico'];

const UsuarioForm = ({ usuario, onSuccess, onClose }: { usuario?: Usuario; onSuccess: () => void; onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ nombre: usuario?.nombre ?? '', email: usuario?.email ?? '', password: '', passwordConfirm: '', rol: usuario?.rol ?? 'operador' });
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usuario && !form.password) return toast.error('Contraseña requerida');
    if (form.password && form.password !== form.passwordConfirm) return toast.error('Las contraseñas no coinciden');
    setLoading(true);
    try {
      if (usuario) {
        await usuariosApi.actualizar(usuario.id, { nombre: form.nombre, email: form.email, rol: form.rol });
        toast.success('Usuario actualizado');
      } else {
        await usuariosApi.crear({ nombre: form.nombre, email: form.email, password: form.password, rol: form.rol });
        toast.success('Usuario creado');
      }
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al guardar');
    } finally { setLoading(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Nombre completo *" value={form.nombre} onChange={set('nombre')} />
      <Input label="Email *" type="email" value={form.email} onChange={set('email')} />
      {!usuario && (
        <>
          <PasswordInput label="Contraseña *" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
          <PasswordInput label="Confirmar contraseña *" value={form.passwordConfirm} onChange={(e) => setForm((f) => ({ ...f, passwordConfirm: e.target.value }))} placeholder="••••••••" autoComplete="new-password" />
        </>
      )}
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Rol *</label>
        <select value={form.rol} onChange={set('rol')} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {ROLES.map((r) => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : usuario ? 'Actualizar' : 'Crear usuario'}</Button>
      </div>
    </form>
  );
};

const ResetPasswordModal = ({ usuario, onClose }: { usuario: Usuario; onClose: () => void }) => {
  const [pwd, setPwd] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwd) return toast.error('Ingresá la nueva contraseña');
    if (pwd !== pwdConfirm) return toast.error('Las contraseñas no coinciden');
    setLoading(true);
    try {
      await usuariosApi.resetPassword(usuario.id, pwd);
      toast.success('Contraseña actualizada');
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally { setLoading(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-gray-600">Cambiar contraseña de <strong>{usuario.nombre}</strong></p>
      <PasswordInput label="Nueva contraseña *" value={pwd} onChange={(e) => setPwd(e.target.value)} autoFocus placeholder="••••••••" autoComplete="new-password" />
      <PasswordInput label="Confirmar contraseña *" value={pwdConfirm} onChange={(e) => setPwdConfirm(e.target.value)} placeholder="••••••••" autoComplete="new-password" />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={loading}>{loading ? 'Guardando...' : 'Cambiar contraseña'}</Button>
      </div>
    </form>
  );
};

export const Usuarios = () => {
  const { user: me } = useAuth();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editUsuario, setEditUsuario] = useState<Usuario | undefined>();
  const [resetUsuario, setResetUsuario] = useState<Usuario | null>(null);
  const [toggleUsuario, setToggleUsuario] = useState<Usuario | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = () => usuariosApi.listar().then((r) => setUsuarios(r.data));
  useEffect(() => { load(); }, []);

  const handleToggle = async () => {
    if (!toggleUsuario) return;
    setToggling(true);
    try {
      await usuariosApi.cambiarEstado(toggleUsuario.id, !toggleUsuario.activo);
      toast.success(toggleUsuario.activo ? 'Usuario desactivado' : 'Usuario activado');
      setToggleUsuario(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error');
    } finally { setToggling(false); }
  };

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button onClick={() => { setEditUsuario(undefined); setShowForm(true); }}>+ Nuevo usuario</Button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 text-left">Nombre</th>
              <th className="px-4 py-3 text-left">Email</th>
              <th className="px-4 py-3 text-left">Rol</th>
              <th className="px-4 py-3 text-left">Estado</th>
              <th className="px-4 py-3 text-left">Alta</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {usuarios.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{u.nombre} {u.id === me?.id && <span className="text-xs text-blue-500">(vos)</span>}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3"><Badge status={u.rol} /></td>
                <td className="px-4 py-3"><Badge status={u.activo ? 'activo' : 'inactivo'} /></td>
                <td className="px-4 py-3 text-gray-500">{u.created_at?.slice(0, 10)}</td>
                <td className="px-4 py-3 text-right flex gap-1 justify-end">
                  <Button variant="ghost" size="sm" onClick={() => { setEditUsuario(u); setShowForm(true); }}>Editar</Button>
                  <Button variant="ghost" size="sm" onClick={() => setResetUsuario(u)}>Contraseña</Button>
                  {u.id !== me?.id && (
                    <Button variant="ghost" size="sm" className={u.activo ? 'text-red-500 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'}
                      onClick={() => setToggleUsuario(u)}>
                      {u.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <Modal title={editUsuario ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => setShowForm(false)}>
          <UsuarioForm usuario={editUsuario} onSuccess={load} onClose={() => setShowForm(false)} />
        </Modal>
      )}
      {resetUsuario && (
        <Modal title="Cambiar contraseña" onClose={() => setResetUsuario(null)} size="sm">
          <ResetPasswordModal usuario={resetUsuario} onClose={() => setResetUsuario(null)} />
        </Modal>
      )}
      {toggleUsuario && (
        <ConfirmDialog
          title={toggleUsuario.activo ? 'Desactivar usuario' : 'Activar usuario'}
          message={`¿${toggleUsuario.activo ? 'Desactivar' : 'Activar'} a ${toggleUsuario.nombre}?`}
          onConfirm={handleToggle}
          onClose={() => setToggleUsuario(null)}
          loading={toggling}
        />
      )}
    </div>
  );
};
