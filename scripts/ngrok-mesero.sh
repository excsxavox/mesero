#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ROOT}/.env"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta ${ENV_FILE}. Copia .env.example y define NGROK_AUTHTOKEN." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a
source "$ENV_FILE"
set +a

if [[ -z "${NGROK_AUTHTOKEN:-}" ]]; then
  echo "Define NGROK_AUTHTOKEN en ${ENV_FILE}" >&2
  echo "Obtén el token en: https://dashboard.ngrok.com/get-started/your-authtoken" >&2
  exit 1
fi

exec ngrok start mesero-ia --config "${ROOT}/ngrok.yml" --log=stdout
