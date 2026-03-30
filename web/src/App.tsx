import { useState, useEffect, useCallback, useRef } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Plan {
  id: number
  nombre: string
  velocidad_down: number
  velocidad_up: number
  precio_mensual: number
  descripcion?: string
}

interface ISP {
  nombre_empresa: string
  cuit?: string
  domicilio?: string
  telefono?: string
  email?: string
  localidad: string
  provincia: string
}

interface Factura {
  id: number
  periodo: string
  monto: number
  estado_pago: 'pendiente' | 'pagado' | 'vencido'
  fecha_vencimiento: string
  fecha_pago?: string
  metodo_pago?: string
}

interface Notificacion {
  id: number
  tipo: string
  titulo: string
  mensaje: string
  created_at: string
  leida_at?: string | null
}

interface OfertaInstalacion {
  id: number
  nombre: string
  descripcion?: string
  tipo: 'gratis' | 'precio_fijo' | 'cuotas'
  precio_total: number
  precio_original?: number
  cuotas: number
  activa: boolean
  destacada: boolean
  badge_texto?: string
  plan_ids: number[]
}

interface ClienteInfo {
  id: number
  nombre: string
  email: string
  telefono?: string
  dni?: string
  direccion?: string
  barrio?: string
  ciudad?: string
  estado: string
  fecha_alta: string
  contrato_listo: boolean
  plan_nombre?: string
  velocidad_down?: number
  velocidad_up?: number
  precio_mensual?: number
  conexion?: { ip_asignada?: string; tecnologia?: string; estado: string } | null
  ordenes?: { id: number; tipo: string; estado: string; prioridad: string; created_at: string; fecha_programada?: string; fecha_completada?: string }[]
}

type Step = 'inicio' | 'planes' | 'instalacion' | 'formulario' | 'exito' | 'login' | 'portal'

// ── API ───────────────────────────────────────────────────────────────────────
const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL || ''}/api` })

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmt = (n: number) =>
  '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 })

const ESTADO_ORDEN: Record<string, string> = {
  pendiente: 'Pendiente', en_curso: 'En curso', completada: 'Completada', cancelada: 'Cancelada',
}
const TIPO_ORDEN: Record<string, string> = {
  conexion: 'Conexión', instalacion: 'Instalación', reparacion: 'Reparación', diagnostico: 'Diagnóstico', otro: 'Otro',
}
const ESTADO_COLOR: Record<string, string> = {
  pendiente: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30',
  en_curso: 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  completada: 'bg-green-400/20 text-green-300 border-green-400/30',
  cancelada: 'bg-gray-400/20 text-gray-300 border-gray-400/30',
}

// ── Field Components ──────────────────────────────────────────────────────────
const Field = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; placeholder?: string; required?: boolean
}) => (
  <div>
    <label className="block text-sm font-medium text-slate-300 mb-1.5">
      {label}{required && <span className="text-cyan-400 ml-0.5">*</span>}
    </label>
    <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 text-white
                 placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/12 transition" />
  </div>
)

const PasswordField = ({ label, value, onChange, placeholder = '••••••••', required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean
}) => {
  const [show, setShow] = useState(false)
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}{required && <span className="text-cyan-400 ml-0.5">*</span>}
      </label>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} required={required} autoComplete="new-password"
          className="w-full bg-white/8 border border-white/15 rounded-xl px-4 py-3 pr-12 text-white
                     placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/12 transition" />
        <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition">
          {show
            ? <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            : <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
          }
        </button>
      </div>
    </div>
  )
}

// ── Hero Carousel ─────────────────────────────────────────────────────────────
const SLIDES = [
  {
    tag: '🌐 Fibra óptica de última generación',
    title: 'Internet ultrarrápido\npara tu hogar',
    sub: 'Velocidades simétricas, instalación sin costo y soporte técnico personalizado.',
    cta: 'Ver planes',
    bg: 'from-slate-950 via-blue-950 to-cyan-950',
    accent: 'from-cyan-400 to-blue-500',
    img: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1600&q=80&auto=format&fit=crop',
  },
  {
    tag: '📡 Cobertura en toda la zona',
    title: 'Conexión estable\nlas 24 horas',
    sub: 'Red redundante con monitoreo constante. 99.9% de disponibilidad garantizada.',
    cta: 'Contratar ahora',
    bg: 'from-slate-950 via-indigo-950 to-blue-950',
    accent: 'from-indigo-400 to-purple-500',
    img: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=1600&q=80&auto=format&fit=crop',
  },
  {
    tag: '🤝 Atención personalizada',
    title: 'Soporte técnico\ncerca tuyo',
    sub: 'Equipo de técnicos locales. Respondemos rápido porque estamos en tu comunidad.',
    cta: 'Conocer más',
    bg: 'from-slate-950 via-teal-950 to-blue-950',
    accent: 'from-teal-400 to-cyan-500',
    img: 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=1600&q=80&auto=format&fit=crop',
  },
]

const HeroCarousel = ({ onCta, isp }: { onCta: () => void; isp: ISP }) => {
  const [current, setCurrent] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const go = (i: number) => setCurrent((i + SLIDES.length) % SLIDES.length)

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent(c => (c + 1) % SLIDES.length), 5000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  const slide = SLIDES[current]

  return (
    <div className={`relative min-h-[90vh] flex flex-col justify-center bg-gradient-to-br ${slide.bg} transition-all duration-700 overflow-hidden`}>
      {/* Background image */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-all duration-700"
        style={{ backgroundImage: `url(${slide.img})` }}
      />
      {/* Dark overlay so text stays readable */}
      <div className="absolute inset-0 bg-black/60" />
      {/* Decorative circles */}
      <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-white/3 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-white/3 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-24 w-full">
        <div className="max-w-2xl">
          <div className={`inline-flex items-center gap-2 bg-gradient-to-r ${slide.accent} bg-clip-text text-transparent text-sm font-semibold mb-6 tracking-wide`}>
            {slide.tag}
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-white leading-[1.05] mb-6 whitespace-pre-line">
            {slide.title}
          </h1>
          <p className="text-slate-300 text-lg md:text-xl mb-10 leading-relaxed max-w-lg">
            {slide.sub}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <button onClick={onCta}
              className={`bg-gradient-to-r ${slide.accent} text-white font-bold px-8 py-4 rounded-2xl text-base transition-all hover:scale-105 shadow-2xl hover:shadow-cyan-500/40`}>
              {slide.cta} →
            </button>
            {isp.telefono && (
              <a href={`tel:${isp.telefono}`}
                className="bg-white/10 hover:bg-white/18 border border-white/20 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all backdrop-blur-sm text-center">
                📞 {isp.telefono}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Slide dots */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => go(i)}
            className={`rounded-full transition-all duration-300 ${i === current ? 'w-8 h-2 bg-white' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`} />
        ))}
      </div>

      {/* Arrow buttons */}
      <button onClick={() => go(current - 1)}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 border border-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition">
        ‹
      </button>
      <button onClick={() => go(current + 1)}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-10 bg-white/10 hover:bg-white/20 border border-white/20 text-white w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm transition">
        ›
      </button>
    </div>
  )
}

// ── DNI Upload ────────────────────────────────────────────────────────────────
const DniUpload = ({ label, file, onChange }: { label: string; file: File | null; onChange: (f: File | null) => void }) => {
  const ref = useRef<HTMLInputElement>(null)
  const preview = file ? URL.createObjectURL(file) : null

  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}<span className="text-cyan-400 ml-0.5">*</span>
      </label>
      <div
        onClick={() => ref.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden
          ${file ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/15 bg-white/4 hover:border-cyan-500/40 hover:bg-white/8'}`}
        style={{ minHeight: '140px' }}
      >
        {preview ? (
          <img src={preview} alt={label} className="w-full h-36 object-cover" />
        ) : (
          <div className="flex flex-col items-center justify-center h-36 gap-2 px-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-white/8 flex items-center justify-center text-xl">🪪</div>
            <p className="text-slate-400 text-xs leading-relaxed">Tocá para subir<br /><span className="text-slate-600">JPG, PNG o WEBP · máx. 5 MB</span></p>
          </div>
        )}
        {file && (
          <div className="absolute bottom-0 inset-x-0 bg-black/60 backdrop-blur-sm px-3 py-1.5 flex items-center justify-between">
            <span className="text-xs text-white truncate max-w-[70%]">{file.name}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); if (ref.current) ref.current.value = ''; onChange(null) }}
              className="text-red-400 hover:text-red-300 text-xs font-bold ml-2">✕</button>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f) }} />
    </div>
  )
}

