// PM2 process for Daybook on the VPS: `pm2 start ecosystem.config.cjs`.
// Listens on 127.0.0.1 only, so it's reachable just through Nginx (the rate limits trust the
// client IP Nginx passes on; AGENTS.md §9). Settings come from .env.production.local in this folder.
module.exports = {
  apps: [
    {
      name: "daybook",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start -H 127.0.0.1 -p 3100",
      env: { NODE_ENV: "production" },
      max_memory_restart: "700M",
      time: true,
    },
  ],
};
