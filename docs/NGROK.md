# Mesero IA por HTTPS con ngrok

El micrófono en el navegador exige **HTTPS** (o `localhost`). ngrok expone el front en **5173** con certificado válido.

Un solo túnel basta: nginx en `mesero-ia` ya reenvía `/api` y `/ws` al `mesero-server`.

## 1. Cuenta y token

1. Regístrate en [ngrok](https://dashboard.ngrok.com/signup) (plan gratuito vale).
2. Copia el authtoken: [dashboard → Your Authtoken](https://dashboard.ngrok.com/get-started/your-authtoken).
3. En `/root/mesero/.env`:

```env
NGROK_AUTHTOKEN=tu_token_aqui
```

## 2. Arrancar el túnel

**Manual (prueba rápida):**

```bash
cd /root/mesero
./scripts/ngrok-mesero.sh
```

En otra terminal, URL pública:

```bash
curl -s http://127.0.0.1:4040/api/tunnels | jq -r '.tunnels[] | select(.name=="mesero-ia") | .public_url'
```

**Como servicio (reinicio automático):**

```bash
systemctl daemon-reload
systemctl enable --now ngrok-mesero
systemctl status ngrok-mesero
```

## 3. Usar el mesero

Abre la URL `https://….ngrok-free.app` (o similar) en Chrome/Edge:

- Pantalla principal del mesero
- **Administración → Modo ejecución** → **Activar micrófono**

## Notas

- En el plan gratuito la URL **cambia** cada vez que reinicias ngrok (salvo dominio reservado de pago).
- Panel local del agente: http://127.0.0.1:4040
- No hace falta otro túnel para el API: todo va por el mismo host (`/api`, `/ws`).
