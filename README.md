# Entrenamiento Comunicativo

Plataforma de entrenamiento en comunicación profesional con análisis por IA. Analiza velocidad de habla, muletillas, presencia visual y estructura del discurso mediante 10 niveles progresivos.

---

## Prerequisites

- Ubuntu/Debian VPS (20.04 LTS+)
- Node.js 20 LTS
- MariaDB 10.6+
- Apache 2.4 with `mod_proxy`, `mod_ssl`, `mod_headers` enabled
- Certbot (Let's Encrypt)
- PM2 (`npm install -g pm2`)
- ts-node (`npm install -g ts-node`)

---

## Database Setup

```bash
sudo mysql -u root -p << 'SQL'
CREATE DATABASE IF NOT EXISTS entrenamiento CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'entrenamiento'@'localhost' IDENTIFIED BY 'STRONG_PASSWORD';
GRANT ALL PRIVILEGES ON entrenamiento.* TO 'entrenamiento'@'localhost';
FLUSH PRIVILEGES;
SQL

mysql -u entrenamiento -p entrenamiento < database/schema.sql
mysql -u entrenamiento -p entrenamiento < database/seed.sql
```

---

## Environment Variables

```bash
cp .env.example .env && nano .env
```

Critical fields:
- `DB_SOCKET`: Unix socket path (usually `/run/mysqld/mysqld.sock`)
- `JWT_SECRET`: Random 64-char hex (`openssl rand -hex 32`)
- `OPENAI_API_KEY`: From https://platform.openai.com/api-keys
- `ANTHROPIC_API_KEY`: From https://console.anthropic.com/

---

## Development

```bash
npm install
npx ts-node --esm server/server.ts

# Frontend
cd client && npm install && npm run dev
```

---

## Production Build

```bash
cd client && npm install && npm run build
cp -r client/dist /var/www/entrenamiento/client/dist
cd .. && npm install --production
```

---

## VPS Deployment

```bash
git clone <repo> /var/www/entrenamiento
cd /var/www/entrenamiento
cp .env.example .env && nano .env
npm install
cd client && npm install && npm run build && cd ..
mkdir -p logs
mysql -u entrenamiento -p entrenamiento < database/schema.sql
mysql -u entrenamiento -p entrenamiento < database/seed.sql
```

---

## Apache Setup

```bash
sudo a2enmod proxy proxy_http ssl headers rewrite
sudo cp deploy/apache-vhost.conf /etc/apache2/sites-available/entrenamiento.conf
sudo a2ensite entrenamiento.conf
sudo apache2ctl configtest && sudo systemctl reload apache2
```

---

## SSL Setup

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d comunicacion.cibermedida.es
```

---

## PM2 Start

```bash
pm2 start ecosystem.config.cjs --env production
pm2 save && pm2 startup
```

---

## Verify Deployment

```bash
pm2 status
curl https://comunicacion.cibermedida.es/api/health
pm2 logs entrenamiento-comunicativo --lines 50
```

---

## Updating the App

```bash
cd /var/www/entrenamiento
git pull origin main
cd client && npm install && npm run build && cd ..
npm install --production
pm2 restart entrenamiento-comunicativo
curl https://comunicacion.cibermedida.es/api/health
```

---

## Project Structure

```
/
├── client/                 ← React + Vite frontend (TypeScript)
├── server/                 ← Express API backend (TypeScript)
│   ├── db.ts               ← MySQL connection pool
│   ├── server.ts           ← Express app entry point
│   ├── routes/             ← auth, sessions, exercises, progress, users
│   ├── services/           ← whisper, claude, nlp, metrics
│   └── middleware/         ← JWT auth
├── learning/               ← Nightly self-learning cron (03:00)
├── database/               ← schema.sql + seed.sql
├── deploy/                 ← Apache vhost config
├── ecosystem.config.cjs    ← PM2 configuration
└── .env.example            ← Environment variables template
```
