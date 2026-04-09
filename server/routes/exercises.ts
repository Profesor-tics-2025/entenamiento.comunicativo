import { Router } from 'express';
import pool from '../db.js';
import { requireAuth, AuthRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', requireAuth, async (req: AuthRequest, res) => {
  const { category, level } = req.query;
  let sql = 'SELECT * FROM exercise_prompts WHERE 1=1';
  const params: any[] = [];
  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (level) { sql += ' AND level_required = ?'; params.push(parseInt(level as string)); }
  sql += ' ORDER BY level_required, id';
  const [rows] = await pool.query(sql, params) as any;
  res.json(rows);
});

router.get('/:id', requireAuth, async (req, res) => {
  const [rows] = await pool.query('SELECT * FROM exercise_prompts WHERE id = ?', [req.params.id]) as any;
  const ex = (rows as any[])[0];
  if (!ex) { res.status(404).json({ error: 'Ejercicio no encontrado' }); return; }
  res.json(ex);
});

export default router;
