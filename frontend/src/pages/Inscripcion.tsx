import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import type { Plan, OfertaInstalacion } from '../types';

const api = axios.create({ baseURL: '/api' });
const fmt = (n: number) => '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0 });

type Step = 'planes' | 'instalacion' | 'formulario' | 'exito';

// ── Componentes reutilizables ─────────────────────────────────────────────────
const Field = ({ label, value, onChange, type = 'text', placeholder = '', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
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
);

const PasswordField = ({ label, value, onChange, placeholder = '••••••••', required = false }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; required?: boolean;
}) => {
  const [show, setShow] = useState(false);
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
  );
};

const DniUpload = ({ label, file, onChange }: {
  label: string; file: File | null; onChange: (f: File | null) => void;
}) => {
  const ref = useRef<HTMLInputElement>(null);
  const preview = file ? URL.createObjectURL(file) : null;
  return (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-1.5">
        {label}<span className="text-cyan-400 ml-0.5">*</span>
      </label>
      <div onClick={() => ref.current?.click()}
        className={`relative cursor-pointer rounded-2xl border-2 border-dashed transition-all overflow-hidden
          ${file ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-white/15 bg-white/4 hover:border-cyan-500/40 hover:bg-white/8'}`}
        style={{ minHeight: '140px' }}>
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
            <button type="button" onClick={(e) => { e.stopPropagation(); if (ref.current) ref.current.value = ''; onChange(null); }}
              className="text-red-400 hover:text-red-300 text-xs font-bold ml-2">✕</button>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f); }} />
    </div>
  );
};

