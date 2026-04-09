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
- [x] Auth: registro + login con JWT + bcrypt
- [x] 40 ejercicios en 7 categorías sembrados en MongoDB
- [x] Dashboard con nivel, XP, sesiones recientes
- [x] Sala de entrenamiento con MediaPipe WASM real via CDN
- [x] AudioAnalyzer: AnalyserNode sin feedback de audio
- [x] Transcripción con Whisper (Emergent key)
- [x] Informe 8 bloques generado por Claude Sonnet
- [x] 10 niveles progresivos + sistema XP
- [x] Explorador de ejercicios con filtros
- [x] Página de progreso con 5 gráficos Recharts
- [x] Perfil de usuario
- [x] Memoria de usuario (muletillas, contacto visual, latencia)
- [x] **CORS**: configurable via `CORS_ORIGINS` env var (actualmente `*` en demo)
- [x] **Rate limiting**: `slowapi` — 10/min en `/api/auth/login`, 5/min en `/api/auth/register`
- [x] **`_real_ip`**: lee `X-Forwarded-For` para funcionar correctamente detrás de Apache/nginx
- [x] **Bug fix**: interceptor 401 correcto (no redirige durante login fallido)

### Frontend de producción Vite/React/TypeScript (/app/client/)
- [x] 7 páginas TypeScript con strict mode
- [x] AudioAnalyzer integrado en Train.tsx (sin feedback)
- [x] PWA configurada (manifest + service worker)
- [x] Build Vite exitoso (6.75s, sin errores TS)
- [x] **CORS**: restringido a `FRONTEND_URL` (sin fallback `*`)
- [x] **Rate limiting**: express-rate-limit — 10/15min en login + register, 200/15min en API general
- [x] `skipSuccessfulRequests: true` (no penaliza logins exitosos)
- [x] Mensaje de error en español: "Demasiados intentos de acceso..."

### Archivos de producción Node.js/MariaDB
- [x] database/schema.sql (9 tablas con InnoDB, utf8mb4)
- [x] database/seed.sql (40 ejercicios + 16 muletillas)
- [x] server/ (backend completo compilable con `tsc`)
- [x] server/.env.example (todas las variables necesarias)
- [x] ecosystem.config.cjs (PM2)
- [x] **deploy/DEPLOYMENT_GUIDE.md** (guía completa paso a paso)
- [x] deploy/apache-vhost.conf

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
