// All TypeScript interfaces for Entrenamiento Comunicativo

export interface User {
  id: number;
  email: string;
  name: string;
  current_level: number;
  total_xp: number;
  job_profile: 'general' | 'commercial' | 'technical';
  created_at: string;
}

export interface Exercise {
  id: number;
  category: string;
  level_required: number;
  title_es: string;
  description_es: string;
  duration_target_seconds: number;
  prompt_text_es: string | null;
  difficulty: 'short' | 'medium' | 'long';
}

export interface Session {
  id: number;
  user_id: number;
  level: number;
  exercise_id: number;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  passed: boolean;
  xp_earned: number;
}

export interface SessionMetrics {
  session_id: number;
  wpm: number;
  long_pauses: number;
  short_pauses: number;
  filler_count: number;
  filler_per_min: number;
  gaze_percentage: number;
  facial_rigidity_score: number;
  head_movement_score: number;
  latency_ms: number;
  lexical_richness: number;
  structure_score: number;
  blink_rate: number;
  asymmetry_score: number;
  mandibular_tension_score: number;
}

export interface Report {
  session_id: number;
  report_json: ReportJSON;
  created_at: string;
}

export interface ReportJSON {
  resumenEjecutivo: string;
  rendimientoVerbal: {
    wpm: number;
    wpmEvaluation: string;
    volumeVariation: string;
    dictionClarity: string;
  };
  ritmoPausas: {
    shortPauses: number;
    longPauses: number;
    startLatencyMs: number;
    evaluation: string;
  };
  muletillasFluidez: {
    totalCount: number;
    perMinute: number;
    topFillers: string[];
    suggestedAlternatives: string[];
    evaluation: string;
  };
  presenciaVisual: {
    gazePercentage: number;
    prolongedDeviations: number;
    facialRigidityDescription: string;
    headMovementDescription: string;
    evaluation: string;
  };
  estructuraContenido: {
    hasOpening: boolean;
    hasClosing: boolean;
    relevanceEvaluation: string;
    overallEvaluation: string;
  };
  comparacionHistorica: string;
  planSiguienteSesion: string;
}

export interface VisionData {
  gazePercentage: number;
  prolongedDeviations: number;
  blinkRate: number;
  facialRigidityScore: number;
  mandibularTensionScore: number;
  lipCompressionEvents: number;
  headMovementPeaks: number;
  asymmetryScore: number;
  avgResponseLatencyMs: number;
  smileEvents: number;
}

export interface ProgressEntry {
  session_id: string;
  level: number;
  exercise_id: string;
  started_at: string;
  duration_seconds: number;
  passed: boolean;
  xp_earned: number;
  metrics: {
    wpm: number;
    filler_per_min: number;
    gaze_percentage: number;
    long_pauses: number;
    structure_score: number;
  };
}
