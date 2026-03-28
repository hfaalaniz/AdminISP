export type CustomerStatus = 'activo' | 'suspendido' | 'inactivo';
export type ConnectionStatus = 'conectado' | 'desconectado' | 'con_problemas';
export type PaymentStatus = 'pendiente' | 'pagado' | 'vencido';

export interface Plan {
  id: number;
  nombre: string;
  velocidad_down: number;
  velocidad_up: number;
  precio_mensual: number;
  descripcion?: string;
  activo: boolean;
}

export interface Cliente {
  id: number;
  nombre: string;
  email?: string;
  telefono?: string;
  dni?: string;
  direccion?: string;
  barrio?: string;
  ciudad?: string;
  plan_id?: number;
  plan_nombre?: string;
  plan_precio?: number;
  velocidad_down?: number;
  velocidad_up?: number;
  estado: CustomerStatus;
  fecha_alta: string;
  notas?: string;
  dni_frente_url?: string;
  dni_dorso_url?: string;
  conexion_estado?: ConnectionStatus;
  sesion_activa?: boolean;
}

export interface ClienteDetalle extends Cliente {
  conexion: Conexion | null;
  facturas: Factura[];
}

export interface Conexion {
  id: number;
  cliente_id: number;
  ip_asignada?: string;
  mac_address?: string;
  puerto_olt?: string;
  tecnologia: string;
  estado: ConnectionStatus;
  ultimo_ping?: string;
  velocidad_real?: number;
  observaciones?: string;
  updated_at?: string;
}

export interface SesionCliente {
  id: number;
  inicio: string;
  fin?: string;
  duracion_seg?: number;
}

export interface Factura {
  id: number;
  cliente_id: number;
  cliente_nombre?: string;
  plan_nombre?: string;
  plan_id?: number;
  periodo: string;
  monto: number;
  estado_pago: PaymentStatus;
  fecha_vencimiento: string;
  fecha_pago?: string;
  metodo_pago?: string;
  referencia_pago?: string;
  notas?: string;
}

export interface OfertaInstalacion {
  id: number;
  nombre: string;
  descripcion?: string;
  tipo: 'gratis' | 'precio_fijo' | 'cuotas';
  precio_total: number;
  precio_original?: number;
  cuotas: number;
  activa: boolean;
  orden: number;
  destacada: boolean;
  badge_texto?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  plan_ids: number[];
}

export interface DashboardStats {
  total_clientes: number;
  clientes_activos: number;
  clientes_suspendidos: number;
  conexiones_ok: number;
  conexiones_problema: number;
  facturas_pendientes: number;
  monto_pendiente: number;
  monto_cobrado_mes: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: string;
}

export interface Equipo {
  id: number;
  nombre: string;
  marca?: string;
  modelo?: string;
  descripcion?: string;
  activo: boolean;
}

export type OrdenEstado = 'pendiente' | 'en_curso' | 'completada' | 'cancelada';
export type OrdenTipo = 'conexion' | 'instalacion' | 'reparacion' | 'diagnostico' | 'otro';
export type OrdenPrioridad = 'baja' | 'normal' | 'alta' | 'urgente';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
  created_at: string;
}

export interface EquipoInstalado {
  nombre: string;
  marca: string;
  modelo: string;
  nro_serie: string;
}

export interface ImagenParte {
  filename: string;
  url: string;
  originalname?: string;
  size?: number;
}

export interface ParteTecnico {
  id: number;
  orden_id: number;
  tecnico_id: number;
  trabajo_realizado?: string;
  equipos_instalados: EquipoInstalado[];
  observaciones?: string;
  estado_conexion_resultante?: string;
  fecha_trabajo?: string;
  imagenes: ImagenParte[];
  submitted_at?: string;
  locked: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrdenTrabajo {
  id: number;
  cliente_id: number;
  cliente_nombre?: string;
  cliente_email?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  tecnico_id?: number;
  tecnico_nombre?: string;
  creado_por_nombre?: string;
  plan_nombre?: string;
  velocidad_down?: number;
  velocidad_up?: number;
  tipo: OrdenTipo;
  descripcion?: string;
  estado: OrdenEstado;
  prioridad: OrdenPrioridad;
  fecha_programada?: string;
  fecha_completada?: string;
  created_at: string;
  parte?: ParteTecnico | null;
}

export interface ConfiguracionISP {
  id?: number;
  nombre_empresa: string;
  cuit?: string;
  domicilio?: string;
  telefono?: string;
  email?: string;
  localidad: string;
  provincia: string;
  logo_url?: string;
}
