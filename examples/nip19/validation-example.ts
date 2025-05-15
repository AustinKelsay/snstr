/**
 * NIP-19 Validation and Error Handling Examples
 *
 * This file demonstrates validation and error handling for NIP-19 entities,
 * covering common issues developers might encounter and security protections implemented.
 */

import {
  encodePublicKey,
  encodePrivateKey,
  encodeNoteId,
  encodeProfile,
  encodeEvent,
  encodeAddress,
  decode,
  decodeEvent,
  decodeProfile,
  Bech32String,
  AddressData
} from "../../src/nip19";

/**
 * Demonstrates hex string validation
 */
function demonstrateHexValidation() {
  console.log("=== Hex String Validation ===");

  const validHex =
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d";
  const invalidHexCases = [
    {
      name: "Wrong length",
      value: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa45",
    },
    {
      name: "Non-hex characters",
      value: "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459z",
    },
    { name: "Empty string", value: "" },
    { name: "Not a string", value: 12345 },
  ];

  // Valid case
  try {
    const npub = encodePublicKey(validHex);
    console.log(
      `✅ Successfully encoded valid hex: ${npub.substring(0, 20)}...`,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Unexpected error with valid hex: ${errorMessage}`);
  }

  // Invalid cases
  console.log("\nInvalid hex cases:");
  invalidHexCases.forEach(({ name, value }: { name: string; value: string | number }) => {
    try {
      encodePublicKey(value as string);
      console.error(`❌ Should have failed but passed: ${name}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates relay URL validation
 */
function demonstrateRelayValidation() {
  console.log("\n=== Relay URL Validation ===");

  const validRelays = ["wss://relay.nostr.info", "wss://relay.damus.io"];

  const invalidRelays = [
    { name: "Invalid protocol", relays: ["http://relay.nostr.info"] },
    { name: "Missing protocol", relays: ["relay.nostr.info"] },
    { name: "Invalid characters", relays: ["wss://relay.with spaces.com"] },
    { name: "Empty URL", relays: [""] },
    { name: "XSS attempt", relays: ["wss://<script>alert(1)</script>.com"] },
    { name: "JavaScript protocol", relays: ["javascript:alert(1)"] },
    { name: "Protocol-relative URL", relays: ["//relay.example.com"] },
  ];

  // Valid case
  try {
    const nprofile = encodeProfile({
      pubkey:
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
      relays: validRelays,
    });
    console.log(
      `✅ Successfully encoded with valid relays: ${nprofile.substring(0, 20)}...`,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Unexpected error with valid relays: ${errorMessage}`);
  }

  // Invalid cases
  console.log("\nInvalid relay cases:");
  invalidRelays.forEach(
    ({ name, relays }: { name: string; relays: string[] }) => {
      try {
        encodeProfile({
          pubkey:
            "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
          relays: relays,
        });
        console.error(`❌ Should have failed but passed: ${name}`);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.log(`✅ ${name}: ${errorMessage}`);
      }
    },
  );

  console.log(
    "\nImportant: Relay URL validation occurs only during encoding. During decoding, invalid relay URLs are accepted but generate warnings.",
  );
  console.log(
    "⚠️ SECURITY CONCERN: decodeProfile only warns about invalid URLs but still includes them",
  );
  console.log(
    "⚠️ Recommendation: You should filter out invalid relay URLs after decoding",
  );

  // Demonstrate how to filter invalid URLs after decoding
  console.log("\nExample of how to filter invalid URLs after decoding:");
  console.log(`
  // Filter invalid URLs from decoded profile
  function filterInvalidRelays(profile) {
    if (!profile.relays || profile.relays.length === 0) return profile;
    
    // Define a function to validate URLs (same as used in the library)
    function isValidRelayUrl(url) {
      try {
        if (!url.startsWith('wss://') && !url.startsWith('ws://')) return false;
        const parsedUrl = new URL(url);
        if (parsedUrl.username || parsedUrl.password) return false;
        return true;
      } catch (error) {
        return false;
      }
    }
    
    // Create a safe copy with only valid relay URLs
    return {
      ...profile,
      relays: profile.relays.filter(url => isValidRelayUrl(url))
    };
  }
  
  // Usage:
  const decodedProfile = decodeProfile(nprofileString);
  const safeProfile = filterInvalidRelays(decodedProfile);
  `);
}

/**
 * Demonstrates required field validation
 */
function demonstrateRequiredFields() {
  console.log("\n=== Required Fields Validation ===");

  // naddr requires specific fields
  const requiredFieldCases = [
    { name: "Missing pubkey", data: { kind: 30023, identifier: "test" } },
    {
      name: "Missing kind",
      data: {
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        identifier: "test",
      },
    },
    {
      name: "Missing identifier",
      data: {
        pubkey:
          "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        kind: 30023,
      },
    },
  ];

  // Valid case
  try {
    const naddr = encodeAddress({
      pubkey:
        "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
      kind: 30023,
      identifier: "test-article",
    });
    console.log(
      `✅ Successfully encoded with all required fields: ${naddr.substring(0, 20)}...`,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Unexpected error with valid fields: ${errorMessage}`);
  }

  // Invalid cases
  console.log("\nMissing required field cases:");
  requiredFieldCases.forEach(({ name, data }: { name: string; data: Partial<AddressData> }) => {
    try {
      encodeAddress(data as AddressData);
      console.error(`❌ Should have failed but passed: ${name}`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`✅ ${name}: ${errorMessage}`);
    }
  });
}

/**
 * Demonstrates size limit validation
 */
function demonstrateSizeLimits() {
  console.log("\n=== Size Limit Validation ===");

  // Generate many relays (exceeding MAX_TLV_ENTRIES limit of 20)
  const tooManyRelays = Array(21)
    .fill(0)
    .map((_, i) => `wss://relay${i}.example.com`);

  // Very long relay URL (exceeding MAX_RELAY_URL_LENGTH limit of 512)
  const veryLongRelayUrl = "wss://" + "a".repeat(510) + ".example.com";

  // Very long identifier (exceeding MAX_IDENTIFIER_LENGTH limit of 1024)
  const veryLongIdentifier = "a".repeat(1100);

  const sizeLimitCases = [
    {
      name: "Too many relays (> 20)",
      test: () => {
        return encodeProfile({
          pubkey:
            "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
          relays: tooManyRelays,
        });
      },
    },
    {
      name: "Very long relay URL (> 512 characters)",
      test: () => {
        return encodeEvent({
          id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
          relays: [veryLongRelayUrl],
        });
      },
    },
    {
      name: "Very long identifier (> 1024 characters)",
      test: () => {
        return encodeAddress({
          pubkey:
            "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
          kind: 30023,
          identifier: veryLongIdentifier,
        });
      },
    },
  ];

  // Test size limits
  console.log("Size limit cases (all should fail with appropriate errors):");
  sizeLimitCases.forEach(
    ({ name, test }: { name: string; test: () => string }) => {
      try {
        test(); 
        console.error(`❌ Should have failed but passed: ${name}`);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.log(`✅ ${name}: ${errorMessage}`);
      }
    },
  );

  console.log("\nThe library enforces these limits for security:");
  console.log("- Maximum of 20 TLV entries (prevent DoS)");
  console.log("- Maximum relay URL length of 512 characters");
  console.log("- Maximum identifier length of 1024 characters");
  console.log("- Default bech32 data limit of 5000 bytes");
}

/**
 * Demonstrates TLV entry limit during decoding
 */
function demonstrateTLVEntryLimits() {
  console.log("\n=== TLV Entry Limits ===");

  // Valid number of relays (maximum 20)
  const exactlyMaxRelays = Array(20)
    .fill(0)
    .map((_, i) => `wss://relay${i}.example.com`);

  try {
    const event = encodeEvent({
      id: "5c04292b1080052d593c561c62a92f1cfda739cc14e9e8c26765165ee3a29b7d",
      relays: exactlyMaxRelays,
    });
    console.log(
      `✅ Successfully encoded with exactly 20 relays (maximum allowed)`,
    );

    // Now decode it
    const decoded = decodeEvent(event);
    console.log(
      `✅ Successfully decoded with ${decoded.relays?.length} relays`,
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Unexpected error with maximum relays: ${errorMessage}`);
  }

  console.log(
    "\nThe TLV entry limit protects against denial of service attacks by:",
  );
  console.log("- Limiting the number of entries in the TLV data");
  console.log("- Preventing resource exhaustion when processing large inputs");
  console.log("- Enforcing reasonable size constraints for encoded entities");
  console.log(
    "- MAX_TLV_ENTRIES has been reduced from 100 to 20 for better security",
  );
}

/**
 * Demonstrates handling of incorrect prefix
 */
function demonstrateIncorrectPrefix() {
  console.log("\n=== Incorrect Prefix Handling ===");

  // Create valid encodings
  const npub = encodePublicKey(
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
  );
  const note = encodeNoteId(
    "6e9612d017c3b507a33bfbed9d17ac9f2a65c38abf0cf2b3234a9ff2c48c2d7c",
  );

  // Try using wrong-type-specific functions
  console.log("Using type-specific decode with wrong type:");

  try {
    encodePrivateKey(npub);
    console.error(
      "❌ Should have failed but passed: Trying to encode npub as private key",
    );
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`✅ Incorrect usage caught: ${errorMessage}`);
  }

  // Generic decode handles all prefixes correctly
  console.log("\nUsing generic decode with different prefixes:");
  try {
    const decodedNpub = decode(npub);
    console.log(`✅ Generic decode correctly identified: ${decodedNpub.type}`);

    const decodedNote = decode(note);
    console.log(`✅ Generic decode correctly identified: ${decodedNote.type}`);
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`❌ Generic decode failed: ${errorMessage}`);
  }
}

/**
 * Demonstrates graceful error handling
 */
function demonstrateGracefulErrorHandling() {
  console.log("\n=== Graceful Error Handling ===");

  console.log("Example error handler for user input:");

  function safeEncode(input: string, type: string) {
    try {
      let encoded = "";

      switch (type) {
        case "npub":
          encoded = encodePublicKey(input);
          break;
        case "note":
          encoded = encodeNoteId(input);
          break;
        default:
          throw new Error(`Unsupported type: ${type}`);
      }

      return { success: true, result: encoded, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, result: null, error: errorMessage };
    }
  }

  // Valid input
  const validResult = safeEncode(
    "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
    "npub",
  );
  console.log(`Valid input: ${JSON.stringify(validResult)}`);

  // Invalid input
  const invalidResult = safeEncode("not-a-hex-string", "npub");
  console.log(`Invalid input: ${JSON.stringify(invalidResult)}`);

  console.log(
    "\nExample of safely handling decoded profiles with potentially invalid URLs:",
  );

  function _safeDecodeProfile(nprofileStr: Bech32String) {
    try {
      // Step 1: Decode the profile
      const decodedProfile = decodeProfile(nprofileStr);

      // Step 2: Filter out invalid relay URLs
      const validateRelayUrl = (url: string): boolean => {
        try {
          if (!url.startsWith("wss://") && !url.startsWith("ws://"))
            return false;
          const parsedUrl = new URL(url);
          if (parsedUrl.username || parsedUrl.password) return false;
          return true;
        } catch (error) {
          return false;
        }
      };

      const safeProfile = {
        ...decodedProfile,
        relays: decodedProfile.relays
          ? decodedProfile.relays.filter(validateRelayUrl)
          : [],
      };

      // Step 3: Return safe result
      return { success: true, result: safeProfile, error: null };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, result: null, error: errorMessage };
    }
  }

  console.log(`
  // Example usage of safeDecodeProfile:
  const decodedProfile = safeDecodeProfile(nprofileString);
  
  if (decodedProfile.success) {
    // Safe to use, all relays are valid
    const profile = decodedProfile.result;
    // Use profile...
  } else {
    // Handle error
    console.error(decodedProfile.error);
  }
  `);

  console.log("\nRecommended error handling approach:");
  console.log("1. Always use try/catch when encoding/decoding NIP-19 entities");
  console.log("2. Provide user-friendly error messages");
  console.log("3. Return structured responses with success/error status");
  console.log("4. Validate inputs before encoding");
  console.log(
    "5. Be permissive during decoding but validate before acting on decoded data",
  );
  console.log("6. Always filter out invalid relay URLs after decoding");
}

/**
 * Demonstrates security best practices
 */
function demonstrateSecurityBestPractices() {
  console.log("\n=== Security Best Practices ===");

  console.log("To ensure secure use of NIP-19 entities:");
  console.log(
    "1. Always validate relay URLs before encoding (especially when from user input)",
  );
  console.log("2. Respect size limits to prevent memory issues or DoS attacks");
  console.log(
    "3. Be aware that decoded entities might contain invalid relay URLs",
  );
  console.log(
    "4. Add additional validation for decoded entities in security-sensitive contexts",
  );
  console.log(
    "5. Use type-specific encode/decode functions when the entity type is known",
  );
  console.log(
    "6. Treat private keys (nsec) with appropriate security precautions",
  );
  console.log(
    "7. Always filter invalid relay URLs from decoded entities before using them",
  );

  console.log("\nLibrary security features:");
  console.log("- Strict validation during encoding");
  console.log("- Enforced size limits (relay URLs, identifiers, TLV entries)");
  console.log(
    "- Protection against malformed relay URLs and potential injection attacks",
  );
  console.log("- Clear error messages for debugging and troubleshooting");
  console.log("- MAX_TLV_ENTRIES reduced from 100 to 20 for better security");
}

/**
 * Runs all validation examples
 */
function runValidationExamples() {
  console.log("NIP-19 VALIDATION AND ERROR HANDLING EXAMPLES\n");
  console.log(
    "This example demonstrates validation, security features, and error handling in the NIP-19 implementation.",
  );

  demonstrateHexValidation();
  demonstrateRelayValidation();
  demonstrateRequiredFields();
  demonstrateSizeLimits();
  demonstrateTLVEntryLimits();
  demonstrateIncorrectPrefix();
  demonstrateGracefulErrorHandling();
  demonstrateSecurityBestPractices();

  console.log("\n=== End of Validation Examples ===");
}

// Run the examples
runValidationExamples();
