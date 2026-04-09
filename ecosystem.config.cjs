/**
 * ecosystem.config.cjs — Configuración PM2 para producción
 *
 * ANTES DE USAR:
 *   cd /opt/comunicacion
 *   mkdir -p logs
 *   cd server && npm install && npm run build   # compila TS → dist/
 *   cd ..
 *   pm2 start ecosystem.config.cjs
 *   pm2 save && pm2 startup
 */
module.exports = {
  apps: [
    {
      name: 'comunicacion-api',
      // Apunta al JS compilado (dist/), NO al .ts fuente
      script: './server/dist/server.js',
      // env_file carga el .env SIN necesitar --env production
      env_file: './server/.env',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      error_file: './logs/api-error.log',
      out_file: './logs/api-out.log',
      time: true,
    },
    {
      name: 'learning-cron',
      // También apunta al JS compilado
      script: './server/dist/learning/nightlyCron.js',
      env_file: './server/.env',
      env: {
        NODE_ENV: 'production',
      },
      autorestart: false,
      watch: false,
      time: true,
    },
  ],
};
