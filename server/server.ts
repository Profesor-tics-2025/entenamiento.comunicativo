import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import authRouter from './routes/auth.js';
import sessionsRouter from './routes/sessions.js';
import exercisesRouter from './routes/exercises.js';
import progressRouter from './routes/progress.js';
import usersRouter from './routes/users.js';
import pool from './db.js';
import { seedAdmin } from './services/seedAdmin.js';

const app = express();

// ── Trust proxy (Apache/nginx) ─────────────────────────────────────────────────
// OBLIGATORIO: sin esto, express-rate-limit ve 127.0.0.1 para TODOS los clientes
// y o bien no hace nada o bien bloquea a todos a la vez.
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginEmbedderPolicy: false }));

// CORS — restringido al dominio frontend de producción
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Rate limiting ─────────────────────────────────────────────────────────────
// General API: 200 req / 15 min por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' },
});
app.use('/api/', apiLimiter);

// Login/register: 10 intentos / 15 min por IP (brute force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos de acceso. Espera 15 minutos antes de intentarlo de nuevo.' },
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/users', usersRouter);

// ── Health ─────────────────────────────────────────────────────────────────────
app.get('/api/health', async (_req, res) => {
  let dbStatus = 'connected';
  try {
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
  } catch {
    dbStatus = 'error';
  }
  res.json({ status: 'ok', db: dbStatus, uptime: process.uptime() });
});

const PORT = parseInt(process.env.PORT || '3002');
app.listen(PORT, () => {
  console.log(`[server] Puerto ${PORT} | CORS: ${allowedOrigins.join(', ') || 'DISABLED'}`);

  // Primer arranque seguro: crea el admin si no existe.
  // Sin endpoint. Sin efecto si las variables no están definidas o el admin ya existe.
  seedAdmin();
});

export default app;
