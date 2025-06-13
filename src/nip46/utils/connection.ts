export interface BuildConnectionStringOptions {
  pubkey: string;
  relays?: string[];
  secret?: string;
}

/**
 * Build a bunker connection string from parameters.
 */
export function buildConnectionString(options: BuildConnectionStringOptions): string {
  const params = new URLSearchParams();
  options.relays?.forEach((relay) => params.append("relay", relay));
  if (options.secret) {
    params.append("secret", options.secret);
  }
  return `bunker://${options.pubkey}?${params.toString()}`;
}

import { NIP46ConnectionError } from "../types";
import type { NIP46ConnectionInfo, NIP46Metadata } from "../types";
import { isValidPublicKeyFormat } from "../../nip44";
-import { isValidRelayUrl } from "../../nip19";
+import { isValidRelayUrl } from "../../utils/relayUrl";
/**
 * Parse a bunker or nostrconnect connection string.
 */
export function parseConnectionString(str: string): NIP46ConnectionInfo {
  if (!str.startsWith("bunker://") && !str.startsWith("nostrconnect://")) {
    throw new NIP46ConnectionError(
      "Invalid connection string format. Must start with bunker:// or nostrconnect://",
    );
  }

  // Determine connection type and extract pubkey first before URL parsing
  const type = str.startsWith("bunker://") ? "bunker" : "nostrconnect";
  const protocolPrefix = type === "bunker" ? "bunker://" : "nostrconnect://";
  const afterProtocol = str.slice(protocolPrefix.length);
  
  // Extract pubkey from original string to preserve case for validation
  // Match pattern: protocol://pubkey?params or protocol://pubkey#fragment or protocol://pubkey/path or protocol://pubkey
  // Find the earliest occurrence of '/', '?' (query), or '#' (fragment) to properly delimit the pubkey
  const pathStart = afterProtocol.indexOf("/");
  const queryStart = afterProtocol.indexOf("?");
  const fragmentStart = afterProtocol.indexOf("#");
  
  // Find the earliest delimiter (path, query, or fragment), or use the entire string if none exist
  const delimiters = [pathStart, queryStart, fragmentStart].filter(pos => pos !== -1);
  const delimiterStart = delimiters.length > 0 ? Math.min(...delimiters) : -1;
  
  const pubkey = delimiterStart === -1 ? afterProtocol : afterProtocol.slice(0, delimiterStart);

  // Validate pubkey before proceeding with URL parsing
  if (!isValidPublicKeyFormat(pubkey)) {
    throw new NIP46ConnectionError(
      "Invalid signer public key in connection string",
    );
  }

  try {
    const url = new URL(str);

    const relays = url
      .searchParams
      .getAll("relay")
      .filter(isValidRelayUrl);
    const secret = url.searchParams.get("secret") || undefined;
    const permissions = url.searchParams.get("perms")?.split(",");

    const metadata: NIP46Metadata = {};
    if (url.searchParams.has("name")) metadata.name = url.searchParams.get("name")!;
    if (url.searchParams.has("url")) metadata.url = url.searchParams.get("url")!;
    if (url.searchParams.has("image")) metadata.image = url.searchParams.get("image")!;

    return { type, pubkey, relays, secret, permissions, metadata };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new NIP46ConnectionError(`Failed to parse connection string: ${errorMessage}`);
  }
}

