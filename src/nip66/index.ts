/**
 * NIP-66: Relay Discovery and Liveness Monitoring
 *
 * Implements utilities for creating and parsing relay discovery events
 * (kind 30166) and relay monitor announcement events (kind 10166).
 *
 * @see https://github.com/nostr-protocol/nips/blob/master/66.md
 */

import { NostrEvent } from "../types/nostr";
import { UnsignedEvent } from "../nip01/event";
import { createEvent } from "../nip01/event";
import { isValidRelayUrl } from "../nip19";
import {
  normalizeRelayUrl as normalizeRelayUrlUtil,
  RelayUrlValidationError,
} from "../utils/relayUrl";
import {
  safeArrayAccess,
  SecurityValidationError,
} from "../utils/security-validator";

import {
  RelayDiscoveryEventOptions,
  ParsedRelayDiscoveryEvent,
  RelayMonitorAnnouncementOptions,
  ParsedRelayMonitorAnnouncement,
} from "./types";

export * from "./types";

/** Constant for relay discovery event kind */
export const RELAY_DISCOVERY_KIND = 30166;
/** Constant for monitor announcement kind */
export const RELAY_MONITOR_KIND = 10166;

/**
 * Validate geohash format if provided
 * @param geohash - The geohash string to validate (can be undefined)
 * @throws Error if geohash is invalid
 */
function validateGeohash(geohash: string | undefined): void {
  if (geohash !== undefined) {
    if (typeof geohash !== "string" || geohash.trim() === "") {
      throw new Error("geohash must be a non-empty string");
    }
    // Basic geohash validation (alphanumeric, reasonable length)
    if (!/^[0-9a-z]+$/i.test(geohash) || geohash.length > 12) {
      throw new Error("geohash must be alphanumeric and at most 12 characters");
    }
  }
}

/**
 * Canonicalize a relay URL using the shared utility for consistent formatting
 * This ensures consistent formatting and prevents duplicate entries due to case differences
 * @param url - The relay URL to canonicalize
 * @returns The canonicalized URL with lowercase scheme and host
 */
function canonicalizeRelayUrl(url: string): string {
  return normalizeRelayUrlUtil(url);
}

/**
 * Create a relay discovery event (kind 30166)
 */
