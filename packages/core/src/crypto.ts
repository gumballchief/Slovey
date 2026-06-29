import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// AES-256-GCM for connector tokens (and any secret) at rest. The key comes from
// TOKEN_ENCRYPTION_KEY (32 bytes, base64). Read straight from process.env so this
// stays usable in unit tests without the full env schema.
const ALG = "aes-256-gcm";

function key(): Buffer {
  const k = process.env.TOKEN_ENCRYPTION_KEY;
  if (!k) throw new Error("TOKEN_ENCRYPTION_KEY is required to encrypt/decrypt secrets");
  const buf = Buffer.from(k, "base64");
  if (buf.length !== 32) {
    throw new Error("TOKEN_ENCRYPTION_KEY must decode to 32 bytes (generate with `openssl rand -base64 32`)");
  }
  return buf;
}

/** Encrypt a secret for storage. Format: base64(iv).base64(tag).base64(ciphertext). */
export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), ct.toString("base64")].join(".");
}

/** Decrypt a value produced by encryptSecret. Throws if tampered (GCM auth fails). */
export function decryptSecret(blob: string): string {
  const [ivB, tagB, ctB] = blob.split(".");
  if (!ivB || !tagB || !ctB) throw new Error("malformed encrypted secret");
  const decipher = createDecipheriv(ALG, key(), Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Non-reversible display hint — never exposes the secret. */
export function maskSecret(plain: string): string {
  return plain.length <= 4 ? "••••" : `••••${plain.slice(-4)}`;
}
