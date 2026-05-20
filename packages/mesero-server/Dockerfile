# mesero-server — API Express + SQLite (better-sqlite3)
# Contexto de build: raíz del monorepo (/root/mesero)
FROM node:20-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/mesero-server/package.json ./packages/mesero-server/
RUN npm ci --workspace=mesero-server --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3041
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/mesero-server ./packages/mesero-server
WORKDIR /app/packages/mesero-server
RUN mkdir -p data
EXPOSE 3041
CMD ["node", "src/index.js"]
