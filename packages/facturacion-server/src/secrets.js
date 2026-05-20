import crypto from "node:crypto";

const PREFIX = "enc:v1:";
const ALGO = "aes-256-gcm";

function deriveKey() {
  const secret = (process.env.BILLING_ENCRYPTION_KEY || process.env.BILLING_API_KEY || "").trim();
  if (!secret) {
    console.warn("[facturacion] Sin BILLING_ENCRYPTION_KEY: contraseña de certificado sin cifrar en desarrollo");
    return null;
  }
  return crypto.scryptSync(secret, "facturacion-cert-v1", 32);
}

export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plain) {
  const text = String(plain ?? "");
  if (!text) return "";
  const key = deriveKey();
  if (!key) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptSecret(stored) {
  const value = String(stored ?? "");
  if (!value) return "";
  if (!isEncrypted(value)) return value;
  const key = deriveKey();
  if (!key) return "";
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) return "";
  const [ivB64, tagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
