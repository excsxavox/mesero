/** PM2: arranque en servidor (Node 22 vía fnm) */
const fnmNode =
  process.env.FNM_NODE ||
  "/root/.fnm/aliases/default/bin/node";

module.exports = {
  apps: [
    {
      name: "mesero-server",
      cwd: "/root/mesero",
      script: "packages/mesero-server/src/index.js",
      interpreter: fnmNode,
      env: { NODE_ENV: "production" },
    },
    {
      name: "mesero-billing",
      cwd: "/root/mesero",
      script: "packages/facturacion-server/src/index.js",
      interpreter: fnmNode,
      env: { NODE_ENV: "production" },
    },
    {
      name: "mesero-ia",
      cwd: "/root/mesero",
      script: "node_modules/vite/bin/vite.js",
      args: "--config apps/mesero-ia/vite.config.ts --host 0.0.0.0",
      interpreter: fnmNode,
      env: { NODE_ENV: "development" },
    },
    {
      name: "mesero-receptor",
      cwd: "/root/mesero",
      script: "node_modules/vite/bin/vite.js",
      args: "--config apps/receptor-pedidos/vite.config.ts --host 0.0.0.0",
      interpreter: fnmNode,
      env: { NODE_ENV: "development" },
    },
    {
      name: "mesero-recepcion",
      cwd: "/root/mesero",
      script: "node_modules/vite/bin/vite.js",
      args: "--config apps/recepcion-ia/vite.config.ts --host 0.0.0.0",
      interpreter: fnmNode,
      env: { NODE_ENV: "development" },
    },
  ],
};