export function createRelayDiscoveryEvent(
  options: RelayDiscoveryEventOptions,
  pubkey: string,
): UnsignedEvent {
  // Validate required fields
  if (!options) {
    throw new Error("Options object is required");
  }

  if (!pubkey || typeof pubkey !== "string" || pubkey.trim() === "") {
    throw new Error("Valid pubkey is required");
  }

  if (
    !options.relay ||
    typeof options.relay !== "string" ||
    options.relay.trim() === ""
  ) {
    throw new Error("Valid relay URL is required");
  }

  // Trim and canonicalize the relay URL to ensure consistent formatting
  const trimmedRelay = options.relay.trim();

  // Canonicalize the relay URL by lowercasing scheme and host
  // This prevents duplicate entries due to case differences (e.g., WSS://RELAY.COM vs wss://relay.com)
  let canonicalizedRelay: string;
  try {
    canonicalizedRelay = canonicalizeRelayUrl(trimmedRelay);
  } catch (error) {
    // If canonicalization fails, check error type instead of message content
    if (error instanceof RelayUrlValidationError) {
      // Re-throw specific validation errors to maintain descriptive error messages
      throw error;
    }
    // For other unexpected errors, throw consistent validation error
    throw new Error("Relay URL must start with ws:// or wss:// and be valid");
  }

  if (!isValidRelayUrl(canonicalizedRelay)) {
    throw new Error("Relay URL must start with ws:// or wss:// and be valid");
  }

  // Validate RTT values (must be non-negative numbers if provided)
  if (options.rttOpen !== undefined) {
    if (
      typeof options.rttOpen !== "number" ||
      options.rttOpen < 0 ||
      !isFinite(options.rttOpen)
    ) {
      throw new Error("rttOpen must be a non-negative number");
    }
  }

  if (options.rttRead !== undefined) {
    if (
      typeof options.rttRead !== "number" ||
      options.rttRead < 0 ||
      !isFinite(options.rttRead)
    ) {
      throw new Error("rttRead must be a non-negative number");
    }
  }

  if (options.rttWrite !== undefined) {
    if (
      typeof options.rttWrite !== "number" ||
      options.rttWrite < 0 ||
      !isFinite(options.rttWrite)
    ) {
      throw new Error("rttWrite must be a non-negative number");
    }
  }

  // Validate array fields
  if (
    options.supportedNips !== undefined &&
    !Array.isArray(options.supportedNips)
  ) {
    throw new Error("supportedNips must be an array");
  }

  if (
    options.requirements !== undefined &&
    !Array.isArray(options.requirements)
  ) {
    throw new Error("requirements must be an array");
  }

  if (options.topics !== undefined && !Array.isArray(options.topics)) {
    throw new Error("topics must be an array");
  }

  if (options.kinds !== undefined && !Array.isArray(options.kinds)) {
    throw new Error("kinds must be an array");
  }

  if (
    options.additionalTags !== undefined &&
    !Array.isArray(options.additionalTags)
  ) {
    throw new Error("additionalTags must be an array");
  }

  // Validate geohash format if provided
  validateGeohash(options.geohash);

  // Validate network if provided
  if (options.network !== undefined) {
    if (typeof options.network !== "string" || options.network.trim() === "") {
      throw new Error("network must be a non-empty string");
    }
  }

  // Validate relayType if provided
  if (options.relayType !== undefined) {
    if (
      typeof options.relayType !== "string" ||
      options.relayType.trim() === ""
    ) {
      throw new Error("relayType must be a non-empty string");
    }
  }

  // Validate supportedNips values
  if (options.supportedNips) {
    for (const nip of options.supportedNips) {
      if (typeof nip === "number") {
        if (!isFinite(nip) || nip < 0 || !Number.isInteger(nip)) {
          throw new Error("supportedNips must contain valid positive integers");
        }
      } else if (typeof nip === "string") {
        // Strict validation: ensure string contains only digits
        if (!/^\d+$/.test(nip)) {
          throw new Error(
            "supportedNips must contain valid positive integers or integer strings (digits only)",
          );
        }
        const parsed = Number(nip);
        if (parsed < 0) {
          throw new Error(
            "supportedNips must contain valid positive integers or integer strings",
          );
        }
      } else {
        throw new Error("supportedNips must contain numbers or strings");
      }
    }
  }

  // Validate kinds values
  if (options.kinds) {
    for (const kind of options.kinds) {
      if (typeof kind === "number") {
        if (!isFinite(kind) || kind < 0 || !Number.isInteger(kind)) {
          throw new Error("kinds must contain valid non-negative integers");
        }
      } else if (typeof kind === "string") {
        // Strict validation: ensure string contains only digits
        if (!/^\d+$/.test(kind)) {
          throw new Error(
            "kinds must contain valid non-negative integers or integer strings (digits only)",
          );
        }
        const parsed = Number(kind);
        if (parsed < 0) {
          throw new Error(
            "kinds must contain valid non-negative integers or integer strings",
          );
        }
      } else {
        throw new Error("kinds must contain numbers or strings");
      }
    }
  }

  // Validate string arrays
  if (options.requirements) {
    for (const req of options.requirements) {
      if (typeof req !== "string" || req.trim() === "") {
        throw new Error("requirements must contain non-empty strings");
      }
    }
  }

  if (options.topics) {
    for (const topic of options.topics) {
      if (typeof topic !== "string" || topic.trim() === "") {
        throw new Error("topics must contain non-empty strings");
      }
    }
  }

  // Validate additionalTags structure
  if (options.additionalTags) {
    for (const tag of options.additionalTags) {
      if (!Array.isArray(tag)) {
        throw new Error("additionalTags must be an array of string arrays");
      }
      for (const tagItem of tag) {
        if (typeof tagItem !== "string") {
          throw new Error("additionalTags must contain arrays of strings");
        }
      }
    }
  }

  const tags: string[][] = [["d", canonicalizedRelay]];

  if (options.network) tags.push(["n", options.network]);
  if (options.relayType) tags.push(["T", options.relayType]);
  if (options.supportedNips) {
    for (const nip of options.supportedNips) {
      tags.push(["N", nip.toString()]);
    }
  }
  if (options.requirements) {
    for (const req of options.requirements) {
      tags.push(["R", req]);
    }
  }
  if (options.topics) {
    for (const t of options.topics) {
      tags.push(["t", t]);
    }
  }
  if (options.kinds) {
    for (const k of options.kinds) {
      tags.push(["k", k.toString()]);
    }
  }
  if (options.geohash) tags.push(["g", options.geohash]);
  if (options.rttOpen !== undefined) {
    tags.push(["rtt-open", options.rttOpen.toString()]);
  }
  if (options.rttRead !== undefined) {
    tags.push(["rtt-read", options.rttRead.toString()]);
  }
  if (options.rttWrite !== undefined) {
    tags.push(["rtt-write", options.rttWrite.toString()]);
  }
  for (const extra of options.additionalTags || []) {
    tags.push(extra);
  }

  const content =
    typeof options.content === "object"
      ? JSON.stringify(options.content)
      : options.content || "{}";

  return createEvent({ kind: RELAY_DISCOVERY_KIND, content, tags }, pubkey);
}

