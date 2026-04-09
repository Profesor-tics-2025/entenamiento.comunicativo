# PRD — Entrenamiento Comunicativo

**Dominio**: comunicacion.cibermedida.es  
**Última actualización**: 2026-02

---

## Problema / Objetivo

Plataforma de entrenamiento en comunicación profesional con análisis por IA. Permite a profesionales mejorar sus habilidades de oratoria mediante ejercicios progresivos, análisis de voz (Whisper) y evaluaciones visuales (MediaPipe), con informes generados por Claude.

---

## Arquitectura

### Demo (este entorno)
- **Backend**: FastAPI + Python + MongoDB (`entrenamiento_comunicativo`)
- **Frontend**: React (CRA) en `/app/frontend/`
- **IA**: Emergent LLM Key → OpenAI Whisper (transcripción) + Anthropic Claude (informes)

### Producción (VPS - comunicacion.cibermedida.es)
- **Backend**: Node.js 20 + Express 4 + TypeScript → `/app/server/`
- **Frontend**: React 18 + Vite 5 + TypeScript → `/app/client/`
- **Base de datos**: MariaDB con raw SQL (mysql2)
- **PM2**: ecosystem.config.cjs
- **Apache**: deploy/apache-vhost.conf + Let's Encrypt
- **Guía de despliegue**: `/app/deploy/DEPLOYMENT_GUIDE.md`

---

## Implementado ✅

### Demo funcional (FastAPI + MongoDB)
- [x] Auth + rate limiting + CORS configurable por env
- [x] `_real_ip()` — lee X-Forwarded-For (listo para Apache)
- [x] seedAdmin idempotente en startup
- [x] `role` en todas las respuestas de auth

### Frontend de producción (/app/client/)
- [x] 7 páginas TypeScript + AudioAnalyzer + PWA
- [x] Build Vite exitoso, TypeScript sin errores

### Archivos de producción Node.js/MariaDB — AUDITADOS Y CORREGIDOS
- [x] `server/package.json` + `server/tsconfig.json` — CREADOS (faltaban)
- [x] `server/server.ts` — `app.set('trust proxy', 1)` añadido (rate limiting real)
- [x] `server/routes/sessions.ts` — camelCase/snake_case corregido (session_id, xp_earned)
- [x] `server/routes/auth.ts` — `role` en /auth/me, login y register
- [x] `server/services/seedAdmin.ts` — idempotente, sin endpoint público
- [x] `database/schema.sql` — columna `role` en users
- [x] `database/seed.sql` — INSERT IGNORE (idempotente)
- [x] `ecosystem.config.cjs` — dist/server.js + env_file (corregido)
- [x] `deploy/apache-vhost.conf` — ruta correcta + proxy trailing slash + mod_remoteip + HSTS + Permissions-Policy
- [x] `deploy/DEPLOYMENT_GUIDE.md` — guía completa auditada (15 secciones, 10 puntos de fallo documentados)

---

## Backlog priorizado

### P0 — Despliegue real en VPS
- [ ] Seguir `deploy/DEPLOYMENT_GUIDE.md` en el servidor
- [ ] Configurar MariaDB + crear usuario + ejecutar schema.sql + seed.sql
- [ ] Configurar `.env` de producción con JWT_SECRET + EMERGENT_LLM_KEY
- [ ] Build Node.js + Build Vite + PM2 + Apache + Certbot SSL
- [ ] Generar iconos PWA (`icon-192.png`, `icon-512.png`) en `/app/client/public/`

### P1 — Mejoras post-despliegue
- [ ] Panel de administración para gestión de ejercicios
- [ ] Teleprompter con auto-scroll en sala de entrenamiento

### P2 — Backlog largo plazo
- [ ] Exportar informes como PDF
- [ ] Historial completo de sesiones con filtros por fecha
- [ ] Modo práctica sin grabación
- [ ] Notificaciones de progreso por email
- [ ] Ranking opcional entre usuarios

---

## Credenciales de prueba (demo)
Ver `/app/memory/test_credentials.md`
- test@cibermedida.es / Test2024! (usuario normal, nivel 1)
- admin@cibermedida.es / Admin2024! (rol admin, creado por seedAdmin)
