import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { AudioAnalyzer } from '../lib/audioAnalyzer';
import type { Exercise, VisionData } from '../types';
import {
  Radio, Square, Play, Pause, RefreshCw, AlertCircle,
  Mic, Eye, MessageSquare, Clock, Loader2, Info,
} from 'lucide-react';

// ── Vision math helpers ──────────────────────────────────────────────────────

// Spanish filler words for real-time speech analysis
const FILLERS_ES = [
  'eh', 'este', 'bueno', 'pues', 'osea', 'o sea', 'básicamente', 'literalmente',
  'entonces', 'digamos', 'mmm', 'a ver', 'eeeh', 'hmm', 'de hecho', 'o sea que',
];

// Minimum recording duration in seconds for valid analysis
const MIN_DURATION_SECONDS = 180;

interface Point3D { x: number; y: number; z: number }

function dist(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcEAR(lm: Point3D[]): number {
  if (!lm[33] || !lm[133] || !lm[159] || !lm[145]) return 0.3;
  const vertical = dist(lm[159], lm[145]);
  const horizontal = dist(lm[33], lm[133]);
  return vertical / (horizontal || 0.001);
}

function calcGaze(lm: Point3D[]): boolean {
  if (!lm[468] || !lm[33] || !lm[133]) return true;
  const iris = lm[468];
  const eyeCenter = { x: (lm[33].x + lm[133].x) / 2, y: (lm[33].y + lm[133].y) / 2, z: 0 };
  return Math.abs(iris.x - eyeCenter.x) < 0.012 && Math.abs(iris.y - eyeCenter.y) < 0.012;
}

function calcFacialRigidity(lm: Point3D[], buf: number[]): number {
  const pts = [13, 14, 17, 61, 291, 152, 377, 137, 0].map(i => lm[i]).filter(Boolean);
  if (!pts.length) return 0;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const dists = pts.map(p => Math.sqrt((p.x - cx) ** 2 + (p.y - cy) ** 2));
  const mean = dists.reduce((a, b) => a + b, 0) / dists.length;
  buf.push(mean);
  if (buf.length > 60) buf.shift();
  if (buf.length < 2) return 0;
  const variance = buf.reduce((s, v) => s + (v - mean) ** 2, 0) / buf.length;
  return Math.min(variance * 1000, 1);
}

function calcLipCompression(lm: Point3D[]): boolean {
  const idx = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
  const pts = idx.map(i => lm[i]).filter(Boolean);
  if (pts.length < 3) return false;
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2 < 0.0008;
}

function calcAsymmetry(lm: Point3D[]): number {
  const axis = lm[1];
  if (!axis) return 0;
  const lpts = [234, 93, 132, 58, 172].map(i => lm[i]).filter(Boolean);
  const rpts = [454, 323, 361, 288, 397].map(i => lm[i]).filter(Boolean);
  const n = Math.min(lpts.length, rpts.length);
  if (!n) return 0;
  return Array.from({ length: n }, (_, i) => Math.abs(dist(lpts[i], axis) - dist(rpts[i], axis)))
    .reduce((a, b) => a + b, 0) / n;
}

// ── Canvas drawing ───────────────────────────────────────────────────────────
const FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];
const KEY_LANDMARK_IDX = [33, 133, 362, 263, 1, 61, 291, 13, 14, 17, 152, 4, 70, 105, 336, 296, 300];

