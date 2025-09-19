import { hexToBytes, bytesToHex, randomBytes } from "@noble/hashes/utils";
import { secp256k1 } from "@noble/curves/secp256k1";
// Use CommonJS require to avoid depending on external type definitions
// eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-explicit-any
const CryptoJS: any = require("crypto-js");

/**
 * Web/RN NIP-04 implementation using crypto-js (AES-256-CBC, PKCS7).
 * Matches the Node build API (sync, same string formats).
 */

/** Error class for NIP-04 decryption failures */
export class NIP04DecryptionError extends Error {
  originalError?: Error;
  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = "NIP04DecryptionError";
    this.originalError = originalError;
  }
}

/** Base64 encode/decode helpers (browser/RN/Node) */
function base64Encode(bytes: Uint8Array): string {
  if (typeof globalThis?.btoa === "function") {
    try {
      // Build binary string without spreading large arrays (avoids stack overflow)
      const CHUNK_SIZE = 0x8000; // 32KB chunks
      const parts: string[] = [];
      for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
        const chunk = bytes.subarray(i, i + CHUNK_SIZE);
        let s = "";
        for (let j = 0; j < chunk.length; j++) s += String.fromCharCode(chunk[j]);
        parts.push(s);
      }
      return globalThis.btoa(parts.join(""));
    }
    // eslint-disable-next-line no-empty
    catch {}
  }
  if (typeof Buffer !== "undefined") {
    try {
      return Buffer.from(bytes).toString("base64");
    }
    // eslint-disable-next-line no-empty
    catch {}
  }
  // Minimal manual base64 (RFC 4648)
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const a = bytes[i++];
    const b = i < bytes.length ? bytes[i++] : 0;
    const c = i < bytes.length ? bytes[i++] : 0;
    const t = (a << 16) | (b << 8) | c;
    out += chars[(t >> 18) & 63] + chars[(t >> 12) & 63];
    out += i - 2 < bytes.length ? chars[(t >> 6) & 63] : "=";
    out += i - 1 < bytes.length ? chars[t & 63] : "=";
  }
  return out;
}

const BASE64_VALIDATION_REGEX =
  /^(?:(?:[A-Za-z0-9+/]{4})+(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?|[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)$/;

function base64Decode(str: string): Uint8Array {
  if (!BASE64_VALIDATION_REGEX.test(str)) {
    throw new Error("Invalid base64 alphabet");
  }
  if (typeof globalThis?.atob === "function") {
    try {
      const bin = globalThis.atob(str);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      throw new Error("Invalid base64 encoding");
    }
  }
  if (typeof Buffer !== "undefined") {
    try {
      return new Uint8Array(Buffer.from(str, "base64"));
    } catch {
      throw new Error("Invalid base64 encoding");
    }
  }
  // Manual decode
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const lut = new Int16Array(256).fill(-1);
  for (let i = 0; i < chars.length; i++) lut[chars.charCodeAt(i)] = i;
  lut["=".charCodeAt(0)] = 0;
  const len = str.length;
  let outLen = Math.floor(len * 0.75);
  if (str[len - 1] === "=") {
    outLen--;
    if (str[len - 2] === "=") outLen--;
  }
  const out = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < len; i += 4) {
    const a = lut[str.charCodeAt(i)];
    const b = lut[str.charCodeAt(i + 1)];
    const c = lut[str.charCodeAt(i + 2)];
    const d = lut[str.charCodeAt(i + 3)];
    if (a < 0 || b < 0 || c < 0 || d < 0) throw new Error("Invalid base64");
    out[p++] = (a << 2) | (b >> 4);
    if (p < outLen) out[p++] = ((b & 15) << 4) | (c >> 2);
    if (p < outLen) out[p++] = ((c & 3) << 6) | d;
  }
  return out;
}

/** Derive ECDH shared secret (raw x-coordinate, 32 bytes) */
export function getSharedSecret(privateKey: string, publicKey: string): Uint8Array {
  const sk = hexToBytes(privateKey);
  const pk = hexToBytes("02" + publicKey);
  const shared = secp256k1.getSharedSecret(sk, pk);
  return shared.slice(1, 33);
}

/** Encrypt message per NIP-04, returns "<base64>?iv=<base64>" */
export function encrypt(privateKey: string, publicKey: string, message: string): string {
  const keyBytes = getSharedSecret(privateKey, publicKey);
  const iv = randomBytes(16);
  const keyWA = CryptoJS.enc.Hex.parse(bytesToHex(keyBytes));
  const ivWA = CryptoJS.enc.Hex.parse(bytesToHex(iv));

  const plaintextWA = CryptoJS.enc.Utf8.parse(message);
  const encrypted = CryptoJS.AES.encrypt(plaintextWA, keyWA, {
    iv: ivWA,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  // CryptoJS.AES.encrypt(...).ciphertext is a WordArray
  const ciphertextB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  const ivB64 = base64Encode(iv);
  return `${ciphertextB64}?iv=${ivB64}`;
}

function isValidBase64(str: string): boolean {
  try {
    base64Decode(str);
    return true;
  } catch {
    return false;
  }
}

/** Decrypt NIP-04 payload */
export function decrypt(privateKey: string, publicKey: string, encryptedMessage: string): string {
  try {
    if (typeof encryptedMessage !== "string") {
      throw new NIP04DecryptionError("Invalid encrypted message: must be a string");
    }
    if (!encryptedMessage.includes("?iv=")) {
      throw new NIP04DecryptionError("Invalid encrypted message format: missing IV separator");
    }
    const parts = encryptedMessage.split("?iv=");
    if (parts.length !== 2) {
      throw new NIP04DecryptionError("Invalid encrypted message format: multiple IV separators found");
    }
    const [encryptedText, ivBase64] = parts;
    if (!encryptedText || !ivBase64) {
      throw new NIP04DecryptionError("Invalid encrypted message format: empty ciphertext or IV");
    }
    if (!isValidBase64(encryptedText)) {
      throw new NIP04DecryptionError("Invalid encrypted message: ciphertext is not valid base64");
    }
    if (!isValidBase64(ivBase64)) {
      throw new NIP04DecryptionError("Invalid encrypted message: IV is not valid base64");
    }

    const iv = base64Decode(ivBase64);
    if (iv.length !== 16) {
      throw new NIP04DecryptionError(`Invalid IV length: expected 16 bytes, got ${iv.length}`);
    }

    const keyBytes = getSharedSecret(privateKey, publicKey);
    const keyWA = CryptoJS.enc.Hex.parse(bytesToHex(keyBytes));
    const ivWA = CryptoJS.enc.Hex.parse(bytesToHex(iv));

    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(encryptedText),
    });
    const decrypted = CryptoJS.AES.decrypt(cipherParams, keyWA, {
      iv: ivWA,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    const plaintext = CryptoJS.enc.Utf8.stringify(decrypted);
    return plaintext;
  } catch (error) {
    if (error instanceof NIP04DecryptionError) throw error;
    // Don't log error details that might contain sensitive data
    throw new NIP04DecryptionError("Failed to decrypt message");
  }
}
