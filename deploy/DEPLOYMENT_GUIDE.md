# Guía de despliegue — Entrenamiento Comunicativo
# comunicacion.cibermedida.es
# Stack: Node.js 20 + Express + MariaDB + React (Vite) + PM2 + Apache + SSL
#
# REVISIÓN: 2026-02 — 9 bugs críticos identificados y corregidos
# Sigue este orden EXACTAMENTE. Cada paso tiene verificación.

---

## Índice

1.  [Requisitos previos](#1-requisitos-previos)
2.  [Preparación del servidor](#2-preparación-del-servidor)
3.  [Instalación de Node.js 20](#3-instalación-de-nodejs-20)
4.  [Instalación y configuración de MariaDB](#4-instalación-y-configuración-de-mariadb)
5.  [Creación de base de datos y usuario](#5-creación-de-base-de-datos-y-usuario)
6.  [Clonar el repositorio](#6-clonar-el-repositorio)
7.  [Ejecución de schema.sql y seed.sql](#7-ejecución-de-schemasql-y-seedsql)
8.  [Variables de entorno del backend](#8-variables-de-entorno-del-backend)
9.  [Build del backend Node.js](#9-build-del-backend-nodejs)
10. [Build del frontend Vite](#10-build-del-frontend-vite)
11. [Arranque con PM2](#11-arranque-con-pm2)
12. [Configuración de Apache como reverse proxy](#12-configuración-de-apache-como-reverse-proxy)
13. [Certificado SSL con Certbot](#13-certificado-ssl-con-certbot)
14. [Verificación final paso a paso](#14-verificación-final-paso-a-paso)
15. [Puntos de fallo reales y soluciones](#15-puntos-de-fallo-reales-y-soluciones)
16. [Comandos de mantenimiento](#16-comandos-de-mantenimiento)

---

## 1. Requisitos previos

| Componente    | Versión mínima | Verificar con         |
|---------------|----------------|-----------------------|
| Ubuntu/Debian | 22.04 LTS      | `lsb_release -a`      |
| Node.js       | 20.x LTS       | `node --version`      |
| npm           | 10.x           | `npm --version`       |
| MariaDB       | 10.11+         | `mariadb --version`   |
| PM2           | 5.x            | `pm2 --version`       |
| Apache2       | 2.4+           | `apache2 -v`          |
| Certbot       | latest         | `certbot --version`   |

> **ANTES de empezar**: el DNS de `comunicacion.cibermedida.es` debe apuntar a la IP del servidor.
> Verifica con: `dig +short comunicacion.cibermedida.es`

---

## 2. Preparación del servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential apache2 apache2-utils

# Firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status

# Directorio de la aplicación
sudo mkdir -p /opt/comunicacion/logs
sudo chown -R $USER:$USER /opt/comunicacion
```

---

## 3. Instalación de Node.js 20

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version   # v20.x.x
npm --version    # 10.x.x

# PM2 global
sudo npm install -g pm2
pm2 --version    # 5.x.x
```

---

## 4. Instalación y configuración de MariaDB

```bash
sudo apt install -y mariadb-server mariadb-client
sudo systemctl start mariadb
sudo systemctl enable mariadb
sudo systemctl status mariadb   # debe mostrar: active (running)

# Asistente de seguridad — EJECUTAR SIEMPRE en servidor nuevo
sudo mariadb-secure-installation
# Respuestas recomendadas:
#   Switch to unix_socket authentication? N
#   Change the root password? Y  → contraseña fuerte
#   Remove anonymous users? Y
#   Disallow root login remotely? Y
#   Remove test database? Y
#   Reload privilege tables? Y
```

---

## 5. Creación de base de datos y usuario

```bash
sudo mariadb -u root -p
```

```sql
CREATE DATABASE IF NOT EXISTS entrenamiento_comunicativo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'entrenamiento'@'localhost'
  IDENTIFIED BY 'PON_AQUI_TU_CONTRASENA_SEGURA';

GRANT ALL PRIVILEGES ON entrenamiento_comunicativo.*
  TO 'entrenamiento'@'localhost';

FLUSH PRIVILEGES;

-- Verificar
SHOW GRANTS FOR 'entrenamiento'@'localhost';
EXIT;
```

> **Nota**: nunca uses `root` en el `.env` del backend.

---

## 6. Clonar el repositorio

```bash
cd /opt/comunicacion

# Repositorio público:
git clone https://github.com/TU_USUARIO/TU_REPO.git .

# Repositorio privado:
# git clone https://USUARIO:TOKEN@github.com/TU_USUARIO/TU_REPO.git .

# Verificar estructura esperada:
ls server/ database/ client/ ecosystem.config.cjs deploy/
```

---

## 7. Ejecución de schema.sql y seed.sql

```bash
cd /opt/comunicacion/database

# Crear tablas (idempotente — CREATE TABLE IF NOT EXISTS)
mariadb -u entrenamiento -p entrenamiento_comunicativo < schema.sql

# Insertar datos iniciales (idempotente — INSERT IGNORE)
mariadb -u entrenamiento -p entrenamiento_comunicativo < seed.sql

# Verificación obligatoria
mariadb -u entrenamiento -p entrenamiento_comunicativo \
  -e "SHOW TABLES; SELECT COUNT(*) as ejercicios FROM exercise_prompts; SELECT COUNT(*) as muletillas FROM filler_words;"
```

Resultado esperado:
```
9 tablas | 40 ejercicios | 16 muletillas
```

> **Si ves un error en seed.sql**: los `INSERT IGNORE` son seguros. Si ves `ERROR 1062 Duplicate entry` en los fillers, es benigno.

---

## 8. Variables de entorno del backend

```bash
cd /opt/comunicacion/server
cp .env.example .env
nano .env          # edita con valores reales
chmod 600 .env     # OBLIGATORIO: solo el propietario puede leer
```

Contenido completo del `.env`:

```env
# MariaDB
DB_HOST=localhost
DB_PORT=3306
DB_USER=entrenamiento
DB_PASSWORD=TU_CONTRASENA_REAL_DE_MARIADB
DB_NAME=entrenamiento_comunicativo

# JWT — genera con: openssl rand -base64 64
JWT_SECRET=RESULTADO_DEL_COMANDO_OPENSSL_AQUI

# CORS — dominio exacto, sin barra final, sin espacios
FRONTEND_URL=https://comunicacion.cibermedida.es

# Clave IA (Whisper + Claude)
EMERGENT_LLM_KEY=sk-emergent-XXXXXXXXXXXXXXXXXX

# Servidor
PORT=3002

# Admin inicial — seedAdmin() lo crea en el primer arranque
ADMIN_EMAIL=admin@cibermedida.es
ADMIN_PASSWORD=CONTRASENA_ADMIN_FUERTE
ADMIN_NAME=Administrador
```

```bash
# Genera JWT_SECRET:
openssl rand -base64 64
# Copia el resultado en JWT_SECRET del .env
```

---

## 9. Build del backend Node.js

```bash
cd /opt/comunicacion/server

# Instalar dependencias de producción
npm install --omit=dev

# Compilar TypeScript → JavaScript
npm run build
# Genera ./dist/ con todos los archivos .js

# Verificar que compiló correctamente
ls dist/server.js dist/db.js dist/routes/ dist/services/ dist/middleware/
# Todos deben existir
```

> **Si `npm run build` falla**:
> ```bash
> npx tsc --version   # debe mostrar 5.x
> npx tsc 2>&1 | head -20   # ver errores de compilación
> ```

---

## 10. Build del frontend Vite

```bash
cd /opt/comunicacion/client

# Instalar dependencias
npm install --omit=dev

# NO necesitas .env.production para producción:
# El frontend usa URLs relativas (/api/...) que Apache redirige al backend.
# VITE_BACKEND_URL vacío = correcto para mismo dominio.

# Build de producción
npm run build
# Genera ./dist/

# Verificar
ls dist/index.html dist/assets/
```

---

## 11. Arranque con PM2

```bash
cd /opt/comunicacion

# El directorio logs debe existir (lo creamos en paso 2)
ls logs/   # debe existir

# Arrancar
pm2 start ecosystem.config.cjs

# Verificar estado
pm2 status
# comunicacion-api debe mostrar: online

# Ver logs en tiempo real
pm2 logs comunicacion-api --lines 30
# Debes ver:
#   [server] Puerto 3002 | CORS: https://comunicacion.cibermedida.es
#   [seedAdmin] Admin creado correctamente: admin@cibermedida.es
#   (o "Admin ya existente" si es el segundo arranque)

# Verificar que el backend responde
curl -s http://localhost:3002/api/health
# {"status":"ok","db":"connected","uptime":...}

# Guardar configuración PM2 para arrancar al reiniciar el servidor
pm2 save
pm2 startup
# PM2 muestra un comando. EJECÚTALO como indica (sudo si es necesario).
```

> **CRÍTICO**: si `pm2 status` muestra `errored`, ejecuta `pm2 logs comunicacion-api --err` para ver el error.

---

## 12. Configuración de Apache como reverse proxy

```bash
# Activar módulos necesarios
sudo a2enmod proxy proxy_http rewrite headers ssl remoteip

# Copiar configuración
sudo cp /opt/comunicacion/deploy/apache-vhost.conf \
  /etc/apache2/sites-available/comunicacion.conf

# Activar sitio y desactivar default
sudo a2ensite comunicacion.conf
sudo a2dissite 000-default.conf

# Verificar configuración
sudo apache2ctl configtest
# Debe mostrar: Syntax OK

sudo systemctl restart apache2
sudo systemctl status apache2   # debe mostrar: active (running)

# Verificar que Apache proxy funciona (antes del SSL)
curl -s http://localhost/api/health
# {"status":"ok","db":"connected","uptime":...}
```

---

## 13. Certificado SSL con Certbot

```bash
# Instalar Certbot para Apache
sudo apt install -y certbot python3-certbot-apache

# Obtener certificado y configurar HTTPS automáticamente
sudo certbot --apache \
  -d comunicacion.cibermedida.es \
  --email admin@cibermedida.es \
  --agree-tos \
  --non-interactive \
  --redirect

# Verificar renovación automática
sudo certbot renew --dry-run
# Debe mostrar: Congratulations, all simulated renewals succeeded
```

> **HTTPS es OBLIGATORIO** para que la cámara y el micrófono funcionen (`getUserMedia` solo
> está disponible en HTTPS o localhost). Sin SSL, la sala de entrenamiento no arrancará.

---

## 14. Verificación final paso a paso

Ejecuta estos comandos en orden. **No avances si alguno falla.**

```bash
# ── 1. Backend health ────────────────────────────────────────────────────────
curl -s https://comunicacion.cibermedida.es/api/health | python3 -m json.tool
# Esperado: {"status": "ok", "db": "connected", "uptime": ...}

# ── 2. SSL activo ────────────────────────────────────────────────────────────
curl -vI https://comunicacion.cibermedida.es 2>&1 | grep -E "SSL|subject|issuer|HTTP/"
# Esperado: SSL certificate verify ok, issuer: Let's Encrypt, HTTP/1.1 200 OK

# ── 3. Login admin ───────────────────────────────────────────────────────────
curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cibermedida.es","password":"TU_PASSWORD_ADMIN"}' \
  | python3 -m json.tool
# Esperado: {"token": "eyJ...", "user": {"role": "admin", ...}}

# ── 4. Login con credenciales incorrectas (no debe redirigir) ────────────────
curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"mal"}' -w "\nHTTP %{http_code}\n"
# Esperado: HTTP 401 (no redirección, no crash)

# ── 5. Rate limiting — el 11º intento debe dar 429 ──────────────────────────
for i in $(seq 1 12); do
  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://comunicacion.cibermedida.es/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"mal"}')
  echo "Intento $i → HTTP $CODE"
done
# Esperado: intentos 1-10 → 401 | intentos 11-12 → 429

# ── 6. Ejercicios con token ──────────────────────────────────────────────────
TOKEN=$(curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cibermedida.es","password":"TU_PASSWORD_ADMIN"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -s https://comunicacion.cibermedida.es/api/exercises \
  -H "Authorization: Bearer $TOKEN" \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} ejercicios cargados')"
# Esperado: 40 ejercicios cargados

# ── 7. Log de seedAdmin ──────────────────────────────────────────────────────
pm2 logs comunicacion-api --lines 50 --nostream | grep -i "seedAdmin\|admin"
# Esperado: [seedAdmin] Admin creado correctamente: admin@cibermedida.es
#       o:  [seedAdmin] Admin ya existente (admin@...). Sin cambios.

# ── 8. CORS correcto desde el dominio ────────────────────────────────────────
curl -s -I -X OPTIONS https://comunicacion.cibermedida.es/api/health \
  -H "Origin: https://comunicacion.cibermedida.es" | grep -i "access-control"
# Esperado: access-control-allow-origin: https://comunicacion.cibermedida.es

# ── 9. Frontend cargando ─────────────────────────────────────────────────────
curl -s https://comunicacion.cibermedida.es | grep -c "<div"
# Esperado: número > 0 (HTML del index.html de Vite)
```

---

## 15. Puntos de fallo reales y soluciones

### A. CORS — "No 'Access-Control-Allow-Origin' header"
**Causa**: `FRONTEND_URL` mal escrito en `.env` (espacio extra, barra final, http en vez de https).
```bash
# Verificar valor exacto en .env:
grep FRONTEND_URL /opt/comunicacion/server/.env
# Debe ser: FRONTEND_URL=https://comunicacion.cibermedida.es
# SIN barra final, SIN espacios, protocolo https://

# Reiniciar después de cambiar .env:
pm2 reload comunicacion-api
```

### B. Cámara/micrófono no funcionan — "getUserMedia not supported"
**Causa**: el frontend se sirve sin HTTPS. `getUserMedia` y MediaPipe requieren HTTPS obligatoriamente (o localhost).
```bash
# Verificar que certbot está activo:
sudo certbot certificates
# Si falta el certificado:
sudo certbot --apache -d comunicacion.cibermedida.es
```

### C. MariaDB — "Access denied" o "Unknown database"
```bash
# Verificar que el usuario tiene acceso:
mariadb -u entrenamiento -p entrenamiento_comunicativo -e "SELECT 1;"
# Si falla, repite el paso 5.

# Verificar que la base de datos existe:
mariadb -u root -p -e "SHOW DATABASES LIKE 'entrenamiento%';"
```

### D. Backend no arranca — PM2 en estado "errored"
```bash
pm2 logs comunicacion-api --err --lines 50
# Causas comunes:
# "Cannot find module './dist/server.js'" → npm run build no se ejecutó
# "ER_ACCESS_DENIED_ERROR" → contraseña de MariaDB incorrecta en .env
# "JWT_SECRET is not defined" → .env no cargado o variable faltante
# "EADDRINUSE :::3002" → otro proceso usa el puerto 3002

# Ver qué ocupa el puerto:
sudo lsof -i :3002
```

### E. Rate limiting no funciona (todos los clientes bloqueados o ninguno)
**Causa**: `app.set('trust proxy', 1)` ausente en `server.ts` (ya corregido).
Sin esta línea, Express ve `127.0.0.1` para todos los clientes → todos comparten el mismo contador.
```bash
# Verificar que trust proxy está activo (en logs de PM2):
pm2 logs comunicacion-api | grep "trust proxy"
# Si no aparece, verifica server.ts:
grep "trust proxy" /opt/comunicacion/server/dist/server.js
```

### F. Frontend muestra pantalla en blanco
```bash
# Ver errores de Apache:
sudo tail -20 /var/log/apache2/comunicacion-error.log

# Causas comunes:
# DocumentRoot incorrecto → ls /opt/comunicacion/client/dist/index.html
# RewriteEngine no activado → sudo a2enmod rewrite && sudo systemctl restart apache2
# Permisos → sudo chmod -R 755 /opt/comunicacion/client/dist
```

### G. Rutas API devuelven 404 desde el frontend
**Causa probable**: `ProxyPass` sin trailing slash.
```bash
# En /etc/apache2/sites-available/comunicacion.conf debe ser:
#   ProxyPass /api/ http://127.0.0.1:3002/api/    ← con / al final en AMBOS lados
# NO:
#   ProxyPass /api http://127.0.0.1:3002/api      ← puede fallar con algunas rutas

sudo apache2ctl configtest && sudo systemctl reload apache2
```

### H. `seed.sql` falla con "Duplicate entry"
**Causa**: se ejecutó seed.sql más de una vez antes de la corrección a `INSERT IGNORE`.
```bash
# Benigno para filler_words (ya tienen INSERT IGNORE).
# Para exercise_prompts, si ya hay 40 ejercicios, no es necesario volver a ejecutar.
mariadb -u entrenamiento -p entrenamiento_comunicativo \
  -e "SELECT COUNT(*) FROM exercise_prompts;"
# Si es 40, todo correcto, ignora el error.
```

### I. seedAdmin — "Error al comprobar/crear admin: Table 'users' doesn't exist"
**Causa**: schema.sql no se ejecutó antes de arrancar PM2.
```bash
# Verificar tablas:
mariadb -u entrenamiento -p entrenamiento_comunicativo -e "SHOW TABLES;"
# Si faltan tablas, ejecutar:
mariadb -u entrenamiento -p entrenamiento_comunicativo \
  < /opt/comunicacion/database/schema.sql
pm2 reload comunicacion-api
```

### J. MediaPipe — "NotAllowedError: Permission denied"
**Causa**: el usuario denegó los permisos de cámara/micrófono en el navegador.
El frontend muestra el mensaje de error con instrucciones. No es un bug del servidor.
Solución: el usuario debe ir a Configuración del navegador → Permisos del sitio → Permitir cámara y micrófono.

---

## 16. Comandos de mantenimiento

```bash
# Estado general
pm2 status
pm2 logs comunicacion-api --lines 50

# Actualizar código (sin downtime)
cd /opt/comunicacion
git pull
cd server && npm install --omit=dev && npm run build
cd ..
pm2 reload comunicacion-api   # reload = zero-downtime restart

# Backup de la base de datos
mkdir -p /opt/backups
mysqldump -u entrenamiento -p entrenamiento_comunicativo \
  > /opt/backups/comunicacion_$(date +%Y%m%d_%H%M).sql

# Renovar SSL manualmente (si falla la renovación automática)
sudo certbot renew && sudo systemctl reload apache2

# Ver logs de Apache
sudo tail -f /var/log/apache2/comunicacion-error.log
sudo tail -f /var/log/apache2/comunicacion-access.log

# Reiniciar tras cambio de .env (pm2 reload NO recarga .env, necesita restart)
pm2 restart comunicacion-api
```

---

## Diferencias entre demo y producción

| Aspecto              | Demo (preview)                  | Producción (VPS)                    |
|----------------------|---------------------------------|-------------------------------------|
| Base de datos        | MongoDB                         | MariaDB                             |
| Backend              | FastAPI (Python)                | Express (Node.js/TypeScript → dist) |
| Frontend             | CRA React (`.js`)               | Vite (`.tsx`, strict TS, build)     |
| CORS                 | `CORS_ORIGINS=*`                | `FRONTEND_URL=https://dominio.es`   |
| Rate limit login     | 10/min por IP (slowapi)         | 10/15min por IP (express-rate-limit)|
| Trust proxy          | No aplica (Kubernetes)          | `app.set('trust proxy', 1)` requerido |
| SSL                  | HTTPS del entorno preview       | Let's Encrypt + Certbot             |
| Cámara/micrófono     | No disponible en headless test  | Requiere HTTPS activo               |
| seedAdmin            | Se ejecuta en startup (MongoDB) | Se ejecuta en startup (MariaDB)     |

---

*Entrenamiento Comunicativo v1.0 — Revisión 2026-02*
*Bugs corregidos en esta revisión: ecosystem.config, apache-vhost, trust proxy, session camelCase, auth/me role, seed idempotencia*
