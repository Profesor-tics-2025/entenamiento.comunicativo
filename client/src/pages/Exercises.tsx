import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import type { Exercise } from '../types';
import { BookOpen, Clock, ChevronRight, X, Radio, Filter } from 'lucide-react';

const CATEGORIES = [
  'Todos', 'Lectura Controlada', 'Presentación Personal', 'Entrevista Laboral',
  'Estructura Oral', 'Soltura y Desinhibición', 'Videoconferencia Profesional', 'Resistencia Comunicativa',
];

type Difficulty = 'short' | 'medium' | 'long';

const DIFFICULTIES: Record<Difficulty, { label: string; color: string }> = {
  short: { label: 'Corto', color: '#10B981' },
  medium: { label: 'Medio', color: '#F59E0B' },
  long: { label: 'Largo', color: '#EF4444' },
};

function ExerciseCard({ exercise, onClick }: { exercise: Exercise; onClick: (ex: Exercise) => void }) {
  const diff = DIFFICULTIES[exercise.difficulty] ?? DIFFICULTIES.short;
  return (
    <div
      className="bg-[#1F2937] border border-white/5 rounded-xl p-5 card-hover cursor-pointer relative"
      onClick={() => onClick(exercise)}
      data-testid="exercise-card"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="level-badge">Nv. {exercise.level_required}</span>
        <span className="text-xs px-2 py-0.5 rounded-full border"
          style={{ color: diff.color, borderColor: `${diff.color}40`, background: `${diff.color}10` }}>
          {diff.label}
        </span>
      </div>
      <h3 className="font-heading font-semibold text-[#F1F5F9] mb-2 leading-tight">{exercise.title_es}</h3>
      <p className="text-[#94A3B8] text-xs line-clamp-2 mb-4">{exercise.description_es}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[#94A3B8] text-xs">
          <Clock className="w-3 h-3" />
          <span>
            {Math.floor(exercise.duration_target_seconds / 60)}m{' '}
            {exercise.duration_target_seconds % 60 > 0 ? `${exercise.duration_target_seconds % 60}s` : ''}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
      </div>
    </div>
  );
}

function ExerciseModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const navigate = useNavigate();
  const diff = DIFFICULTIES[exercise.difficulty] ?? DIFFICULTIES.short;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#111827] border border-white/10 rounded-2xl p-7 w-full max-w-lg shadow-2xl fade-in"
        onClick={e => e.stopPropagation()}
        data-testid="exercise-modal"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-2">
            <span className="level-badge">Nv. {exercise.level_required}</span>
            <span className="text-xs px-2 py-0.5 rounded-full border"
              style={{ color: diff.color, borderColor: `${diff.color}40`, background: `${diff.color}10` }}>
              {diff.label}
            </span>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#F1F5F9] transition-colors" data-testid="close-modal-btn">
            <X className="w-5 h-5" />
          </button>
        </div>

        <h2 className="font-heading font-semibold text-xl text-[#F1F5F9] mb-2">{exercise.title_es}</h2>
        <p className="text-[#94A3B8] text-sm leading-relaxed mb-4">{exercise.description_es}</p>

        <div className="flex items-center gap-4 mb-5 text-sm text-[#94A3B8]">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4" />
            <span>Duración: {Math.floor(exercise.duration_target_seconds / 60)}min{' '}
              {exercise.duration_target_seconds % 60 > 0 ? `${exercise.duration_target_seconds % 60}s` : ''}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <BookOpen className="w-4 h-4" />
            <span>{exercise.category}</span>
          </div>
        </div>

        {exercise.prompt_text_es && (
          <div className="bg-[#1F2937] border border-white/5 rounded-xl p-4 mb-5">
            <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-2">Texto del ejercicio</p>
            <p className="text-[#F1F5F9] text-sm leading-relaxed">{exercise.prompt_text_es}</p>
          </div>
        )}

        <button
          onClick={() => navigate(`/train?exerciseId=${exercise.id}`)}
          data-testid="start-exercise-btn"
          className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <Radio className="w-4 h-4" /> Entrenar ahora
        </button>
      </div>
    </div>
  );
}

export default function Exercises() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState('Todos');
  const [selectedDiff, setSelectedDiff] = useState<Difficulty | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  useEffect(() => {
    api.get<Exercise[]>('/api/exercises')
      .then(r => { setExercises(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => exercises.filter(ex => {
    if (selectedCat !== 'Todos' && ex.category !== selectedCat) return false;
    if (selectedDiff && ex.difficulty !== selectedDiff) return false;
    return true;
  }), [exercises, selectedCat, selectedDiff]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 fade-in">
      <div className="mb-6">
        <h1 className="font-heading font-semibold text-3xl sm:text-4xl tracking-tighter text-[#F1F5F9]">Ejercicios</h1>
        <p className="text-[#94A3B8] mt-1 text-sm">{exercises.length} ejercicios disponibles en 7 categorías</p>
      </div>

      {/* Category tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2 mb-4 scrollbar-none" data-testid="category-tabs">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCat(cat)}
            data-testid={`cat-tab-${cat}`}
            className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-all flex-shrink-0 ${
              selectedCat === cat
                ? 'bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30'
                : 'text-[#94A3B8] hover:text-[#F1F5F9] hover:bg-white/5 border border-transparent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Difficulty filter */}
      <div className="flex items-center gap-2 mb-6" data-testid="difficulty-filter">
        <Filter className="w-3.5 h-3.5 text-[#94A3B8]" />
        <span className="text-[#94A3B8] text-xs mr-1">Dificultad:</span>
        {([null, 'short', 'medium', 'long'] as (Difficulty | null)[]).map(d => {
          const label = d === null ? 'Todos' : DIFFICULTIES[d].label;
          const color = d ? DIFFICULTIES[d].color : '#06B6D4';
          return (
            <button
              key={d ?? 'all'}
              onClick={() => setSelectedDiff(d)}
              data-testid={`diff-pill-${d ?? 'all'}`}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                selectedDiff === d
                  ? 'text-white'
                  : 'text-[#94A3B8] border-white/10 hover:border-white/20'
              }`}
              style={selectedDiff === d ? { background: color, borderColor: color } : {}}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Exercise grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="bg-[#1F2937] border border-white/5 rounded-xl p-5">
              <div className="shimmer h-4 w-1/3 rounded mb-3" />
              <div className="shimmer h-5 w-4/5 rounded mb-2" />
              <div className="shimmer h-3 w-full rounded mb-1" />
              <div className="shimmer h-3 w-3/4 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-[#94A3B8] mx-auto mb-3" />
          <p className="text-[#94A3B8]">No hay ejercicios que coincidan con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" data-testid="exercises-grid">
          {filtered.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onClick={setSelectedExercise} />
          ))}
        </div>
      )}

      {selectedExercise && (
        <ExerciseModal exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />
      )}
    </div>
  );
}
