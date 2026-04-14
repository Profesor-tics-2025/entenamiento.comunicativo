import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import {
  Users, BookOpen, BarChart2, Plus, Pencil, Trash2,
  ChevronDown, ChevronUp, Check, X, AlertCircle, Loader2,
  ChevronLeft, Radio, Clock
} from 'lucide-react';

const TABS = [
  { id: 'stats',     label: 'Resumen',   icon: BarChart2 },
  { id: 'users',     label: 'Usuarios',  icon: Users },
  { id: 'exercises', label: 'Ejercicios', icon: BookOpen },
];

const CATEGORIES = [
  'Lectura Controlada', 'Presentación Personal', 'Entrevista Laboral',
  'Estructura Oral', 'Soltura y Desinhibición', 'Videoconferencia Profesional', 'Resistencia Comunicativa',
];
const DIFFICULTIES = { short: 'Corto', medium: 'Medio', long: 'Largo' };
const DIFF_COLORS   = { short: '#10B981', medium: '#F59E0B', long: '#EF4444' };

function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-[#94A3B8] text-xs uppercase tracking-widest">{label}</p>
        <p className="font-heading font-semibold text-2xl text-[#F1F5F9] mt-0.5">{value ?? '—'}</p>
      </div>
    </div>
  );
}

// ── Exercise Form ─────────────────────────────────────────────────────────────
function ExerciseForm({ initial, onSave, onCancel, loading }) {
  const empty = {
    title_es: '', description_es: '', category: CATEGORIES[0],
    difficulty: 'short', level_required: 1, duration_target_seconds: 180, prompt_text_es: '',
  };
  const [form, setForm] = useState(initial ?? empty);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="bg-[#111827] border border-[#06B6D4]/20 rounded-xl p-5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="block text-[#94A3B8] text-xs mb-1">Título *</label>
          <input value={form.title_es} onChange={e => set('title_es', e.target.value)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[#94A3B8] text-xs mb-1">Descripción *</label>
          <textarea value={form.description_es} onChange={e => set('description_es', e.target.value)} rows={2}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none resize-none" />
        </div>
        <div>
          <label className="block text-[#94A3B8] text-xs mb-1">Categoría</label>
          <select value={form.category} onChange={e => set('category', e.target.value)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[#94A3B8] text-xs mb-1">Dificultad</label>
          <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none">
            {Object.entries(DIFFICULTIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[#94A3B8] text-xs mb-1">Nivel requerido</label>
          <input type="number" min={1} max={10} value={form.level_required} onChange={e => set('level_required', +e.target.value)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none" />
        </div>
        <div>
          <label className="block text-[#94A3B8] text-xs mb-1">Duración objetivo (seg)</label>
          <input type="number" min={30} value={form.duration_target_seconds} onChange={e => set('duration_target_seconds', +e.target.value)}
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none" />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-[#94A3B8] text-xs mb-1">Texto del ejercicio (opcional)</label>
          <textarea value={form.prompt_text_es || ''} onChange={e => set('prompt_text_es', e.target.value)} rows={2}
            placeholder="Texto para leer o contexto adicional"
            className="w-full bg-[#1F2937] border border-white/10 rounded-lg px-3 py-2 text-[#F1F5F9] text-sm focus:border-[#06B6D4] outline-none resize-none placeholder-[#4B5563]" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 text-[#94A3B8] text-sm rounded-lg transition-all flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" /> Cancelar
        </button>
        <button onClick={() => onSave(form)} disabled={loading || !form.title_es.trim() || !form.description_es.trim()}
          className="px-4 py-2 bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold text-sm rounded-lg transition-all flex items-center gap-1.5 disabled:opacity-40">
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Guardar
        </button>
      </div>
    </div>
  );
}

// ── Main Admin Page ───────────────────────────────────────────────────────────
export default function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('stats');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [expandedUser, setExpandedUser] = useState(null);
  const [userSessions, setUserSessions] = useState({});
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [editingExercise, setEditingExercise] = useState(null);
  const [creatingExercise, setCreatingExercise] = useState(false);
  const [savingExercise, setSavingExercise] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, usersRes, exRes] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
        api.get('/api/admin/exercises'),
      ]);
      setStats(statsRes.data);
      setUsers(usersRes.data);
      setExercises(exRes.data);
    } catch (e) {
      setError('Error cargando datos del panel. Verifica que tienes rol de administrador.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleUserSessions = async (userId) => {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (userSessions[userId]) return;
    setLoadingSessions(true);
    try {
      const res = await api.get(`/api/admin/users/${userId}/sessions`);
      setUserSessions(p => ({ ...p, [userId]: res.data }));
    } catch { setUserSessions(p => ({ ...p, [userId]: [] })); }
    finally { setLoadingSessions(false); }
  };

  const saveExercise = async (form) => {
    setSavingExercise(true);
    try {
      if (editingExercise?.id) {
        const res = await api.put(`/api/admin/exercises/${editingExercise.id}`, form);
        setExercises(p => p.map(e => e.id === editingExercise.id ? res.data : e));
      } else {
        const res = await api.post('/api/admin/exercises', form);
        setExercises(p => [res.data, ...p]);
      }
      setEditingExercise(null);
      setCreatingExercise(false);
    } catch { setError('Error guardando el ejercicio.'); }
    finally { setSavingExercise(false); }
  };

  const deleteExercise = async (id) => {
    if (!window.confirm('¿Eliminar este ejercicio? Esta acción no se puede deshacer.')) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/admin/exercises/${id}`);
      setExercises(p => p.filter(e => e.id !== id));
      setStats(s => s ? { ...s, exercises: s.exercises - 1 } : s);
    } catch { setError('Error eliminando el ejercicio.'); }
    finally { setDeletingId(null); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const formatDuration = (s) => s ? `${Math.floor(s / 60)}m ${s % 60 > 0 ? `${s % 60}s` : ''}`.trim() : '—';

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center gap-4">
      <div className="w-8 h-8 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
      <p className="text-[#94A3B8] text-sm">Cargando panel de administración...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in" data-testid="admin-panel">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} data-testid="admin-back-btn"
            className="flex items-center gap-1.5 text-[#94A3B8] hover:text-[#F1F5F9] text-sm transition-colors">
            <ChevronLeft className="w-4 h-4" /> Inicio
          </button>
          <div>
            <h1 className="font-heading font-semibold text-2xl sm:text-3xl tracking-tighter text-[#F1F5F9]">Panel de administración</h1>
            <p className="text-[#94A3B8] text-xs mt-0.5">Gestión de usuarios, sesiones y ejercicios</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-[#EF4444] flex-shrink-0" />
          <p className="text-[#EF4444] text-sm">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto text-[#94A3B8] hover:text-[#F1F5F9]"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-[#1F2937] border border-white/5 rounded-xl p-1 mb-6 w-fit" data-testid="admin-tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} data-testid={`admin-tab-${id}`}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/20' : 'text-[#94A3B8] hover:text-[#F1F5F9]'
            }`}>
            <Icon className="w-4 h-4" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Stats tab ── */}
      {tab === 'stats' && stats && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Usuarios registrados" value={stats.users} icon={Users} color="#06B6D4" />
            <StatCard label="Sesiones totales"      value={stats.sessions} icon={Radio} color="#8B5CF6" />
            <StatCard label="Ejercicios activos"    value={stats.exercises} icon={BookOpen} color="#10B981" />
          </div>
          <div className="bg-[#1F2937] border border-white/5 rounded-xl p-5">
            <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-3">Acceso rápido</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setTab('users')} className="bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 text-[#06B6D4] text-sm px-4 py-2 rounded-lg border border-[#06B6D4]/20 transition-all flex items-center gap-2">
                <Users className="w-3.5 h-3.5" /> Ver usuarios
              </button>
              <button onClick={() => { setTab('exercises'); setCreatingExercise(true); }} className="bg-[#10B981]/10 hover:bg-[#10B981]/20 text-[#10B981] text-sm px-4 py-2 rounded-lg border border-[#10B981]/20 transition-all flex items-center gap-2">
                <Plus className="w-3.5 h-3.5" /> Nuevo ejercicio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Users tab ── */}
      {tab === 'users' && (
        <div className="space-y-2" data-testid="admin-users-table">
          {users.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-10">No hay usuarios registrados.</p>
          ) : users.map(u => (
            <div key={u.id} className="bg-[#1F2937] border border-white/5 rounded-xl overflow-hidden">
              <button
                onClick={() => toggleUserSessions(u.id)}
                data-testid={`user-row-${u.id}`}
                className="w-full flex items-center gap-4 p-4 hover:bg-white/2 transition-all text-left">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-semibold">{u.name?.charAt(0)?.toUpperCase() || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[#F1F5F9] text-sm font-medium truncate">{u.name}</p>
                    {u.role === 'admin' && (
                      <span className="bg-[#F59E0B]/10 text-[#F59E0B] text-xs px-2 py-0.5 rounded-full border border-[#F59E0B]/20">Admin</span>
                    )}
                  </div>
                  <p className="text-[#94A3B8] text-xs truncate">{u.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-6 text-xs text-[#94A3B8]">
                  <span className="level-badge">Nv. {u.current_level}</span>
                  <span>{u.total_xp} XP</span>
                  <span>{u.sessions_count} sesiones</span>
                  <span>Último: {formatDate(u.last_session_at)}</span>
                </div>
                {expandedUser === u.id
                  ? <ChevronUp className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                  : <ChevronDown className="w-4 h-4 text-[#94A3B8] flex-shrink-0" />
                }
              </button>

              {/* Expandable sessions */}
              {expandedUser === u.id && (
                <div className="border-t border-white/5 p-4 bg-[#111827]">
                  <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-3">Sesiones de {u.name}</p>
                  {loadingSessions && !userSessions[u.id] ? (
                    <div className="flex items-center gap-2 text-[#94A3B8] text-sm">
                      <Loader2 className="w-4 h-4 animate-spin" /> Cargando sesiones...
                    </div>
                  ) : !userSessions[u.id] || userSessions[u.id].length === 0 ? (
                    <p className="text-[#4B5563] text-sm">Sin sesiones registradas.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userSessions[u.id].map(s => (
                        <div key={s.id} className="flex items-center gap-4 bg-[#1F2937] rounded-lg px-3 py-2.5 text-xs">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.passed ? 'bg-[#10B981]' : 'bg-[#EF4444]'}`} />
                          <span className="text-[#F1F5F9] truncate flex-1">
                            {s.exercise_title || `Ejercicio ${s.exercise_id}`}
                          </span>
                          <span className="text-[#94A3B8] hidden sm:block">Nv. {s.level}</span>
                          {s.score != null && <span className="text-[#06B6D4] font-mono font-semibold">{s.score} pts</span>}
                          <span className="text-[#94A3B8] hidden sm:flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(s.duration_seconds)}
                          </span>
                          <span className="text-[#4B5563]">{formatDate(s.started_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Exercises tab ── */}
      {tab === 'exercises' && (
        <div className="space-y-3" data-testid="admin-exercises-table">
          {/* Create button + form */}
          {!creatingExercise ? (
            <button onClick={() => setCreatingExercise(true)} data-testid="add-exercise-btn"
              className="w-full bg-[#1F2937] border border-dashed border-white/10 hover:border-[#06B6D4]/40 text-[#94A3B8] hover:text-[#06B6D4] rounded-xl p-4 text-sm transition-all flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Nuevo ejercicio
            </button>
          ) : (
            <ExerciseForm onSave={saveExercise} onCancel={() => setCreatingExercise(false)} loading={savingExercise} />
          )}

          {/* Exercise list */}
          {exercises.map(ex => (
            <div key={ex.id} className="bg-[#1F2937] border border-white/5 rounded-xl overflow-hidden" data-testid={`exercise-item-${ex.id}`}>
              {editingExercise?.id === ex.id ? (
                <div className="p-4">
                  <ExerciseForm initial={ex} onSave={saveExercise} onCancel={() => setEditingExercise(null)} loading={savingExercise} />
                </div>
              ) : (
                <div className="flex items-start gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="level-badge text-xs">Nv. {ex.level_required}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full border"
                        style={{ color: DIFF_COLORS[ex.difficulty], borderColor: `${DIFF_COLORS[ex.difficulty]}30`, background: `${DIFF_COLORS[ex.difficulty]}10` }}>
                        {DIFFICULTIES[ex.difficulty] || ex.difficulty}
                      </span>
                      <span className="text-[#4B5563] text-xs">{ex.category}</span>
                    </div>
                    <p className="text-[#F1F5F9] text-sm font-medium">{ex.title_es}</p>
                    <p className="text-[#94A3B8] text-xs mt-1 line-clamp-1">{ex.description_es}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setEditingExercise(ex)} data-testid={`edit-exercise-${ex.id}`}
                      className="p-2 text-[#94A3B8] hover:text-[#06B6D4] hover:bg-white/5 rounded-lg transition-all">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteExercise(ex.id)} disabled={deletingId === ex.id} data-testid={`delete-exercise-${ex.id}`}
                      className="p-2 text-[#94A3B8] hover:text-[#EF4444] hover:bg-white/5 rounded-lg transition-all disabled:opacity-40">
                      {deletingId === ex.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
