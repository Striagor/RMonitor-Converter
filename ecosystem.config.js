/**
 * PM2 Ecosystem Configuration
 * Production deployment with PM2
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 logs
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: 'rmonitor-converter',
      cwd: './mini-services/converter-service',
      script: 'bun',
      args: 'run dev',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/converter-error.log',
      out_file: './logs/converter-out.log',
      log_file: './logs/converter.log',
      time: true,
    },
    {
      name: 'rmonitor-panel',
      cwd: '.',
      script: 'bun',
      args: 'run dev',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/panel-error.log',
      out_file: './logs/panel-out.log',
      log_file: './logs/panel.log',
      time: true,
    },
  ],
};
