# Guía de despliegue — Entrenamiento Comunicativo
# comunicacion.cibermedida.es
# Stack: Node.js 20 + Express + MariaDB + React (Vite) + PM2 + Apache + SSL

---

## Índice

1. [Requisitos previos](#1-requisitos-previos)
2. [Preparación del servidor](#2-preparación-del-servidor)
3. [Instalación de Node.js 20](#3-instalación-de-nodejs-20)
4. [Instalación y configuración de MariaDB](#4-instalación-y-configuración-de-mariadb)
5. [Creación de base de datos y usuario](#5-creación-de-base-de-datos-y-usuario)
6. [Clonar el repositorio](#6-clonar-el-repositorio)
7. [Ejecución de schema.sql y seed.sql](#7-ejecución-de-schemasql-y-seedsql)
8. [Variables de entorno del backend](#8-variables-de-entorno-del-backend)
9. [Build del backend Node.js](#9-build-del-backend-nodejs)
10. [Build del frontend Vite](#10-build-del-frontend-vite)
11. [Arranque con PM2](#11-arranque-con-pm2)
12. [Configuración de Apache como reverse proxy](#12-configuración-de-apache-como-reverse-proxy)
13. [Certificado SSL con Certbot](#13-certificado-ssl-con-certbot)
14. [Verificación final](#14-verificación-final)
15. [Comandos de mantenimiento](#15-comandos-de-mantenimiento)

---

## 1. Requisitos previos

| Componente     | Versión mínima | Verificar con              |
|----------------|----------------|---------------------------|
| Ubuntu/Debian  | 22.04 LTS      | `lsb_release -a`          |
| Node.js        | 20.x LTS       | `node --version`           |
| npm            | 10.x           | `npm --version`            |
| MariaDB        | 10.11+         | `mariadb --version`        |
| PM2            | 5.x            | `pm2 --version`            |
| Apache2        | 2.4+           | `apache2 -v`               |
| Certbot        | latest         | `certbot --version`        |

**El dominio `comunicacion.cibermedida.es` debe apuntar a la IP del servidor antes de ejecutar Certbot.**

---

## 2. Preparación del servidor

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl wget build-essential apache2 apache2-utils
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 3. Instalación de Node.js 20

```bash
# Usando NodeSource (LTS oficial)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verificar
node --version   # debe mostrar v20.x.x
npm --version    # debe mostrar 10.x.x

# Instalar PM2 globalmente
sudo npm install -g pm2
pm2 --version
```

---

## 4. Instalación y configuración de MariaDB

```bash
sudo apt install -y mariadb-server mariadb-client

# Arrancar y activar al inicio
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Asistente de seguridad (EJECUTAR SIEMPRE en nuevo servidor)
sudo mariadb-secure-installation
# Responde:
#   Switch to unix_socket authentication? N
#   Change the root password? Y  → pon una contraseña fuerte
#   Remove anonymous users? Y
#   Disallow root login remotely? Y
#   Remove test database? Y
#   Reload privilege tables? Y
```

---

## 5. Creación de base de datos y usuario

```bash
# Entra como root
sudo mariadb -u root -p

# Dentro de MariaDB, ejecuta:
CREATE DATABASE IF NOT EXISTS entrenamiento_comunicativo
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'entrenamiento'@'localhost'
  IDENTIFIED BY 'PON_AQUI_TU_CONTRASENA_SEGURA';

GRANT ALL PRIVILEGES ON entrenamiento_comunicativo.*
  TO 'entrenamiento'@'localhost';

FLUSH PRIVILEGES;
EXIT;
```

> **Nota de seguridad**: El usuario de la aplicación solo tiene acceso a su propia base de datos. Nunca uses `root` en el backend.

---

## 6. Clonar el repositorio

```bash
cd /opt
sudo git clone https://github.com/TU_USUARIO/TU_REPO.git comunicacion
sudo chown -R $USER:$USER /opt/comunicacion
cd /opt/comunicacion
```

> Si el repositorio es privado:
> ```bash
> git clone https://USUARIO:TOKEN@github.com/TU_USUARIO/TU_REPO.git comunicacion
> ```

---

## 7. Ejecución de schema.sql y seed.sql

```bash
cd /opt/comunicacion/database

# Crear todas las tablas
mariadb -u entrenamiento -p entrenamiento_comunicativo < schema.sql

# Insertar los 40 ejercicios y 16 muletillas
mariadb -u entrenamiento -p entrenamiento_comunicativo < seed.sql

# Verificar que las tablas se crearon correctamente
mariadb -u entrenamiento -p entrenamiento_comunicativo \
  -e "SHOW TABLES; SELECT COUNT(*) as ejercicios FROM exercise_prompts;"
# Debe mostrar 9 tablas y 40 ejercicios
```

---

## 8. Variables de entorno del backend

```bash
cd /opt/comunicacion/server

# Crear .env a partir del ejemplo
cp .env.example .env

# Editar con tus valores reales
nano .env
```

Contenido del archivo `.env` final:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=entrenamiento
DB_PASSWORD=TU_CONTRASENA_REAL
DB_NAME=entrenamiento_comunicativo

# Genera con: openssl rand -base64 64
JWT_SECRET=TU_JWT_SECRET_MUY_LARGO_Y_ALEATORIO

# Dominio exacto del frontend (sin trailing slash)
FRONTEND_URL=https://comunicacion.cibermedida.es

# Clave Emergent para Whisper + Claude
EMERGENT_LLM_KEY=sk-emergent-XXXXXXXXXXXXXXXXXX

PORT=3002
```

> **Seguridad**: Protege el archivo `.env`:
> ```bash
> chmod 600 /opt/comunicacion/server/.env
> ```

---

## 9. Build del backend Node.js

```bash
cd /opt/comunicacion/server

# Instalar dependencias
npm install

# Compilar TypeScript a JavaScript
npm run build
# Genera /opt/comunicacion/server/dist/

# Verificar que compila sin errores
ls dist/server.js  # debe existir
```

> Si no hay `package.json` con script `build`, ejecuta directamente:
> ```bash
> npx tsc
> ```

---

## 10. Build del frontend Vite

```bash
cd /opt/comunicacion/client

# Crear .env de producción
cat > .env.production << 'EOF'
VITE_API_URL=https://comunicacion.cibermedida.es
EOF

# Instalar dependencias
npm install

# Build de producción
npm run build
# Genera /opt/comunicacion/client/dist/

# Verificar
ls dist/index.html  # debe existir
```

---

## 11. Arranque con PM2

```bash
cd /opt/comunicacion

# Arrancar con PM2 usando el archivo de configuración
pm2 start ecosystem.config.cjs

# Verificar que el proceso está corriendo
pm2 status
pm2 logs comunicacion-api --lines 50

# Guardar la configuración para que PM2 arranque al reiniciar el servidor
pm2 save
pm2 startup
# PM2 mostrará un comando. EJECÚTALO como dice (con sudo si es necesario)
```

Contenido de referencia de `ecosystem.config.cjs`:

```js
module.exports = {
  apps: [
    {
      name: 'comunicacion-api',
      script: './server/dist/server.js',
      env: {
        NODE_ENV: 'production',
      },
      env_file: './server/.env',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
    },
  ],
};
```

---

## 12. Configuración de Apache como reverse proxy

```bash
# Activar módulos necesarios
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite headers ssl

# Crear el virtual host
sudo nano /etc/apache2/sites-available/comunicacion.conf
```

Pega el siguiente contenido (sustituye el email de admin):

```apache
<VirtualHost *:80>
    ServerName comunicacion.cibermedida.es
    # Certbot añadirá la redirección HTTPS aquí automáticamente
    DocumentRoot /opt/comunicacion/client/dist

    <Directory /opt/comunicacion/client/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
        # SPA routing: redirige todo al index.html
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>

    # Proxy hacia el backend Node.js
    ProxyPreserveHost On
    ProxyPass /api/ http://127.0.0.1:3002/api/
    ProxyPassReverse /api/ http://127.0.0.1:3002/api/

    # Headers de seguridad
    Header always set X-Content-Type-Options "nosniff"
    Header always set X-Frame-Options "DENY"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    ErrorLog ${APACHE_LOG_DIR}/comunicacion-error.log
    CustomLog ${APACHE_LOG_DIR}/comunicacion-access.log combined
</VirtualHost>
```

```bash
# Activar el sitio y deshabilitar el default
sudo a2ensite comunicacion.conf
sudo a2dissite 000-default.conf

# Verificar configuración
sudo apache2ctl configtest
# Debe mostrar: Syntax OK

# Reiniciar Apache
sudo systemctl restart apache2
```

---

## 13. Certificado SSL con Certbot

```bash
# Instalar Certbot para Apache
sudo apt install -y certbot python3-certbot-apache

# Obtener certificado (sustituye el email real)
sudo certbot --apache \
  -d comunicacion.cibermedida.es \
  --email admin@cibermedida.es \
  --agree-tos \
  --non-interactive \
  --redirect

# Certbot modifica automáticamente el VirtualHost para HTTPS
# Verifica la renovación automática
sudo certbot renew --dry-run
```

---

## 14. Verificación final

Ejecuta estos comandos en orden para confirmar que todo funciona:

```bash
# 1. Backend health
curl -s https://comunicacion.cibermedida.es/api/health | python3 -m json.tool
# Debe responder: {"status": "ok", "db": "connected", "uptime": ...}

# 2. Login correcto
curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@cibermedida.es","password":"TU_PASSWORD"}' | python3 -m json.tool
# Debe responder con token y user

# 3. Login incorrecto — debe devolver 401, no redirigir
curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"x@x.com","password":"mal"}' -w "\nHTTP %{http_code}\n"
# Debe mostrar: HTTP 401

# 4. Rate limiting — 11 intentos consecutivos deben dar 429
for i in {1..12}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
    https://comunicacion.cibermedida.es/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"x@x.com","password":"mal"}')
  echo "Intento $i: HTTP $code"
done
# Los primeros 10 son 401, del 11 en adelante deben ser 429

# 5. Tabla de ejercicios
TOKEN=$(curl -s -X POST https://comunicacion.cibermedida.es/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"TU_EMAIL","password":"TU_PASSWORD"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")
curl -s "https://comunicacion.cibermedida.es/api/exercises" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json;d=json.load(sys.stdin);print(f'{len(d)} ejercicios')"
# Debe mostrar: 40 ejercicios

# 6. SSL
curl -vI https://comunicacion.cibermedida.es 2>&1 | grep "SSL certificate\|subject:"
# Debe mostrar el certificado de Let's Encrypt
```

---

## 15. Comandos de mantenimiento

```bash
# Ver logs en tiempo real
pm2 logs comunicacion-api

# Reiniciar backend sin downtime
pm2 reload comunicacion-api

# Ver estado
pm2 status

# Actualizar código y redesplegar
cd /opt/comunicacion
git pull
cd server && npm run build
pm2 reload comunicacion-api

# Backup de la base de datos
mysqldump -u entrenamiento -p entrenamiento_comunicativo \
  > /opt/backups/comunicacion_$(date +%Y%m%d).sql

# Restaurar backup
mariadb -u entrenamiento -p entrenamiento_comunicativo \
  < /opt/backups/comunicacion_20251215.sql

# Ver logs de Apache
sudo tail -f /var/log/apache2/comunicacion-error.log
sudo tail -f /var/log/apache2/comunicacion-access.log

# Renovar SSL manualmente (si falla la renovación automática)
sudo certbot renew
sudo systemctl reload apache2
```

---

## Diferencias importantes entre demo y producción

| Aspecto            | Demo (preview)            | Producción (VPS)                  |
|--------------------|---------------------------|-----------------------------------|
| Base de datos      | MongoDB (Atlas/local)     | MariaDB (local en VPS)            |
| Backend            | FastAPI (Python)          | Express (Node.js/TypeScript)      |
| Frontend           | CRA React (`.js`)         | Vite React (`.tsx`, strict TS)    |
| CORS               | `*` (todos los orígenes)  | Solo `comunicacion.cibermedida.es`|
| Rate limit login   | 10/min por IP (slowapi)   | 10/15min por IP (express-rate-limit) |
| JWT               | .env hardcoded demo        | `openssl rand -base64 64`         |
| SSL               | HTTPS del preview          | Let's Encrypt via Certbot         |
| Archivos estáticos | Servidos por CRA dev       | Apache sirve `/client/dist/`      |

---

*Generado automáticamente — Entrenamiento Comunicativo v1.0*
