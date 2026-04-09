module.exports = {
  apps: [
    {
      name: 'entrenamiento-comunicativo',
      script: './server/server.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      env_production: {
        NODE_ENV: 'production',
        PORT: '3002'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      time: true
    },
    {
      name: 'learning-cron',
      script: './learning/nightlyCron.ts',
      interpreter: 'node',
      interpreter_args: '--loader ts-node/esm',
      autorestart: false,
      watch: false,
      env_production: { NODE_ENV: 'production' }
    }
  ]
};
