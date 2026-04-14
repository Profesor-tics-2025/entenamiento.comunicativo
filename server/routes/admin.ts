import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin, AuthRequest } from '../middleware/auth.js';

const router = Router();

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [[uRow]] = await pool.query('SELECT COUNT(*) as cnt FROM users') as any;
    const [[sRow]] = await pool.query('SELECT COUNT(*) as cnt FROM sessions') as any;
    const [[eRow]] = await pool.query('SELECT COUNT(*) as cnt FROM exercises') as any;
    res.json({ users: uRow.cnt, sessions: sRow.cnt, exercises: eRow.cnt });
  } catch (err) {
    console.error('[admin/stats]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [users] = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.current_level, u.total_xp, u.job_profile, u.created_at,
              COUNT(s.id) as sessions_count, MAX(s.started_at) as last_session_at
       FROM users u
       LEFT JOIN sessions s ON s.user_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    ) as any;
    res.json(users);
  } catch (err) {
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.get('/users/:userId/sessions', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT s.id, s.exercise_id, s.level, s.passed, s.xp_earned,
              s.duration_seconds, s.started_at, s.score,
              e.title_es as exercise_title
       FROM sessions s
       LEFT JOIN exercises e ON e.id = s.exercise_id
       WHERE s.user_id = ?
       ORDER BY s.started_at DESC
       LIMIT 100`,
      [req.params.userId]
    ) as any;
    res.json(rows);
  } catch (err) {
    console.error('[admin/user-sessions]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

// ── Exercises ─────────────────────────────────────────────────────────────────
router.get('/exercises', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM exercises ORDER BY level_required, title_es') as any;
    res.json(rows);
  } catch (err) {
    console.error('[admin/exercises]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.post('/exercises', requireAdmin, async (req: AuthRequest, res) => {
  const { title_es, description_es, category, difficulty, level_required, duration_target_seconds, prompt_text_es } = req.body;
  if (!title_es?.trim() || !description_es?.trim() || !category || !difficulty) {
    res.status(400).json({ error: 'Faltan campos obligatorios' });
    return;
  }
  try {
    const [result] = await pool.query(
      `INSERT INTO exercises (title_es, description_es, category, difficulty, level_required, duration_target_seconds, prompt_text_es, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [title_es.trim(), description_es.trim(), category, difficulty, level_required || 1, duration_target_seconds || 180, prompt_text_es || null]
    ) as any;
    const [[row]] = await pool.query('SELECT * FROM exercises WHERE id = ?', [result.insertId]) as any;
    res.status(201).json(row);
  } catch (err) {
    console.error('[admin/create-exercise]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.put('/exercises/:id', requireAdmin, async (req: AuthRequest, res) => {
  const { title_es, description_es, category, difficulty, level_required, duration_target_seconds, prompt_text_es, active } = req.body;
  try {
    await pool.query(
      `UPDATE exercises SET title_es=?, description_es=?, category=?, difficulty=?,
       level_required=?, duration_target_seconds=?, prompt_text_es=?, active=? WHERE id=?`,
      [title_es, description_es, category, difficulty, level_required, duration_target_seconds, prompt_text_es || null, active ?? 1, req.params.id]
    );
    const [[row]] = await pool.query('SELECT * FROM exercises WHERE id = ?', [req.params.id]) as any;
    if (!row) { res.status(404).json({ error: 'Ejercicio no encontrado' }); return; }
    res.json(row);
  } catch (err) {
    console.error('[admin/update-exercise]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

router.delete('/exercises/:id', requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [result] = await pool.query('DELETE FROM exercises WHERE id = ?', [req.params.id]) as any;
    if (result.affectedRows === 0) { res.status(404).json({ error: 'Ejercicio no encontrado' }); return; }
    res.json({ ok: true });
  } catch (err) {
    console.error('[admin/delete-exercise]', err);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
