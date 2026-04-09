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

const app = express();

app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.FRONTEND_URL || '*', credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// Auth stricter limit
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
app.use('/api/auth/', authLimiter);

// Routes
app.use('/api/auth', authRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/exercises', exercisesRouter);
app.use('/api/progress', progressRouter);
app.use('/api/users', usersRouter);

// Health endpoint
app.get('/api/health', async (req, res) => {
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
  console.log(`[server] listening on port ${PORT}`);
});

export default app;
