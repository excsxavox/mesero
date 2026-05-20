import fs from "node:fs";
import path from "node:path";
import { decryptSecret, encryptSecret, isEncrypted } from "./secrets.js";

const MASK = "***";

export function sanitizeConfigForApi(config) {
  const hasCert = Boolean(config.certificatePath?.trim() && fs.existsSync(config.certificatePath));
  return {
    ...config,
    certificatePath: "",
    certificatePassword: config.certificatePassword ? MASK : "",
    certificatePasswordSet: Boolean(config.certificatePassword),
    certificateUploaded: hasCert || Boolean(config.certificateUploaded),
    certificateFileName: config.certificateFileName || (hasCert ? path.basename(config.certificatePath) : ""),
  };
}

export function prepareConfigPatch(patch, current) {
  const next = { ...current, ...patch };
  const pwd = patch.certificatePassword;
  if (pwd === MASK || pwd === undefined) {
    next.certificatePassword = current.certificatePassword;
  } else if (pwd === "") {
    next.certificatePassword = "";
  } else if (pwd && !isEncrypted(pwd)) {
    next.certificatePassword = encryptSecret(pwd);
  }
  return next;
}

export function getConfigWithDecryptedPassword(config) {
  return {
    ...config,
    certificatePasswordPlain: decryptSecret(config.certificatePassword),
  };
}
