import axios from 'axios';
import type { Cliente, ClienteDetalle, Plan, Conexion, Factura, DashboardStats, PaginatedResponse, SesionCliente, OfertaInstalacion } from '../types';

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api`, timeout: 10000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('isp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !err.config?.url?.includes('/auth/login')) {
      localStorage.removeItem('isp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: { id: number; nombre: string; email: string; rol: string } }>('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.put('/auth/password', { current_password, new_password }),
};

export const clientesApi = {
  listar: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Cliente>>('/clientes', { params }),
  obtener: (id: number) => api.get<ClienteDetalle>(`/clientes/${id}`),
  crear: (data: FormData | Record<string, unknown>) =>
    api.post<Cliente>('/clientes', data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  actualizar: (id: number, data: FormData | Record<string, unknown>) =>
    api.put<Cliente>(`/clientes/${id}`, data, data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : {}),
  eliminar: (id: number) => api.delete(`/clientes/${id}`),
  cambiarEstado: (id: number, estado: string) =>
    api.patch<Cliente>(`/clientes/${id}/estado`, { estado }),
  listarSesiones: (id: number) => api.get<SesionCliente[]>(`/clientes/${id}/sesiones`),
};

export const planesApi = {
  listar: (soloActivos = false) =>
    api.get<Plan[]>('/planes', { params: soloActivos ? { activo: 'true' } : {} }),
  crear: (data: Partial<Plan>) => api.post<Plan>('/planes', data),
  actualizar: (id: number, data: Partial<Plan>) => api.put<Plan>(`/planes/${id}`, data),
  eliminar: (id: number) => api.delete(`/planes/${id}`),
};

export const conexionesApi = {
  listar: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Conexion & { cliente_nombre: string; cliente_estado: string }>>('/conexiones', { params }),
  upsert: (clienteId: number, data: Partial<Conexion>) =>
    api.put<Conexion>(`/conexiones/${clienteId}`, data),
};

export const facturasApi = {
  listar: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<Factura>>('/facturas', { params }),
  crear: (data: Partial<Factura>) => api.post<Factura>('/facturas', data),
  registrarPago: (id: number, data: { metodo_pago: string; referencia_pago?: string }) =>
    api.patch<Factura>(`/facturas/${id}/pago`, data),
  generarMensual: () => api.post<{ message: string; count: number }>('/facturas/generar-mensual'),
  generarParaCliente: (clienteId: number) =>
    api.post<Factura>(`/facturas/generar-cliente/${clienteId}`),
};

export const dashboardApi = {
  stats: () => api.get<DashboardStats>('/dashboard/stats'),
};

import type { Equipo, ConfiguracionISP, Usuario, OrdenTrabajo, ParteTecnico } from '../types';

export const ofertasApi = {
  listar: () => api.get<OfertaInstalacion[]>('/ofertas'),
  crear: (data: Partial<OfertaInstalacion>) => api.post<OfertaInstalacion>('/ofertas', data),
  actualizar: (id: number, data: Partial<OfertaInstalacion>) => api.put<OfertaInstalacion>(`/ofertas/${id}`, data),
  eliminar: (id: number) => api.delete(`/ofertas/${id}`),
};

export const equiposApi = {
  listar: () => api.get<Equipo[]>('/equipos'),
  crear: (data: Partial<Equipo>) => api.post<Equipo>('/equipos', data),
  actualizar: (id: number, data: Partial<Equipo>) => api.put<Equipo>(`/equipos/${id}`, data),
  eliminar: (id: number) => api.delete(`/equipos/${id}`),
};

export const configuracionApi = {
  obtener: () => api.get<ConfiguracionISP>('/configuracion'),
  actualizar: (data: Partial<ConfiguracionISP>) => api.put<ConfiguracionISP>('/configuracion', data),
};

export const contratoApi = {
  descargar: (clienteId: number) =>
    api.get(`/public/contrato/${clienteId}`, { responseType: 'blob' }),
};

export const usuariosApi = {
  listar: () => api.get<Usuario[]>('/usuarios'),
  listarTecnicos: () => api.get<{ id: number; nombre: string; email: string }[]>('/usuarios/tecnicos'),
  crear: (data: { nombre: string; email: string; password: string; rol: string }) =>
    api.post<Usuario>('/usuarios', data),
  actualizar: (id: number, data: Partial<{ nombre: string; email: string; rol: string }>) =>
    api.put<Usuario>(`/usuarios/${id}`, data),
  cambiarEstado: (id: number, activo: boolean) =>
    api.patch<Usuario>(`/usuarios/${id}/estado`, { activo }),
  resetPassword: (id: number, new_password: string) =>
    api.put(`/usuarios/${id}/password`, { new_password }),
};

export const ordenesApi = {
  listar: (params?: Record<string, string>) =>
    api.get<PaginatedResponse<OrdenTrabajo>>('/ordenes', { params }),
  obtener: (id: number) => api.get<OrdenTrabajo>(`/ordenes/${id}`),
  crear: (data: Partial<OrdenTrabajo>) => api.post<OrdenTrabajo>('/ordenes', data),
  actualizar: (id: number, data: Partial<OrdenTrabajo>) =>
    api.put<OrdenTrabajo>(`/ordenes/${id}`, data),
  cambiarEstado: (id: number, estado: string) =>
    api.patch<OrdenTrabajo>(`/ordenes/${id}/estado`, { estado }),
};

export const partesApi = {
  crear: (ordenId: number, data: Partial<ParteTecnico>) =>
    api.post<ParteTecnico>(`/ordenes/${ordenId}/parte`, data),
  actualizar: (id: number, data: Partial<ParteTecnico>) =>
    api.put<ParteTecnico>(`/partes/${id}`, data),
  submit: (id: number) => api.patch<ParteTecnico>(`/partes/${id}/submit`),
  unlock: (id: number) => api.patch<ParteTecnico>(`/partes/${id}/unlock`),
  subirImagenes: (id: number, files: File[]) => {
    const fd = new FormData();
    files.forEach((f) => fd.append('imagenes', f));
    return api.post<ParteTecnico>(`/partes/${id}/imagenes`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  eliminarImagen: (id: number, filename: string) =>
    api.delete<ParteTecnico>(`/partes/${id}/imagenes/${filename}`),
};
