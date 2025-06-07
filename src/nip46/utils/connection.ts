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

/**
 * Parse a bunker or nostrconnect connection string.
 */
export function parseConnectionString(str: string): NIP46ConnectionInfo {
  if (!str.startsWith("bunker://") && !str.startsWith("nostrconnect://")) {
    throw new NIP46ConnectionError(
      "Invalid connection string format. Must start with bunker:// or nostrconnect://",
    );
  }

  try {
    const url = new URL(str);
    const type = url.protocol === "bunker:" ? "bunker" : "nostrconnect";
    const pubkey = url.hostname;

    if (!pubkey || pubkey.length !== 64) {
      throw new NIP46ConnectionError(
        "Invalid signer public key in connection string",
      );
    }

    const relays = url.searchParams.getAll("relay");
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

