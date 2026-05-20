# Mesero IA por HTTPS (micrófono)

El navegador **no permite el micrófono** en `http://37.60.247.8:5173` (HTTP + IP pública).

## URL que debes usar

| Antes (no sirve para el micrófono) | Ahora (HTTPS) |
|-----------------------------------|-----------------|
| http://37.60.247.8:5173 | **https://37.60.247.8:5176** |

Administración / modo ejecución:

**https://37.60.247.8:5176/admin/ejecucion**

## Primera vez en el navegador

El certificado es **autofirmado** (generado en el servidor). Chrome/Edge mostrarán una advertencia:

1. Pulsa **Avanzado** → **Continuar a 37.60.247.8 (no seguro)** (o equivalente).
2. Entra en **Modo ejecución** → **Activar micrófono** y acepta el permiso.

## Qué hay detrás

- **nginx** en el puerto **5176** termina TLS y reenvía a Mesero IA en **5173** (Docker).
- Config: `/etc/nginx/sites-available/mesero-https`
- Certificado: `/etc/nginx/mesero-ssl/`

## Alternativas (opcional)

- **ngrok**: pon `NGROK_AUTHTOKEN` en `.env` y `systemctl enable --now ngrok-mesero` → URL `https://….ngrok-free.app`
- **Dominio propio**: se puede sustituir el cert autofirmado por Let's Encrypt si tienes un DNS apuntando al VPS.
