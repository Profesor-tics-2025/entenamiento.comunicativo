/**
 * seedAdmin.ts — Primer arranque seguro
 *
 * Se ejecuta UNA VEZ en startup (server.ts → seedAdmin()).
 * No expone ningún endpoint. No modifica usuarios existentes.
 *
 * Lógica:
 *  1. Lee ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME del entorno.
 *  2. Si alguna variable falta → log de aviso y retorno inmediato.
 *  3. Si el email ya existe en la BD → log "admin ya existente" y retorno.
 *  4. Si no existe → crea el usuario con role='admin' y contraseña hasheada.
 *  5. Registra el resultado en consola (visible en logs de PM2).
 *
 * Archivo: /app/server/services/seedAdmin.ts
 * Llamado desde: /app/server/server.ts (bloque startup, después de listen())
 */

import bcrypt from 'bcrypt';
import pool from '../db.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function seedAdmin(): Promise<void> {
  const email    = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const name     = process.env.ADMIN_NAME?.trim();

  // ── 1. Validar que las tres variables estén presentes ────────────────────────
  if (!email || !password || !name) {
    const missing = [
      !email    && 'ADMIN_EMAIL',
      !password && 'ADMIN_PASSWORD',
      !name     && 'ADMIN_NAME',
    ].filter(Boolean).join(', ');
    console.log(`[seedAdmin] Variables de entorno ausentes (${missing}). No se crea ningún admin.`);
    return;
  }

  // ── 2. Validar formato de email ──────────────────────────────────────────────
  if (!EMAIL_RE.test(email)) {
    console.warn(`[seedAdmin] ADMIN_EMAIL "${email}" no tiene formato válido. Abortando.`);
    return;
  }

  // ── 3. Comprobar si el admin ya existe ───────────────────────────────────────
  try {
    const [rows] = await pool.query<{ id: number }[]>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email]
    );

    if (rows.length > 0) {
      console.log(`[seedAdmin] Admin ya existente (${email}). Sin cambios.`);
      return;
    }

    // ── 4. Crear admin con contraseña hasheada ─────────────────────────────────
    const hash = await bcrypt.hash(password, 12);

    await pool.query(
      `INSERT INTO users (email, password_hash, name, role, current_level, total_xp, job_profile)
       VALUES (?, ?, ?, 'admin', 1, 0, 'general')`,
      [email, hash, name]
    );

    // ── 5. Log de confirmación ─────────────────────────────────────────────────
    console.log(`[seedAdmin] Admin creado correctamente: ${email} (nombre: "${name}")`);

  } catch (err: unknown) {
    // Error de BD (tabla no lista, fallo de conexión, etc.) → log sin crashear el servidor
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[seedAdmin] Error al comprobar/crear admin: ${message}`);
  }
}
