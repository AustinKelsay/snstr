import { secp256k1 } from "@noble/curves/secp256k1";
import { isHexOfLength } from "./wire-validation";

const FIELD_PRIME = BigInt(
  "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
);

export function isValidPublicKeyFormat(publicKey: string): boolean {
  if (!isHexOfLength(publicKey, 64)) return false;
  if (/^0{64}$/.test(publicKey) || /^f{64}$/.test(publicKey)) return false;

  try {
    return BigInt(`0x${publicKey}`) < FIELD_PRIME;
  } catch {
    return false;
  }
}

export function isValidPublicKeyPoint(publicKey: string): boolean {
  if (!isValidPublicKeyFormat(publicKey)) return false;

  for (const prefix of ["02", "03"]) {
    try {
      secp256k1.ProjectivePoint.fromHex(prefix + publicKey);
      return true;
    } catch {
      // Try the other possible y-coordinate.
    }
  }
  return false;
}

export function isValidPrivateKey(privateKey: string): boolean {
  if (!isHexOfLength(privateKey, 64)) return false;
  try {
    secp256k1.getPublicKey(privateKey);
    return true;
  } catch {
    return false;
  }
}
