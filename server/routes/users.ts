import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireAuth, async (req: AuthRequest, res) => {
  const [rows] = await pool.query(
    'SELECT id, email, name, current_level, total_xp, job_profile, created_at FROM users WHERE id = ?',
    [req.userId]
  ) as any;
  const user = (rows as any[])[0];
  if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
  res.json(user);
});

router.patch('/profile', requireAuth, async (req: AuthRequest, res) => {
  const { name, jobProfile } = req.body;
  const updates: string[] = [];
  const params: any[] = [];
  if (name?.trim()) { updates.push('name = ?'); params.push(name.trim()); }
  if (jobProfile && ['general', 'commercial', 'technical'].includes(jobProfile)) {
    updates.push('job_profile = ?'); params.push(jobProfile);
  }
  if (updates.length === 0) { res.status(400).json({ error: 'Nada que actualizar' }); return; }
  params.push(req.userId);
  await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  const [rows] = await pool.query('SELECT id, email, name, current_level, total_xp, job_profile FROM users WHERE id = ?', [req.userId]) as any;
  res.json((rows as any[])[0]);
});

export default router;
