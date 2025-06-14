         

🧹 Nitpick comments (29)

    docs/nip02-pubkey-normalization-fix.md (1)

        1-1: Empty doc looks accidental

        The file is completely empty. If you don’t intend to ship documentation yet, drop the file to keep the tree clean, or at least add a stub heading explaining what will come.

    tests/nip01/relay/relay.test.ts (1)

        1480-1481: Trim trailing blank lines

        Two extra blank lines slipped in at EOF. They add churn to git history and most linters flag them.

    tests/nip01/nostr.test.ts (2)

        61-64: Derive the normalized URL instead of hard-coding

        Hard-coding "ws://localhost:3556/" duplicates the normalization logic you just centralised.
        Consider:

        const normalizedRelay = getNostrInternals(client).preprocessRelayUrl(additionalRelay);
        expect(relays.has(normalizedRelay)).toBe(true);

    This keeps the test resilient if the normalization rules change again.

    98-101: Same remark as above – compute normalizedRelayUrl via the helper instead of string-concatenation.

tests/nip01/event/event.test.ts (1)

    241-286: Assertion style might be brittle

    await expect(promise).rejects.toThrow(new NostrValidationError(...)) performs deep-equality on the whole error object, incl. enumerable props like field.
    If the implementation later sets invalidData, these assertions will start failing for the wrong reason.

    Safer:

    await expect(createDirectMessage(...))
      .rejects.toThrow(/Invalid recipient public key/);

or

await expect(createDirectMessage(...))
  .rejects.toMatchObject({ field: "recipientPubkey" });

    Keeps the intent but avoids tight coupling to exact object shape.

src/nip19/index.ts (1)

    16-16: Nit: import location

    isValidRelayUrl belongs to “security utilities”. Grouping this import with the final export * from "./secure"; block (or moving the export earlier) keeps related symbols together and avoids a mid-file import.

src/nip02/index.ts (2)

    103-110: Redundant toLowerCase() after already-strict validation

    isValidPublicKeyFormat rejects any non-lower-case hex, so tag[1] is guaranteed to be lower-case when execution reaches here. Re-lower-casing every pubkey is harmless but unnecessary work on the hot path (contact lists can be large).

    -const normalizedPubkey = tag[1].toLowerCase();
    +const normalizedPubkey = tag[1]; // already lower-case

115-120: Store canonicalised relay URL to avoid duplicates

You now trim whitespace (👍) but still keep the relay URL exactly as supplied.
isValidRelayUrl is case-insensitive, so "wss://Relay.EXAMPLE.com" and "wss://relay.example.com" both validate and will be treated as different relays downstream. Consider re-using the new canonicalizeRelayUrl helper (added in NIP-66) or a lightweight normalizeRelayUrl that lower-cases scheme + host before storing.

