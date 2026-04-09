import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pool from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { transcribeAudio } from '../services/whisper.js';
import { generateReport } from '../services/claude.js';
import { analyzeTranscript } from '../services/nlp.js';
import { evaluateSession } from '../services/metrics.js';

const router = Router();
const upload = multer({ dest: os.tmpdir(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/start', requireAuth, async (req: AuthRequest, res) => {
  // Acepta tanto snake_case (cliente prod) como camelCase (legacy)
  const exercise_id = req.body.exercise_id ?? req.body.exerciseId;
  const level = req.body.level;
  const [result] = await pool.query(
    'INSERT INTO sessions (user_id, level, exercise_id) VALUES (?, ?, ?)',
    [req.userId, level, exercise_id]
  ) as any;
  // Responde en snake_case (consistente con el cliente y la demo)
  res.json({ session_id: (result as any).insertId });
});

router.post('/transcribe', requireAuth, upload.single('audio'), async (req: AuthRequest, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: 'No se recibió archivo de audio' }); return; }

  const durationSeconds = parseFloat(req.body.duration_seconds) || 60;
  const tmpPath = file.path;

  try {
    const transcription = await transcribeAudio(tmpPath);
    const nlp = analyzeTranscript(transcription.text, durationSeconds, transcription.words);
    res.json({
      transcript: transcription.text,
      wpm: nlp.wpm,
      longPauses: nlp.longPauses,
      shortPauses: nlp.shortPauses,
      fillerCount: nlp.fillerCount,
      fillerPerMin: nlp.fillerPerMin,
      topFillers: nlp.topFillers,
      lexicalRichness: nlp.lexicalRichness,
      hasOpening: nlp.hasOpening,
      hasClosing: nlp.hasClosing,
    });
  } finally {
    fs.unlink(tmpPath, () => {});
  }
});

router.post('/analyze', requireAuth, async (req: AuthRequest, res) => {
  // Acepta tanto snake_case como camelCase para compatibilidad
  const sessionId    = req.body.session_id    ?? req.body.sessionId;
  const visionData   = req.body.vision_data   ?? req.body.visionData;
  const audioMetrics = req.body.audio_metrics ?? req.body.audioMetrics;
  const transcript       = req.body.transcript;
  const durationSeconds  = req.body.duration_seconds ?? req.body.durationSeconds;

  const [sessionRows] = await pool.query('SELECT * FROM sessions WHERE id = ? AND user_id = ?', [sessionId, req.userId]) as any;
  const session = (sessionRows as any[])[0];
  if (!session) { res.status(404).json({ error: 'Sesión no encontrada' }); return; }

  const [exRows] = await pool.query('SELECT title_es FROM exercise_prompts WHERE id = ?', [session.exercise_id]) as any;
  const exercise = (exRows as any[])[0];

  const [pastRows] = await pool.query(
    `SELECT sm.wpm, sm.filler_per_min, sm.gaze_percentage FROM session_metrics sm
     JOIN sessions s ON s.id = sm.session_id
     WHERE s.user_id = ? AND s.ended_at IS NOT NULL ORDER BY s.started_at DESC LIMIT 5`,
    [req.userId]
  ) as any;

  const [memoryRows] = await pool.query('SELECT memory_type, description FROM user_memory WHERE user_id = ?', [req.userId]) as any;

  const nlp = analyzeTranscript(transcript || '', durationSeconds || 60);

  const report = await generateReport({
    sessionContext: { level: session.level, exerciseTitle: exercise?.title_es || 'Ejercicio', durationSeconds: durationSeconds || 60 },
    vision: visionData,
    audio: { ...audioMetrics, ...nlp },
    userMemory: memoryRows as any[],
    previousSessions: pastRows as any[],
  });

  const structureScore = (nlp.hasOpening ? 50 : 0) + (nlp.hasClosing ? 50 : 0);
  const metrics = {
    wpm: nlp.wpm,
    long_pauses: audioMetrics.longPauses || 0,
    short_pauses: audioMetrics.shortPauses || 0,
    filler_count: nlp.fillerCount,
    filler_per_min: nlp.fillerPerMin,
    gaze_percentage: visionData.gazePercentage || 0,
    facial_rigidity_score: visionData.facialRigidityScore || 0,
    head_movement_score: visionData.headMovementPeaks || 0,
    latency_ms: visionData.avgResponseLatencyMs || 0,
    lexical_richness: nlp.lexicalRichness,
    structure_score: structureScore,
    blink_rate: visionData.blinkRate || 0,
    asymmetry_score: visionData.asymmetryScore || 0,
    mandibular_tension_score: visionData.mandibularTensionScore || 0,
  };

  const evalResult = evaluateSession(
    { ...metrics, facialRigidityScore: metrics.facial_rigidity_score, latencyMs: metrics.latency_ms, structureScore },
    session.level,
    durationSeconds
  );

  await pool.query(
    `INSERT INTO session_metrics (session_id, wpm, long_pauses, short_pauses, filler_count, filler_per_min,
     gaze_percentage, facial_rigidity_score, head_movement_score, latency_ms, lexical_richness,
     structure_score, blink_rate, asymmetry_score, mandibular_tension_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE wpm=VALUES(wpm)`,
    [sessionId, metrics.wpm, metrics.long_pauses, metrics.short_pauses, metrics.filler_count,
     metrics.filler_per_min, metrics.gaze_percentage, metrics.facial_rigidity_score,
     metrics.head_movement_score, metrics.latency_ms, metrics.lexical_richness,
     metrics.structure_score, metrics.blink_rate, metrics.asymmetry_score, metrics.mandibular_tension_score]
  );

  await pool.query(
    'INSERT INTO reports (session_id, report_json) VALUES (?, ?) ON DUPLICATE KEY UPDATE report_json=VALUES(report_json)',
    [sessionId, JSON.stringify(report)]
  );

  await pool.query(
    'UPDATE sessions SET ended_at=NOW(), duration_seconds=?, passed=?, xp_earned=? WHERE id=?',
    [durationSeconds, evalResult.passed ? 1 : 0, evalResult.xp, sessionId]
  );

  if (evalResult.passed) {
    await pool.query('UPDATE users SET total_xp = total_xp + ? WHERE id = ?', [evalResult.xp, req.userId]);
    const [passedRows] = await pool.query(
      'SELECT COUNT(*) as cnt FROM sessions WHERE user_id=? AND level=? AND passed=1',
      [req.userId, session.level]
    ) as any;
    if ((passedRows as any[])[0].cnt >= 3) {
      await pool.query('UPDATE users SET current_level = LEAST(current_level + 1, 10) WHERE id = ? AND current_level = ?', [req.userId, session.level]);
    }
  }

  res.json({ session_id: sessionId, passed: evalResult.passed, xp_earned: evalResult.xp, report, metrics });
});

router.get('/:sessionId/report', requireAuth, async (req: AuthRequest, res) => {
  const [rows] = await pool.query(
    'SELECT r.report_json FROM reports r JOIN sessions s ON s.id = r.session_id WHERE r.session_id = ? AND s.user_id = ?',
    [req.params.sessionId, req.userId]
  ) as any;
  const row = (rows as any[])[0];
  if (!row) { res.status(404).json({ error: 'Informe no encontrado' }); return; }
  res.json({ session_id: req.params.sessionId, report_json: JSON.parse(row.report_json) });
});

export default router;