/**
 * Parse a relay discovery event into a structured object
 */
export function parseRelayDiscoveryEvent(
  event: NostrEvent,
): ParsedRelayDiscoveryEvent | null {
  if (event.kind !== RELAY_DISCOVERY_KIND) return null;

  const data: ParsedRelayDiscoveryEvent = {
    relay: "",
    network: "",
    relayType: "",
    supportedNips: [],
    requirements: [],
    topics: [],
    kinds: [],
  };

  for (const tag of event.tags) {
    // Skip invalid tags - must be array with at least 2 elements
    if (!Array.isArray(tag) || tag.length < 2) continue;

    try {
      // Safe access to tag elements with bounds checking
      const tagName = safeArrayAccess(tag, 0);
      const tagValue = safeArrayAccess(tag, 1);

      if (typeof tagName !== "string" || typeof tagValue !== "string") {
        continue; // Skip malformed tags
      }

      switch (tagName) {
        case "d":
          data.relay = tagValue;
          break;
        case "n":
          data.network = tagValue;
          break;
        case "T":
          data.relayType = tagValue;
          break;
        case "N":
          data.supportedNips.push(tagValue);
          break;
        case "R":
          data.requirements.push(tagValue);
          break;
        case "t":
          data.topics.push(tagValue);
          break;
        case "k":
          data.kinds.push(tagValue);
          break;
        case "g":
          data.geohash = tagValue;
          break;
        case "rtt-open":
          // Strict validation: ensure tagValue contains only digits
          if (tagValue && /^\d+$/.test(tagValue)) {
            data.rttOpen = Number(tagValue);
          }
          break;
        case "rtt-read":
          // Strict validation: ensure tagValue contains only digits
          if (tagValue && /^\d+$/.test(tagValue)) {
            data.rttRead = Number(tagValue);
          }
          break;
        case "rtt-write":
          // Strict validation: ensure tagValue contains only digits
          if (tagValue && /^\d+$/.test(tagValue)) {
            data.rttWrite = Number(tagValue);
          }
          break;
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        // Log bounds checking error but continue processing
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `NIP-66: Bounds checking error in tag processing: ${error.message}`,
          );
        }
      }
    }
  }

  try {
    if (event.content) {
      data.content = JSON.parse(event.content);
    }
  } catch {
    data.content = event.content;
  }

  return data;
}

/**
 * Create a relay monitor announcement event (kind 10166)
 */
