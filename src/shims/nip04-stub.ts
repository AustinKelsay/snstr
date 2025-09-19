/**
 * NIP-04 stub for web/React Native builds.
 * These environments do not include Node's `crypto` primitives required by
 * the AES-256-CBC implementation used in the Node build.
 *
 * If you need direct message encryption on web/RN, use NIP-44 instead
 * (exported as encryptNIP44/decryptNIP44), or perform NIP-04 on a trusted
 * backend / in Node by importing `snstr/nip04` from a Node runtime.
 */

function notAvailable<T extends string>(fn: T) {
  return () => {
    throw new Error(
      `snstr: ${fn} (NIP-04) is not available in this build. ` +
        `Use NIP-44 (encryptNIP44/decryptNIP44) or import "snstr/nip04" in Node.`,
    );
  };
}

export const encrypt = notAvailable("encrypt");
export const decrypt = notAvailable("decrypt");
export const getSharedSecret = notAvailable("getSharedSecret");
