import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import {
  Radio, TrendingUp, Clock, CheckCircle, XCircle,
  ChevronRight, Zap, BookOpen, Star
} from 'lucide-react';

function XpBar({ xp, level }) {
  const xpPerLevel = 300;
  const xpInLevel = xp % xpPerLevel;
  const pct = Math.min((xpInLevel / xpPerLevel) * 100, 100);
  return (
    <div data-testid="xp-bar-container">
      <div className="flex justify-between text-xs text-[#94A3B8] mb-1.5">
        <span>Nivel {level}</span>
        <span>{xpInLevel} / {xpPerLevel} XP</span>
      </div>
      <div className="h-1.5 bg-[#111827] rounded-full overflow-hidden">
        <div className="xp-bar" style={{ width: `${pct}%` }} data-testid="xp-progress" />
      </div>
    </div>
  );
}

function SessionCard({ session }) {
  const navigate = useNavigate();
  const date = session.started_at ? new Date(session.started_at).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  }) : '—';
  const duration = session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}m ${session.duration_seconds % 60}s` : '—';

  return (
    <div
      className="bg-[#1F2937] border border-white/5 rounded-xl p-4 card-hover cursor-pointer"
      onClick={() => navigate(`/report/${session.session_id}`)}
      data-testid="session-card"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {session.passed
            ? <CheckCircle className="w-4 h-4 text-[#10B981]" />
            : <XCircle className="w-4 h-4 text-[#EF4444]" />
          }
          <span className="level-badge">Nv. {session.level}</span>
        </div>
        <span className="text-[#94A3B8] text-xs">{date}</span>
      </div>
      <div className="flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1 text-[#94A3B8]">
          <Clock className="w-3 h-3" />
          <span>{duration}</span>
        </div>
        {session.xp_earned > 0 && (
          <div className="flex items-center gap-1 text-[#F59E0B]">
            <Zap className="w-3 h-3" />
            <span>+{session.xp_earned} XP</span>
          </div>
        )}
        {session.metrics?.wpm > 0 && (
          <span className="text-[#94A3B8]">{session.metrics.wpm} ppm</span>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#1F2937] border border-white/5 rounded-xl p-4">
      <div className="shimmer h-4 w-3/4 rounded mb-2" />
      <div className="shimmer h-3 w-1/2 rounded" />
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [progressRes, exRes] = await Promise.all([
          api.get('/api/progress'),
          api.get(`/api/exercises?level=${user.current_level}`),
        ]);
        setSessions(progressRes.data.slice(0, 3));
        setExercises(exRes.data.slice(0, 1));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user.current_level]);

  const recommended = exercises[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[#94A3B8] text-sm uppercase tracking-widest font-medium mb-1">Bienvenido</p>
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl tracking-tighter text-[#F1F5F9]">
          {user.name}
        </h1>
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {/* Level card */}
        <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5" data-testid="level-card">
          <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-3">Nivel actual</p>
          <div className="flex items-end gap-3 mb-4">
            <span className="font-heading font-semibold text-5xl text-[#06B6D4]">{user.current_level}</span>
            <span className="text-[#94A3B8] text-sm mb-1">/ 10</span>
          </div>
          <XpBar xp={user.total_xp} level={user.current_level} />
        </div>

        {/* Total XP */}
        <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5" data-testid="xp-card">
          <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-3">XP Total</p>
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-5 h-5 text-[#F59E0B]" />
            <span className="font-heading font-semibold text-3xl text-[#F1F5F9]">{user.total_xp}</span>
          </div>
          <p className="text-[#94A3B8] text-xs">Puntos de experiencia acumulados</p>
        </div>

        {/* Sessions */}
        <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5" data-testid="sessions-stat-card">
          <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-3">Sesiones completadas</p>
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-5 h-5 text-[#10B981]" />
            <span className="font-heading font-semibold text-3xl text-[#F1F5F9]">
              {loading ? '—' : sessions.length}
            </span>
          </div>
          <p className="text-[#94A3B8] text-xs">Últimas 3 sesiones visibles abajo</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent sessions */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-heading font-semibold text-lg text-[#F1F5F9]">Sesiones recientes</h2>
            <Link to="/progress" className="text-[#06B6D4] text-sm hover:underline flex items-center gap-1">
              Ver todo <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {loading ? (
              <>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : sessions.length > 0 ? (
              sessions.map((s, i) => <SessionCard key={i} session={s} />)
            ) : (
              <div className="bg-[#1F2937] border border-white/5 rounded-xl p-8 text-center">
                <Radio className="w-8 h-8 text-[#94A3B8] mx-auto mb-3" />
                <p className="text-[#94A3B8] text-sm">Aún no hay sesiones. ¡Empieza tu primer entrenamiento!</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick start */}
          <div className="bg-gradient-to-br from-[#06B6D4]/10 to-[#8B5CF6]/10 border border-[#06B6D4]/20 rounded-xl p-5">
            <h3 className="font-heading font-semibold text-[#F1F5F9] mb-2">Acceso rápido</h3>
            <div className="space-y-2">
              <button
                onClick={() => navigate('/train')}
                data-testid="quick-train-btn"
                className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
              >
                <Radio className="w-4 h-4" /> Entrenar ahora
              </button>
              <button
                onClick={() => navigate('/exercises')}
                data-testid="quick-exercises-btn"
                className="w-full bg-white/5 hover:bg-white/10 text-[#F1F5F9] py-3 rounded-lg transition-all flex items-center justify-center gap-2 text-sm"
              >
                <BookOpen className="w-4 h-4" /> Ver ejercicios
              </button>
            </div>
          </div>

          {/* Recommended exercise */}
          {recommended && (
            <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5 card-hover" data-testid="recommended-exercise">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-[#F59E0B]" />
                <p className="text-[#94A3B8] text-xs uppercase tracking-widest">Recomendado</p>
              </div>
              <h4 className="font-heading font-semibold text-[#F1F5F9] mb-1">{recommended.title_es}</h4>
              <p className="text-[#94A3B8] text-xs mb-3 line-clamp-2">{recommended.description_es}</p>
              <div className="flex items-center justify-between">
                <span className="level-badge">Nv. {recommended.level_required}</span>
                <button
                  onClick={() => navigate(`/train?exerciseId=${recommended.id}`)}
                  className="text-[#06B6D4] text-xs hover:underline flex items-center gap-1"
                >
                  Entrenar <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