export function createRelayMonitorAnnouncement(
  options: RelayMonitorAnnouncementOptions,
  pubkey: string,
): UnsignedEvent {
  // Validate required fields
  if (!options) {
    throw new Error("Options object is required");
  }

  if (!pubkey || typeof pubkey !== "string" || pubkey.trim() === "") {
    throw new Error("Valid pubkey is required");
  }

  if (options.frequency === undefined || options.frequency === null) {
    throw new Error("frequency is required");
  }

  if (
    typeof options.frequency !== "number" ||
    options.frequency <= 0 ||
    !Number.isFinite(options.frequency) ||
    !Number.isInteger(options.frequency)
  ) {
    throw new Error("frequency must be a positive integer");
  }

  // Validate timeouts array if provided
  if (options.timeouts !== undefined) {
    if (!Array.isArray(options.timeouts)) {
      throw new Error("timeouts must be an array");
    }

    for (const timeout of options.timeouts) {
      if (!timeout || typeof timeout !== "object") {
        throw new Error("timeouts must contain timeout definition objects");
      }

      if (timeout.value === undefined || timeout.value === null) {
        throw new Error("timeout value is required");
      }

      if (
        typeof timeout.value !== "number" ||
        timeout.value <= 0 ||
        !Number.isFinite(timeout.value) ||
        !Number.isInteger(timeout.value)
      ) {
        throw new Error("timeout value must be a positive integer");
      }

      if (
        timeout.test !== undefined &&
        (typeof timeout.test !== "string" || timeout.test.trim() === "")
      ) {
        throw new Error("timeout test must be a non-empty string if provided");
      }
    }
  }

  // Validate checks array if provided
  if (options.checks !== undefined) {
    if (!Array.isArray(options.checks)) {
      throw new Error("checks must be an array");
    }

    for (const check of options.checks) {
      if (typeof check !== "string" || check.trim() === "") {
        throw new Error("checks must contain non-empty strings");
      }
    }
  }

  // Validate geohash format if provided
  validateGeohash(options.geohash);

  // Validate content if provided
  if (options.content !== undefined && typeof options.content !== "string") {
    throw new Error("content must be a string");
  }

  // Validate additionalTags structure
  if (options.additionalTags !== undefined) {
    if (!Array.isArray(options.additionalTags)) {
      throw new Error("additionalTags must be an array");
    }

    for (const tag of options.additionalTags) {
      if (!Array.isArray(tag)) {
        throw new Error("additionalTags must be an array of string arrays");
      }
      for (const tagItem of tag) {
        if (typeof tagItem !== "string") {
          throw new Error("additionalTags must contain arrays of strings");
        }
      }
    }
  }

  const tags: string[][] = [["frequency", options.frequency.toString()]];

  if (options.timeouts) {
    for (const t of options.timeouts) {
      const tag = ["timeout", t.value.toString()];
      if (t.test) tag.push(t.test);
      tags.push(tag);
    }
  }

  if (options.checks) {
    for (const c of options.checks) {
      tags.push(["c", c]);
    }
  }

  if (options.geohash) tags.push(["g", options.geohash]);
  for (const extra of options.additionalTags || []) {
    tags.push(extra);
  }

  const content = options.content || "";

  return createEvent({ kind: RELAY_MONITOR_KIND, content, tags }, pubkey);
}

/**
 * Parse a relay monitor announcement event
 */
