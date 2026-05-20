module.exports = {
  apps: [
    {
      name: "profitsoftware",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/home/app/profitsoftware",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      instances: 1,
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
