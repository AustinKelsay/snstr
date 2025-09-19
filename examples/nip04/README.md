# NIP-04 Examples (Web & Node)

This folder documents how to use NIP‑04 in both Node and browser/React Native environments.

## Quick Start

```ts
import { generateKeypair, encryptNIP04, decryptNIP04 } from 'snstr';

const alice = await generateKeypair();
const bob = await generateKeypair();

const ciphertext = encryptNIP04(alice.privateKey, bob.publicKey, 'hello');
const plaintext = decryptNIP04(bob.privateKey, alice.publicKey, ciphertext);
```

## Browser / React Native

- Works out of the box; no Node polyfills.
- React Native: add once at app bootstrap to provide secure RNG:
  ```ts
  import 'react-native-get-random-values';
  ```

## Node

Simply import from `snstr`. The Node build uses the native `crypto` module for AES‑256‑CBC.

## Notes

- Output format is `<base64-ciphertext>?iv=<base64-iv>`.
- Prefer NIP‑44 for new features; keep NIP‑04 for legacy compatibility.

