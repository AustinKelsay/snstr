/**
 * NIP-11 Relay Information Example
 *
 * This example shows how to fetch and use relay information documents.
 */

import {
  fetchRelayInformation,
  RelayInfo,
  supportsNIP11,
  relaySupportsNIPs,
  getRelayPaymentInfo,
  relayRequiresPayment,
} from "../../src/nip11";

// List of well-known relays to test
const relays = [
  "wss://relay.damus.io",
  "wss://nos.lol",
  "wss://relay.nostr.band",
  "wss://nostr.fmt.wiz.biz",
  "wss://relay.snort.social",
];

async function main() {
  console.log("Fetching relay information documents...\n");

  for (const relay of relays) {
    console.log(`Checking ${relay}...`);

    try {
      // First check if the relay supports NIP-11
      const supportsInfo = await supportsNIP11(relay);

      if (!supportsInfo) {
        console.log(`${relay} does not support NIP-11\n`);
        console.log("--------------------------------------------------");
        continue;
      }

      // Fetch detailed information (this will use cache from the previous call)
      const info = await fetchRelayInformation(relay);

      if (info) {
        printRelayInfo(relay, info);

        // Check for specific NIP support
        const supportsNIP1and4 = await relaySupportsNIPs(relay, [1, 4]);
        console.log(
          `Supports NIPs 1 and 4: ${supportsNIP1and4 ? "Yes" : "No"}`,
        );

        // Check for payment requirements
        const requiresPayment = await relayRequiresPayment(relay);
        console.log(`Requires payment: ${requiresPayment ? "Yes" : "No"}`);

        // Get payment info if available
        const paymentUrl = await getRelayPaymentInfo(relay);
        if (paymentUrl) {
          console.log(`Payment URL: ${paymentUrl}`);
        }
      }
    } catch (error) {
      console.error(`Error fetching info for ${relay}: ${error}`);
    }

    console.log("\n--------------------------------------------------");
  }

  // Example of fetching with options
  console.log("\nFetching with custom options:");
  try {
    const info = await fetchRelayInformation("wss://relay.damus.io", {
      useCache: false, // Bypass cache
      timeoutMs: 2000, // 2 second timeout
    });

    console.log(
      `Fetched fresh data from relay.damus.io: ${info ? "Success" : "Failed"}`,
    );
  } catch (error) {
    console.error(`Error with custom options: ${error}`);
  }
}

function printRelayInfo(url: string, info: RelayInfo) {
  console.log(`\nRelay: ${url}`);
  if (info.name) console.log(`Name: ${info.name}`);
  if (info.description) console.log(`Description: ${info.description}`);
  if (info.pubkey) console.log(`Operator pubkey: ${info.pubkey}`);
  if (info.contact) console.log(`Contact: ${info.contact}`);
  if (info.supported_nips && info.supported_nips.length > 0) {
    console.log(`Supported NIPs: ${info.supported_nips.join(", ")}`);
  }
  if (info.software) {
    let softwareInfo = info.software;
    if (info.version) softwareInfo += ` ${info.version}`;
    console.log(`Software: ${softwareInfo}`);
  }

  if (info.limitation) {
    console.log("\nLimitations:");
    if (info.limitation.max_message_length) {
      console.log(
        `  Max message length: ${info.limitation.max_message_length} bytes`,
      );
    }
    if (info.limitation.max_subscriptions) {
      console.log(`  Max subscriptions: ${info.limitation.max_subscriptions}`);
    }
    if (info.limitation.max_limit) {
      console.log(`  Max limit value: ${info.limitation.max_limit}`);
    }
    console.log(
      `  Payments required: ${info.limitation.payments_required ? "Yes" : "No"}`,
    );
    console.log(
      `  Auth required: ${info.limitation.auth_required ? "Yes" : "No"}`,
    );
  }

  if (info.fees) {
    console.log("\nFees:");

    if (info.fees.admission) {
      console.log("  Admission fees:");
      info.fees.admission.forEach((fee) => {
        console.log(
          `    ${fee.amount} ${fee.unit}${fee.period ? ` per ${fee.period}` : ""} - ${fee.description || ""}`,
        );
      });
    }

    if (info.fees.subscription) {
      console.log("  Subscription fees:");
      info.fees.subscription.forEach((fee) => {
        console.log(
          `    ${fee.amount} ${fee.unit}${fee.period ? ` per ${fee.period}` : ""} - ${fee.description || ""}`,
        );
      });
    }

    if (info.fees.publication) {
      console.log("  Publication fees:");
      info.fees.publication.forEach((fee) => {
        console.log(
          `    ${fee.amount} ${fee.unit}${fee.period ? ` per ${fee.period}` : ""} - ${fee.description || ""}`,
        );
      });
    }
  }

  console.log(""); // Add an empty line at the end
}

main().catch((error) => console.error("Error in main:", error));
