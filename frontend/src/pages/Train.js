import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../lib/api';
import { Radio, Square, Play, Pause, RefreshCw, AlertCircle, Mic, Eye, MessageSquare, Clock } from 'lucide-react';

// Simulated vision metrics for demo
function generateVisionMetrics(durationSeconds) {
  return {
    gazePercentage: 55 + Math.random() * 20,
    prolongedDeviations: Math.floor(Math.random() * 4),
    blinkRate: 14 + Math.random() * 8,
    facialRigidityScore: 0.1 + Math.random() * 0.25,
    mandibularTensionScore: 0.1 + Math.random() * 0.15,
    lipCompressionEvents: Math.floor(Math.random() * 4),
    headMovementPeaks: Math.floor(Math.random() * 5),
    asymmetryScore: 0.02 + Math.random() * 0.05,
    avgResponseLatencyMs: 800 + Math.random() * 700,
    smileEvents: Math.floor(Math.random() * 6),
  };
}

function MetricGauge({ label, value, max, color, unit, icon: Icon, testId }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = 28, cx = 36, cy = 36;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-[#111827] border border-white/5 rounded-xl p-4 flex flex-col items-center" data-testid={testId}>
      <div className="relative w-[72px] h-[72px] mb-2">
        <svg width="72" height="72">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#1F2937" strokeWidth="5" />
          <circle
            cx={cx} cy={cy} r={r} fill="none"
            stroke={color} strokeWidth="5"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            className="gauge-ring"
          />
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

  const [exercise, setExercise] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [phase, setPhase] = useState('idle'); // idle | recording | paused | processing | error
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [alertType, setAlertType] = useState(null); // wpm | pause | filler | null

  // Live metric simulation state
  const [liveMetrics, setLiveMetrics] = useState({ wpm: 0, gaze: 0, fillers: 0, pauses: 0 });
  const metricsIntervalRef = useRef(null);

  // Load exercise
  useEffect(() => {
    if (exerciseId) {
      api.get(`/api/exercises/${exerciseId}`)
        .then(r => setExercise(r.data))
        .catch(() => {});
    }
  }, [exerciseId]);

  // Initialize camera
  useEffect(() => {
    initCamera();
    return () => cleanup();
  }, []);

  const initCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
        setCameraError('Se requiere HTTPS para acceder a la cámara. Por favor, accede a través de una conexión segura.');
      } else {
        setCameraError('Tu navegador no soporta acceso a la cámara.');
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraReady(true);
        startCanvasAnimation(stream);
      }
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        setCameraError('Permiso de cámara denegado. Por favor, permite el acceso a la cámara en la configuración de tu navegador.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No se encontró ninguna cámara. Comprueba que tienes una cámara conectada.');
      } else {
        setCameraError(`Error al acceder a la cámara: ${err.message}`);
      }
    }
  };

  const startCanvasAnimation = (stream) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const drawFrame = () => {
      if (!canvas || !video) return;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Simulated face detection dots (MediaPipe-like visualization)
      const cx = canvas.width / 2;
      const cy = canvas.height * 0.45;
      const faceR = Math.min(canvas.width, canvas.height) * 0.18;

      // Face oval
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cx, cy, faceR * 0.75, faceR, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Key landmarks
      const pts = [
        [cx, cy - faceR * 0.7], // top
        [cx - faceR * 0.5, cy - faceR * 0.25], // left eye
        [cx + faceR * 0.5, cy - faceR * 0.25], // right eye
        [cx, cy], // nose
        [cx - faceR * 0.3, cy + faceR * 0.45], // left mouth
        [cx + faceR * 0.3, cy + faceR * 0.45], // right mouth
        [cx, cy + faceR * 0.8], // chin
      ];

      pts.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.8)';
        ctx.fill();
      });

      animFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();
  };

  const startRecording = async () => {
    if (!streamRef.current || !cameraReady) return;

    try {
      const session = await api.post('/api/sessions/start', {
        exercise_id: exerciseId || 'free',
        level: user.current_level,
      });
      setSessionId(session.data.session_id);
    } catch {
      // Continue even if session creation fails
    }

    chunksRef.current = [];
    const mr = new MediaRecorder(streamRef.current, { mimeType: 'audio/webm' });
    mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    mr.start(1000);
    mediaRecorderRef.current = mr;

    setPhase('recording');
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    // Live metrics simulation
    metricsIntervalRef.current = setInterval(() => {
      setLiveMetrics({
        wpm: 100 + Math.floor(Math.random() * 60),
        gaze: 50 + Math.floor(Math.random() * 30),
        fillers: Math.floor(Math.random() * 5),
        pauses: Math.floor(Math.random() * 3),
      });
      // Random peripheral alerts
      const rand = Math.random();
      if (rand < 0.1) setAlertType('wpm');
      else if (rand < 0.2) setAlertType('pause');
      else if (rand < 0.3) setAlertType('filler');
      else setAlertType(null);
    }, 2000);
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
        setLiveMetrics({
          wpm: 100 + Math.floor(Math.random() * 60),
          gaze: 50 + Math.floor(Math.random() * 30),
          fillers: Math.floor(Math.random() * 5),
          pauses: Math.floor(Math.random() * 3),
        });
      }, 2000);
      setPhase('recording');
    }
  };

  const stopRecording = () => {
    clearInterval(timerRef.current);
    clearInterval(metricsIntervalRef.current);
    setAlertType(null);
    setPhase('processing');

    const mr = mediaRecorderRef.current;
    if (!mr) { processSession(new Blob([])); return; }

    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await processSession(blob);
    };
    if (mr.state !== 'inactive') mr.stop();
    else processSession(new Blob([]));
  };

  const processSession = async (audioBlob) => {
    const duration = elapsed || 30;
    const visionData = generateVisionMetrics(duration);

    try {
      // Transcribe audio
      let transcribeResult = { transcript: '', wpm: 0, long_pauses: 0, short_pauses: 0, filler_count: 0, filler_per_min: 0, top_fillers: [], lexical_richness: 0, has_opening: false, has_closing: false };

      if (audioBlob.size > 100) {
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        formData.append('duration_seconds', String(duration));
        try {
          const transcribeRes = await api.post('/api/sessions/transcribe', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 120000,
          });
          transcribeResult = transcribeRes.data;
        } catch (e) {
          console.warn('Transcription failed, continuing with empty transcript:', e);
        }
      }

      // Analyze session
      const currentSessionId = sessionId;
      let sid = currentSessionId;
      if (!sid) {
        try {
          const startRes = await api.post('/api/sessions/start', {
            exercise_id: exerciseId || 'free',
            level: user.current_level,
          });
          sid = startRes.data.session_id;
        } catch {
          navigate('/dashboard');
          return;
        }
      }

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
      console.error('Processing error:', err);
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
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const formatTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const borderClass = alertType === 'wpm' ? 'alert-wpm' : alertType === 'pause' ? 'alert-pause' : alertType === 'filler' ? 'alert-filler' : '';

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
        {phase === 'recording' && (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#EF4444] animate-pulse" />
            <span className="text-[#EF4444] text-xs font-mono">REC</span>
          </div>
        )}
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
              <video
                ref={videoRef}
                className={`w-full h-full object-cover border-4 ${borderClass || 'border-transparent'} transition-colors duration-300`}
                muted
                playsInline
                autoPlay
                data-testid="camera-feed"
              />
              <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
                data-testid="mediapipe-canvas"
              />
              {phase === 'recording' && <div className="scan-line" />}
              {!cameraReady && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0A0E1A]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-[#06B6D4] border-t-transparent rounded-full animate-spin" />
                    <p className="text-[#94A3B8] text-sm">Iniciando cámara...</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Teleprompter overlay */}
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
                <p className="text-[#94A3B8] text-xs mt-1">
                  Objetivo: {formatTime(exercise.duration_target_seconds)}
                </p>
              )}
            </div>

            {/* Live metrics */}
            <div className="grid grid-cols-2 gap-3" data-testid="live-metrics">
              <MetricGauge label="Velocidad" value={phase === 'recording' ? liveMetrics.wpm : 0} max={200}
                color="#06B6D4" unit=" ppm" icon={Mic} testId="metric-wpm" />
              <MetricGauge label="Contacto visual" value={phase === 'recording' ? liveMetrics.gaze : 0} max={100}
                color="#8B5CF6" unit="%" icon={Eye} testId="metric-gaze" />
              <MetricGauge label="Muletillas" value={phase === 'recording' ? liveMetrics.fillers : 0} max={20}
                color="#F59E0B" unit="" icon={MessageSquare} testId="metric-fillers" />
              <MetricGauge label="Pausas" value={phase === 'recording' ? liveMetrics.pauses : 0} max={10}
                color="#10B981" unit="" icon={Clock} testId="metric-pauses" />
            </div>

            {/* Controls */}
            <div className="space-y-2" data-testid="control-buttons">
              {phase === 'idle' && (
                <button
                  onClick={startRecording}
                  disabled={!cameraReady}
                  data-testid="start-btn"
                  className="w-full bg-[#06B6D4] hover:bg-[#06B6D4]/90 text-[#0A0E1A] font-semibold py-3.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
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
                  <p className="text-[#94A3B8] text-xs mt-1">Transcribiendo y generando informe con IA</p>
                </div>
              )}
              {phase === 'error' && (
                <div className="space-y-2">
                  <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-xl p-4 text-center" data-testid="error-state">
                    <AlertCircle className="w-6 h-6 text-[#EF4444] mx-auto mb-2" />
                    <p className="text-[#EF4444] text-sm">Error al procesar la sesión</p>
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