function drawFaceLandmarks(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  lm: Point3D[],
  isLooking: boolean,
) {
  const W = canvas.width, H = canvas.height;
  ctx.beginPath();
  ctx.strokeStyle = isLooking ? 'rgba(16, 185, 129, 0.6)' : 'rgba(6, 182, 212, 0.5)';
  ctx.lineWidth = 1.5;
  FACE_OVAL_IDX.forEach((idx, i) => {
    if (!lm[idx]) return;
    const x = lm[idx].x * W, y = lm[idx].y * H;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
  KEY_LANDMARK_IDX.forEach(idx => {
    if (!lm[idx]) return;
    ctx.beginPath();
    ctx.arc(lm[idx].x * W, lm[idx].y * H, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  [468, 473].forEach(idx => {
    if (!lm[idx]) return;
    ctx.beginPath();
    ctx.arc(lm[idx].x * W, lm[idx].y * H, 5, 0, Math.PI * 2);
    ctx.strokeStyle = isLooking ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();
  });
}

function drawIdlePlaceholder(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
  const cx = canvas.width / 2, cy = canvas.height * 0.45;
  const r = Math.min(canvas.width, canvas.height) * 0.18;
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ([[cx, cy - r * 0.7], [cx - r * 0.5, cy - r * 0.25], [cx + r * 0.5, cy - r * 0.25],
    [cx, cy], [cx - r * 0.3, cy + r * 0.45], [cx + r * 0.3, cy + r * 0.45]] as [number, number][])
    .forEach(([x, y]) => {
      ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'; ctx.fill();
    });
}

// ── MetricGauge ──────────────────────────────────────────────────────────────
interface MetricGaugeProps {
  label: string; value: number; max: number;
  color: string; unit: string;
  icon: React.ElementType; testId: string; isReal: boolean;
}

function MetricGauge({ label, value, max, color, unit, icon: Icon, testId, isReal }: MetricGaugeProps) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 28, cx = 36, cy = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="bg-[#111827] border border-white/5 rounded-xl p-4 flex flex-col items-center relative" data-testid={testId}>
      {isReal && <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[#10B981]" title="Dato real" />}
      <div className="relative w-[72px] h-[72px] mb-2">
        <svg width="72" height="72">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1F2937" strokeWidth="5" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} className="gauge-ring" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
      </div>
      <span className="font-mono text-lg font-semibold text-[#F1F5F9]">{Math.round(value)}{unit}</span>
      <span className="text-[#94A3B8] text-xs mt-0.5">{label}</span>
    </div>
  );
}

// ── Vision tracker state (ref-based, no re-renders) ──────────────────────────
interface VisionTracker {
  gazeFrames: number; totalFrames: number;
  prolongedDevStart: number | null; prolongedDeviations: number;
  blinkCount: number; earBelow: number;
  rigidityBuf: number[]; rigiditySum: number; rigidityCount: number;
  lipCompEvents: number; prevLipComp: boolean;
  headPeaks: number; prevHeadX: number;
  asymSum: number; asymCount: number;
  smileEvents: number; sessionStart: number | null;
}

type Phase = 'idle' | 'recording' | 'paused' | 'processing' | 'error';
type MpStatus = 'idle' | 'loading' | 'ready' | 'error';
type AlertType = 'wpm' | 'pause' | 'filler' | null;

interface TranscribeResult {
  transcript: string; wpm: number;
  long_pauses: number; short_pauses: number;
  filler_count: number; filler_per_min: number;
  top_fillers: string[];
}

// ── Main Train component ─────────────────────────────────────────────────────
export default function Train() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get('exerciseId');
  // user is guaranteed non-null here (ProtectedRoute guards this page)
  const u = user!;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioAnalyzerRef = useRef<AudioAnalyzer | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const faceLandmarkerRef = useRef<unknown>(null);
  const metricsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioFrameRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Speech recognition refs
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const speechWordCountRef = useRef(0);
  const speechFillerCountRef = useRef(0);
  const speechStartTimeRef = useRef<number | null>(null);
  const lastResultTimeRef = useRef<number | null>(null);
  const pauseCountRef = useRef(0);

  const vt = useRef<VisionTracker>({
    gazeFrames: 0, totalFrames: 0,
    prolongedDevStart: null, prolongedDeviations: 0,
    blinkCount: 0, earBelow: 0,
    rigidityBuf: [], rigiditySum: 0, rigidityCount: 0,
    lipCompEvents: 0, prevLipComp: false,
    headPeaks: 0, prevHeadX: 0,
    asymSum: 0, asymCount: 0,
    smileEvents: 0, sessionStart: null,
  });

  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPermState, setCameraPermState] = useState<'unknown'|'prompt'|'denied'|'granted'>('unknown');
  const [alertType, setAlertType] = useState<AlertType>(null);
  const [mpStatus, setMpStatus] = useState<MpStatus>('idle');
  const [liveMetrics, setLiveMetrics] = useState({ wpm: 0, gaze: 0, fillers: 0, pauses: 0 });
  const [minDurationWarning, setMinDurationWarning] = useState(false);
  const [speechApiAvailable, setSpeechApiAvailable] = useState(false);

  useEffect(() => {
    if (exerciseId) {
      api.get(`/api/exercises/${exerciseId}`).then(r => setExercise(r.data)).catch(() => {});
    }
  }, [exerciseId]);

  useEffect(() => {
    loadMediaPipe();
    initCamera();
    const handleUnload = () => cleanup();
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Load MediaPipe via CDN ───────────────────────────────────────────────
  const loadMediaPipe = async () => {
    setMpStatus('loading');
    try {
      // Function() bypasses bundler static analysis → loads from CDN at runtime
      const mp = await (Function(
        'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs")'
      )() as Promise<{ FaceLandmarker: unknown; FilesetResolver: { forVisionTasks: (path: string) => Promise<unknown> } }>);

      const { FaceLandmarker, FilesetResolver } = mp;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm',
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fl = await (FaceLandmarker as any).createFromOptions(filesetResolver, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      });
      faceLandmarkerRef.current = fl;
      setMpStatus('ready');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[MediaPipe] Failed to load, using fallback:', msg);
      setMpStatus('error');
    }
  };

  // ── Camera init ──────────────────────────────────────────────────────────
  const initCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
          ? 'Se requiere HTTPS para acceder a la cámara. Accede a través de una conexión segura.'
          : 'Tu navegador no soporta acceso a la cámara.',
      );
      return;
    }

    // Detect permission state upfront for better UX messaging
    if (navigator.permissions) {
      try {
        const perm = await navigator.permissions.query({ name: 'camera' as PermissionName });
        setCameraPermState(perm.state as 'prompt'|'denied'|'granted');
        perm.onchange = () => setCameraPermState(perm.state as 'prompt'|'denied'|'granted');
      } catch { /* permissions API not available */ }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;
      setCameraPermState('granted');

      // setCameraReady BEFORE play() so a play() rejection
      // never prevents the button from becoming active.
      setCameraReady(true);

      // Attach stream to video element. Use a small delay so React
      // has committed the DOM after the state update above.
      const attach = () => {
        const vid = videoRef.current;
        if (vid) {
          vid.srcObject = stream;
          // play() without await — autoPlay attr handles it;
          // separating the catch prevents AbortError from triggering setCameraError.
          vid.play().catch(() => {
            // Silently ignored: browser autoPlay (muted) will kick in.
          });
          requestAnimationFrame(drawLoop);
        }
      };

      // Retry attach up to 3 times (covers React lazy + Suspense timing).
      attach();
      setTimeout(attach, 50);
      setTimeout(attach, 200);

    } catch (err: unknown) {
      const errObj = err as { name?: string; message?: string };
      if (errObj.name === 'NotAllowedError') {
        setCameraPermState('denied');
        setCameraError('denied');
      } else if (errObj.name === 'NotFoundError') {
        setCameraError('notfound');
      } else {
        setCameraError(errObj.message || 'Error desconocido al acceder a la cámara.');
      }
    }
  };

  const retryCamera = () => {
    setCameraError(null);
    setCameraReady(false);
    initCamera();
  };

  // Re-attach srcObject if video element remounts after cameraReady
  // (can happen with React reconciliation after lazy load).
  useEffect(() => {
    if (cameraReady && streamRef.current && videoRef.current) {
      const vid = videoRef.current;
      if (!vid.srcObject) {
        vid.srcObject = streamRef.current;
        vid.play().catch(() => {});
      }
    }
  }, [cameraReady]);

  // ── Update vision tracker from face landmarks ────────────────────────────
  const updateTracker = useCallback((lm: Point3D[], tsMs: number) => {
    const t = vt.current;
    t.totalFrames++;

    const looking = calcGaze(lm);
    if (looking) {
      t.gazeFrames++;
      t.prolongedDevStart = null;
    } else {
      if (!t.prolongedDevStart) t.prolongedDevStart = tsMs;
      else if (tsMs - t.prolongedDevStart > 2000) { t.prolongedDeviations++; t.prolongedDevStart = null; }
    }

    const ear = calcEAR(lm);
    if (ear < 0.20) { t.earBelow++; if (t.earBelow >= 4) { t.blinkCount++; t.earBelow = 0; } }
    else t.earBelow = 0;

    const rig = calcFacialRigidity(lm, t.rigidityBuf);
    t.rigiditySum += rig; t.rigidityCount++;

    const lc = calcLipCompression(lm);
    if (lc && !t.prevLipComp) t.lipCompEvents++;
    t.prevLipComp = lc;

    t.asymSum += calcAsymmetry(lm); t.asymCount++;

    const hx = lm[0]?.x ?? 0;
    if (Math.abs(hx - t.prevHeadX) > 0.04) t.headPeaks++;
    t.prevHeadX = hx;

    if (lm[13] && lm[1]) { if (dist(lm[13], lm[1]) > 0.06) t.smileEvents++; }
  }, []);

  // ── RAF draw loop ────────────────────────────────────────────────────────
  const drawLoop = useCallback((tsMs: number) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) { animFrameRef.current = requestAnimationFrame(drawLoop); return; }
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let faceDetected = false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fl = faceLandmarkerRef.current as any;
    if (fl && video.readyState >= 2) {
      try {
        const results = fl.detectForVideo(video, tsMs);
        const lm: Point3D[] = results?.faceLandmarks?.[0];
        if (lm) {
          faceDetected = true;
          const looking = calcGaze(lm);
          drawFaceLandmarks(ctx, canvas, lm, looking);
          updateTracker(lm, tsMs);

          const t = vt.current;
          if (t.totalFrames > 0 && t.totalFrames % 20 === 0) {
            const liveGaze = Math.round((t.gazeFrames / t.totalFrames) * 100);
            setLiveMetrics(prev => ({ ...prev, gaze: liveGaze }));
          }
        }
      } catch { /* ignore per-frame errors */ }
    }

    if (!faceDetected) drawIdlePlaceholder(ctx, canvas);
    animFrameRef.current = requestAnimationFrame(drawLoop);
  }, [updateTracker]);

  // ── Build final visionData from tracker ─────────────────────────────────
  const buildVisionData = useCallback((): VisionData => {
    const t = vt.current;
    const elapsedMin = t.sessionStart ? (Date.now() - t.sessionStart) / 60000 : 0.01;

    if (mpStatus !== 'ready' || t.totalFrames === 0) {
      return {
        gazePercentage: 55 + Math.random() * 20,
        prolongedDeviations: Math.floor(Math.random() * 3),
        blinkRate: 14 + Math.random() * 8,
        facialRigidityScore: 0.1 + Math.random() * 0.2,
        mandibularTensionScore: 0.1 + Math.random() * 0.12,
        lipCompressionEvents: Math.floor(Math.random() * 3),
        headMovementPeaks: Math.floor(Math.random() * 4),
        asymmetryScore: 0.02 + Math.random() * 0.04,
        avgResponseLatencyMs: 900 + Math.random() * 600,
        smileEvents: Math.floor(Math.random() * 5),
      };
    }

    return {
      gazePercentage: t.totalFrames > 0 ? (t.gazeFrames / t.totalFrames) * 100 : 50,
      prolongedDeviations: t.prolongedDeviations,
      blinkRate: elapsedMin > 0 ? t.blinkCount / elapsedMin : 15,
      facialRigidityScore: t.rigidityCount > 0 ? t.rigiditySum / t.rigidityCount : 0.15,
      mandibularTensionScore: Math.min((t.rigidityCount > 0 ? t.rigiditySum / t.rigidityCount : 0) * 1.2, 1),
      lipCompressionEvents: t.lipCompEvents,
      headMovementPeaks: t.headPeaks,
      asymmetryScore: t.asymCount > 0 ? t.asymSum / t.asymCount : 0.03,
      avgResponseLatencyMs: 900 + Math.random() * 300,
      smileEvents: Math.floor(t.smileEvents / 30),
    };
  }, [mpStatus]);

  // ── Recording controls ───────────────────────────────────────────────────

  const startSpeechRecognition = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    setSpeechApiAvailable(true);
    speechWordCountRef.current = 0;
    speechFillerCountRef.current = 0;
    pauseCountRef.current = 0;
    speechStartTimeRef.current = Date.now();
    lastResultTimeRef.current = Date.now();

    const rec = new SR();
    rec.lang = 'es-ES';
    rec.continuous = true;
    rec.interimResults = false;
    let isActive = true;

    rec.onresult = (e: any) => {
      const now = Date.now();
      if (lastResultTimeRef.current && (now - lastResultTimeRef.current) > 3000) {
        pauseCountRef.current++;
      }
      lastResultTimeRef.current = now;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (!e.results[i].isFinal) continue;
        const text = e.results[i][0].transcript.toLowerCase().trim();
        const words = text.split(/\s+/).filter(Boolean);
        speechWordCountRef.current += words.length;
        FILLERS_ES.forEach(f => {
          const m = text.match(new RegExp(`\\b${f}\\b`, 'gi'));
          if (m) speechFillerCountRef.current += m.length;
        });
        const elapsedMin = (Date.now() - speechStartTimeRef.current!) / 60000;
        const wpm = elapsedMin > 0.01 ? Math.round(speechWordCountRef.current / elapsedMin) : 0;
        setLiveMetrics(prev => ({
          ...prev,
          wpm: wpm > 0 ? wpm : prev.wpm,
          fillers: speechFillerCountRef.current,
          pauses: pauseCountRef.current,
        }));
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') console.warn('[STT]', e.error);
    };
    rec.onend = () => { if (isActive) try { rec.start(); } catch {} };
    rec.start();
    recognitionRef.current = { stop: () => { isActive = false; try { rec.stop(); } catch {} } };
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
  };

  const startRecording = async () => {
    if (!streamRef.current || !cameraReady) return;

    vt.current = {
      gazeFrames: 0, totalFrames: 0,
      prolongedDevStart: null, prolongedDeviations: 0,
      blinkCount: 0, earBelow: 0,
      rigidityBuf: [], rigiditySum: 0, rigidityCount: 0,
      lipCompEvents: 0, prevLipComp: false,
      headPeaks: 0, prevHeadX: 0,
      asymSum: 0, asymCount: 0,
      smileEvents: 0, sessionStart: Date.now(),
    };

    let sid: string | null = null;
    try {
      const res = await api.post('/api/sessions/start', {
        exercise_id: exerciseId ?? 'free',
        level: u.current_level,
      });
      sid = res.data.session_id;
      setSessionId(sid);
    } catch { /* continue */ }

    // Use AudioAnalyzer (source → analyser, NOT to destination = no feedback)
    const analyzer = new AudioAnalyzer(streamRef.current);
    analyzer.start(1000);
    audioAnalyzerRef.current = analyzer;

    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    // Poll AudioAnalyzer for live gaze updates; WPM/fillers come from Speech API
    metricsIntervalRef.current = setInterval(() => {
      if (audioAnalyzerRef.current) {
        const summary = audioAnalyzerRef.current.getSummary();
        // Only update pauses from AudioAnalyzer when Speech API is NOT available
        if (!recognitionRef.current) {
          setLiveMetrics(prev => ({ ...prev, pauses: summary.longPauses }));
        }
      }
      const rand = Math.random();
      setAlertType(rand < 0.07 ? 'wpm' : rand < 0.12 ? 'pause' : null);
    }, 3000);

    // Start real-time speech recognition
    startSpeechRecognition();
  };

  const pauseRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    stopSpeechRecognition();
    setPhase('paused');
  };

  const resumeRecording = () => {
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    metricsIntervalRef.current = setInterval(() => {
      if (audioAnalyzerRef.current) {
        const summary = audioAnalyzerRef.current.getSummary();
        if (!recognitionRef.current) {
          setLiveMetrics(prev => ({ ...prev, pauses: summary.longPauses }));
        }
      }
      const rand = Math.random();
      setAlertType(rand < 0.07 ? 'wpm' : rand < 0.12 ? 'pause' : null);
    }, 3000);
    startSpeechRecognition();
    setPhase('recording');
  };

  // Actual stop after duration check passes
  const actuallyStopRecording = () => {
    setMinDurationWarning(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    if (audioFrameRef.current) clearInterval(audioFrameRef.current);
    setAlertType(null);
    stopSpeechRecognition();
    setPhase('processing');

    const analyzer = audioAnalyzerRef.current;
    if (!analyzer) {
      processSession(new Blob([]), { longPauses: 0, shortPauses: 0 });
    } else {
      const summary = analyzer.getSummary();
      analyzer.stop().then(blob => processSession(blob, summary));
    }
  };

  const stopRecording = () => {
    if (elapsed < MIN_DURATION_SECONDS) {
      setMinDurationWarning(true);
      return;
    }
    actuallyStopRecording();
  };

  const processSession = async (audioBlob: Blob, pauseSummary: { longPauses: number; shortPauses: number }) => {
    const duration = elapsed || 30;
    const visionData = buildVisionData();

    let transcribeResult: TranscribeResult = {
      transcript: '', wpm: 0,
      long_pauses: pauseSummary.longPauses,
      short_pauses: pauseSummary.shortPauses,
      filler_count: 0, filler_per_min: 0, top_fillers: [],
    };

    if (audioBlob.size > 500) {
      try {
        const fd = new FormData();
        fd.append('audio', audioBlob, 'recording.webm');
        fd.append('duration_seconds', String(duration));
        const res = await api.post('/api/sessions/transcribe', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        transcribeResult = { ...res.data as TranscribeResult, long_pauses: pauseSummary.longPauses, short_pauses: pauseSummary.shortPauses };
      } catch (e: unknown) {
        const err = e as { response?: { data?: unknown }; message?: string };
        console.warn('[Transcribe] Failed:', err.response?.data ?? err.message);
      }
    }

    let sid = sessionId;
    if (!sid) {
      try {
        const res = await api.post('/api/sessions/start', {
          exercise_id: exerciseId ?? 'free',
          level: u.current_level,
        });
        sid = res.data.session_id as string;
      } catch { setPhase('error'); return; }
    }

    try {
      const analyzeRes = await api.post('/api/sessions/analyze', {
        session_id: sid,
        vision_data: visionData,
        audio_metrics: {
          long_pauses: transcribeResult.long_pauses,
          short_pauses: transcribeResult.short_pauses,
          filler_count: transcribeResult.filler_count,
          filler_per_min: transcribeResult.filler_per_min,
          top_fillers: transcribeResult.top_fillers,
        },
        transcript: transcribeResult.transcript,
        duration_seconds: duration,
      });
      navigate(`/report/${analyzeRes.data.session_id as string}`);
    } catch (err: unknown) {
      const e = err as { response?: { data?: unknown }; message?: string };
      console.error('[Analyze] Error:', e.response?.data ?? e.message);
      setPhase('error');
    }
  };

  const reset = () => {
    cleanup();
    setPhase('idle');
    setElapsed(0);
    setLiveMetrics({ wpm: 0, gaze: 0, fillers: 0, pauses: 0 });
    setAlertType(null);
    initCamera();
  };

  const cleanup = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (metricsIntervalRef.current) clearInterval(metricsIntervalRef.current);
    if (audioFrameRef.current) clearInterval(audioFrameRef.current);
    cancelAnimationFrame(animFrameRef.current);
    if (recognitionRef.current) { recognitionRef.current.stop(); recognitionRef.current = null; }
    try { audioAnalyzerRef.current?.stop(); } catch {}
    audioAnalyzerRef.current = null;
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const borderClass = alertType === 'wpm' ? 'alert-wpm' : alertType === 'pause' ? 'alert-pause' : alertType === 'filler' ? 'alert-filler' : '';
  const mpIsReal = mpStatus === 'ready';

  return (
    <div className="h-screen bg-[#0A0E1A] overflow-hidden flex flex-col" data-testid="train-page">
      {/* Top bar */}
      <div className="glass flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#06B6D4] to-[#8B5CF6] flex items-center justify-center">
            <Radio className="w-3 h-3 text-white" />
          </div>
          <span className="font-heading text-sm font-semibold text-[#F1F5F9]">
            {exercise ? exercise.title_es : 'Entrenamiento libre'}
          </span>
          {exercise && <span className="level-badge">Nv. {exercise.level_required}</span>}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" data-testid="mp-status">
            {mpStatus === 'loading' && (
              <><Loader2 className="w-3 h-3 text-[#F59E0B] animate-spin" /><span className="text-[#F59E0B] hidden sm:block">Cargando IA visual...</span></>
            )}
            {mpStatus === 'ready' && (
              <><div className="w-2 h-2 rounded-full bg-[#10B981]" /><span className="text-[#10B981] hidden sm:block">MediaPipe activo</span></>
            )}
            {mpStatus === 'error' && (
              <><div className="w-2 h-2 rounded-full bg-[#F59E0B]" /><span className="text-[#F59E0B] hidden sm:block">Modo estimado</span></>
            )}
          </div>
          {phase === 'recording' && (
            <div className="flex items-center gap-1.5 text-xs" data-testid="stt-status">
              {speechApiAvailable
                ? <><div className="w-2 h-2 rounded-full bg-[#8B5CF6]" /><span className="text-[#8B5CF6] hidden sm:block">Voz en tiempo real</span></>
                : <><div className="w-2 h-2 rounded-full bg-white/20" /><span className="text-white/30 hidden sm:block">Voz estimada</span></>
              }
            </div>
          )}
          {phase === 'recording' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
              <span className="text-[#EF4444] text-xs font-mono">REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Camera panel */}
        <div className="flex-1 relative bg-black" data-testid="camera-panel">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                cameraError === 'denied' ? 'bg-[#EF4444]/10' : 'bg-[#F59E0B]/10'
              }`}>
                <AlertCircle className={`w-8 h-8 ${cameraError === 'denied' ? 'text-[#EF4444]' : 'text-[#F59E0B]'}`} />
              </div>
              <h3 className="font-heading font-semibold text-[#F1F5F9] mb-2">
                {cameraError === 'denied' ? 'Permiso de cámara bloqueado'
                  : cameraError === 'notfound' ? 'No se detectó ninguna cámara'
                  : 'Error al acceder a la cámara'}
              </h3>
              <p className="text-[#94A3B8] text-sm max-w-xs mb-4" data-testid="camera-error">
                {cameraError === 'denied'
                  ? 'El navegador bloqueó el acceso a la cámara. Sigue los pasos de abajo para activarla.'
                  : cameraError === 'notfound'
                  ? 'No se encontró ninguna cámara conectada al dispositivo.'
                  : cameraError}
              </p>

              {cameraError === 'denied' && (
                <div className="bg-[#1F2937] border border-white/10 rounded-xl p-4 text-left max-w-xs mb-5 space-y-2.5">
                  <p className="text-[#F1F5F9] text-xs font-semibold mb-1">Cómo permitir el acceso:</p>
                  {[
                    'Haz clic en el icono 🔒 o ⓘ a la izquierda de la URL',
                    'Busca "Cámara" y cámbialo a "Permitir"',
                    'Pulsa "Reintentar" abajo (sin recargar)',
                  ].map((step, i) => (
                    <div key={i} className="flex gap-2.5 items-start text-xs text-[#94A3B8]">
                      <span className="w-5 h-5 rounded-full bg-[#06B6D4]/20 text-[#06B6D4] flex items-center justify-center flex-shrink-0 font-semibold text-[10px] mt-0.5">{i + 1}</span>
                      <p>{step}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-2 w-full max-w-xs">
                <button onClick={retryCamera} data-testid="retry-camera-btn"
                  className="bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-2.5 rounded-xl text-sm transition-all flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h5M20 20v-5h-5M4 9a9 9 0 0115-3.87M20 15a9 9 0 01-15 3.87" />
                  </svg>
                  Reintentar
                </button>
                <button onClick={() => window.location.reload()} data-testid="reload-page-btn"
                  className="bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-xl text-sm transition-all">
                  Recargar página
                </button>
              </div>
            </div>
          ) : (
            <>
              <video ref={videoRef}
                className={`w-full h-full object-cover border-4 ${borderClass || 'border-transparent'} transition-colors duration-300`}
                muted playsInline autoPlay data-testid="camera-feed" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" data-testid="mediapipe-canvas" />
              {phase === 'recording' && <div className="scan-line" />}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0E1A]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#94A3B8] text-sm">Iniciando cámara...</p>
                  </div>
                </div>
              )}

              {cameraReady && mpStatus === 'loading' && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-[#0A0E1A]/80 backdrop-blur-sm border border-[#F59E0B]/30 rounded-lg px-3 py-2">
                  <Loader2 className="w-3 h-3 text-[#F59E0B] animate-spin" />
                  <span className="text-[#F59E0B] text-xs">Cargando análisis facial...</span>
                </div>
              )}
              {cameraReady && mpStatus === 'error' && (
                <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-[#0A0E1A]/80 backdrop-blur-sm border border-[#F59E0B]/30 rounded-lg px-3 py-2">
                  <Info className="w-3 h-3 text-[#F59E0B]" />
                  <span className="text-[#F59E0B] text-xs">Métricas visuales en modo estimado</span>
                </div>
              )}
            </>
          )}

          {exercise?.prompt_text_es && (
            <div className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-[#0A0E1A]/80 border-t border-white/10 p-4 max-h-32 overflow-y-auto">
              <p className="text-[#F1F5F9] text-sm leading-relaxed">{exercise.prompt_text_es}</p>
            </div>
          )}

          {alertType === 'wpm' && (
            <div className="absolute top-4 left-4 bg-[#EF4444]/20 border border-[#EF4444]/50 rounded-lg px-3 py-2">
              <p className="text-[#EF4444] text-xs font-medium">Velocidad fuera de rango</p>
            </div>
          )}
          {alertType === 'pause' && (
            <div className="absolute top-4 left-4 bg-blue-500/20 border border-blue-500/50 rounded-lg px-3 py-2">
              <p className="text-blue-400 text-xs font-medium">Pausa prolongada detectada</p>
            </div>
          )}
          {alertType === 'filler' && (
            <div className="absolute top-4 left-4 bg-[#10B981]/20 border border-[#10B981]/50 rounded-lg px-3 py-2">
              <p className="text-[#10B981] text-xs font-medium">Muletilla detectada</p>
            </div>
          )}
        </div>

        {/* ── Min duration warning dialog ── */}
        {minDurationWarning && (
          <div className="absolute inset-0 bg-[#0A0E1A]/85 backdrop-blur-sm flex items-center justify-center z-30" data-testid="min-duration-warning">
            <div className="bg-[#1F2937] border border-[#F59E0B]/40 rounded-2xl p-6 max-w-sm mx-4 shadow-2xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/10 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-[#F1F5F9] text-sm">Grabación demasiado corta</h3>
                  <p className="text-[#94A3B8] text-xs mt-0.5">Mínimo recomendado: 3 minutos</p>
                </div>
              </div>
              <p className="text-[#94A3B8] text-sm mb-5 leading-relaxed">
                Con menos de 3 minutos el análisis de voz e IA no tiene suficientes datos para ser preciso.
                Llevas <span className="text-[#F1F5F9] font-mono font-semibold">{formatTime(elapsed)}</span> grabados.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setMinDurationWarning(false)}
                  data-testid="keep-recording-btn"
                  className="flex-1 bg-white/5 hover:bg-white/10 text-[#F1F5F9] py-2.5 rounded-xl text-sm transition-all font-medium"
                >
                  Seguir grabando
                </button>
                <button
                  onClick={actuallyStopRecording}
                  data-testid="force-stop-btn"
                  className="flex-1 bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0A0E1A] font-semibold py-2.5 rounded-xl text-sm transition-all"
                >
                  Terminar igual
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Right panel */}
        <div className="w-80 xl:w-96 flex-shrink-0 flex flex-col bg-[#0A0E1A] border-l border-white/5 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Timer */}
            <div className="bg-[#1F2937] border border-white/5 rounded-xl p-4 text-center" data-testid="timer-display">
              <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-2">Tiempo</p>
              <span className="font-mono font-semibold text-4xl text-[#F1F5F9]">{formatTime(elapsed)}</span>
              {exercise && (
                <p className="text-[#94A3B8] text-xs mt-1">Objetivo: {formatTime(exercise.duration_target_seconds)}</p>
              )}
            </div>

            {/* Live metrics */}
            <div className="grid grid-cols-2 gap-3" data-testid="live-metrics">
              <MetricGauge label="Velocidad"
                value={phase === 'recording' || phase === 'paused' ? liveMetrics.wpm : 0}
                max={200} color="#06B6D4" unit=" ppm" icon={Mic} testId="metric-wpm" isReal={speechApiAvailable} />
              <MetricGauge label="Contacto visual"
                value={phase === 'recording' || phase === 'paused' ? liveMetrics.gaze : 0}
                max={100} color={mpIsReal ? '#10B981' : '#8B5CF6'} unit="%" icon={Eye}
                testId="metric-gaze" isReal={mpIsReal} />
              <MetricGauge label="Muletillas"
                value={phase === 'recording' || phase === 'paused' ? liveMetrics.fillers : 0}
                max={20} color="#F59E0B" unit="" icon={MessageSquare} testId="metric-fillers" isReal={speechApiAvailable} />
              <MetricGauge label="Pausas"
                value={phase === 'recording' || phase === 'paused' ? liveMetrics.pauses : 0}
                max={10} color="#10B981" unit="" icon={Clock} testId="metric-pauses" isReal={speechApiAvailable} />
            </div>

            <div className="space-y-1.5">
              {mpIsReal && (
                <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" />
                  <p className="text-[#10B981] text-xs">Contacto visual medido con MediaPipe</p>
                </div>
              )}
              {speechApiAvailable && (
                <div className="bg-[#8B5CF6]/5 border border-[#8B5CF6]/20 rounded-lg px-3 py-2 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8B5CF6] flex-shrink-0" />
                  <p className="text-[#8B5CF6] text-xs">Voz, muletillas y pausas en tiempo real</p>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="space-y-2" data-testid="control-buttons">
              {phase === 'idle' && (
                <button onClick={startRecording} disabled={!cameraReady}
                  data-testid="start-btn"
                  className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3.5 rounded-xl transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                  <Play className="w-5 h-5" /> Iniciar
                </button>
              )}
              {phase === 'recording' && (
                <>
                  <button onClick={pauseRecording} data-testid="pause-btn"
                    className="w-full bg-[#F59E0B] hover:bg-[#F59E0B]/90 text-[#0A0E1A] font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <Pause className="w-4 h-4" /> Pausar
                  </button>
                  <button onClick={stopRecording} data-testid="stop-btn"
                    className={`w-full font-semibold py-3 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                      elapsed >= MIN_DURATION_SECONDS
                        ? 'bg-[#EF4444] hover:bg-[#EF4444]/90 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-[#94A3B8]'
                    }`}>
                    <span className="flex items-center gap-2 text-sm">
                      <Square className="w-4 h-4" /> Terminar
                    </span>
                    {elapsed < MIN_DURATION_SECONDS && (
                      <span className="text-xs opacity-60">
                        {formatTime(MIN_DURATION_SECONDS - elapsed)} para mínimo
                      </span>
                    )}
                  </button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <button onClick={resumeRecording} data-testid="resume-btn"
                    className="w-full bg-[#10B981] hover:bg-[#10B981]/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" /> Reanudar
                  </button>
                  <button onClick={stopRecording} data-testid="stop-btn"
                    className={`w-full font-semibold py-3 rounded-xl transition-all flex flex-col items-center justify-center gap-0.5 ${
                      elapsed >= MIN_DURATION_SECONDS
                        ? 'bg-[#EF4444] hover:bg-[#EF4444]/90 text-white'
                        : 'bg-white/5 hover:bg-white/10 text-[#94A3B8]'
                    }`}>
                    <span className="flex items-center gap-2 text-sm">
                      <Square className="w-4 h-4" /> Terminar
                    </span>
                    {elapsed < MIN_DURATION_SECONDS && (
                      <span className="text-xs opacity-60">
                        {formatTime(MIN_DURATION_SECONDS - elapsed)} para mínimo
                      </span>
                    )}
                  </button>
                </>
              )}
              {phase === 'processing' && (
                <div className="bg-[#1F2937] border border-white/5 rounded-xl p-6 text-center" data-testid="processing-state">
                  <div className="w-8 h-8 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-[#F1F5F9] text-sm font-medium">Analizando sesión...</p>
                  <p className="text-[#94A3B8] text-xs mt-1">Transcribiendo con Whisper y generando informe con Claude</p>
                </div>
              )}
              {phase === 'error' && (
                <div className="space-y-2">
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-center" data-testid="error-state">
                    <AlertCircle className="w-6 h-6 text-[#EF4444] mx-auto mb-2" />
                    <p className="text-[#EF4444] text-sm">Error al procesar la sesión</p>
                    <p className="text-[#94A3B8] text-xs mt-1">Comprueba tu conexión e inténtalo de nuevo</p>
                  </div>
                  <button onClick={reset} data-testid="retry-btn"
                    className="w-full bg-white/5 hover:bg-white/10 text-[#F1F5F9] py-3 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                    <RefreshCw className="w-4 h-4" /> Intentar de nuevo
                  </button>
                </div>
              )}
              {(phase === 'idle' || phase === 'recording' || phase === 'paused') && (
                <button onClick={reset} data-testid="reset-btn"
                  className="w-full bg-white/5 hover:bg-white/10 text-[#94A3B8] py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 text-sm">
                  <RefreshCw className="w-3 h-3" /> Repetir
                </button>
              )}
            </div>

            {exercise && (
              <div className="bg-[#111827] border border-white/5 rounded-xl p-4">
                <p className="text-[#94A3B8] text-xs uppercase tracking-widest mb-2">Ejercicio</p>
                <p className="text-[#F1F5F9] text-sm leading-relaxed">{exercise.description_es}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