// ── Cambiar contraseña ────────────────────────────────────────────────────────
const CambiarPassword = ({ token }: { token: string }) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ actual: '', nueva: '', confirmar: '' })
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.nueva.length < 6) { toast.error('La nueva contraseña debe tener al menos 6 caracteres'); return }
    if (form.nueva !== form.confirmar) { toast.error('Las contraseñas no coinciden'); return }
    setLoading(true)
    try {
      await api.put('/cliente/password',
        { password_actual: form.actual, password_nueva: form.nueva },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      toast.success('Contraseña actualizada')
      setOpen(false)
      setForm({ actual: '', nueva: '', confirmar: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al cambiar la contraseña')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-white/8 border border-white/12 rounded-2xl p-5">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-cyan-400 uppercase tracking-wider">Seguridad</h3>
        {!open && (
          <button onClick={() => setOpen(true)}
            className="text-xs bg-white/10 hover:bg-white/18 border border-white/15 px-3 py-1.5 rounded-lg transition text-slate-300 hover:text-white">
            Cambiar contraseña
          </button>
        )}
      </div>
      {!open && <p className="text-slate-400 text-xs mt-2">Podés cambiar tu contraseña de acceso al portal.</p>}
      {open && (
        <form onSubmit={submit} className="mt-4 space-y-3">
          <PasswordField label="Contraseña actual" value={form.actual} onChange={(v) => setForm(f => ({ ...f, actual: v }))} required />
          <PasswordField label="Nueva contraseña" value={form.nueva} onChange={(v) => setForm(f => ({ ...f, nueva: v }))} placeholder="Mínimo 6 caracteres" required />
          <PasswordField label="Confirmar nueva contraseña" value={form.confirmar} onChange={(v) => setForm(f => ({ ...f, confirmar: v }))} placeholder="Repetir contraseña" required />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => { setOpen(false); setForm({ actual: '', nueva: '', confirmar: '' }) }}
              className="flex-1 bg-white/8 hover:bg-white/15 border border-white/15 py-2.5 rounded-xl text-sm font-semibold transition text-slate-300">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 py-2.5 rounded-xl text-sm font-bold transition text-white">
              {loading ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── ContactForm ───────────────────────────────────────────────────────────────
const ContactForm = () => {
  const [form, setForm] = useState({ nombre: '', email: '', telefono: '', mensaje: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim() || !form.mensaje.trim()) return toast.error('Completá nombre y mensaje')
    setSending(true)
    try {
      await api.post('/public/contacto', form)
      setSent(true)
      setForm({ nombre: '', email: '', telefono: '', mensaje: '' })
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al enviar. Intentá de nuevo.')
    } finally {
      setSending(false)
    }
  }

  if (sent) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-10 text-center">
      <div className="text-5xl">✅</div>
      <h4 className="font-bold text-white text-lg">¡Mensaje enviado!</h4>
      <p className="text-slate-400 text-sm max-w-xs">Recibimos tu consulta y te respondemos a la brevedad.</p>
      <button onClick={() => setSent(false)} className="text-cyan-400 hover:text-cyan-300 text-sm transition">Enviar otro mensaje</button>
    </div>
  )

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-cyan-400/60 focus:bg-white/8 transition"

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Nombre <span className="text-cyan-400">*</span></label>
        <input className={inputCls} placeholder="Tu nombre completo" value={form.nombre} onChange={set('nombre')} required />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
          <input type="email" className={inputCls} placeholder="tu@email.com" value={form.email} onChange={set('email')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Teléfono</label>
          <input type="tel" className={inputCls} placeholder="Tu teléfono" value={form.telefono} onChange={set('telefono')} />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-400 mb-1.5">Mensaje <span className="text-cyan-400">*</span></label>
        <textarea className={`${inputCls} resize-none`} rows={5} placeholder="¿En qué podemos ayudarte?" value={form.mensaje} onChange={set('mensaje')} required />
      </div>
      <button type="submit" disabled={sending}
        className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105">
        {sending ? 'Preparando...' : '📨 Enviar mensaje'}
      </button>
    </form>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [step, setStep] = useState<Step>('inicio')
  const [planes, setPlanes] = useState<Plan[]>([])
  const [planesLoaded, setPlanesLoaded] = useState(false)
  const [ofertas, setOfertas] = useState<OfertaInstalacion[]>([])
  const [isp, setIsp] = useState<ISP>({ nombre_empresa: 'AdminISP', localidad: 'Villa Santa Cruz del Lago', provincia: 'Córdoba' })
  const [planSel, setPlanSel] = useState<Plan | null>(null)
  const [ofertaSel, setOfertaSel] = useState<OfertaInstalacion | null>(null)
  const [loading, setLoading] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
  const [bannerIndex, setBannerIndex] = useState(0)
  const [bannerTransitioning, setBannerTransitioning] = useState(false)

  const bannerAds = [
    {
      tag: 'Sistema de Gestión',
      title: 'Gestioná tu negocio con StockFlow',
      desc: 'ERP completo con ventas, stock, facturación AFIP y más. Empezá gratis, sin tarjeta.',
      cta: 'Probar gratis →',
      url: 'https://stockflowy.netlify.app',
      accent: 'from-violet-500 to-indigo-600',
      glow: 'shadow-violet-500/30',
      glowHover: 'hover:shadow-violet-500/60',
      bg: 'from-violet-900/60 via-indigo-900/40 to-slate-900/80',
    },
    {
      tag: 'Servicios Eléctricos',
      title: 'ElectroNet — Electricistas en Córdoba',
      desc: 'Diagnóstico gratis en tu domicilio, disponibilidad 24/7 y garantía de 6 meses en trabajos.',
      cta: 'Ver servicios →',
      url: 'https://electronety.netlify.app',
      accent: 'from-lime-500 to-green-500',
      glow: 'shadow-lime-500/30',
      glowHover: 'hover:shadow-lime-500/60',
      bg: 'from-lime-900/60 via-green-900/40 to-slate-900/80',
    },
  ]

  const goToBanner = useCallback((i: number) => {
    setBannerTransitioning(true)
    setTimeout(() => { setBannerIndex(i); setBannerTransitioning(false) }, 250)
  }, [])

  useEffect(() => {
    if (!bannerVisible) return
    const t = setInterval(() => {
      goToBanner((bannerIndex + 1) % bannerAds.length)
    }, 5000)
    return () => clearInterval(t)
  }, [bannerVisible, bannerIndex, bannerAds.length, goToBanner])

  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '', dni: '',
    direccion: '', barrio: '', ciudad: '',
    password: '', passwordConfirm: '',
  })

  const [dniFrente, setDniFrente] = useState<File | null>(null)
  const [dniDorso, setDniDorso] = useState<File | null>(null)

  const [token, setToken] = useState<string | null>(() => localStorage.getItem('cliente_token'))
  const [cliente, setCliente] = useState<ClienteInfo | null>(null)
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [pagandoId, setPagandoId] = useState<number | null>(null)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [loginForm, setLoginForm] = useState({ email: '', password: '' })

  useEffect(() => {
    api.get<Plan[]>('/public/planes', { params: { activo: 'true' } }).then((r) => { setPlanes(r.data); setPlanesLoaded(true) }).catch(() => setPlanesLoaded(true))
    api.get<ISP>('/public/configuracion').then((r) => setIsp(r.data)).catch(() => null)
    api.get<OfertaInstalacion[]>('/public/ofertas', { params: { activa: 'true' } }).then((r) => setOfertas(r.data)).catch(() => null)
  }, [])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const loadFacturas = useCallback((tk: string) => {
    api.get<Factura[]>('/cliente/facturas', { headers: { Authorization: `Bearer ${tk}` } })
      .then((r) => setFacturas(r.data)).catch(() => null)
  }, [])

  const loadNotificaciones = useCallback((tk: string) => {
    api.get<Notificacion[]>('/cliente/notificaciones', { headers: { Authorization: `Bearer ${tk}` } })
      .then((r) => setNotificaciones(r.data)).catch(() => null)
  }, [])

  useEffect(() => {
    if (token) {
      api.get<ClienteInfo>('/cliente/me', { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => { setCliente(r.data); setStep('portal') })
        .catch(() => { localStorage.removeItem('cliente_token'); setToken(null) })
      loadFacturas(token)
      loadNotificaciones(token)
    }
  }, [token, loadFacturas, loadNotificaciones])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const pago = params.get('pago')
    if (!pago) return
    window.history.replaceState({}, '', window.location.pathname)
    if (pago === 'success') { toast.success('¡Pago acreditado! Gracias.'); if (token) loadFacturas(token) }
    else if (pago === 'failure') toast.error('El pago no se completó. Podés intentarlo de nuevo.')
    else if (pago === 'pending') toast('Tu pago está siendo procesado.', { icon: '⏳' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }))

  // Ofertas que aplican a un plan: plan_ids vacío = todas, si tiene elementos debe incluir el planId
  const ofertasParaPlan = (planId: number) =>
    ofertas.filter(o => !o.plan_ids || o.plan_ids.length === 0 || o.plan_ids.includes(planId))

  const elegirPlan = (plan: Plan) => {
    setPlanSel(plan)
    setStep(ofertasParaPlan(plan.id).length > 0 ? 'instalacion' : 'formulario')
  }
  const elegirOferta = (oferta: OfertaInstalacion) => { setOfertaSel(oferta); setStep('formulario') }
  const logout = async () => {
    if (token) {
      try { await api.post('/cliente/logout', {}, { headers: { Authorization: `Bearer ${token}` } }) } catch { /* ignorar */ }
    }
    localStorage.removeItem('cliente_token'); setToken(null); setCliente(null); setStep('inicio')
  }

  const scrollTo = (id: string) => {
    setNavOpen(false)
    if (step !== 'inicio') { setStep('inicio'); setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 100) }
    else document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true)
    try {
      const res = await api.post('/public/login-cliente', loginForm)
      localStorage.setItem('cliente_token', res.data.token); setToken(res.data.token)
    } catch (err: any) { toast.error(err.response?.data?.error ?? 'Error al iniciar sesión')
    } finally { setLoading(false) }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nombre.trim()) return toast.error('El nombre es requerido')
    if (!form.email.trim()) return toast.error('El email es requerido')
    if (!form.telefono.trim()) return toast.error('El teléfono es requerido')
    if (!dniFrente) return toast.error('La foto del frente del DNI es requerida')
    if (!dniDorso) return toast.error('La foto del dorso del DNI es requerida')
    if (form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres')
    if (form.password !== form.passwordConfirm) return toast.error('Las contraseñas no coinciden')
    setLoading(true)
    try {
      const { password, passwordConfirm, ...rest } = form
      const fd = new FormData()
      Object.entries({ ...rest, plan_id: planSel?.id ?? '', oferta_id: ofertaSel?.id ?? '', password }).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, String(v))
      })
      fd.append('dni_frente', dniFrente)
      fd.append('dni_dorso', dniDorso)
      const res = await api.post('/public/registro', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      localStorage.setItem('cliente_token', res.data.token); setToken(res.data.token); setStep('exito')
    } catch (err: any) { toast.error(err.response?.data?.error ?? 'Error al registrarse.')
    } finally { setLoading(false) }
  }

  const refreshPortal = () => {
    if (!token) return
    api.get<ClienteInfo>('/cliente/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setCliente(r.data)).catch(() => null)
    loadFacturas(token); loadNotificaciones(token)
  }

  const marcarLeida = async (id: number) => {
    if (!token) return
    await api.post(`/cliente/notificaciones/${id}/leer`, {}, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null)
    setNotificaciones((prev) => prev.map((n) => n.id === id ? { ...n, leida_at: new Date().toISOString() } : n))
  }

  const pagarFactura = async (facturaId: number) => {
    if (!token) return
    setPagandoId(facturaId)
    try {
      const res = await api.post(`/cliente/pagar/${facturaId}`, {}, { headers: { Authorization: `Bearer ${token}` } })
      window.location.href = res.data.init_point
    } catch (err: any) { toast.error(err.response?.data?.error ?? 'Error al iniciar el pago')
    } finally { setPagandoId(null) }
  }

  const descargarContrato = async () => {
    if (!token) return
    try {
      const res = await api.get('/cliente/contrato', { headers: { Authorization: `Bearer ${token}` }, responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a'); a.href = url; a.download = `contrato_${cliente?.id}.pdf`; a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      if (err.response?.status === 403) toast.error('El contrato estará disponible una vez que el técnico complete la instalación.')
      else toast.error('Error al descargar el contrato')
    }
  }

  const noReady = step !== 'inicio'

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* ═══════════════════════ BANNER PUBLICITARIO ═══════════════════════ */}
      {bannerVisible && (() => {
        const ad = bannerAds[bannerIndex]
        return (
          <div className={`fixed top-16 inset-x-0 z-40 px-4 py-2 flex items-center justify-center gap-3 backdrop-blur-md border-b border-white/8 shadow-lg transition-shadow duration-500 ${ad.glow}`}
            style={{
              background: bannerIndex === 0
                ? 'linear-gradient(270deg, #0f172a, #2e1065, #1e1b4b, #0f172a)'
                : 'linear-gradient(270deg, #0f172a, #14532d, #1a2e05, #0f172a)',
              backgroundSize: '400% 400%',
              animation: 'bannerShift 8s ease infinite',
            }}>
            <div className={`flex items-center gap-3 flex-1 justify-center min-w-0 transition-all duration-250 ${bannerTransitioning ? 'opacity-0 translate-y-1' : 'opacity-100 translate-y-0'}`}>
              <span className={`hidden sm:inline-block text-[10px] font-black uppercase tracking-widest bg-gradient-to-r ${ad.accent} text-white px-2.5 py-0.5 rounded-full shrink-0`}>
                {ad.tag}
              </span>
              <p className="text-sm text-slate-300 truncate">
                <span className="font-bold text-white">{ad.title}</span>
                <span className="hidden md:inline"> — {ad.desc}</span>
              </p>
              <a
                href={ad.url} target="_blank" rel="noopener noreferrer"
                className={`shrink-0 bg-gradient-to-r ${ad.accent} text-white text-xs font-bold px-4 py-1.5 rounded-xl transition-all duration-200 hover:scale-105 shadow-md ${ad.glow} ${ad.glowHover}`}
              >
                {ad.cta}
              </a>
            </div>
            <div className="flex items-center gap-1.5 shrink-0 ml-1">
              {bannerAds.map((_, i) => (
                <button key={i} onClick={() => goToBanner(i)}
                  className={`rounded-full transition-all duration-300 ${i === bannerIndex ? 'w-4 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'}`} />
              ))}
            </div>
            <button onClick={() => setBannerVisible(false)}
              className="shrink-0 text-slate-500 hover:text-white transition text-lg leading-none ml-1">
              ✕
            </button>
          </div>
        )
      })()}

      {/* ═══════════════════════ NAVBAR ═══════════════════════ */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled || noReady
          ? 'bg-slate-950/95 backdrop-blur-md border-b border-white/8 shadow-2xl'
          : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => { setStep('inicio'); setNavOpen(false) }}
            className="flex items-center gap-3 hover:opacity-80 transition shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg font-black shadow-lg">
              📡
            </div>
            <div className="text-left">
              <div className="text-base font-extrabold leading-tight tracking-tight">{isp.nombre_empresa}</div>
              <div className="text-cyan-400/70 text-[10px] leading-none">{isp.localidad}</div>
            </div>
          </button>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { label: 'Inicio', id: 'hero' },
              { label: 'Servicios', id: 'servicios' },
              { label: 'Planes', id: 'planes-section' },
              { label: 'Contacto', id: 'contacto' },
            ].map(({ label, id }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/8 transition">
                {label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {token && cliente ? (
              <>
                <button onClick={() => setStep('portal')}
                  className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white hover:text-cyan-300 transition px-3 py-2 rounded-xl hover:bg-white/8">
                  <span className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xs font-black">
                    {cliente.nombre.charAt(0).toUpperCase()}
                  </span>
                  {cliente.nombre.split(' ')[0]}
                </button>
                <button onClick={logout}
                  className="text-xs border border-white/20 hover:border-white/40 text-slate-300 hover:text-white px-3 py-2 rounded-xl transition">
                  Salir
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setStep('login')}
                  className="text-sm font-medium text-slate-300 hover:text-white px-3 py-2 rounded-xl hover:bg-white/8 transition hidden sm:block">
                  Ingresar
                </button>
                <button onClick={() => setStep('planes')}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105">
                  Contratar
                </button>
              </>
            )}

            {/* Hamburger */}
            <button onClick={() => setNavOpen(o => !o)}
              className="md:hidden w-9 h-9 flex flex-col justify-center items-center gap-1.5 rounded-xl hover:bg-white/8 transition">
              <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${navOpen ? 'rotate-45 translate-y-2' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${navOpen ? 'opacity-0' : ''}`} />
              <span className={`block w-5 h-0.5 bg-white transition-all duration-200 ${navOpen ? '-rotate-45 -translate-y-2' : ''}`} />
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {navOpen && (
          <div className="md:hidden bg-slate-950/98 backdrop-blur-xl border-t border-white/8 px-6 py-4 space-y-1">
            {[
              { label: 'Inicio', id: 'hero' },
              { label: 'Servicios', id: 'servicios' },
              { label: 'Planes', id: 'planes-section' },
              { label: 'Contacto', id: 'contacto' },
            ].map(({ label, id }) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="block w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-white/8 transition">
                {label}
              </button>
            ))}
            <div className="border-t border-white/8 pt-3 mt-3 flex flex-col gap-2">
              {token && cliente ? (
                <>
                  <button onClick={() => { setStep('portal'); setNavOpen(false) }}
                    className="text-sm font-semibold text-white py-3 px-4 rounded-xl bg-white/8 text-left">
                    👤 {cliente.nombre.split(' ')[0]} — Mi cuenta
                  </button>
                  <button onClick={logout} className="text-sm text-slate-400 py-2 px-4 text-left">Cerrar sesión</button>
                </>
              ) : (
                <>
                  <button onClick={() => { setStep('login'); setNavOpen(false) }}
                    className="text-sm font-semibold text-white py-3 px-4 rounded-xl bg-white/8 text-left">
                    Ingresar a mi cuenta
                  </button>
                  <button onClick={() => { setStep('planes'); setNavOpen(false) }}
                    className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-3 px-4 rounded-xl text-sm text-left transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105">
                    Contratar el servicio →
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ═══════════════════════ LOGIN ═══════════════════════ */}
      {step === 'login' && (
        <main className="flex-1 flex items-center justify-center px-6 py-24 min-h-screen">
          <div className="w-full max-w-md">
            <div className="text-center mb-10">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-3xl shadow-2xl shadow-cyan-500/30">
                🔐
              </div>
              <h2 className="text-3xl font-extrabold mb-2">Accedé a tu cuenta</h2>
              <p className="text-slate-400 text-sm">Gestioná tu servicio, pagos y contrato.</p>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-sm">
              <form onSubmit={submitLogin} className="space-y-4">
                <Field label="Email" value={loginForm.email} onChange={(v) => setLoginForm(f => ({ ...f, email: v }))}
                  type="email" placeholder="tu@email.com" required />
                <PasswordField label="Contraseña" value={loginForm.password} onChange={(v) => setLoginForm(f => ({ ...f, password: v }))}
                  placeholder="••••••••" required />
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50
                             text-white font-bold py-3.5 rounded-2xl text-base transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105 mt-2">
                  {loading ? 'Ingresando...' : 'Ingresar'}
                </button>
              </form>
              <div className="mt-6 text-center text-sm text-slate-400">
                ¿No tenés cuenta?{' '}
                <button onClick={() => setStep('planes')} className="text-cyan-400 font-semibold hover:text-cyan-300 transition">
                  Contratá el servicio
                </button>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => setStep('inicio')} className="text-slate-500 hover:text-white text-sm transition">
                ← Volver al inicio
              </button>
            </div>
          </div>
        </main>
      )}

      {/* ═══════════════════════ PORTAL ═══════════════════════ */}
      {step === 'portal' && cliente && (
        <main className="flex-1 px-4 sm:px-6 pt-24 pb-16 max-w-3xl mx-auto w-full space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pt-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg font-black shadow-lg">
                  {cliente.nombre.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-xl font-extrabold leading-tight">Bienvenido, {cliente.nombre.split(' ')[0]}</h2>
                  <p className="text-slate-400 text-xs">Panel de tu servicio</p>
                </div>
              </div>
            </div>
            <button onClick={refreshPortal} className="text-slate-500 hover:text-white text-xs transition flex items-center gap-1">
              ↻ Actualizar
            </button>
          </div>

          {/* Suspensión */}
          {cliente.estado === 'suspendido' && (
            <div className="bg-red-500/15 border border-red-500/30 rounded-2xl p-4 flex items-start gap-3">
              <span className="text-xl mt-0.5">⚠️</span>
              <div>
                <p className="font-bold text-red-300 text-sm">Servicio suspendido por falta de pago</p>
                <p className="text-red-300/70 text-xs mt-0.5 leading-relaxed">
                  Realizá el pago de las facturas pendientes para restablecer la conexión.
                </p>
              </div>
            </div>
          )}

          {/* Estado del servicio */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Estado del servicio</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs mb-1">Estado</p>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                  cliente.estado === 'activo' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                  cliente.estado === 'suspendido' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                  'bg-slate-500/15 text-slate-400 border-slate-500/30'
                }`}>{cliente.estado.charAt(0).toUpperCase() + cliente.estado.slice(1)}</span>
              </div>
              {cliente.plan_nombre && (
                <div><p className="text-slate-500 text-xs mb-1">Plan</p><p className="font-semibold text-white">{cliente.plan_nombre}</p></div>
              )}
              {cliente.precio_mensual && (
                <div><p className="text-slate-500 text-xs mb-1">Abono mensual</p><p className="font-semibold text-white">{fmt(cliente.precio_mensual)}</p></div>
              )}
              {cliente.velocidad_down && (
                <div><p className="text-slate-500 text-xs mb-1">Velocidad</p><p className="font-semibold text-white">↓{cliente.velocidad_down} / ↑{cliente.velocidad_up} Mbps</p></div>
              )}
              {cliente.conexion && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Conexión</p>
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    cliente.conexion.estado === 'conectado' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30'
                  }`}>{cliente.conexion.estado}</span>
                </div>
              )}
              <div><p className="text-slate-500 text-xs mb-1">Cliente desde</p><p className="font-semibold text-white">{new Date(cliente.fecha_alta).toLocaleDateString('es-AR')}</p></div>
            </div>
          </div>

          {/* Tus datos */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Tus datos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {([['Email', cliente.email], ['Teléfono', cliente.telefono], ['DNI', cliente.dni],
                ['Dirección', cliente.direccion], ['Barrio', cliente.barrio], ['Ciudad', cliente.ciudad]
              ] as [string, string | undefined][]).filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <p className="text-slate-500 text-xs mb-0.5">{label}</p>
                  <p className="font-medium text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Seguridad */}
          <CambiarPassword token={token!} />

          {/* Contrato */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Contrato</h3>
            {cliente.contrato_listo ? (
              <div>
                <p className="text-sm text-slate-300 mb-4">Tu contrato está disponible. Incluye los datos técnicos de los equipos instalados.</p>
                <button onClick={descargarContrato}
                  className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105 flex items-center gap-2">
                  📄 Descargar contrato en PDF
                </button>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <span className="text-xl mt-0.5">⏳</span>
                <div>
                  <p className="font-semibold text-sm">Contrato pendiente</p>
                  <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                    Estará disponible una vez que el técnico complete la instalación y cargue los números de serie.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Órdenes */}
          {cliente.ordenes && cliente.ordenes.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Historial de visitas</h3>
              <div className="space-y-3">
                {cliente.ordenes.map((o) => (
                  <div key={o.id} className="flex items-center justify-between py-2 border-b border-white/8 last:border-0">
                    <div>
                      <p className="font-medium text-sm text-white">{TIPO_ORDEN[o.tipo] ?? o.tipo}</p>
                      <p className="text-slate-500 text-xs mt-0.5">
                        {o.fecha_programada ? `Programada: ${new Date(o.fecha_programada).toLocaleDateString('es-AR')}` : `Registrada: ${new Date(o.created_at).toLocaleDateString('es-AR')}`}
                        {o.fecha_completada && ` · Completada: ${new Date(o.fecha_completada).toLocaleDateString('es-AR')}`}
                      </p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${ESTADO_COLOR[o.estado] ?? ''}`}>
                      {ESTADO_ORDEN[o.estado] ?? o.estado}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Facturas */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
            <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Mis pagos</h3>
            {facturas.length === 0 ? (
              <p className="text-sm text-slate-400">No hay facturas registradas aún.</p>
            ) : (
              <div className="space-y-1">
                {facturas.map((f) => {
                  const pendiente = f.estado_pago !== 'pagado'
                  const [anio, mes] = f.periodo.split('-')
                  const periodoLabel = new Date(Number(anio), Number(mes) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                  return (
                    <div key={f.id} className="flex items-center justify-between py-3 border-b border-white/8 last:border-0 gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm text-white capitalize">{periodoLabel}</p>
                        <p className="text-slate-400 text-xs mt-0.5">
                          {fmt(f.monto)}
                          {f.estado_pago === 'pagado' && f.fecha_pago
                            ? ` · Pagado el ${new Date(f.fecha_pago).toLocaleDateString('es-AR')}${f.metodo_pago === 'mercadopago' ? ' vía MP' : ''}`
                            : ` · Vence el 15/${mes}/${anio}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${
                          f.estado_pago === 'pagado' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' :
                          f.estado_pago === 'vencido' ? 'bg-red-500/15 text-red-400 border-red-500/30' :
                          'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
                        }`}>{f.estado_pago === 'pagado' ? 'Pagado' : f.estado_pago === 'vencido' ? 'Vencido' : 'Pendiente'}</span>
                        {pendiente && (
                          <button onClick={() => pagarFactura(f.id)} disabled={pagandoId === f.id}
                            className={`text-white text-xs font-bold px-3 py-1.5 rounded-lg transition disabled:opacity-50 ${
                              f.estado_pago === 'vencido' ? 'bg-red-500 hover:bg-red-400' : 'bg-cyan-600 hover:bg-cyan-500'
                            }`}>
                            {pagandoId === f.id ? '...' : '💳 Pagar'}
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Notificaciones */}
          {notificaciones.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <h3 className="font-bold text-xs text-cyan-400 uppercase tracking-widest mb-4">Notificaciones</h3>
              <div className="space-y-3">
                {notificaciones.map((n) => {
                  const leida = !!n.leida_at
                  return (
                    <div key={n.id} onClick={() => { if (!leida) marcarLeida(n.id) }}
                      className={`rounded-xl p-4 border transition cursor-pointer ${
                        leida ? 'bg-white/3 border-white/8 opacity-60' : 'bg-cyan-500/8 border-cyan-500/25 hover:bg-cyan-500/12'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-semibold ${leida ? 'text-slate-300' : 'text-white'}`}>{n.titulo}</p>
                        {!leida && <span className="shrink-0 w-2 h-2 rounded-full bg-cyan-400 mt-1.5" />}
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed mt-1">{n.mensaje}</p>
                      <p className="text-slate-600 text-xs mt-2">{new Date(n.created_at).toLocaleString('es-AR')}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contacto */}
          {(isp.telefono || isp.email) && (
            <div className="bg-white/3 border border-white/8 rounded-2xl p-5 text-center">
              <p className="font-semibold text-sm text-white mb-3">¿Necesitás ayuda?</p>
              <div className="flex justify-center gap-6 text-sm text-slate-400">
                {isp.telefono && <a href={`tel:${isp.telefono}`} className="hover:text-cyan-400 transition">📞 {isp.telefono}</a>}
                {isp.email && <a href={`mailto:${isp.email}`} className="hover:text-cyan-400 transition">✉️ {isp.email}</a>}
              </div>
            </div>
          )}
        </main>
      )}

      {/* ═══════════════════════ INICIO ═══════════════════════ */}
      {step === 'inicio' && (
        <main className="flex-1">

          {/* Hero */}
          <div id="hero">
            <HeroCarousel onCta={() => setStep('planes')} isp={isp} />
          </div>

          {/* Stats bar */}
          <div className="bg-slate-900 border-y border-white/8">
            <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { val: '99.9%', label: 'Disponibilidad' },
                { val: '24/7', label: 'Soporte técnico' },
                { val: '1 Gbps', label: 'Velocidad máxima' },
                { val: '0$', label: 'Costo de instalación' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="text-2xl md:text-3xl font-black bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">{val}</div>
                  <div className="text-slate-400 text-xs mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Servicios */}
          <section id="servicios" className="px-6 py-20 max-w-6xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-block bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1 text-cyan-400 text-xs font-semibold mb-4 tracking-wide uppercase">
                Nuestros servicios
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4">¿Por qué elegirnos?</h2>
              <p className="text-slate-400 max-w-xl mx-auto">Tecnología de punta, atención local y precios transparentes sin letras chicas.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: '⚡', title: 'Alta velocidad', desc: 'Fibra óptica simétrica y tecnología inalámbrica para streaming 4K, gaming y trabajo remoto sin interrupciones.', color: 'from-yellow-500/20 to-orange-500/10 border-yellow-500/20' },
                { icon: '🛡️', title: 'Red estable', desc: 'Infraestructura redundante con monitoreo 24/7 y 99.9% de disponibilidad garantizada en tu servicio.', color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/20' },
                { icon: '🤝', title: 'Soporte local', desc: 'Equipo de técnicos de la zona disponible para asistirte. Instalación incluida y atención personalizada.', color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/20' },
              ].map(({ icon, title, desc, color }) => (
                <div key={title} className={`bg-gradient-to-br ${color} border rounded-3xl p-7 transition-all duration-200 hover:-translate-y-1 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20`}>
                  <div className="text-4xl mb-5">{icon}</div>
                  <h3 className="font-bold text-lg text-white mb-3">{title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Proceso */}
          <section className="bg-slate-900/60 border-y border-white/8 px-6 py-20">
            <div className="max-w-5xl mx-auto">
              <div className="text-center mb-14">
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">¿Cómo funciona?</h2>
                <p className="text-slate-400">Conectarte es fácil y rápido</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-6 relative">
                <div className="hidden sm:block absolute top-8 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                {[
                  { n: '01', icon: '📋', title: 'Elegí tu plan', desc: 'Seleccioná el plan que más se adapta a tus necesidades.' },
                  { n: '02', icon: '📝', title: 'Completá el formulario', desc: 'Ingresá tus datos y creá tu cuenta en minutos.' },
                  { n: '03', icon: '📅', title: 'Coordinamos la instalación', desc: 'Un técnico te contactará para acordar la visita.' },
                  { n: '04', icon: '🚀', title: '¡A navegar!', desc: 'Una vez instalado, tu conexión está activa de inmediato.' },
                ].map(({ n, icon, title, desc }) => (
                  <div key={n} className="text-center relative z-10 rounded-2xl p-4 transition-all duration-200 hover:-translate-y-1 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-800 border border-white/10 flex items-center justify-center text-2xl shadow-xl">
                      {icon}
                    </div>
                    <div className="text-xs font-bold text-cyan-500 mb-1">{n}</div>
                    <h4 className="font-bold text-white text-sm mb-2">{title}</h4>
                    <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Planes */}
          <section id="planes-section" className="px-6 py-20 max-w-6xl mx-auto">
          {planes.length > 0 && (<>
              <div className="text-center mb-14">
                <div className="inline-block bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1 text-cyan-400 text-xs font-semibold mb-4 tracking-wide uppercase">
                  Planes y precios
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">Planes para todos</h2>
                <p className="text-slate-400">Instalación gratis · Equipos en comodato · Sin permanencia</p>
              </div>
              <div className={`grid gap-8 w-full ${
                planes.length === 1 ? 'grid-cols-1 max-w-lg mx-auto' :
                planes.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
                planes.length === 3 ? 'grid-cols-1 sm:grid-cols-3' :
                'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
              }`}>
                {planes.map((p) => {
                  const ofertasPlan = ofertasParaPlan(p.id)
                  const ofertaGratis = ofertasPlan.find(o => o.tipo === 'gratis' || Number(o.precio_total) === 0)
                  const ofertaDest   = ofertasPlan.find(o => o.destacada)
                  const mejorOferta  = ofertaDest || ofertaGratis || ofertasPlan[0]
                  return (
                    <div key={p.id} onClick={() => elegirPlan(p)}
                      className="group relative rounded-3xl p-10 flex flex-col gap-7 cursor-pointer transition-all duration-200 hover:-translate-y-1 w-full bg-slate-900 border border-white/10 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20">
                      {mejorOferta && (
                        <div className="absolute -top-3.5 right-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap uppercase">
                          🎁 {mejorOferta.nombre}
                        </div>
                      )}
                      <div>
                        <h3 className="text-xl font-bold text-white">{p.nombre}</h3>
                        {p.descripcion && <p className="text-sm text-slate-400 mt-2 leading-relaxed">{p.descripcion}</p>}
                      </div>
                      <div className="flex gap-2.5 flex-wrap">
                        <span className="bg-white/8 border border-white/10 px-4 py-2 rounded-xl text-sm text-slate-300 font-medium">↓ {p.velocidad_down} Mbps</span>
                        <span className="bg-white/8 border border-white/10 px-4 py-2 rounded-xl text-sm text-slate-300 font-medium">↑ {p.velocidad_up} Mbps</span>
                      </div>
                      <div className="mt-auto">
                        <div className="text-5xl font-black text-white">{fmt(p.precio_mensual)}</div>
                        <div className="text-slate-400 text-sm mt-1.5">por mes</div>
                      </div>
                      <div className="w-full py-4 rounded-2xl font-bold text-base text-center transition-colors bg-white/8 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600 text-white border border-white/15 group-hover:border-transparent">
                        Elegir este plan
                      </div>
                    </div>
                  )
                })}
              </div>
            </>)}
          </section>

          {/* CTA banner */}
          <section className="px-6 py-20">
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-cyan-500/15 via-blue-600/10 to-indigo-600/15 border border-cyan-500/20 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none" />
              <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">¿Listo para conectarte?</h2>
              <p className="text-slate-400 mb-8 relative max-w-md mx-auto">
                Completá el formulario en minutos y un técnico coordinará la instalación sin costo adicional.
              </p>
              <button onClick={() => setStep('planes')}
                className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black px-10 py-4 rounded-2xl text-lg transition-all shadow-2xl shadow-cyan-500/30 hover:scale-105 relative">
                Quiero contratar →
              </button>
            </div>
          </section>

          {/* Contacto */}
          <section id="contacto" className="bg-slate-900/60 border-t border-white/8 px-6 py-20">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-14">
                <div className="inline-block bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1 text-cyan-400 text-xs font-semibold mb-4 tracking-wide uppercase">
                  Contacto
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white mb-4">¿Cómo podemos ayudarte?</h2>
                <p className="text-slate-400 max-w-xl mx-auto">Completá el formulario o contactanos directamente. Te respondemos a la brevedad.</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Formulario */}
                <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-8">
                  <h3 className="text-lg font-bold text-white mb-6">Envianos un mensaje</h3>
                  <ContactForm />
                </div>

                {/* Info + Mapa */}
                <div className="flex flex-col gap-6">
                  {/* Datos de contacto */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {isp.telefono && (
                      <a href={`tel:${isp.telefono}`}
                        className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20 group">
                        <div className="text-2xl shrink-0">📞</div>
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Teléfono</p>
                          <p className="font-bold text-white group-hover:text-cyan-300 transition text-sm">{isp.telefono}</p>
                        </div>
                      </a>
                    )}
                    {isp.email && (
                      <a href={`mailto:${isp.email}`}
                        className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 flex items-center gap-4 transition-all duration-200 hover:-translate-y-1 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20 group">
                        <div className="text-2xl shrink-0">✉️</div>
                        <div>
                          <p className="text-xs text-slate-500 mb-0.5">Email</p>
                          <p className="font-bold text-white group-hover:text-cyan-300 transition text-sm break-all">{isp.email}</p>
                        </div>
                      </a>
                    )}
                    <div className="bg-slate-800/60 border border-white/10 rounded-2xl p-5 flex items-center gap-4 sm:col-span-2">
                      <div className="text-2xl shrink-0">📍</div>
                      <div>
                        <p className="text-xs text-slate-500 mb-0.5">Ubicación</p>
                        <p className="font-bold text-white text-sm">{isp.localidad}, {isp.provincia}</p>
                        {isp.domicilio && <p className="text-slate-400 text-xs mt-0.5">{isp.domicilio}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Mapa */}
                  <div className="rounded-3xl overflow-hidden border border-white/10 flex-1 min-h-[220px]">
                    <iframe
                      title="Ubicación"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=-64.5546,-31.3901,-64.5146,-31.3501&layer=mapnik&marker=-31.370145,-64.534620`}
                      className="w-full h-full min-h-[220px]"
                      style={{ border: 0, filter: 'invert(90%) hue-rotate(180deg)' }}
                      loading="lazy"
                    />
                  </div>

                  {/* Cómo llegar */}
                  <div className="bg-slate-800/50 border border-white/10 rounded-3xl p-6">
                    <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">🗺️ Cómo llegar</h3>
                    <ol className="space-y-3">
                      {[
                        { n: '1', text: `Dirigite a ${isp.localidad}, ${isp.provincia}.` },
                        { n: '2', text: isp.domicilio ? `Buscá ${isp.domicilio}.` : 'Consultá la dirección exacta por teléfono o email.' },
                        { n: '3', text: 'Si venís desde la ruta, tomá el acceso a Villa Carlos Paz y seguí hacia el centro.' },
                        { n: '4', text: 'También podés agendar una visita técnica y nosotros vamos a tu domicilio.' },
                      ].map(({ n, text }) => (
                        <li key={n} className="flex items-start gap-3 text-sm text-slate-400">
                          <span className="shrink-0 w-6 h-6 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-black flex items-center justify-center">{n}</span>
                          {text}
                        </li>
                      ))}
                    </ol>
                    <a
                      href="https://www.openstreetmap.org/?mlat=-31.370145&mlon=-64.534620#map=17/-31.370145/-64.534620"
                      target="_blank" rel="noopener noreferrer"
                      className="mt-5 inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 text-sm font-semibold transition">
                      Ver en mapa completo →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* ═══════════════════════ PLANES (página) ═══════════════════════ */}
      {step === 'planes' && (
        <main className="flex-1 px-6 pt-28 pb-16 max-w-6xl mx-auto w-full">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-3">Elegí tu plan</h2>
            <p className="text-slate-400">Todos los planes incluyen equipos en comodato.</p>
          </div>

          {!planesLoaded ? (
            <p className="text-center text-slate-400">Cargando planes...</p>
          ) : planes.length === 0 ? (
            <p className="text-center text-slate-400">No hay planes disponibles por el momento.</p>
          ) : (
            <div className={`grid gap-5 justify-center ${
              planes.length === 1 ? 'grid-cols-1 max-w-xs mx-auto' :
              planes.length === 2 ? 'grid-cols-1 sm:grid-cols-2 max-w-2xl mx-auto' :
              planes.length === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
            }`}>
              {planes.map((p) => {
                const ofertasPlan = ofertasParaPlan(p.id)
                const ofertaGratis = ofertasPlan.find(o => o.tipo === 'gratis' || Number(o.precio_total) === 0)
                const ofertaDest   = ofertasPlan.find(o => o.destacada)
                const mejorOferta  = ofertaDest || ofertaGratis || ofertasPlan[0]
                return (
                  <div key={p.id} onClick={() => elegirPlan(p)}
                    className="group relative rounded-3xl p-8 flex flex-col gap-6 cursor-pointer transition-all duration-200 hover:-translate-y-1 bg-slate-900 border border-white/10 hover:bg-gradient-to-b hover:from-cyan-500/25 hover:to-blue-600/20 hover:border-cyan-500/50 hover:shadow-2xl hover:shadow-cyan-500/20">
                    {mejorOferta && (
                      <div className="absolute -top-3.5 right-4 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[11px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap uppercase">
                        🎁 {mejorOferta.nombre}
                      </div>
                    )}
                    <div>
                      <h3 className="text-lg font-bold text-white">{p.nombre}</h3>
                      {p.descripcion && <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{p.descripcion}</p>}
                    </div>
                    <div className="flex gap-2.5 flex-wrap">
                      <span className="bg-white/8 border border-white/10 px-3 py-1.5 rounded-lg text-sm text-slate-300">↓ {p.velocidad_down} Mbps</span>
                      <span className="bg-white/8 border border-white/10 px-3 py-1.5 rounded-lg text-sm text-slate-300">↑ {p.velocidad_up} Mbps</span>
                    </div>
                    <div className="mt-auto">
                      <div className="text-4xl font-black text-white">{fmt(p.precio_mensual)}</div>
                      <div className="text-slate-400 text-sm mt-1">por mes</div>
                    </div>
                    <div className="w-full py-3 rounded-2xl font-bold text-base text-center transition-colors bg-white/8 group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600 text-white border border-white/15 group-hover:border-transparent">
                      Elegir este plan
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div className="text-center mt-10">
            <button onClick={() => setStep('inicio')} className="text-slate-500 hover:text-white text-sm transition">
              ← Volver al inicio
            </button>
          </div>
        </main>
      )}

      {/* ═══════════════════════ INSTALACIÓN ═══════════════════════ */}
      {step === 'instalacion' && planSel && (
        <main className="flex-1 px-6 pt-28 pb-16 max-w-3xl mx-auto w-full">
          <button onClick={() => setStep('planes')} className="text-slate-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition">
            ← Volver a los planes
          </button>

          {/* Plan seleccionado */}
          <div className="bg-gradient-to-r from-cyan-500/15 to-blue-600/10 border border-cyan-500/25 rounded-2xl p-5 mb-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-cyan-400 text-xs mb-0.5 font-semibold uppercase tracking-wide">Plan seleccionado</p>
              <p className="font-bold text-lg text-white">{planSel.nombre}</p>
              <p className="text-slate-400 text-sm">↓ {planSel.velocidad_down} Mbps · ↑ {planSel.velocidad_up} Mbps</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black text-white">{fmt(planSel.precio_mensual)}</p>
              <p className="text-slate-400 text-xs">por mes</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">¿Cómo querés abonar la instalación?</h2>
          <p className="text-slate-400 text-sm mb-8">El precio mensual del servicio no cambia según esta opción.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ofertasParaPlan(planSel.id).map((o) => {
              const precioServicio = Number(planSel.precio_mensual)
              const precioTotal    = Number(o.precio_total)
              const precioOrig     = Number(o.precio_original) || 0
              const nCuotas        = Number(o.cuotas) || 1
              const gratis         = o.tipo === 'gratis' || precioTotal === 0
              const enCuotas       = o.tipo === 'cuotas' && nCuotas > 1
              const montoCuota     = enCuotas ? precioTotal / nCuotas : null
              const tieneAhorro    = precioOrig > 0 && precioOrig > precioTotal
              const ahorro         = tieneAhorro ? precioOrig - precioTotal : 0
              const pctAhorro      = tieneAhorro ? Math.round((ahorro / precioOrig) * 100) : 0
              // Lo que paga el primer mes: servicio + instalación (o primera cuota)
              const pagoInicial    = gratis ? precioServicio : enCuotas ? precioServicio + montoCuota! : precioServicio + precioTotal
              return (
                <button key={o.id} onClick={() => elegirOferta(o)}
                  className={`relative w-full text-left rounded-3xl p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5 group ${
                    o.destacada
                      ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/15 border-2 border-cyan-500/60 shadow-2xl shadow-cyan-500/20'
                      : 'bg-slate-900 border border-white/10 hover:border-white/25'
                  }`}>
                  {(o.destacada || o.badge_texto) && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">
                        {o.badge_texto || '★ Más conveniente'}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-bold text-white text-base mb-1.5">{o.nombre}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {gratis && <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">BONIFICADA</span>}
                      {enCuotas && <span className="text-[11px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">{o.cuotas} CUOTAS SIN INTERÉS</span>}
                      {tieneAhorro && <span className="text-[11px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">{pctAhorro}% OFF</span>}
                    </div>
                    {o.descripcion && <p className="text-slate-400 text-sm mt-2 leading-relaxed">{o.descripcion}</p>}
                  </div>
                  <div className="mt-auto space-y-3">
                    {/* Precio instalación */}
                    {gratis ? (
                      <div>
                        {tieneAhorro && <p className="text-slate-500 text-sm line-through">{fmt(precioOrig)}</p>}
                        <p className="text-3xl font-black text-emerald-400">GRATIS</p>
                        {tieneAhorro && <p className="text-emerald-400/70 text-xs mt-0.5">Ahorrás {fmt(ahorro)}</p>}
                      </div>
                    ) : enCuotas ? (
                      <div>
                        {tieneAhorro && <p className="text-slate-500 text-sm line-through">{fmt(precioOrig)}</p>}
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black text-white">{fmt(montoCuota!)}</p>
                          <p className="text-slate-400 text-sm">/ cuota</p>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{nCuotas} cuotas · total {fmt(precioTotal)}</p>
                        {tieneAhorro && <p className="text-yellow-400/80 text-xs mt-0.5">Ahorrás {fmt(ahorro)} vs precio normal</p>}
                      </div>
                    ) : (
                      <div>
                        {tieneAhorro && <p className="text-slate-500 text-sm line-through">{fmt(precioOrig)}</p>}
                        <p className="text-3xl font-black text-white">{fmt(precioTotal)}</p>
                        {tieneAhorro && <p className="text-yellow-400/80 text-xs mt-0.5">Ahorrás {fmt(ahorro)}</p>}
                      </div>
                    )}

                    {/* Total primer mes */}
                    <div className="border-t border-white/10 pt-3 space-y-1">
                      <p className="text-slate-500 text-xs uppercase tracking-wide">Total primer mes</p>
                      <p className="text-2xl font-black text-cyan-400">{fmt(pagoInicial)}</p>
                      <div className="text-xs text-slate-500 space-y-0.5">
                        <p>{fmt(precioServicio)} · servicio mensual</p>
                        {gratis
                          ? <p className="text-emerald-400/80">+ $0 · instalación bonificada</p>
                          : enCuotas
                            ? <p>+ {fmt(montoCuota!)} · cuota 1 de {nCuotas}</p>
                            : <p>+ {fmt(precioTotal)} · instalación</p>
                        }
                      </div>
                    </div>
                  </div>
                  <div className={`w-full py-2.5 rounded-2xl font-bold text-sm text-center transition-colors mt-1 ${
                    o.destacada
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white group-hover:from-cyan-400 group-hover:to-blue-500'
                      : 'bg-white/8 hover:bg-white/15 text-white border border-white/15'
                  }`}>Elegir esta opción</div>
                </button>
              )
            })}
          </div>
        </main>
      )}

      {/* ═══════════════════════ FORMULARIO ═══════════════════════ */}
      {step === 'formulario' && planSel && (
        <main className="flex-1 px-6 pt-28 pb-16 max-w-2xl mx-auto w-full">
          <button onClick={() => setStep(ofertas.length > 0 ? 'instalacion' : 'planes')} className="text-slate-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition">
            ← Volver
          </button>

          {/* Resumen plan + instalación */}
          <div className="bg-gradient-to-r from-cyan-500/15 to-blue-600/10 border border-cyan-500/25 rounded-2xl p-5 mb-8 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-cyan-400 text-xs mb-0.5 font-semibold uppercase tracking-wide">Plan seleccionado</p>
                <p className="font-bold text-lg text-white">{planSel.nombre}</p>
                <p className="text-slate-400 text-sm">↓ {planSel.velocidad_down} Mbps · ↑ {planSel.velocidad_up} Mbps</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-black text-white">{fmt(planSel.precio_mensual)}</p>
                <p className="text-slate-400 text-xs">por mes</p>
              </div>
            </div>
            {ofertaSel && (
              <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5 uppercase tracking-wide">Instalación</p>
                  <p className="font-semibold text-white text-sm">{ofertaSel.nombre}</p>
                  {ofertaSel.tipo === 'cuotas' && ofertaSel.cuotas > 1 && (
                    <p className="text-slate-500 text-xs">{ofertaSel.cuotas} cuotas de {fmt(Number(ofertaSel.precio_total) / ofertaSel.cuotas)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {Number(ofertaSel.precio_total) === 0
                    ? <p className="text-emerald-400 font-black text-lg">GRATIS</p>
                    : <p className="text-white font-bold text-lg">{fmt(Number(ofertaSel.precio_total))}</p>}
                </div>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black text-white mb-6">Completá tus datos</h2>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Nombre completo" value={form.nombre} onChange={set('nombre')} placeholder="Juan García" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" value={form.email} onChange={set('email')} type="email" placeholder="juan@email.com" required />
              <Field label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="+54 9 351 000-0000" required />
            </div>
            <Field label="DNI" value={form.dni} onChange={set('dni')} placeholder="20123456" />
            <Field label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Calle Los Paraísos 123" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Barrio" value={form.barrio} onChange={set('barrio')} />
              <Field label="Ciudad" value={form.ciudad} onChange={set('ciudad')} />
            </div>

            <div className="border-t border-white/10 pt-5 mt-2">
              <p className="text-sm font-semibold text-white mb-1">🪪 Identificación</p>
              <p className="text-slate-500 text-xs mb-4">Subí una foto del frente y del dorso de tu DNI para verificar tu identidad.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DniUpload label="Frente del DNI" file={dniFrente} onChange={setDniFrente} />
                <DniUpload label="Dorso del DNI" file={dniDorso} onChange={setDniDorso} />
              </div>
            </div>

            <div className="border-t border-white/10 pt-5 mt-2">
              <p className="text-sm font-semibold text-white mb-1">🔐 Creá tu cuenta</p>
              <p className="text-slate-500 text-xs mb-4">Para gestionar tu servicio, pagos y descargar tu contrato.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordField label="Contraseña" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" required />
                <PasswordField label="Repetir contraseña" value={form.passwordConfirm} onChange={set('passwordConfirm')} placeholder="Repetir contraseña" required />
              </div>
            </div>

            <div className="bg-white/4 border border-white/10 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-400 mb-1">⚖️ Aceptación de términos</p>
              Al enviar este formulario aceptás las condiciones del contrato de prestación de servicios de {isp.nombre_empresa}.
              La sola aceptación constituye firma vinculante conforme al art. 288 del CCyCN.
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 disabled:opacity-50
                         text-white font-black py-4 rounded-2xl text-base transition-all shadow-2xl shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105">
              {loading ? 'Enviando solicitud...' : '✅ Solicitar instalación'}
            </button>
          </form>

          <div className="mt-5 text-center text-sm text-slate-500">
            ¿Ya tenés cuenta?{' '}
            <button onClick={() => setStep('login')} className="text-cyan-400 font-semibold hover:text-cyan-300 transition">
              Iniciá sesión
            </button>
          </div>
        </main>
      )}

      {/* ═══════════════════════ ÉXITO ═══════════════════════ */}
      {step === 'exito' && (
        <main className="flex-1 flex items-center justify-center px-6 py-24 min-h-screen">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-4xl shadow-2xl shadow-emerald-500/30">
              🎉
            </div>
            <h2 className="text-3xl font-extrabold mb-4">¡Solicitud enviada!</h2>
            <p className="text-slate-300 text-lg mb-2">
              Recibimos tu solicitud para el plan <strong className="text-white">{planSel?.nombre}</strong>.
            </p>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Nuestro equipo se va a comunicar con vos a la brevedad para coordinar la instalación.
              Gracias por elegir <strong className="text-white">{isp.nombre_empresa}</strong>.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <p className="font-semibold text-sm text-white mb-3">📋 ¿Qué pasa ahora?</p>
              <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside">
                <li>Un técnico coordinará la instalación con vos.</li>
                <li>Durante la visita se instalarán y registrarán los equipos.</li>
                <li>Una vez completada, el contrato PDF estará disponible en tu cuenta.</li>
              </ol>
            </div>
            <button onClick={() => setStep('portal')}
              className="w-full mb-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold py-4 rounded-2xl text-base transition-all shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/40 hover:scale-105 flex items-center justify-center gap-2">
              👤 Ver mi cuenta
            </button>
            {(isp.telefono || isp.email) && (
              <div className="mt-6 text-sm text-slate-500 space-y-1">
                <p className="font-semibold text-slate-400">¿Tenés alguna consulta?</p>
                {isp.telefono && <p>📞 <a href={`tel:${isp.telefono}`} className="hover:text-cyan-400 transition">{isp.telefono}</a></p>}
                {isp.email && <p>✉️ <a href={`mailto:${isp.email}`} className="hover:text-cyan-400 transition">{isp.email}</a></p>}
              </div>
            )}
          </div>
        </main>
      )}

      {/* ═══════════════════════ FOOTER ═══════════════════════ */}
      <footer className="bg-slate-950 border-t border-white/8">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg">📡</div>
              <div>
                <div className="font-extrabold text-white text-sm">{isp.nombre_empresa}</div>
                <div className="text-slate-500 text-xs">{isp.localidad}, {isp.provincia}</div>
              </div>
            </div>
            <div className="flex items-center gap-6 text-xs text-slate-500">
              {isp.cuit && <span>CUIT: {isp.cuit}</span>}
              {isp.domicilio && <span>{isp.domicilio}</span>}
              {isp.telefono && <a href={`tel:${isp.telefono}`} className="hover:text-cyan-400 transition">{isp.telefono}</a>}
              {isp.email && <a href={`mailto:${isp.email}`} className="hover:text-cyan-400 transition">{isp.email}</a>}
            </div>
          </div>
          <div className="border-t border-white/5 mt-8 pt-6 text-center text-xs text-slate-600">
            © {new Date().getFullYear()} {isp.nombre_empresa}. Todos los derechos reservados.
          </div>
        </div>
      </footer>

      {/* WhatsApp flotante */}
      {isp.telefono && (
        <a
          href={`https://wa.me/5493512848802?text=${encodeURIComponent('Hola! Me comunico desde el sitio web. Quería consultar sobre sus planes de internet.')}`}
          target="_blank" rel="noopener noreferrer"
          title="Contactanos por WhatsApp"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg shadow-[#25D366]/40 transition-all duration-200 hover:scale-110 hover:shadow-xl hover:shadow-[#25D366]/60"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-7 h-7 fill-white">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}

    </div>
  )
}
