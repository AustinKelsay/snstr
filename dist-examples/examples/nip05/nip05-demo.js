"use strict";
/**
 * NIP-05 Demonstration
 *
 * This example shows how to use the NIP-05 functionality to:
 * 1. Verify a NIP-05 identifier against a pubkey
 * 2. Lookup a NIP-05 identifier to find the associated pubkey
 * 3. Get recommended relays for a user
 */
Object.defineProperty(exports, "__esModule", { value: true });
const nip05_1 = require("../../src/nip05");
// Enable verbose logging if environment variable is set
const verbose = process.env.VERBOSE === 'true';
/**
 * Log function that only prints if verbose mode is enabled
 */
function log(...args) {
    if (verbose) {
        console.log(...args);
    }
}
async function main() {
    // Example NIP-05 identifiers to test with
    // Replace these with real identifiers you want to test
    const identifiers = [
        'bob@example.com', // Sample from NIP-05 (won't work)
        '_@example.com', // Root identifier (won't work)
        'jack@cash.app', // Real example
        'jack@damus.io', // Real example
    ];
    console.log('===== NIP-05 DEMO =====\n');
    for (const identifier of identifiers) {
        console.log(`\n----- Testing identifier: ${identifier} -----`);
        try {
            // 1. Lookup the NIP-05 record
            console.log(`Looking up ${identifier}...`);
            const result = await (0, nip05_1.lookupNIP05)(identifier);
            if (result) {
                const [name] = identifier.split('@');
                console.log(`Found NIP-05 record for ${identifier}`);
                if (result.names && result.names[name]) {
                    console.log(`Public key: ${result.names[name]}`);
                    // 2. Get recommended relays
                    const relays = await (0, nip05_1.getRelaysFromNIP05)(identifier);
                    if (relays && relays.length > 0) {
                        console.log('Recommended relays:');
                        relays.forEach(relay => console.log(`  - ${relay}`));
                    }
                    else {
                        console.log('No recommended relays found');
                    }
                    // 3. Verify a pubkey (using the one we just found)
                    const pubkey = result.names[name];
                    const isValid = await (0, nip05_1.verifyNIP05)(identifier, pubkey);
                    console.log(`Verification with correct pubkey: ${isValid ? 'VALID ✅' : 'INVALID ❌'}`);
                    // 4. Try verification with an incorrect pubkey
                    const wrongPubkey = 'e8b487c079b0f67c695ae6c4c2552a47c79e3b42c104952a214c6eb16cc30d10';
                    const isInvalid = await (0, nip05_1.verifyNIP05)(identifier, wrongPubkey);
                    console.log(`Verification with incorrect pubkey: ${isInvalid ? 'VALID ✅' : 'INVALID ❌'}`);
                }
                else {
                    console.log(`No name ${name} found in the response`);
                }
            }
            else {
                console.log(`Failed to find NIP-05 record for ${identifier}`);
            }
        }
        catch (error) {
            console.error(`Error processing ${identifier}:`, error);
        }
    }
    console.log('\n===== NIP-05 DEMO COMPLETE =====');
}
main().catch(error => {
    console.error('ERROR:', error);
    process.exit(1);
});
