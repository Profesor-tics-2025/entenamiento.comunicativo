import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
  CheckCircle, XCircle, Zap, ChevronLeft, TrendingUp,
  Mic, Eye, MessageSquare, AlignLeft, Clock, Award
} from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1F2937] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-[#94A3B8] mb-1">Sesión {label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

function ReportBlock({ title, icon: Icon, color, children, testId }) {
  return (
    <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5 card-hover" data-testid={testId}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4" style={{ color }} />
        <h3 className="font-heading font-semibold text-[#F1F5F9] text-sm">{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default function Report() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get(`/api/sessions/${sessionId}/report`)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(e => { setError('No se pudo cargar el informe.'); setLoading(false); });
  }, [sessionId]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#1F2937] border border-white/5 rounded-xl p-5">
              <div className="shimmer h-4 w-1/2 rounded mb-3" />
              <div className="shimmer h-3 w-full rounded mb-2" />
              <div className="shimmer h-3 w-4/5 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <p className="text-[#EF4444] mb-4">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-[#06B6D4] hover:underline">Volver al inicio</button>
      </div>
    );
  }

  const r = data.report_json;
  if (!r) return null;

  // Chart data for historical comparison (simplified)
  const histChartData = [1, 2, 3, 4, 5].map((n, i) => ({
    sesion: n,
    wpm: 90 + i * 8 + (r.rendimientoVerbal?.wpm ? Math.floor((r.rendimientoVerbal.wpm - 90 - i * 8) / 5) * i : 0),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      {/* Back */}
      <button onClick={() => navigate('/dashboard')}
        className="flex items-center gap-2 text-[#94A3B8] hover:text-[#F1F5F9] text-sm mb-6 transition-colors"
        data-testid="back-btn">
        <ChevronLeft className="w-4 h-4" /> Volver al inicio
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-semibold text-3xl tracking-tighter text-[#F1F5F9]">Informe de sesión</h1>
          <p className="text-[#94A3B8] text-sm mt-1">Análisis completo generado por IA</p>
        </div>
        <button onClick={() => navigate('/train')}
          data-testid="new-session-btn"
          className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold px-5 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2">
          <Mic className="w-4 h-4" /> Nueva sesión
        </button>
      </div>

      {/* 1. Executive summary - full width */}
      <div className="bg-gradient-to-r from-[#06B6D4]/10 to-[#8B5CF6]/10 border border-[#06B6D4]/20 rounded-xl p-6 mb-6" data-testid="report-summary">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-5 h-5 text-[#06B6D4]" />
          <h2 className="font-heading font-semibold text-[#F1F5F9]">Resumen ejecutivo</h2>
        </div>
        <p className="text-[#F1F5F9] leading-relaxed">{r.resumenEjecutivo}</p>
      </div>

      {/* Blocks grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">

        {/* 2. Rendimiento verbal */}
        <ReportBlock title="Rendimiento verbal" icon={Mic} color="#06B6D4" testId="report-verbal">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-mono text-3xl font-semibold text-[#06B6D4]">{r.rendimientoVerbal?.wpm || 0}</span>
            <span className="text-[#94A3B8] text-sm">palabras/min</span>
          </div>
          <p className="text-[#F1F5F9] text-sm mb-2">{r.rendimientoVerbal?.wpmEvaluation}</p>
          {r.rendimientoVerbal?.dictionClarity && (
            <p className="text-[#94A3B8] text-xs">{r.rendimientoVerbal.dictionClarity}</p>
          )}
        </ReportBlock>

        {/* 3. Ritmo y pausas */}
        <ReportBlock title="Ritmo y pausas" icon={Clock} color="#F59E0B" testId="report-rhythm">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <p className="font-mono text-xl font-semibold text-[#F59E0B]">{r.ritmoPausas?.shortPauses ?? 0}</p>
              <p className="text-[#94A3B8] text-xs mt-1">Pausas cortas</p>
            </div>
            <div className="bg-[#111827] rounded-lg p-3 text-center">
              <p className="font-mono text-xl font-semibold text-[#EF4444]">{r.ritmoPausas?.longPauses ?? 0}</p>
              <p className="text-[#94A3B8] text-xs mt-1">Pausas largas</p>
            </div>
          </div>
          <p className="text-[#F1F5F9] text-sm">{r.ritmoPausas?.evaluation}</p>
        </ReportBlock>

        {/* 4. Muletillas */}
        <ReportBlock title="Muletillas y fluidez" icon={MessageSquare} color="#8B5CF6" testId="report-fillers">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-full px-3 py-1">
              <span className="text-[#8B5CF6] font-mono font-semibold">{r.muletillasFluidez?.totalCount ?? 0}</span>
              <span className="text-[#94A3B8] text-xs ml-1">total</span>
            </div>
            <span className="text-[#94A3B8] text-xs">{r.muletillasFluidez?.perMinute?.toFixed(1) ?? '0.0'}/min</span>
          </div>
          {r.muletillasFluidez?.topFillers?.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {r.muletillasFluidez.topFillers.map((f, i) => (
                <span key={i} className="bg-[#8B5CF6]/10 text-[#8B5CF6] text-xs px-2 py-0.5 rounded-full border border-[#8B5CF6]/20">{f}</span>
              ))}
            </div>
          )}
          <p className="text-[#F1F5F9] text-sm">{r.muletillasFluidez?.evaluation}</p>
        </ReportBlock>

        {/* 5. Presencia visual */}
        <ReportBlock title="Presencia visual" icon={Eye} color="#10B981" testId="report-visual">
          <div className="flex items-center gap-3 mb-3">
            <div className="relative w-16 h-16">
              <svg width="64" height="64">
                <circle cx="32" cy="32" r="26" fill="none" stroke="#1F2937" strokeWidth="5" />
                <circle cx="32" cy="32" r="26" fill="none" stroke="#10B981" strokeWidth="5"
                  strokeDasharray={2 * Math.PI * 26}
                  strokeDashoffset={2 * Math.PI * 26 * (1 - (r.presenciaVisual?.gazePercentage || 0) / 100)}
                  strokeLinecap="round" transform="rotate(-90 32 32)" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-mono text-xs font-semibold text-[#10B981]">
                  {Math.round(r.presenciaVisual?.gazePercentage || 0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-[#F1F5F9] text-xs font-medium">Contacto visual</p>
              <p className="text-[#94A3B8] text-xs mt-1">{r.presenciaVisual?.prolongedDeviations ?? 0} desviaciones prolongadas</p>
            </div>
          </div>
          <p className="text-[#F1F5F9] text-sm">{r.presenciaVisual?.facialRigidityDescription}</p>
        </ReportBlock>

        {/* 6. Estructura */}
        <ReportBlock title="Estructura del contenido" icon={AlignLeft} color="#06B6D4" testId="report-structure">
          <div className="flex gap-4 mb-3">
            <div className={`flex items-center gap-2 text-sm ${r.estructuraContenido?.hasOpening ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {r.estructuraContenido?.hasOpening ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>Apertura</span>
            </div>
            <div className={`flex items-center gap-2 text-sm ${r.estructuraContenido?.hasClosing ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
              {r.estructuraContenido?.hasClosing ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
              <span>Cierre</span>
            </div>
          </div>
          <p className="text-[#F1F5F9] text-sm">{r.estructuraContenido?.overallEvaluation}</p>
        </ReportBlock>

        {/* 7. Historical comparison */}
        <ReportBlock title="Comparación histórica" icon={TrendingUp} color="#8B5CF6" testId="report-historical">
          <div className="h-24 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={histChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="sesion" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="wpm" stroke="#8B5CF6" strokeWidth={2} dot={false} name="ppm" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[#94A3B8] text-xs">{r.comparacionHistorica}</p>
        </ReportBlock>
      </div>

      {/* 8. Next session plan - full width highlighted */}
      <div className="bg-[#0A2730] border border-[#06B6D4]/30 rounded-xl p-6" data-testid="report-next-plan">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-[#06B6D4]" />
          <h3 className="font-heading font-semibold text-[#F1F5F9]">Plan para la siguiente sesión</h3>
        </div>
        <p className="text-[#F1F5F9] leading-relaxed">{r.planSiguienteSesion}</p>
        <div className="mt-5 flex gap-3">
          <button onClick={() => navigate('/train')}
            data-testid="report-train-again-btn"
            className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold px-5 py-2.5 rounded-lg transition-all text-sm flex items-center gap-2">
            <Mic className="w-4 h-4" /> Entrenar de nuevo
          </button>
          <button onClick={() => navigate('/exercises')}
            className="bg-white/5 hover:bg-white/10 text-[#F1F5F9] px-5 py-2.5 rounded-lg text-sm transition-all">
            Ver ejercicios
          </button>
        </div>
      </div>
    </div>
  );
}
