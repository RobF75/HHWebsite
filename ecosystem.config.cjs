module.exports = {
  apps: [
    {
      name: "hh-website",
      cwd: "C:/node/HHWebsite",
      script: "node",
      instances: 1,
      args: "node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5175",
      env: { NODE_ENV: "development" },
      watch: true,
      autorestart: true
    }
  ]
};
