import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, Cell
} from 'recharts';
import { TrendingUp, CheckCircle, Lock } from 'lucide-react';

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload?.length) {
    return (
      <div className="bg-[#1F2937] border border-white/10 rounded-lg p-3 text-xs">
        <p className="text-[#94A3B8] mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</p>
        ))}
      </div>
    );
  }
  return null;
};

function ChartCard({ title, children }) {
  return (
    <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5 card-hover">
      <h3 className="font-heading font-semibold text-[#F1F5F9] text-sm mb-4">{title}</h3>
      {children}
    </div>
  );
}

export default function Progress() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/api/progress')
      .then(r => { setSessions(r.data.reverse()); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const chartData = sessions.map((s, i) => ({
    idx: i + 1,
    label: `#${i + 1}`,
    wpm: s.metrics?.wpm || 0,
    fillers: s.metrics?.filler_per_min || 0,
    gaze: s.metrics?.gaze_percentage || 0,
    duration: Math.floor((s.duration_seconds || 0) / 60),
    passed: s.passed ? 1 : 0,
  }));

  const currentLevel = sessions.length > 0 ? Math.max(...sessions.map(s => s.level)) : 1;

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-[#1F2937] border border-white/5 rounded-xl p-5 h-48">
              <div className="shimmer h-full w-full rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="mb-8">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl tracking-tighter text-[#F1F5F9]">Progreso</h1>
        <p className="text-[#94A3B8] mt-1 text-sm">{sessions.length} sesiones registradas</p>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp className="w-12 h-12 text-[#94A3B8] mx-auto mb-4" />
          <p className="text-[#94A3B8]">Aún no hay datos de progreso. ¡Realiza tu primera sesión de entrenamiento!</p>
        </div>
      ) : (
        <>
          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ChartCard title="Velocidad de habla (palabras/min)">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="wpm" stroke="#06B6D4" strokeWidth={2} dot={{ fill: '#06B6D4', r: 3 }} name="PPM" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Muletillas por minuto">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="fillers" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6', r: 3 }} name="Muletillas/min" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Contacto visual (%)">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} domain={[0, 100]} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="gaze" stroke="#10B981" strokeWidth={2} dot={{ fill: '#10B981', r: 3 }} name="Contacto visual %" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Duración de sesiones (minutos)">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#94A3B8', fontSize: 10 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="duration" name="Minutos" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={index} fill={entry.passed ? '#10B981' : '#4B5563'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Level timeline */}
          <div className="bg-[#1F2937] border border-white/5 rounded-xl p-6">
            <h3 className="font-heading font-semibold text-[#F1F5F9] mb-5">Línea de niveles</h3>
            <div className="flex items-center gap-2 flex-wrap">
              {[...Array(10)].map((_, i) => {
                const lvl = i + 1;
                const isDone = lvl < currentLevel;
                const isCurrent = lvl === currentLevel;
                const isLocked = lvl > currentLevel;
                return (
                  <React.Fragment key={lvl}>
                    <div className={`flex flex-col items-center gap-1.5 ${isLocked ? 'opacity-40' : ''}`} data-testid={`level-node-${lvl}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${
                        isDone ? 'bg-[#10B981]/20 border-[#10B981]' :
                        isCurrent ? 'bg-[#06B6D4]/20 border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.3)]' :
                        'bg-[#111827] border-white/10'
                      }`}>
                        {isDone ? <CheckCircle className="w-4 h-4 text-[#10B981]" /> :
                         isLocked ? <Lock className="w-3 h-3 text-[#94A3B8]" /> :
                         <span className="font-mono text-xs font-semibold text-[#06B6D4]">{lvl}</span>}
                      </div>
                      <span className="text-xs text-[#94A3B8]">Nv. {lvl}</span>
                    </div>
                    {i < 9 && (
                      <div className={`flex-1 h-0.5 min-w-[12px] ${isDone ? 'bg-[#10B981]' : 'bg-white/10'}`} />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
