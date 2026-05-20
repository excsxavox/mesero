import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, monorepoRoot, "");
  const apiPort = env.PORT || "3041";
  const target = `http://127.0.0.1:${apiPort}`;

  return {
    plugins: [react(), tailwindcss()],
    server: {
      port: 5174,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/ws": { target: `ws://127.0.0.1:${apiPort}`, ws: true },
      },
    },
  };
});
