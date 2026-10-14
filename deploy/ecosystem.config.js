module.exports = {
  apps: [
    {
      name: 'it-asset-backend',
      cwd: '/var/www/it.vegithglobal.com/backend',
      script: 'server.js',
      env: { NODE_ENV: 'production' },
    },
  ],
};