export function parseRelayMonitorAnnouncement(
  event: NostrEvent,
): ParsedRelayMonitorAnnouncement | null {
  if (event.kind !== RELAY_MONITOR_KIND) return null;

  const data: ParsedRelayMonitorAnnouncement = {
    frequency: 0,
    timeouts: [],
    checks: [],
  };

  for (const tag of event.tags) {
    // Skip invalid tags - must be array with at least 2 elements
    if (!Array.isArray(tag) || tag.length < 2) continue;

    try {
      // Safe access to tag elements with bounds checking
      const tagName = safeArrayAccess(tag, 0);
      const tagValue = safeArrayAccess(tag, 1);

      if (typeof tagName !== "string") {
        continue; // Skip malformed tags
      }

      switch (tagName) {
        case "frequency":
          // Enhanced frequency parsing with validation and error handling
          try {
            // Check if frequency value exists
            if (
              !tagValue ||
              (typeof tagValue === "string" && tagValue.trim() === "")
            ) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping frequency tag with missing or empty value: ${JSON.stringify(tag)}`,
                );
              }
              break;
            }

            // Convert to string for validation
            const tagValueStr = String(tagValue);
            
            // Parse the frequency value using parseInt (consistent with timeout parsing)
            const frequencyValue = parseInt(tagValueStr, 10);
            
            // Check if parsing resulted in a valid number
            if (isNaN(frequencyValue)) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping frequency tag with invalid numeric value: "${tagValue}"`,
                );
              }
              break;
            }

            // Define acceptable bounds for frequency values (in seconds)
            const MIN_FREQUENCY = 1; // 1 second minimum
            const MAX_FREQUENCY = 86400; // 24 hours maximum (86,400 seconds)

            // Check bounds
            if (
              frequencyValue < MIN_FREQUENCY ||
              frequencyValue > MAX_FREQUENCY
            ) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping frequency tag with value out of bounds (${MIN_FREQUENCY}-${MAX_FREQUENCY}s): ${frequencyValue}s`,
                );
              }
              break;
            }

            // All validation passed - set frequency
            data.frequency = frequencyValue;
          } catch (error) {
            // Handle any unexpected errors during parsing
            if (typeof console !== "undefined" && console.warn) {
              console.warn(
                `NIP-66: Error parsing frequency tag ${JSON.stringify(tag)}:`,
                error,
              );
            }
            // Continue processing other tags
          }
          break;
        case "timeout":
          // Enhanced timeout parsing with comprehensive validation and error handling
          try {
            // Check if timeout value exists
            if (
              !tagValue ||
              (typeof tagValue === "string" && tagValue.trim() === "")
            ) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping timeout tag with missing or empty value: ${JSON.stringify(tag)}`,
                );
              }
              break;
            }

            // Convert to string for validation
            const tagValueStr = String(tagValue);
            
            // Parse the timeout value using parseInt (like NIP-66 spec expects)
            // This will handle decimal numbers by truncating them
            const timeoutValue = parseInt(tagValueStr, 10);
            
            // Check if parsing resulted in a valid number
            if (isNaN(timeoutValue)) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping timeout tag with invalid numeric value: "${tagValue}"`,
                );
              }
              break;
            }

            // Define acceptable bounds for timeout values (in milliseconds)
            const MIN_TIMEOUT = 1; // 1ms minimum
            const MAX_TIMEOUT = 300000; // 5 minutes maximum (300,000ms)

            // Check bounds
            if (timeoutValue < MIN_TIMEOUT || timeoutValue > MAX_TIMEOUT) {
              if (typeof console !== "undefined" && console.warn) {
                console.warn(
                  `NIP-66: Skipping timeout tag with value out of bounds (${MIN_TIMEOUT}-${MAX_TIMEOUT}ms): ${timeoutValue}ms`,
                );
              }
              break;
            }

            // Validate test parameter if present - safe access to tag[2]
            let testParam: string | undefined = undefined;
            if (tag.length > 2) {
              const testValue = tag[2];
              if (typeof testValue === "string" && testValue.trim() !== "") {
                testParam = testValue;
              } else if (testValue !== undefined) {
                if (typeof console !== "undefined" && console.warn) {
                  console.warn(
                    `NIP-66: Skipping timeout tag with invalid test parameter: ${JSON.stringify(testValue)}`,
                  );
                }
                break;
              }
            }

            // All validation passed - add to timeouts
            data.timeouts.push({
              value: timeoutValue,
              test: testParam,
            });
          } catch (error) {
            // Handle any unexpected errors during parsing
            if (typeof console !== "undefined" && console.warn) {
              console.warn(
                `NIP-66: Error parsing timeout tag ${JSON.stringify(tag)}:`,
                error,
              );
            }
            // Continue processing other tags
          }
          break;
        case "c":
          if (typeof tagValue === "string") {
            data.checks.push(tagValue);
          }
          break;
        case "g":
          if (typeof tagValue === "string") {
            data.geohash = tagValue;
          }
          break;
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        // Log bounds checking error but continue processing
        if (typeof console !== "undefined" && console.warn) {
          console.warn(
            `NIP-66: Bounds checking error in tag processing: ${error.message}`,
          );
        }
      }
    }
  }

  data.content = event.content || "";
  return data;
}
