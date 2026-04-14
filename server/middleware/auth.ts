import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import pool from '../db.js';

export interface AuthRequest extends Request {
  userId?: number;
  userEmail?: string;
  userRole?: string;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }
  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub: number; email: string };
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  requireAuth(req, res, async () => {
    try {
      const [rows] = await pool.query('SELECT role FROM users WHERE id = ?', [req.userId]) as any;
      const user = (rows as any[])[0];
      if (!user || user.role !== 'admin') {
        res.status(403).json({ error: 'Acceso restringido a administradores' });
        return;
      }
      req.userRole = 'admin';
      next();
    } catch {
      res.status(500).json({ error: 'Error interno' });
    }
  });
}
