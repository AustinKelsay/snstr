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
  
  if (!options.relay || typeof options.relay !== "string" || options.relay.trim() === "") {
    throw new Error("Valid relay URL is required");
  }
  
  // Validate relay URL format (basic WebSocket URL validation)
  if (!options.relay.startsWith("ws://") && !options.relay.startsWith("wss://")) {
    throw new Error("Relay URL must start with ws:// or wss://");
  }
  
  // Validate URL format more thoroughly
  try {
    new URL(options.relay);
  } catch {
    throw new Error("Relay URL must be a valid URL");
  }
  
  // Validate RTT values (must be non-negative numbers if provided)
  if (options.rttOpen !== undefined) {
    if (typeof options.rttOpen !== "number" || options.rttOpen < 0 || !isFinite(options.rttOpen)) {
      throw new Error("rttOpen must be a non-negative number");
    }
  }
  
  if (options.rttRead !== undefined) {
    if (typeof options.rttRead !== "number" || options.rttRead < 0 || !isFinite(options.rttRead)) {
      throw new Error("rttRead must be a non-negative number");
    }
  }
  
  if (options.rttWrite !== undefined) {
    if (typeof options.rttWrite !== "number" || options.rttWrite < 0 || !isFinite(options.rttWrite)) {
      throw new Error("rttWrite must be a non-negative number");
    }
  }
  
  // Validate array fields
  if (options.supportedNips !== undefined && !Array.isArray(options.supportedNips)) {
    throw new Error("supportedNips must be an array");
  }
  
  if (options.requirements !== undefined && !Array.isArray(options.requirements)) {
    throw new Error("requirements must be an array");
  }
  
  if (options.topics !== undefined && !Array.isArray(options.topics)) {
    throw new Error("topics must be an array");
  }
  
  if (options.kinds !== undefined && !Array.isArray(options.kinds)) {
    throw new Error("kinds must be an array");
  }
  
  if (options.additionalTags !== undefined && !Array.isArray(options.additionalTags)) {
    throw new Error("additionalTags must be an array");
  }
  
  // Validate geohash format if provided (basic validation)
  if (options.geohash !== undefined) {
    if (typeof options.geohash !== "string" || options.geohash.trim() === "") {
      throw new Error("geohash must be a non-empty string");
    }
    // Basic geohash validation (alphanumeric, reasonable length)
    if (!/^[0-9a-z]+$/i.test(options.geohash) || options.geohash.length > 12) {
      throw new Error("geohash must be alphanumeric and at most 12 characters");
    }
  }
  
  // Validate network if provided
  if (options.network !== undefined) {
    if (typeof options.network !== "string" || options.network.trim() === "") {
      throw new Error("network must be a non-empty string");
    }
  }
  
  // Validate relayType if provided
  if (options.relayType !== undefined) {
    if (typeof options.relayType !== "string" || options.relayType.trim() === "") {
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
        const parsed = parseInt(nip, 10);
        if (isNaN(parsed) || parsed < 0) {
          throw new Error("supportedNips must contain valid positive integers or integer strings");
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
        const parsed = parseInt(kind, 10);
        if (isNaN(parsed) || parsed < 0) {
          throw new Error("kinds must contain valid non-negative integers or integer strings");
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
  
  const tags: string[][] = [["d", options.relay]];

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
    supportedNips: [],
    requirements: [],
    topics: [],
    kinds: [],
  };

  for (const tag of event.tags) {
    // Skip invalid tags - must be array with at least 2 elements
    if (!Array.isArray(tag) || tag.length < 2) continue;
    
    switch (tag[0]) {
      case "d":
        data.relay = tag[1];
        break;
      case "n":
        data.network = tag[1];
        break;
      case "T":
        data.relayType = tag[1];
        break;
      case "N":
        data.supportedNips.push(tag[1]);
        break;
      case "R":
        data.requirements.push(tag[1]);
        break;
      case "t":
        data.topics.push(tag[1]);
        break;
      case "k":
        data.kinds.push(tag[1]);
        break;
      case "g":
        data.geohash = tag[1];
        break;
      case "rtt-open":
        // Parse integer with bounds checking
        if (tag[1] && !isNaN(parseInt(tag[1], 10))) {
          data.rttOpen = parseInt(tag[1], 10);
        }
        break;
      case "rtt-read":
        // Parse integer with bounds checking
        if (tag[1] && !isNaN(parseInt(tag[1], 10))) {
          data.rttRead = parseInt(tag[1], 10);
        }
        break;
      case "rtt-write":
        // Parse integer with bounds checking
        if (tag[1] && !isNaN(parseInt(tag[1], 10))) {
          data.rttWrite = parseInt(tag[1], 10);
        }
        break;
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
  
  if (typeof options.frequency !== "number" || options.frequency <= 0 || !isFinite(options.frequency) || !Number.isInteger(options.frequency)) {
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
      
      if (typeof timeout.value !== "number" || timeout.value <= 0 || !isFinite(timeout.value) || !Number.isInteger(timeout.value)) {
        throw new Error("timeout value must be a positive integer");
      }
      
      if (timeout.test !== undefined && (typeof timeout.test !== "string" || timeout.test.trim() === "")) {
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
  if (options.geohash !== undefined) {
    if (typeof options.geohash !== "string" || options.geohash.trim() === "") {
      throw new Error("geohash must be a non-empty string");
    }
    // Basic geohash validation (alphanumeric, reasonable length)
    if (!/^[0-9a-z]+$/i.test(options.geohash) || options.geohash.length > 12) {
      throw new Error("geohash must be alphanumeric and at most 12 characters");
    }
  }
  
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
    
    switch (tag[0]) {
      case "frequency":
        // Parse integer with bounds checking
        if (tag[1] && !isNaN(parseInt(tag[1], 10))) {
          data.frequency = parseInt(tag[1], 10);
        }
        break;
      case "timeout":
        // Parse timeout with bounds checking - requires at least tag[1]
        if (tag[1] && !isNaN(parseInt(tag[1], 10))) {
          data.timeouts.push({
            value: parseInt(tag[1], 10),
            test: tag.length > 2 ? tag[2] : undefined, // Check if tag[2] exists
          });
        }
        break;
      case "c":
        data.checks.push(tag[1]);
        break;
      case "g":
        data.geohash = tag[1];
        break;
    }
  }

  data.content = event.content || "";
  return data;
}

export default {
  RELAY_DISCOVERY_KIND,
  RELAY_MONITOR_KIND,
  createRelayDiscoveryEvent,
  parseRelayDiscoveryEvent,
  createRelayMonitorAnnouncement,
  parseRelayMonitorAnnouncement,
};
