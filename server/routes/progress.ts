import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const [rows] = await pool.query(
    `SELECT s.id as session_id, s.level, s.exercise_id, s.started_at, s.duration_seconds,
            s.passed, s.xp_earned,
            sm.wpm, sm.filler_per_min, sm.gaze_percentage, sm.long_pauses, sm.structure_score
     FROM sessions s
     LEFT JOIN session_metrics sm ON sm.session_id = s.id
     WHERE s.user_id = ? AND s.ended_at IS NOT NULL
     ORDER BY s.started_at DESC
     LIMIT 30`,
    [req.userId]
  ) as any;

  const result = (rows as any[]).map(r => ({
    session_id: r.session_id,
    level: r.level,
    exercise_id: r.exercise_id,
    started_at: r.started_at,
    duration_seconds: r.duration_seconds,
    passed: r.passed === 1,
    xp_earned: r.xp_earned,
    metrics: {
      wpm: r.wpm || 0,
      filler_per_min: parseFloat(r.filler_per_min) || 0,
      gaze_percentage: parseFloat(r.gaze_percentage) || 0,
      long_pauses: r.long_pauses || 0,
      structure_score: r.structure_score || 0,
    },
  }));

  res.json(result);
});

export default router;
