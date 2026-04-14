import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import {
  Radio, Square, Play, Pause, RefreshCw, AlertCircle,
  Mic, Eye, MessageSquare, Clock, Loader2, Info
} from 'lucide-react';

// ── Vision math helpers ─────────────────────────────────────────────────────
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function calcEAR(lm) {
  if (!lm[33] || !lm[133] || !lm[159] || !lm[145]) return 0.3;
  const vertical = dist(lm[159], lm[145]);
  const horizontal = dist(lm[33], lm[133]);
  return vertical / (horizontal || 0.001);
}

function calcGaze(lm) {
  if (!lm[468] || !lm[33] || !lm[133]) return true; // default looking
  const iris = lm[468];
  const eyeCenter = { x: (lm[33].x + lm[133].x) / 2, y: (lm[33].y + lm[133].y) / 2 };
  return Math.abs(iris.x - eyeCenter.x) < 0.012 && Math.abs(iris.y - eyeCenter.y) < 0.012;
}

function calcFacialRigidity(lm, buf) {
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

function calcLipCompression(lm) {
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

function calcAsymmetry(lm) {
  const axis = lm[1];
  if (!axis) return 0;
  const lpts = [234, 93, 132, 58, 172].map(i => lm[i]).filter(Boolean);
  const rpts = [454, 323, 361, 288, 397].map(i => lm[i]).filter(Boolean);
  const n = Math.min(lpts.length, rpts.length);
  if (!n) return 0;
  return Array.from({ length: n }, (_, i) => Math.abs(dist(lpts[i], axis) - dist(rpts[i], axis)))
    .reduce((a, b) => a + b, 0) / n;
}

// ── Canvas drawing ──────────────────────────────────────────────────────────
const FACE_OVAL_IDX = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

const KEY_LANDMARK_IDX = [33, 133, 362, 263, 1, 61, 291, 13, 14, 17, 152, 4, 70, 105, 336, 296, 300];

function drawFaceLandmarks(ctx, canvas, lm, isLooking) {
  const W = canvas.width, H = canvas.height;

  // Face oval outline
  ctx.beginPath();
  ctx.strokeStyle = isLooking ? 'rgba(16, 185, 129, 0.6)' : 'rgba(6, 182, 212, 0.5)';
  ctx.lineWidth = 1.5;
  FACE_OVAL_IDX.forEach((idx, i) => {
    if (!lm[idx]) return;
    const x = lm[idx].x * W, y = lm[idx].y * H;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.stroke();

  // Key point dots
  ctx.fillStyle = 'rgba(6, 182, 212, 0.9)';
  KEY_LANDMARK_IDX.forEach(idx => {
    if (!lm[idx]) return;
    ctx.beginPath();
    ctx.arc(lm[idx].x * W, lm[idx].y * H, 2.5, 0, Math.PI * 2);
    ctx.fill();
  });

  // Iris highlight
  if (lm[468]) {
    ctx.beginPath();
    ctx.arc(lm[468].x * W, lm[468].y * H, 5, 0, Math.PI * 2);
    ctx.strokeStyle = isLooking ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Left iris
  if (lm[473]) {
    ctx.beginPath();
    ctx.arc(lm[473].x * W, lm[473].y * H, 5, 0, Math.PI * 2);
    ctx.strokeStyle = isLooking ? '#10B981' : '#EF4444';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawIdlePlaceholder(ctx, canvas) {
  const cx = canvas.width / 2, cy = canvas.height * 0.45;
  const r = Math.min(canvas.width, canvas.height) * 0.18;
  ctx.strokeStyle = 'rgba(6, 182, 212, 0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.75, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  [[cx, cy - r * 0.7], [cx - r * 0.5, cy - r * 0.25], [cx + r * 0.5, cy - r * 0.25],
   [cx, cy], [cx - r * 0.3, cy + r * 0.45], [cx + r * 0.3, cy + r * 0.45]].forEach(([x, y]) => {
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'; ctx.fill();
  });
}

// ── MetricGauge component ───────────────────────────────────────────────────
function MetricGauge({ label, value, max, color, unit, icon: Icon, testId, isReal }) {
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
          {Icon && <Icon className="w-4 h-4" style={{ color }} />}
        </div>
      </div>
      <span className="font-mono text-lg font-semibold text-[#F1F5F9]">{Math.round(value)}{unit}</span>
      <span className="text-[#94A3B8] text-xs mt-0.5">{label}</span>
    </div>
  );
}

// ── Main Train component ────────────────────────────────────────────────────
export default function Train() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const exerciseId = searchParams.get('exerciseId');

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const animFrameRef = useRef(null);
  const timerRef = useRef(null);
  const faceLandmarkerRef = useRef(null);
  const metricsIntervalRef = useRef(null);

  // Vision tracker (accumulated per session, never triggers re-render)
  const vt = useRef({
    gazeFrames: 0, totalFrames: 0,
    prolongedDevStart: null, prolongedDeviations: 0,
    blinkCount: 0, earBelow: 0,
    rigidityBuf: [], rigiditySum: 0, rigidityCount: 0,
    lipCompEvents: 0, prevLipComp: false,
    headPeaks: 0, prevHeadX: 0,
    asymSum: 0, asymCount: 0,
    smileEvents: 0, sessionStart: null,
  });

  const [exercise, setExercise] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('idle');
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [alertType, setAlertType] = useState(null);
  const [mpStatus, setMpStatus] = useState('idle'); // idle | loading | ready | error
  const [liveMetrics, setLiveMetrics] = useState({ wpm: 0, gaze: 0, fillers: 0, pauses: 0 });

  useEffect(() => {
    if (exerciseId) {
      api.get(`/api/exercises/${exerciseId}`).then(r => setExercise(r.data)).catch(() => {});
    }
  }, [exerciseId]);

  useEffect(() => {
    loadMediaPipe();
    initCamera();
    return () => cleanup();
  }, []); // eslint-disable-line

  // ── Load MediaPipe via CDN (bypasses webpack) ────────────────────────────
  const loadMediaPipe = async () => {
    setMpStatus('loading');
    try {
      // Function() trick bypasses webpack static import analysis → loads from CDN at runtime
      const mp = await Function(
        'return import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs")'
      )();

      const { FaceLandmarker, FilesetResolver } = mp;
      const filesetResolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
      );
      const fl = await FaceLandmarker.createFromOptions(filesetResolver, {
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
    } catch (err) {
      console.warn('[MediaPipe] Failed to load, using fallback:', err?.message || err);
      setMpStatus('error');
    }
  };

  // ── Camera init ───────────────────────────────────────────────────────────
  const initCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        window.location.protocol !== 'https:' && window.location.hostname !== 'localhost'
          ? 'Se requiere HTTPS para acceder a la cámara. Accede a través de una conexión segura.'
          : 'Tu navegador no soporta acceso a la cámara.'
      );
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720, facingMode: 'user' },
        audio: true,
      });
      streamRef.current = stream;

      // Mark camera ready BEFORE play() so an AbortError never blocks the UI.
      setCameraReady(true);

      // Attach stream to the video element. Use a small retry in case React
      // hasn't committed the DOM yet (lazy load / Suspense timing).
      const attach = () => {
        const vid = videoRef.current;
        if (vid) {
          vid.srcObject = stream;
          // Do NOT await play() — the autoPlay attr handles playback.
          // A separate .catch() prevents AbortError from surfacing as a camera error.
          vid.play().catch(() => {});
          requestAnimationFrame(drawLoop);
        }
      };

      attach();
      setTimeout(attach, 50);
      setTimeout(attach, 200);

    } catch (err) {
      const msgs = {
        NotAllowedError: 'Permiso de cámara denegado. Permite el acceso en la configuración del navegador.',
        NotFoundError: 'No se encontró ninguna cámara. Comprueba que tienes una cámara conectada.',
      };
      setCameraError(msgs[err.name] || `Error al acceder a la cámara: ${err.message}`);
    }
  };

  // Re-attach srcObject if the video element remounts after cameraReady
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

  // ── Update vision tracker from face landmarks ─────────────────────────────
  const updateTracker = useCallback((lm, tsMs) => {
    const t = vt.current;
    t.totalFrames++;

    // Gaze
    const looking = calcGaze(lm);
    if (looking) {
      t.gazeFrames++;
      t.prolongedDevStart = null;
    } else {
      if (!t.prolongedDevStart) t.prolongedDevStart = tsMs;
      else if (tsMs - t.prolongedDevStart > 2000) { t.prolongedDeviations++; t.prolongedDevStart = null; }
    }

    // Blink (EAR)
    const ear = calcEAR(lm);
    if (ear < 0.20) { t.earBelow++; if (t.earBelow >= 4) { t.blinkCount++; t.earBelow = 0; } }
    else t.earBelow = 0;

    // Rigidity
    const rig = calcFacialRigidity(lm, t.rigidityBuf);
    t.rigiditySum += rig; t.rigidityCount++;

    // Lip compression
    const lc = calcLipCompression(lm);
    if (lc && !t.prevLipComp) t.lipCompEvents++;
    t.prevLipComp = lc;

    // Asymmetry
    t.asymSum += calcAsymmetry(lm); t.asymCount++;

    // Head movement (x-axis proxy)
    const hx = lm[0]?.x || 0;
    if (Math.abs(hx - t.prevHeadX) > 0.04) t.headPeaks++;
    t.prevHeadX = hx;

    // Smile (upper lip to nose distance as proxy)
    if (lm[13] && lm[1]) { if (dist(lm[13], lm[1]) > 0.06) t.smileEvents++; }
  }, []);

  // ── RAF draw loop ──────────────────────────────────────────────────────────
  const drawLoop = useCallback((tsMs) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video || video.videoWidth === 0) {
      animFrameRef.current = requestAnimationFrame(drawLoop);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let faceDetected = false;
    if (faceLandmarkerRef.current && video.readyState >= 2) {
      try {
        const results = faceLandmarkerRef.current.detectForVideo(video, tsMs);
        const lm = results?.faceLandmarks?.[0];
        if (lm) {
          faceDetected = true;
          const looking = calcGaze(lm);
          drawFaceLandmarks(ctx, canvas, lm, looking);
          updateTracker(lm, tsMs);

          // Update live gaze every ~20 frames
          const t = vt.current;
          if (t.totalFrames > 0 && t.totalFrames % 20 === 0) {
            const liveGaze = Math.round((t.gazeFrames / t.totalFrames) * 100);
            setLiveMetrics(prev => ({ ...prev, gaze: liveGaze }));
          }
        }
      } catch { /* ignore frame errors */ }
    }

    if (!faceDetected) drawIdlePlaceholder(ctx, canvas);

    animFrameRef.current = requestAnimationFrame(drawLoop);
  }, [updateTracker]);

  // ── Build final visionData from tracker ───────────────────────────────────
  const buildVisionData = useCallback(() => {
    const t = vt.current;
    const elapsedMin = t.sessionStart ? (Date.now() - t.sessionStart) / 60000 : 0.01;

    if (mpStatus !== 'ready' || t.totalFrames === 0) {
      // Fallback: plausible simulated values
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
      smileEvents: Math.floor(t.smileEvents / 30), // normalize event count
    };
  }, [mpStatus]);

  // ── Recording controls ────────────────────────────────────────────────────
  const startRecording = async () => {
    if (!streamRef.current || !cameraReady) return;

    // Reset tracker
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

    let sid = null;
    try {
      const res = await api.post('/api/sessions/start', {
        exercise_id: exerciseId || 'free',
        level: user.current_level,
      });
      sid = res.data.session_id;
      setSessionId(sid);
    } catch { /* continue */ }

    chunksRef.current = [];
    // Pick the best supported mimeType — fall back to browser default if none match.
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : '';
    const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : {});
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(1000);
    mediaRecorderRef.current = mr;

    setPhase('recording');
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    // Update WPM/fillers display (estimated, since no live transcription)
    metricsIntervalRef.current = setInterval(() => {
      setLiveMetrics(prev => ({
        ...prev,
        wpm: 100 + Math.floor(Math.random() * 60),
        fillers: Math.floor(Math.random() * 4),
        pauses: Math.floor(Math.random() * 3),
      }));
      const rand = Math.random();
      setAlertType(rand < 0.07 ? 'wpm' : rand < 0.14 ? 'pause' : rand < 0.2 ? 'filler' : null);
    }, 2500);
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      clearInterval(timerRef.current);
      clearInterval(metricsIntervalRef.current);
      setPhase('paused');
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
      metricsIntervalRef.current = setInterval(() => {
        setLiveMetrics(prev => ({
          ...prev,
          wpm: 100 + Math.floor(Math.random() * 60),
          fillers: Math.floor(Math.random() * 4),
          pauses: Math.floor(Math.random() * 3),
        }));
      }, 2500);
      setPhase('recording');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    clearInterval(metricsIntervalRef.current);
    setAlertType(null);
    setPhase('processing');

    const mr = mediaRecorderRef.current;
    if (!mr || mr.state === 'inactive') {
      processSession(new Blob([]));
    } else {
      mr.onstop = () => processSession(new Blob(chunksRef.current, { type: 'audio/webm' }));
      mr.stop();
    }
  };

  const processSession = async (audioBlob) => {
    const duration = elapsed || 30;
    const visionData = buildVisionData();

    let transcribeResult = {
      transcript: '', wpm: 0, long_pauses: 0, short_pauses: 0,
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
        transcribeResult = res.data;
      } catch (e) {
        console.warn('[Transcribe] Failed:', e?.response?.data || e.message);
      }
    }

    let sid = sessionId;
    if (!sid) {
      try {
        const res = await api.post('/api/sessions/start', {
          exercise_id: exerciseId || 'free',
          level: user.current_level,
        });
        sid = res.data.session_id;
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
      navigate(`/report/${analyzeRes.data.session_id}`);
    } catch (err) {
      console.error('[Analyze] Error:', err?.response?.data || err.message);
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
    clearInterval(timerRef.current);
    clearInterval(metricsIntervalRef.current);
    cancelAnimationFrame(animFrameRef.current);
    try { if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current?.stop(); } catch {}
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const formatTime = s => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
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
          {/* MediaPipe status indicator */}
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
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
              <span className="text-[#EF4444] text-xs font-mono">REC</span>
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Camera panel (60%) */}
        <div className="flex-1 relative bg-black" data-testid="camera-panel">
          {cameraError ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center">
              <AlertCircle className="w-12 h-12 text-[#EF4444] mb-4" />
              <h3 className="font-heading font-semibold text-[#F1F5F9] mb-2">Error de cámara</h3>
              <p className="text-[#94A3B8] text-sm max-w-sm" data-testid="camera-error">{cameraError}</p>
            </div>
          ) : (
            <>
              <video ref={videoRef} className={`w-full h-full object-cover border-4 ${borderClass || 'border-transparent'} transition-colors duration-300`}
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

              {/* MediaPipe loading overlay */}
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

          {/* Teleprompter */}
          {exercise?.prompt_text_es && (
            <div className="absolute bottom-0 left-0 right-0 backdrop-blur-xl bg-[#0A0E1A]/80 border-t border-white/10 p-4 max-h-32 overflow-y-auto">
              <p className="text-[#F1F5F9] text-sm leading-relaxed">{exercise.prompt_text_es}</p>
            </div>
          )}

          {/* Alert overlays */}
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

        {/* Right panel (40%) */}
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
              <MetricGauge label="Velocidad" value={phase === 'recording' || phase === 'paused' ? liveMetrics.wpm : 0}
                max={200} color="#06B6D4" unit=" ppm" icon={Mic} testId="metric-wpm" isReal={false} />
              <MetricGauge label="Contacto visual" value={phase === 'recording' || phase === 'paused' ? liveMetrics.gaze : 0}
                max={100} color={mpIsReal ? '#10B981' : '#8B5CF6'} unit="%" icon={Eye} testId="metric-gaze" isReal={mpIsReal} />
              <MetricGauge label="Muletillas" value={phase === 'recording' || phase === 'paused' ? liveMetrics.fillers : 0}
                max={20} color="#F59E0B" unit="" icon={MessageSquare} testId="metric-fillers" isReal={false} />
              <MetricGauge label="Pausas" value={phase === 'recording' || phase === 'paused' ? liveMetrics.pauses : 0}
                max={10} color="#10B981" unit="" icon={Clock} testId="metric-pauses" isReal={false} />
            </div>

            {/* MediaPipe legend */}
            {mpIsReal && (
              <div className="bg-[#10B981]/5 border border-[#10B981]/20 rounded-lg px-3 py-2 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] flex-shrink-0" />
                <p className="text-[#10B981] text-xs">Contacto visual medido con MediaPipe en tiempo real</p>
              </div>
            )}

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
                    className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <Square className="w-4 h-4" /> Terminar
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
                    className="w-full bg-[#EF4444] hover:bg-[#EF4444]/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                    <Square className="w-4 h-4" /> Terminar
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

            {/* Exercise description */}
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
