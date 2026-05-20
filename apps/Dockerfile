# Build de una app Vite del monorepo (ARG APP_WORKSPACE: mesero-ia | receptor-pedidos | recepcion-ia)
# Contexto: raíz del monorepo (/root/mesero)
FROM node:22-bookworm-slim AS build
ARG APP_WORKSPACE
ARG VITE_AIBOX_COMPANY_ID=
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/mesero-ia/package.json ./apps/mesero-ia/
COPY apps/receptor-pedidos/package.json ./apps/receptor-pedidos/
COPY apps/recepcion-ia/package.json ./apps/recepcion-ia/
RUN npm ci

COPY apps ./apps
ENV VITE_AIBOX_COMPANY_ID=${VITE_AIBOX_COMPANY_ID}
RUN npm run build -w "${APP_WORKSPACE}"

FROM nginx:1.27-alpine AS runner
ARG APP_WORKSPACE
COPY apps/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/${APP_WORKSPACE}/dist /usr/share/nginx/html
EXPOSE 80
