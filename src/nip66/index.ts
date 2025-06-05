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
