import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { User, Save, CheckCircle, AlertCircle } from 'lucide-react';

type JobProfile = 'general' | 'commercial' | 'technical';

interface JobProfileOption {
  value: JobProfile; label: string; desc: string;
}

const JOB_PROFILES: JobProfileOption[] = [
  { value: 'general', label: 'General', desc: 'Comunicación para todo tipo de contextos profesionales' },
  { value: 'commercial', label: 'Comercial', desc: 'Ventas, negociación y presentaciones a clientes' },
  { value: 'technical', label: 'Técnico', desc: 'Presentaciones técnicas y comunicación especializada' },
];

interface ProfileForm {
  name: string;
  job_profile: JobProfile;
}

type Status = 'success' | 'error' | null;

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState<ProfileForm>({
    name: user?.name ?? '',
    job_profile: (user?.job_profile as JobProfile) ?? 'general',
  });
  const [status, setStatus] = useState<Status>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name ?? '', job_profile: (user.job_profile as JobProfile) ?? 'general' });
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setLoading(true);
    setStatus(null);
    try {
      const { data } = await api.patch<{ name: string; job_profile: string }>('/api/users/profile', {
        name: form.name.trim(),
        job_profile: form.job_profile,
      });
      updateUser({ name: data.name, job_profile: data.job_profile as JobProfile });
      setStatus('success');
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="mb-8">
        <h1 className="font-heading font-semibold text-3xl tracking-tighter text-[#F1F5F9]">Perfil</h1>
        <p className="text-[#94A3B8] mt-1 text-sm">Configura tu cuenta y preferencias</p>
      </div>

      {/* Avatar / level */}
      <div className="bg-[#1F2937] border border-white/5 rounded-xl p-6 flex items-center gap-5 mb-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center flex-shrink-0">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <p className="font-heading font-semibold text-xl text-[#F1F5F9]">{user?.name}</p>
          <p className="text-[#94A3B8] text-sm">{user?.email}</p>
          <div className="flex items-center gap-3 mt-2">
            <span className="level-badge">Nivel {user?.current_level}</span>
            <span className="text-[#94A3B8] text-xs">{user?.total_xp} XP</span>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSave} className="bg-[#1F2937] border border-white/5 rounded-xl p-6 space-y-6" data-testid="profile-form">
        <div>
          <label className="block text-[#94A3B8] text-xs uppercase tracking-widest mb-2">Nombre completo</label>
          <input
            type="text" className="input-dark"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            data-testid="profile-name-input" required
          />
        </div>

        <div>
          <label className="block text-[#94A3B8] text-xs uppercase tracking-widest mb-2">Email</label>
          <input
            type="email" className="input-dark opacity-60 cursor-not-allowed"
            value={user?.email ?? ''} readOnly
            data-testid="profile-email-display"
          />
          <p className="text-[#94A3B8] text-xs mt-1">El email no se puede modificar</p>
        </div>

        <div>
          <label className="block text-[#94A3B8] text-xs uppercase tracking-widest mb-3">Perfil profesional</label>
          <div className="space-y-2" data-testid="job-profile-selector">
            {JOB_PROFILES.map(({ value, label, desc }) => (
              <div
                key={value}
                onClick={() => setForm({ ...form, job_profile: value })}
                data-testid={`profile-${value}`}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  form.job_profile === value
                    ? 'bg-[#06B6D4]/10 border-[#06B6D4]/40'
                    : 'bg-[#111827] border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-medium text-sm ${form.job_profile === value ? 'text-[#06B6D4]' : 'text-[#F1F5F9]'}`}>
                    {label}
                  </span>
                  {form.job_profile === value && (
                    <div className="w-5 h-5 rounded-full bg-[#06B6D4] flex items-center justify-center">
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                  )}
                </div>
                <p className="text-[#94A3B8] text-xs mt-1">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {status === 'success' && (
          <div className="flex items-center gap-2 bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg px-4 py-3 text-sm text-[#10B981]"
            data-testid="profile-success">
            <CheckCircle className="w-4 h-4" /> Perfil actualizado correctamente
          </div>
        )}
        {status === 'error' && (
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg px-4 py-3 text-sm text-[#EF4444]"
            data-testid="profile-error">
            <AlertCircle className="w-4 h-4" /> Error al guardar los cambios
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !form.name.trim()}
          data-testid="save-profile-btn"
          className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>
    </div>
  );
}
