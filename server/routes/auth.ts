import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';

const router = Router();

function createToken(userId: number, email: string): string {
  return jwt.sign(
    { sub: userId, email, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || !name?.trim()) {
    res.status(400).json({ error: 'Todos los campos son obligatorios' });
    return;
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email.toLowerCase()]) as any;
  if ((existing as any[]).length > 0) {
    res.status(400).json({ error: 'El email ya está registrado' });
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const [result] = await pool.query(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [email.toLowerCase(), hash, name.trim()]
  ) as any;

  const userId = (result as any).insertId;
  const token = createToken(userId, email.toLowerCase());
  res.json({ token, user: { id: userId, email: email.toLowerCase(), name: name.trim(), current_level: 1, total_xp: 0, job_profile: 'general' } });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email?.toLowerCase()]) as any;
  const user = (rows as any[])[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    res.status(401).json({ error: 'Email o contraseña incorrectos' });
    return;
  }
  const token = createToken(user.id, user.email);
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, current_level: user.current_level, total_xp: user.total_xp, job_profile: user.job_profile } });
});

router.get('/me', async (req, res) => {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) { res.status(401).json({ error: 'No autenticado' }); return; }
  try {
    const payload = jwt.verify(auth.slice(7), process.env.JWT_SECRET!) as any;
    const [rows] = await pool.query('SELECT id, email, name, current_level, total_xp, job_profile FROM users WHERE id = ?', [payload.sub]) as any;
    const user = (rows as any[])[0];
    if (!user) { res.status(404).json({ error: 'Usuario no encontrado' }); return; }
    res.json(user);
  } catch { res.status(401).json({ error: 'Token inválido' }); }
});

export default router;
