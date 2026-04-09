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

---

## Implementado (MVP + Iteración 2) ✅

### Demo funcional
- [x] Registro e inicio de sesión con JWT + bcrypt
- [x] 40 ejercicios en 7 categorías sembrados en MongoDB
- [x] Dashboard con nivel, XP, sesiones recientes, ejercicio recomendado
- [x] Sala de entrenamiento con cámara, canvas overlay, grabación audio, métricas en vivo
- [x] MediaPipe WASM real vía CDN (FaceLandmarker, gaze, blink, rigidez facial)
- [x] AudioAnalyzer: AnalyserNode conectado sin enrutar al destino (sin feedback de audio)
- [x] Transcripción con Whisper (Emergent key)
- [x] Informe 8 bloques con Claude claude-4-sonnet-20250514
- [x] 10 niveles progresivos con evaluación de umbrales
- [x] Sistema XP con recompensas por nivel
- [x] Explorador de ejercicios con filtros (categoría + dificultad)
- [x] Página de progreso con 5 gráficos Recharts
- [x] Perfil de usuario (nombre, email, perfil profesional)
- [x] Memoria de usuario (muletillas, contacto visual, latencia)
- [x] Navegación completa con Navbar
- [x] **BUG FIX**: Interceptor 401 de api.js/api.ts corregido — solo redirige si hay token (sesión expirada), no durante login fallido

### Archivos de producción Node.js/MariaDB
- [x] database/schema.sql (9 tablas con InnoDB, utf8mb4)
- [x] database/seed.sql (40 ejercicios + 16 muletillas)
- [x] server/db.ts (pool MySQL2, socket Unix o TCP)
- [x] server/server.ts (Express con helmet, CORS, rate-limit)
- [x] server/routes/ (auth, sessions, exercises, progress, users)
- [x] server/services/ (whisper, claude, nlp, metrics)
- [x] server/middleware/auth.ts (JWT)
- [x] learning/ (5 módulos: nightlyCron, updateThresholds, detectNewFillers, generateExercises, updateUserMemory)
- [x] deploy/apache-vhost.conf (HTTPS + proxy)
- [x] ecosystem.config.cjs (PM2 con cron)
- [x] .env.example
- [x] README.md (guía completa de despliegue)

### Frontend de producción Vite/React/TypeScript (/app/client/)
- [x] package.json, tsconfig.json, vite.config.ts configurados
- [x] PWA con vite-plugin-pwa: manifest.webmanifest + service worker (22 entradas precacheadas)
- [x] App.tsx con lazy loading y code splitting
- [x] Navbar.tsx, AuthContext.tsx, api.ts (con interceptor 401 corregido)
- [x] audioAnalyzer.ts: AnalyserNode sin enrutar al destino (sin feedback)
- [x] visionMetrics.ts: VisionTracker class + funciones matemáticas (EAR, gaze, rigidez)
- [x] types/index.ts: interfaces TypeScript estrictas
- [x] **7 páginas TypeScript completas**:
  - Train.tsx — MediaPipe real + AudioAnalyzer integrado + grabación
  - Dashboard.tsx — stats, sesiones recientes, ejercicio recomendado
  - Report.tsx — informe 8 bloques + Recharts
  - Progress.tsx — 5 gráficos + línea de niveles
  - Exercises.tsx — grid con filtros de categoría y dificultad
  - Landing.tsx — hero + modal auth (register/login)
  - Profile.tsx — formulario de perfil profesional
- [x] Build Vite: ✅ compila sin errores (6.75s, TypeScript strict mode)
- [x] TypeScript sin errores (`tsc --noEmit` limpio)

---

## Usuarios objetivo

- Profesionales que buscan mejorar comunicación ejecutiva
- Personas que preparan entrevistas laborales
- Equipos de ventas y presentaciones

---

## Backlog priorizado

### P0 - Crítico para producción
- [ ] Configurar MariaDB en VPS y ejecutar schema.sql + seed.sql
- [ ] Configurar certificado SSL con certbot
- [ ] Inicializar PM2 con ecosystem.config.cjs
- [ ] Generar iconos PWA (icon-192.png, icon-512.png) para /app/client/public/

### P1 - Alta prioridad
- [ ] Limitar CORS a dominio de producción (actualmente *)
- [ ] Rate limiting en auth endpoints (brute force protection)
- [ ] Panel de administración para gestión de ejercicios
- [ ] Teleprompter con auto-scroll en tiempo real

### P2 - Media prioridad
- [ ] Exportar informes como PDF
- [ ] Notificaciones de progreso por email
- [ ] Modo práctica sin grabación (vista previa de ejercicio)
- [ ] Historial completo de sesiones con filtros por fecha
- [ ] Comparación entre sesiones en la página de informe
- [ ] Ranking opcional entre usuarios

---

## Credenciales de prueba

Ver `/app/memory/test_credentials.md`
- test@cibermedida.es / Test2024!
