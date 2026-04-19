module.exports = {
  apps: [
    {
      name: "sentinel-governor",
      script: "./Scan-Global-News.js",
      watch: false,
      autorestart: true,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sentinel-dashboard",
      script: "./Start-Dashboard.js",
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      }
    },
    {
      name: "sentinel-bot",
      script: "./Start-Bot.js",
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: "production",
      }
    }
  ]
};