// ── Página principal ──────────────────────────────────────────────────────────
export const Inscripcion = () => {
  const [planes, setPlanes] = useState<Plan[]>([]);
  const [ofertas, setOfertas] = useState<OfertaInstalacion[]>([]);
  const [step, setStep] = useState<Step>('planes');
  const [planSeleccionado, setPlanSeleccionado] = useState<Plan | null>(null);
  const [ofertaSeleccionada, setOfertaSeleccionada] = useState<OfertaInstalacion | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    nombre: '', email: '', telefono: '', dni: '',
    direccion: '', barrio: '', ciudad: '',
    password: '', passwordConfirm: '',
  });
  const [dniFrente, setDniFrente] = useState<File | null>(null);
  const [dniDorso, setDniDorso] = useState<File | null>(null);

  useEffect(() => {
    api.get<Plan[]>('/public/planes', { params: { activo: 'true' } }).then((r) => setPlanes(r.data));
    api.get<OfertaInstalacion[]>('/public/ofertas', { params: { activa: 'true' } }).then((r) => setOfertas(r.data)).catch(() => null);
  }, []);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));
  const elegirPlan = (plan: Plan) => {
    setPlanSeleccionado(plan);
    // Si hay ofertas activas, mostrar paso de instalación; si no, ir directo al formulario
    setStep(ofertas.length > 0 ? 'instalacion' : 'formulario');
  };
  const elegirOferta = (oferta: OfertaInstalacion) => { setOfertaSeleccionada(oferta); setStep('formulario'); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre.trim()) return toast.error('El nombre es requerido');
    if (!form.telefono.trim()) return toast.error('El teléfono es requerido');
    if (!dniFrente) return toast.error('La foto del frente del DNI es requerida');
    if (!dniDorso) return toast.error('La foto del dorso del DNI es requerida');
    if (form.password && form.password.length < 6) return toast.error('La contraseña debe tener al menos 6 caracteres');
    if (form.password !== form.passwordConfirm) return toast.error('Las contraseñas no coinciden');

    setLoading(true);
    try {
      const { passwordConfirm, password, ...rest } = form;
      const fd = new FormData();
      Object.entries({ ...rest, plan_id: planSeleccionado?.id ?? '', oferta_id: ofertaSeleccionada?.id ?? '' }).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') fd.append(k, String(v));
      });
      if (password) fd.append('password', password);
      fd.append('dni_frente', dniFrente);
      fd.append('dni_dorso', dniDorso);

      await api.post('/public/inscripcion', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setStep('exito');
    } catch (err: any) {
      toast.error(err.response?.data?.error ?? 'Error al enviar. Intentá de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setStep('planes');
    setForm({ nombre: '', email: '', telefono: '', dni: '', direccion: '', barrio: '', ciudad: '', password: '', passwordConfirm: '' });
    setDniFrente(null);
    setDniDorso(null);
    setPlanSeleccionado(null);
    setOfertaSeleccionada(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">

      {/* Header */}
      <header className="bg-slate-950/95 backdrop-blur-md border-b border-white/8 px-6 h-16 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center text-lg font-black shadow-lg">
            📡
          </div>
          <div>
            <div className="text-base font-extrabold leading-tight">AdminISP</div>
            <div className="text-cyan-400/70 text-[10px] leading-none">Portal de inscripción</div>
          </div>
        </div>
        <a href="tel:" className="text-slate-400 text-sm hover:text-cyan-400 transition hidden sm:block">
          ¿Necesitás ayuda? Llamanos
        </a>
      </header>

      {/* ── PLANES ── */}
      {step === 'planes' && (
        <main className="flex-1">
          <section className="text-center px-6 py-20 max-w-3xl mx-auto">
            <div className="inline-block bg-cyan-500/10 border border-cyan-500/20 rounded-full px-4 py-1 text-cyan-400 text-xs font-semibold mb-6 tracking-wide uppercase">
              🌐 Conectividad de alta velocidad
            </div>
            <h1 className="text-4xl md:text-5xl font-black mb-5 leading-tight">
              Internet rápido y confiable<br />
              <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">para tu hogar o negocio</span>
            </h1>
            <p className="text-slate-400 text-lg mb-10 max-w-xl mx-auto">
              Elegí el plan que mejor se adapte a vos y completá tu solicitud en minutos.
            </p>
          </section>

          <section className="px-6 pb-10 max-w-6xl mx-auto">
            <h2 className="text-center text-xl font-bold mb-4 text-slate-300">Nuestros planes</h2>
            {ofertas.some(o => o.tipo === 'gratis' || Number(o.precio_total) === 0) && (
              <div className="flex items-center justify-center gap-2.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl px-5 py-3 mb-8 max-w-lg mx-auto">
                <span className="text-xl">🎁</span>
                <p className="text-emerald-400 text-sm font-semibold">
                  ¡Instalación <span className="text-emerald-300 font-black">GRATIS</span> disponible! Elegí cualquier plan para verla.
                </p>
              </div>
            )}
            {!ofertas.some(o => o.tipo === 'gratis' || Number(o.precio_total) === 0) && ofertas.length > 0 && (
              <div className="flex items-center justify-center gap-2.5 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl px-5 py-3 mb-8 max-w-lg mx-auto">
                <span className="text-xl">✨</span>
                <p className="text-cyan-400 text-sm font-semibold">
                  Tenemos <span className="text-cyan-300 font-black">promociones de instalación</span>. Elegí un plan para conocerlas.
                </p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {planes.length === 0 && (
                <p className="col-span-4 text-center text-slate-500 py-10">Cargando planes...</p>
              )}
              {(() => {
                const ofertaGratis = ofertas.find(o => o.tipo === 'gratis' || Number(o.precio_total) === 0);
                const ofertaDestacada = ofertas.find(o => o.destacada);
                const mejorOferta = ofertaDestacada || ofertaGratis;
                return planes.map((p, i) => {
                const popular = i === 1;
                return (
                  <div key={p.id} onClick={() => elegirPlan(p)}
                    className={`relative rounded-3xl p-6 flex flex-col gap-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 ${
                      popular
                        ? 'bg-gradient-to-b from-cyan-500/25 to-blue-600/20 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20'
                        : 'bg-slate-900 border border-white/10 hover:border-white/25'
                    }`}>
                    {popular && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap uppercase tracking-wide">
                        ★ Más popular
                      </div>
                    )}
                    {popular && mejorOferta && (
                      <div className="absolute -top-8 right-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-black px-2.5 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wide">
                        🎁 Instalación {ofertaGratis ? 'GRATIS' : 'bonificada'}
                      </div>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-white">{p.nombre}</h3>
                      {p.descripcion && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{p.descripcion}</p>}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="bg-white/8 border border-white/10 px-2.5 py-1 rounded-lg text-xs text-slate-300">↓ {p.velocidad_down} Mbps</span>
                      <span className="bg-white/8 border border-white/10 px-2.5 py-1 rounded-lg text-xs text-slate-300">↑ {p.velocidad_up} Mbps</span>
                    </div>
                    <div className="mt-auto">
                      <div className="text-3xl font-black text-white">{fmt(p.precio_mensual)}</div>
                      <div className="text-slate-400 text-xs mt-0.5">por mes</div>
                    </div>
                    <div className={`w-full py-2.5 rounded-2xl font-bold text-sm text-center transition-colors ${
                      popular
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white'
                        : 'bg-white/8 hover:bg-white/15 text-white border border-white/15'
                    }`}>
                      Elegir este plan
                    </div>
                  </div>
                );
              });
              })()}
            </div>
          </section>

          <section className="bg-slate-900/60 border-t border-white/8 px-6 py-16">
            <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              {[
                { icon: '⚡', title: 'Alta velocidad', desc: 'Conexión estable para streaming, gaming y trabajo remoto.' },
                { icon: '🛡️', title: 'Red estable', desc: 'Infraestructura redundante con 99.9% de disponibilidad.' },
                { icon: '🤝', title: 'Soporte local', desc: 'Técnicos de la zona disponibles para ayudarte.' },
              ].map(({ icon, title, desc }) => (
                <div key={title}>
                  <div className="text-4xl mb-3">{icon}</div>
                  <h3 className="font-bold text-lg mb-2 text-white">{title}</h3>
                  <p className="text-slate-400 text-sm">{desc}</p>
                </div>
              ))}
            </div>
          </section>
        </main>
      )}

      {/* ── INSTALACIÓN ── */}
      {step === 'instalacion' && planSeleccionado && (
        <main className="flex-1 px-6 py-12 max-w-3xl mx-auto w-full">
          <button onClick={() => setStep('planes')}
            className="text-slate-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition">
            ← Volver a los planes
          </button>

          {/* Plan seleccionado */}
          <div className="bg-gradient-to-r from-cyan-500/15 to-blue-600/10 border border-cyan-500/25 rounded-2xl p-5 mb-10 flex items-center justify-between gap-4">
            <div>
              <p className="text-cyan-400 text-xs mb-0.5 font-semibold uppercase tracking-wide">Plan seleccionado</p>
              <p className="font-bold text-lg text-white">{planSeleccionado.nombre}</p>
              <p className="text-slate-400 text-sm">↓ {planSeleccionado.velocidad_down} Mbps · ↑ {planSeleccionado.velocidad_up} Mbps</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-black text-white">{fmt(planSeleccionado.precio_mensual)}</p>
              <p className="text-slate-400 text-xs">por mes</p>
            </div>
          </div>

          <h2 className="text-2xl font-black text-white mb-2">¿Cómo querés abonar la instalación?</h2>
          <p className="text-slate-400 text-sm mb-8">Elegí la opción que mejor se adapte a vos. El precio del servicio mensual no cambia.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {ofertas.map((o) => {
              const gratis      = o.tipo === 'gratis' || Number(o.precio_total) === 0;
              const enCuotas    = o.tipo === 'cuotas' && o.cuotas > 1;
              const montoCuota  = enCuotas ? Number(o.precio_total) / o.cuotas : null;
              const tieneAhorro = o.precio_original && Number(o.precio_original) > Number(o.precio_total);
              const ahorro      = tieneAhorro ? Number(o.precio_original) - Number(o.precio_total) : 0;
              const pctAhorro   = tieneAhorro ? Math.round((ahorro / Number(o.precio_original)) * 100) : 0;

              return (
                <button key={o.id} onClick={() => elegirOferta(o)}
                  className={`relative w-full text-left rounded-3xl p-6 flex flex-col gap-4 transition-all duration-200 hover:-translate-y-0.5 group ${
                    o.destacada
                      ? 'bg-gradient-to-b from-cyan-500/20 to-blue-600/15 border-2 border-cyan-500/60 shadow-2xl shadow-cyan-500/20'
                      : 'bg-slate-900 border border-white/10 hover:border-white/25'
                  }`}>

                  {/* Badge destacada o personalizado */}
                  {(o.destacada || o.badge_texto) && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <span className="bg-gradient-to-r from-cyan-400 to-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wide shadow-lg">
                        {o.badge_texto || '★ Más conveniente'}
                      </span>
                    </div>
                  )}

                  {/* Título + badges de tipo */}
                  <div>
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-bold text-white text-base leading-tight">{o.nombre}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {gratis && (
                        <span className="text-[11px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                          BONIFICADA
                        </span>
                      )}
                      {enCuotas && (
                        <span className="text-[11px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30 px-2 py-0.5 rounded-full">
                          {o.cuotas} CUOTAS SIN INTERÉS
                        </span>
                      )}
                      {tieneAhorro && (
                        <span className="text-[11px] font-black bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
                          {pctAhorro}% OFF
                        </span>
                      )}
                    </div>
                    {o.descripcion && (
                      <p className="text-slate-400 text-sm mt-2 leading-relaxed">{o.descripcion}</p>
                    )}
                  </div>

                  {/* Precio */}
                  <div className="mt-auto">
                    {gratis ? (
                      <div>
                        {tieneAhorro && (
                          <p className="text-slate-500 text-sm line-through">{fmt(Number(o.precio_original))}</p>
                        )}
                        <p className="text-3xl font-black text-emerald-400">GRATIS</p>
                        {tieneAhorro && (
                          <p className="text-emerald-400/70 text-xs mt-0.5">Ahorrás {fmt(ahorro)}</p>
                        )}
                      </div>
                    ) : enCuotas ? (
                      <div>
                        {tieneAhorro && (
                          <p className="text-slate-500 text-sm line-through">{fmt(Number(o.precio_original))}</p>
                        )}
                        <div className="flex items-baseline gap-1">
                          <p className="text-3xl font-black text-white">{fmt(montoCuota!)}</p>
                          <p className="text-slate-400 text-sm">/ cuota</p>
                        </div>
                        <p className="text-slate-400 text-xs mt-0.5">{o.cuotas} cuotas · total {fmt(Number(o.precio_total))}</p>
                        {tieneAhorro && (
                          <p className="text-yellow-400/80 text-xs mt-0.5">Ahorrás {fmt(ahorro)} vs precio normal</p>
                        )}
                      </div>
                    ) : (
                      <div>
                        {tieneAhorro && (
                          <p className="text-slate-500 text-sm line-through">{fmt(Number(o.precio_original))}</p>
                        )}
                        <p className="text-3xl font-black text-white">{fmt(Number(o.precio_total))}</p>
                        {tieneAhorro && (
                          <p className="text-yellow-400/80 text-xs mt-0.5">Ahorrás {fmt(ahorro)}</p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className={`w-full py-2.5 rounded-2xl font-bold text-sm text-center transition-colors mt-1 ${
                    o.destacada
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white group-hover:from-cyan-400 group-hover:to-blue-500'
                      : 'bg-white/8 hover:bg-white/15 text-white border border-white/15'
                  }`}>
                    Elegir esta opción
                  </div>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* ── FORMULARIO ── */}
      {step === 'formulario' && planSeleccionado && (
        <main className="flex-1 px-6 py-12 max-w-2xl mx-auto w-full">
          <button onClick={() => setStep(ofertas.length > 0 ? 'instalacion' : 'planes')}
            className="text-slate-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition">
            ← Volver
          </button>

          {/* Resumen plan + instalación */}
          <div className="bg-gradient-to-r from-cyan-500/15 to-blue-600/10 border border-cyan-500/25 rounded-2xl p-5 mb-8 space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-cyan-400 text-xs mb-0.5 font-semibold uppercase tracking-wide">Plan seleccionado</p>
                <p className="font-bold text-lg text-white">{planSeleccionado.nombre}</p>
                <p className="text-slate-400 text-sm">↓ {planSeleccionado.velocidad_down} Mbps · ↑ {planSeleccionado.velocidad_up} Mbps</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-black text-white">{fmt(planSeleccionado.precio_mensual)}</p>
                <p className="text-slate-400 text-xs">por mes</p>
              </div>
            </div>
            {ofertaSeleccionada && (
              <div className="border-t border-white/10 pt-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-slate-400 text-xs mb-0.5 uppercase tracking-wide">Instalación</p>
                  <p className="font-semibold text-white text-sm">{ofertaSeleccionada.nombre}</p>
                  {ofertaSeleccionada.tipo === 'cuotas' && ofertaSeleccionada.cuotas > 1 && (
                    <p className="text-slate-500 text-xs">{ofertaSeleccionada.cuotas} cuotas de {fmt(Number(ofertaSeleccionada.precio_total) / ofertaSeleccionada.cuotas)}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  {Number(ofertaSeleccionada.precio_total) === 0
                    ? <p className="text-emerald-400 font-black text-lg">GRATIS</p>
                    : <p className="text-white font-bold text-lg">{fmt(Number(ofertaSeleccionada.precio_total))}</p>}
                </div>
              </div>
            )}
          </div>

          <h2 className="text-2xl font-black text-white mb-6">Completá tus datos</h2>

          <form onSubmit={submit} className="space-y-4">
            {/* Datos personales */}
            <Field label="Nombre completo" value={form.nombre} onChange={set('nombre')} placeholder="Juan García" required />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Email" value={form.email} onChange={set('email')} type="email" placeholder="juan@email.com" />
              <Field label="Teléfono" value={form.telefono} onChange={set('telefono')} placeholder="+54 9 11 1234-5678" required />
            </div>
            <Field label="DNI" value={form.dni} onChange={set('dni')} placeholder="20123456" />
            <Field label="Dirección" value={form.direccion} onChange={set('direccion')} placeholder="Av. Corrientes 1234" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Barrio" value={form.barrio} onChange={set('barrio')} placeholder="Palermo" />
              <Field label="Ciudad" value={form.ciudad} onChange={set('ciudad')} placeholder="Buenos Aires" />
            </div>

            {/* Fotos del DNI */}
            <div className="border-t border-white/10 pt-5 mt-2">
              <p className="text-sm font-semibold text-white mb-1">🪪 Identificación</p>
              <p className="text-slate-500 text-xs mb-4">Subí una foto del frente y del dorso de tu DNI para verificar tu identidad.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DniUpload label="Frente del DNI" file={dniFrente} onChange={setDniFrente} />
                <DniUpload label="Dorso del DNI" file={dniDorso} onChange={setDniDorso} />
              </div>
            </div>

            {/* Contraseña */}
            <div className="border-t border-white/10 pt-5 mt-2">
              <p className="text-sm font-semibold text-white mb-1">🔐 Contraseña del portal (opcional)</p>
              <p className="text-slate-500 text-xs mb-4">Si la cargás podrás acceder al portal del cliente para ver tu servicio y descargar tu contrato.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <PasswordField label="Contraseña" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" />
                <PasswordField label="Confirmar contraseña" value={form.passwordConfirm} onChange={set('passwordConfirm')} placeholder="Repetir contraseña" />
              </div>
            </div>

            <div className="bg-white/4 border border-white/10 rounded-2xl p-4 text-xs text-slate-500 leading-relaxed">
              <p className="font-semibold text-slate-400 mb-1">⚖️ Aceptación de términos</p>
              Al enviar este formulario aceptás las condiciones del contrato de prestación de servicios.
              La sola aceptación constituye firma vinculante conforme al art. 288 del CCyCN.
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500
                         disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-4 rounded-2xl
                         text-base transition-all shadow-2xl shadow-cyan-500/20">
              {loading ? 'Enviando solicitud...' : '✅ Solicitar instalación'}
            </button>
          </form>
        </main>
      )}

      {/* ── ÉXITO ── */}
      {step === 'exito' && (
        <main className="flex-1 flex items-center justify-center px-6 py-24">
          <div className="max-w-lg w-full text-center">
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-4xl shadow-2xl shadow-emerald-500/30">
              🎉
            </div>
            <h2 className="text-3xl font-extrabold mb-4">¡Solicitud enviada!</h2>
            <p className="text-slate-300 text-lg mb-2">
              Recibimos tus datos con el plan <strong className="text-white">{planSeleccionado?.nombre}</strong>.
            </p>
            <p className="text-slate-400 mb-8 text-sm leading-relaxed">
              Nuestro equipo se va a comunicar con vos a la brevedad para coordinar la instalación.
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6 text-left">
              <p className="font-semibold text-sm text-white mb-3">📋 ¿Qué pasa ahora?</p>
              <ol className="text-slate-400 text-sm space-y-2 list-decimal list-inside">
                <li>Un técnico coordinará la instalación con vos.</li>
                <li>Durante la visita se instalarán y registrarán los equipos.</li>
                <li>Una vez completada, el contrato PDF estará disponible en tu cuenta.</li>
              </ol>
            </div>
            <p className="text-slate-600 text-xs mb-8">
              Al enviar este formulario aceptaste los términos y condiciones del contrato. La aceptación constituye firma vinculante conforme al art. 288 CCyCN.
            </p>
            <button onClick={resetForm}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-8 py-3 rounded-2xl transition-all">
              Volver al inicio
            </button>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-white/8 px-6 py-6 text-center text-slate-600 text-xs">
        © {new Date().getFullYear()} AdminISP — Todos los derechos reservados
      </footer>
    </div>
  );
};