-const trimmedRelayUrl = tag[2].trim();
-if (trimmedRelayUrl.length > 0 && isValidRelayUrl(trimmedRelayUrl)) {
-  contact.relayUrl = trimmedRelayUrl;
+const candidate = canonicalizeRelayUrl(tag[2].trim());
+if (isValidRelayUrl(candidate)) {
+  contact.relayUrl = candidate;
 }

examples/nip46/connection-string-validation-example.ts (2)

    22-37: DRY up the repetitive try/catch logging in the example

    The four almost-identical blocks that build a string, call parseConnectionString, and log the outcome are copy-pasted.
    A small helper such as

    function demo(label: string, fn: () => unknown) {
      console.log(label);
      try {
        const result = fn();
        console.log("   → ✓", result);
      } catch (e) {
        console.log("   → ✗", (e as Error).message);
      }
      console.log();
    }

    would remove ~60 lines of boilerplate and make the example easier to scan.
    Only the literal test vectors would remain in the main flow.

    58-78: Minor: misleading comment about “mixed-case” test

    The comment claims to demonstrate that “mixed-case pubkeys are rejected”, yet the string supplied (mixedCasePubkey) is still hexadecimal but with upper-case characters that would already be rejected by isValidPublicKeyFormat.
    The emphasis on “case preservation” is correct, but the example does not show a scenario that previously passed and now fails.

    Consider briefly mentioning that this would have been accepted before the fix and why, or simply shorten the comment to avoid confusion.

examples/nip01/url-preprocessing-example.ts (1)

    70-77: Tiny nit – duplicate scheme test could be stricter

    Listing "wss://http://example.com" in incompatibleUrls would explicitly demonstrate that the historical bug is gone and makes the intention crystal-clear.

tests/nip02/nip02.test.ts (1)

    458-480: Test description does not match what is actually verified

    The title says “case normalization in duplicate detection”, but the scenario contains no duplicates that differ only by case – those would be rejected by isValidPublicKeyFormat before deduplication runs.

    Either:

        Adjust the description (“verifies that pubkey is stored as provided”), or
        Stub/monkey-patch the validator to allow an upper-case duplicate and assert that it is skipped.

    As-is, the test gives a false sense of coverage.

tests/nip66/nip66.test.ts (1)

    228-236: Make error-message assertions resilient to copy changes

    Hard-coding the full text in five separate toThrow calls is brittle.
    Use a regexp that captures the invariant part:

    expect(() => createRelayDiscoveryEvent({ relay: "http://example.com" }, validPubkey))
      .toThrow(/Relay URL must start with ws:\/\/ or wss:\/\/.*valid/);

    This keeps the test meaningful while tolerating wording tweaks.

examples/nip02/pubkey-normalization-example.ts (1)

    9-11: Avoid deep relative imports for public API usage

    ../../src/nip02 couples this example to the repository layout. If the folder structure changes (e.g. src → packages/core/src) the example breaks. Prefer using whatever path alias or package entry-point end-users will import from (e.g. import { parseContactsFromEvent } from "@myorg/nostr").

docs/relay-pool-url-normalization-fix.md (1)

    120-126: JavaScript triple-equality chaining is incorrect in the code sample

    relay1 === relay2 === relay3 is parsed as
    (relay1 === relay2) === relay3, i.e. boolean === Relay, which is never true.
    Use logical AND instead to demonstrate equality of all three instances:

    -console.log(relay1 === relay2 === relay3); // true
    +console.log(relay1 === relay2 && relay2 === relay3); // true

src/nip01/nostr.ts (1)

    235-239: Duplicate preprocessing – call normalizeRelayUrl() only once

    addRelay/getRelay/removeRelay first invoke preprocessRelayUrl() and then pass the result into normalizeRelayUrl(), but normalizeRelayUrl() itself never calls preprocessRelayUrl().
    This double work is harmless yet unnecessary and easy to forget when future callers use normalizeRelayUrl() directly.

    Two alternatives:

    -    url = this.preprocessRelayUrl(url);
    -    url = this.normalizeRelayUrl(url);
    +    url = this.normalizeRelayUrl(url);          // normalize handles preprocessing

    or move the preprocessRelayUrl() call inside normalizeRelayUrl() so the helper is truly self-contained.

src/nip01/event.ts (1)

    613-631: Trim relay URL before validating to avoid false negatives

    A relay URL inside a tag may legally include surrounding spaces (["p", "<pk>", " wss://relay.com  "]).
    isValidRelayUrl(relayUrl) fails for the untrimmed string even though the underlying URL is fine.

    -if (relayUrl.length > 0 && !isValidRelayUrl(relayUrl)) {
    +const cleaned = relayUrl.trim();
    +if (cleaned.length > 0 && !isValidRelayUrl(cleaned)) {

src/nip01/relayPool.ts (1)

    61-65: hasPort regex duplicated from Nostr – extract to shared util

    Both RelayPool and Nostr carry identical (and non-trivial) regular expressions for port detection. Divergence risk is high; consider a small shared helper in utils/url.ts and import it in both places.

tests/nip44/nip44-format-validation.test.ts (2)

    12-15: Duplicate assertion adds no extra coverage

    Lines 12-15 repeat the exact same test vector already asserted on lines 8-10.
    Removing the duplicate keeps the test focused and marginally speeds up the suite.

    160-169: Edge-case loop doesn’t assert behaviour

    The loop merely checks typeof result === "boolean", which can never fail because the function always returns a boolean.
    Consider asserting a concrete outcome (false is expected for the 66-char prefixed keys) or drop the loop to avoid meaningless coverage.

examples/nip01/relay-pool-url-normalization-example.ts (1)

    64-70: Unsafe cast of null | undefined to string

    pool.addRelay(input as string) compiles, but at runtime null or undefined will be passed straight through to the method and trigger an exception unrelated to URL validation logic.
    Prefer an explicit runtime guard:

    -invalidInputs.forEach(input => {
    -  try {
    -    pool.addRelay(input as string);
    +invalidInputs.forEach(input => {
    +  if (typeof input !== "string") {
    +    console.log(`→ ${JSON.stringify(input)}: REJECTED - Invalid relay URL`);
    +    return;
    +  }
    +  try {
    +    pool.addRelay(input);

docs/url-preprocessing-fix.md (2)

    5-5: Nit – convert bare URL to markdown link

    Static analysis flagged MD034. Wrap the URL in <> or use [text](url) to silence the linter.
    🧰 Tools


    111-113: Add language identifier to fenced block

    MD040 warning – specify text (or another suitable language) after the triple back-ticks.
    🧰 Tools


src/nip44/index.ts (3)

    175-206: Avoid recomputing the field prime on every call

    isValidPublicKeyFormat re-creates a BigInt for the field prime each invocation, adding unnecessary allocations.
    Hoist it once at module scope:

    -  // secp256k1 field prime: FFFFFFFFFF…FC2F
    -  // Any value >= field prime is invalid as an x-coordinate
    -  try {
    -    const keyValue = BigInt("0x" + publicKey);
    -    const fieldPrime = BigInt("0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f");
    -    if (keyValue >= fieldPrime) {
    +const FIELD_PRIME = BigInt(
    +  "0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2f",
    +);
    +…
    +  const keyValue = BigInt("0x" + publicKey);
    +  if (keyValue >= FIELD_PRIME) {
           return false;
         }
    -  } catch {
    -    // If BigInt conversion fails, it's not a valid hex string anyway
    -    return false;
    -  }
    +} catch {
    +  return false;
     }

216-241: Nested try/catch blocks are noisy – collapse into a loop

The double-nesting makes control flow hard to read. A small loop removes duplication and keeps the same behaviour:

-export function isValidPublicKeyPoint(publicKey: string): boolean {
-  if (!isValidPublicKeyFormat(publicKey)) return false;
-  try {
-    // Try with '02' prefix
-    try {
-      secp256k1.ProjectivePoint.fromHex("02" + publicKey);
-      return true;
-    } catch {
-      // Try with '03' prefix
-      try {
-        secp256k1.ProjectivePoint.fromHex("03" + publicKey);
-        return true;
-      } catch {
-        return false;
-      }
-    }
-  } catch {
-    return false;
-  }
+export function isValidPublicKeyPoint(publicKey: string): boolean {
+  if (!isValidPublicKeyFormat(publicKey)) return false;
+
+  for (const prefix of ["02", "03"]) {
+    try {
+      secp256k1.ProjectivePoint.fromHex(prefix + publicKey);
+      return true;
+    } catch {
+      /* continue */
+    }
+  }
+  return false;
 }

    Cleaner control flow and one less level of indentation.

    300-303: Error message now misleading

    After switching to isValidPublicKeyPoint, the message “Invalid public key format” no longer reflects the stricter cryptographic check.
    Recommend wording like Invalid public key (format or not on curve) to help callers diagnose failures.

    Also applies to: 580-585, 846-849

tests/nip01/nostr/nostr.test.ts (1)

    56-56: Add test for schemeless URLs
    Consider adding a test where the input omits the wss:// scheme to verify that it’s automatically prefixed.

docs/nip46-connection-validation-fix.md (2)

    1-10: Minor formatting enhancement
    Recommend adding a brief bullet list of sections (Problem, Vulnerability, Solution, Testing, Impact) at the top for quicker navigation.

    41-51: Consider edge cases for port-containing connection strings
    The direct string-slice approach should handle inputs with ports or embedded credentials. Please verify this logic against such variants and include tests to cover them.
