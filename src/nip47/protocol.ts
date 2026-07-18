import {
  NIP47ConnectionOptions,
  NIP47Method,
  NIP47Request,
  NIP47Response,
} from "./types";

export function parseNWCURL(url: string): NIP47ConnectionOptions {
  if (!url.startsWith("nostr+walletconnect://")) {
    throw new Error("Invalid NWC URL format");
  }

  let parsed: URL;
  try {
    parsed = new URL(
      url.replace("nostr+walletconnect://", "https://nwc.temp/"),
    );
  } catch {
    throw new Error("Invalid NWC URL format: malformed URL structure");
  }

  const pubkey = parsed.pathname.slice(1);
  if (!pubkey) throw new Error("Missing pubkey in NWC URL");
  const secret = parsed.searchParams.get("secret");
  if (!secret) throw new Error("Missing secret in NWC URL");
  const relays = parsed.searchParams.getAll("relay");
  if (relays.length === 0) {
    throw new Error("At least one relay must be specified");
  }

  return { pubkey, secret, relays };
}

export function generateNWCURL(options: NIP47ConnectionOptions): string {
  if (!options.pubkey) throw new Error("Missing pubkey in connection options");
  if (!options.secret) throw new Error("Missing secret in connection options");
  if (!options.relays || options.relays.length === 0) {
    throw new Error("At least one relay must be specified");
  }

  const params = new URLSearchParams();
  options.relays.forEach((relay) => params.append("relay", relay));
  params.append("secret", options.secret);
  return `nostr+walletconnect://${options.pubkey}?${params.toString()}`;
}

export function validateNIP47Response(
  response: unknown,
  invalid: (message: string) => Error,
): NIP47Response {
  if (!response || typeof response !== "object") {
    throw invalid("Invalid response: not an object");
  }
  const value = response as Record<string, unknown>;
  if (!value.result_type || typeof value.result_type !== "string") {
    throw invalid("Invalid response: missing or invalid result_type");
  }
  if (!Object.values(NIP47Method).includes(value.result_type as NIP47Method)) {
    throw invalid(
      `Invalid response: unknown result_type '${value.result_type}'`,
    );
  }

  const hasError = "error" in value;
  const errorValue = hasError ? value.error : null;
  if (errorValue !== null) {
    if (!errorValue || typeof errorValue !== "object") {
      throw invalid("Invalid response: error field must be an object or null");
    }
    const error = errorValue as Record<string, unknown>;
    if (!error.code || typeof error.code !== "string") {
      throw invalid("Invalid response: error must have a code field");
    }
    if (!error.message || typeof error.message !== "string") {
      throw invalid("Invalid response: error must have a message field");
    }
    if (value.result !== null) {
      throw invalid(
        "Invalid response: when error is present, result must be null",
      );
    }
  } else if (value.result === null || value.result === undefined) {
    throw invalid(
      "Invalid response: when error is null, result must be defined and not null",
    );
  }

  return hasError
    ? (response as NIP47Response)
    : ({
        ...(response as Omit<NIP47Response, "error">),
        error: null,
      } as NIP47Response);
}

export class NIP47RequestParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NIP47RequestParseError";
  }
}

export function parseNIP47Request(content: string): NIP47Request {
  let request: unknown;
  try {
    request = JSON.parse(content);
  } catch {
    throw new NIP47RequestParseError("Invalid request: malformed JSON");
  }
  if (!request || typeof request !== "object") {
    throw new NIP47RequestParseError("Invalid request: not an object");
  }
  const value = request as Record<string, unknown>;
  if (typeof value.method !== "string" || !value.method) {
    throw new NIP47RequestParseError(
      "Invalid request: missing or invalid method",
    );
  }
  if (
    !value.params ||
    typeof value.params !== "object" ||
    Array.isArray(value.params)
  ) {
    throw new NIP47RequestParseError(
      "Invalid request: missing or invalid params",
    );
  }
  return request as NIP47Request;
}

export function parseNIP47Response(
  content: string,
  invalid: (message: string) => Error,
): NIP47Response {
  try {
    return validateNIP47Response(JSON.parse(content), invalid);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw invalid("Invalid response: malformed JSON");
    }
    throw error;
  }
}
