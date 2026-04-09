import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Radio, Mic, Eye, Brain, BarChart3, ChevronRight, Star, Shield, Zap } from 'lucide-react';

const FEATURES = [
  { icon: Mic, title: 'Análisis de Voz con IA', desc: 'Transcripción en tiempo real con Whisper. Detecta muletillas, velocidad y pausas automáticamente.' },
  { icon: Eye, title: 'Presencia Visual', desc: 'MediaPipe analiza tu contacto visual, expresión facial y rigidez facial cuadro a cuadro.' },
  { icon: Brain, title: 'Informes con Claude', desc: 'Recibe feedback experto generado por IA con un plan de mejora personalizado tras cada sesión.' },
  { icon: BarChart3, title: '10 Niveles Progresivos', desc: 'Desde lectura básica hasta resistencia comunicativa. Sube de nivel con cada sesión superada.' },
  { icon: Shield, title: 'Ejercicios Profesionales', desc: 'Más de 40 ejercicios en 7 categorías: entrevistas, presentaciones, videoconferencias y más.' },
  { icon: Zap, title: 'Aprendizaje Adaptativo', desc: 'El sistema aprende de tus sesiones y adapta los umbrales a tu nivel de progreso real.' },
];

function AuthModal({ mode, onClose, onSwitch }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('El nombre es obligatorio'); setLoading(false); return; }
        await register(form.email, form.password, form.name);
      }
      navigate('/dashboard');
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Error al procesar la solicitud. Inténtelo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-white/10 rounded-2xl p-8 w-full max-w-md shadow-2xl fade-in"
        onClick={e => e.stopPropagation()}
        data-testid="auth-modal"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center">
            <Radio className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-heading font-semibold text-[#F1F5F9] text-lg">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p className="text-[#94A3B8] text-xs">Entrenamiento Comunicativo</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-[#94A3B8] text-xs mb-1.5 uppercase tracking-widest">Nombre completo</label>
              <input
                type="text"
                className="input-dark"
                placeholder="Tu nombre"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                data-testid="auth-name-input"
              />
            </div>
          )}
          <div>
            <label className="block text-[#94A3B8] text-xs mb-1.5 uppercase tracking-widest">Email</label>
            <input
              type="email"
              className="input-dark"
              placeholder="tu@email.com"
              value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })}
              data-testid="auth-email-input"
              required
            />
          </div>
          <div>
            <label className="block text-[#94A3B8] text-xs mb-1.5 uppercase tracking-widest">Contraseña</label>
            <input
              type="password"
              className="input-dark"
              placeholder="••••••••"
              value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              data-testid="auth-password-input"
              required
            />
          </div>

          {error && (
            <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-4 py-3 text-sm text-[#EF4444]" data-testid="auth-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            data-testid="auth-submit-btn"
            className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Procesando...' : mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-[#94A3B8]">
          {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}{' '}
          <button onClick={onSwitch} className="text-[#06B6D4] hover:underline font-medium">
            {mode === 'login' ? 'Regístrate gratis' : 'Inicia sesión'}
          </button>
        </p>
      </div>
    </div>
  );
}

export default function Landing() {
  const [authMode, setAuthMode] = useState(null);

  return (
    <div className="min-h-screen bg-[#0A0E1A] text-[#F1F5F9]">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `url(https://images.unsplash.com/photo-1762279389042-9439bfb6c155?w=1600&q=80)`,
          backgroundSize: 'cover', backgroundPosition: 'center',
          mixBlendMode: 'screen'
        }} />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0A0E1A]/50 via-transparent to-[#0A0E1A]" />

        <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center">
              <Radio className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-semibold tracking-tight">
              Entrenamiento <span className="text-[#06B6D4]">Comunicativo</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAuthMode('login')}
              data-testid="login-cta-btn"
              className="text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => setAuthMode('register')}
              data-testid="register-cta-btn"
              className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] text-sm font-semibold px-4 py-2 rounded-lg transition-all"
            >
              Empezar gratis
            </button>
          </div>
        </nav>

        <div className="relative z-10 text-center px-6 pt-16 pb-32 max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-[#06B6D4]/10 border border-[#06B6D4]/30 rounded-full px-4 py-1.5 mb-6">
            <Star className="w-3 h-3 text-[#06B6D4]" />
            <span className="text-[#06B6D4] text-xs font-medium">Análisis de comunicación con IA</span>
          </div>
          <h1 className="font-heading font-semibold text-4xl sm:text-5xl lg:text-6xl tracking-tighter mb-6 leading-tight">
            Comunica con<br />
            <span className="bg-gradient-to-r from-[#06B6D4] to-[#8B5CF6] bg-clip-text text-transparent">
              confianza y claridad
            </span>
          </h1>
          <p className="text-[#94A3B8] text-lg max-w-2xl mx-auto mb-10 leading-relaxed">
            Entrena tu comunicación profesional con IA. Análisis en tiempo real de voz, presencia visual y estructura del discurso. 10 niveles progresivos adaptados a ti.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => setAuthMode('register')}
              data-testid="hero-register-btn"
              className="flex items-center justify-center gap-2 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold px-8 py-3.5 rounded-xl transition-all text-base"
            >
              Crear cuenta gratis <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setAuthMode('login')}
              data-testid="hero-login-btn"
              className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-[#F1F5F9] font-medium px-8 py-3.5 rounded-xl border border-white/10 transition-all text-base"
            >
              Iniciar sesión
            </button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-heading text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
            Todo lo que necesitas para comunicar mejor
          </h2>
          <p className="text-[#94A3B8]">Tecnología de análisis profesional en tu navegador</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
          {FEATURES.map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="bg-[#0A0E1A] p-8 hover:bg-[#111827] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-[#06B6D4]/10 border border-[#06B6D4]/20 flex items-center justify-center mb-4">
                <Icon className="w-5 h-5 text-[#06B6D4]" />
              </div>
              <h3 className="font-heading font-semibold text-[#F1F5F9] mb-2">{title}</h3>
              <p className="text-[#94A3B8] text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA Bottom */}
      <div className="border-t border-white/5 py-20 text-center px-6">
        <h2 className="font-heading font-semibold text-2xl sm:text-3xl tracking-tight mb-4">
          Empieza tu entrenamiento hoy
        </h2>
        <p className="text-[#94A3B8] mb-8">Gratis. Sin tarjeta de crédito. Resultados desde la primera sesión.</p>
        <button
          onClick={() => setAuthMode('register')}
          className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold px-10 py-4 rounded-xl transition-all text-base"
        >
          Comenzar ahora
        </button>
      </div>

      <footer className="border-t border-white/5 py-8 text-center text-[#94A3B8] text-xs">
        &copy; {new Date().getFullYear()} Entrenamiento Comunicativo · comunicacion.cibermedida.es
      </footer>

      {authMode && (
        <AuthModal
          mode={authMode}
          onClose={() => setAuthMode(null)}
          onSwitch={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        />
      )}
    </div>
  );
}
