/**
 * NIP-17 Example: Gift Wrapped Direct Message
 *
 * This example demonstrates creating a gift wrapped message
 * and decrypting it using the NIP-17 helpers.
 *
 * How to run:
 * npm run example:nip17
 */
import { createDirectMessage, decryptDirectMessage } from "../../src/nip17";
import { generateKeypair } from "../../src";

async function main() {
  const alice = await generateKeypair();
  const bob = await generateKeypair();

  console.log("Alice pubkey:", alice.publicKey);
  console.log("Bob pubkey:", bob.publicKey);

  const wrapped = await createDirectMessage(
    "Hello Bob!",
    alice.privateKey,
    bob.publicKey,
  );
  console.log("Gift wrap event:", wrapped);

  const dm = decryptDirectMessage(wrapped, bob.privateKey);
  console.log("Decrypted message:", dm.content);
}

main().catch((e) => console.error(e));
