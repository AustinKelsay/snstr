/**
 * NostrEvent interface representing a Nostr event as specified in NIP-01
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export interface NostrEvent {
  /** 32-bytes lowercase hex-encoded sha256 of the serialized event data */
  id: string;
  /** 32-bytes lowercase hex-encoded public key of the event creator */
  pubkey: string;
  /** UNIX timestamp in seconds */
  created_at: number;
  /** Integer identifier for the event type (0-65535) */
  kind: number;
  /** Array of tags. Each tag is an array of strings */
  tags: string[][];
  /** Arbitrary string (may be encrypted in some event kinds) */
  content: string;
  /** 64-bytes lowercase hex of the signature of the sha256 hash of the serialized event data */
  sig: string;
}

/**
 * Template for creating Nostr events
 */
export interface EventTemplate {
  /** Integer identifier for the event type (0-65535) */
  kind: number;
  /** Arbitrary string (may be encrypted in some event kinds) */
  content: string;
  /** Array of tags. Each tag is an array of strings */
  tags?: string[][];
  /** Optional UNIX timestamp in seconds (will be set automatically if not provided) */
  created_at?: number;
}

/**
 * Base Nostr filter for subscription requests as specified in NIP-01
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export type NostrFilter = {
  /** List of event ids to match */
  ids?: string[];
  /** List of pubkeys (event authors) to match */
  authors?: string[];
  /** List of event kinds to match */
  kinds?: number[];

  // Standard tag filters from NIP-01
  /** Filter by e tags (event references) */
  "#e"?: string[];
  /** Filter by p tags (pubkey references) */
  "#p"?: string[];
  /** Filter by a tags for addressable events (NIP-01) */
  "#a"?: string[];
  /** Filter by d tags (for replaceable events) */
  "#d"?: string[];
  /** Filter by t tags (topics) */
  "#t"?: string[];
  /** Filter by r tags (references) */
  "#r"?: string[];
  /** Filter by g tags (geohash) */
  "#g"?: string[];
  /** Filter by u tags (URLs) */
  "#u"?: string[];

  // Common extended tag filters
  /** Filter by c tags (content warning) */
  "#c"?: string[];
  /** Filter by l tags (language) */
  "#l"?: string[];
  /** Filter by m tags (MIME type) */
  "#m"?: string[];
  /** Filter by s tags (subject) */
  "#s"?: string[];

  // Time filters
  /** UNIX timestamp (seconds), events must be newer than this to match */
  since?: number;
  /** UNIX timestamp (seconds), events must be older than this to match */
  until?: number;
  /** Maximum number of events to return */
  limit?: number;
  /**
   * Full text search query string as defined in NIP-50.
   * Relays interpret this to return events matching the query.
   */
  search?: string;
};

/**
 * Extended filter type that allows for custom tag filters and arbitrary properties
 */
export type Filter = NostrFilter & {
  // Allow additional tag filters while maintaining type safety for the common ones
  /** Tag-filter keys like "#e", "#p", … */
  [K in `#${string}`]?: string[];
} & {
  /** Any other custom filter property */
  [key: string]: unknown;
};

/**
 * Subscription object representing an active subscription to a relay
 */
export type Subscription = {
  /** Unique subscription identifier */
  id: string;
  /** Array of filters applied to this subscription */
  filters: Filter[];
  /** Callback function that receives matching events */
  onEvent: (event: NostrEvent) => void;
  /** Optional callback function called when relay sends EOSE (End of Stored Events) */
  onEOSE?: () => void;
};

/**
 * Relay event types as specified in NIP-01
 */
export enum RelayEvent {
  /** Fired when a connection to a relay is established */
  Connect = "connect",
  /** Fired when a connection to a relay is closed */
  Disconnect = "disconnect",
  /** Fired when an error occurs */
  Error = "error",
  /** Fired when a relay sends a NOTICE message */
  Notice = "notice",
  /** Fired when a relay confirms an event was received (OK message) */
  OK = "ok",
  /** Fired when a relay closes a subscription */
  Closed = "closed",
  /** Fired when a relay sends an authentication challenge (NIP-42) */
  Auth = "auth",
}

/**
 * Type for relay event handler callbacks with proper typing for each event
 */
export type RelayEventCallbacks = {
  [RelayEvent.Connect]: (relay: string) => void;
  [RelayEvent.Disconnect]: (relay: string) => void;
  [RelayEvent.Error]: (relay: string, error: unknown) => void;
  [RelayEvent.Notice]: (relay: string, notice: string) => void;
  [RelayEvent.OK]: (
    eventId: string,
    success: boolean,
    details: ParsedOkReason,
  ) => void;
  [RelayEvent.Closed]: (subscriptionId: string, message: string) => void;
  [RelayEvent.Auth]: (challengeEvent: NostrEvent) => void;
};

/**
 * Type for relay event handlers with optional callbacks
 */
export type RelayEventHandler = {
  [K in keyof RelayEventCallbacks]?: RelayEventCallbacks[K][];
};

/**
 * Options for publishing events to relays
 */
export interface PublishOptions {
  /** Timeout in milliseconds before considering the publish operation failed */
  timeout?: number;
  /** Whether to wait for OK response from the relay before resolving */
  waitForAck?: boolean;
}

/**
 * Publish response returned by the relay after publishing an event
 */
export interface PublishResponse {
  /** Whether the publish operation was successful */
  success: boolean;
  /** Optional reason for failure if success is false */
  reason?: string;
  /** The relay URL the response came from (useful in multi-relay operations) */
  relay?: string;
  /** Parsed reason for failure if success is false */
  parsedReason?: ParsedOkReason;
}

/**
 * Options for subscribing to events
 */
export interface SubscriptionOptions {
  /** Whether to skip initial EOSE (End of Stored Events) */
  skipEose?: boolean;
  /** Timeout in milliseconds for EOSE (0 for no timeout) */
  eoseTimeout?: number;
  /** Whether this subscription should be ephemeral (not stored) */
  ephemeral?: boolean;
}

/**
 * Response from a subscription operation
 */
export interface SubscriptionResponse {
  /** Subscription ID */
  id: string;
  /** Whether the subscription was created successfully */
  success: boolean;
  /** Optional reason for failure */
  reason?: string;
  /** The relay the subscription was created on */
  relay: string;
}

/**
 * Relay status indicating the current connection state
 */
export enum RelayStatus {
  /** Not connected or disconnected */
  DISCONNECTED = "disconnected",
  /** Connection in progress */
  CONNECTING = "connecting",
  /** Successfully connected */
  CONNECTED = "connected",
  /** Waiting to reconnect after a disconnection */
  RECONNECTING = "reconnecting",
  /** Permanently closed (e.g., after calling disconnect) */
  CLOSED = "closed",
}

/**
 * NIP-01 defined event kinds with their semantic meanings
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export enum NostrKind {
  /** Metadata: Profile information (replaceable) */
  Metadata = 0,
  /** Short note: Standard text note */
  ShortNote = 1,
  /** Recommend relay: Relay recommendations (replaceable) */
  RecommendRelay = 2,
  /** Contacts: Follow list (replaceable) */
  Contacts = 3,
  /** Direct message: Encrypted direct message */
  DirectMessage = 4,
  /** Deletion: Event deletion request */
  Deletion = 5,
  /** Repost: Repost of another note */
  Repost = 6,
  /** Reaction: Reaction to another note */
  Reaction = 7,
  /** Badge award: Award badge to a user */
  BadgeAward = 8,
}

/**
 * Relay Information Document as defined in NIP-11
 * https://github.com/nostr-protocol/nips/blob/master/11.md
 */
export interface FeeSchedule {
  /** Amount in the smallest unit of currency */
  amount: number;
  /** The unit of currency (e.g., "msats" or "USD") */
  unit: string;
  /** The period if applicable (e.g., "day", "month") */
  period?: number;
  /** Human-readable description of the fee */
  description?: string;
}

export interface RelayFees {
  /** Fee for publishing an event */
  admission?: FeeSchedule[];
  /** Fee for subscription */
  subscription?: FeeSchedule[];
  /** Fee for publishing an event */
  publication?: FeeSchedule[];
}

export interface RelayLimitation {
  /** Maximum event size in bytes */
  max_message_length?: number;
  /** Maximum number of subscriptions per connection */
  max_subscriptions?: number;
  /** Maximum filter length */
  max_filters?: number;
  /** Maximum limit value filter */
  max_limit?: number;
  /** Maximum time range for queries in seconds */
  max_subid_length?: number;
  /** Minimum PoW difficulty (NIP-13) */
  min_pow_difficulty?: number;
  /** Whether to require payment for events */
  payments_required?: boolean;
  /** Whether to require auth for events */
  auth_required?: boolean;
  /** Whether to restrict reads to authenticated users */
  restricted_reads?: boolean;
  /** Whether to restrict writes to authenticated users */
  restricted_writes?: boolean;
  /** Maximum time allowed for an event (legacy field) */
  max_event_time?: number;
  /** Restricted to kind list */
  restricted_kinds?: number[];
  /** Creator-only kind list */
  creator_only_kinds?: number[];
}

export interface RelayInfo {
  /** The relay software name */
  name?: string;
  /** The relay description */
  description?: string;
  /** The operator's pubkey */
  pubkey?: string;
  /** The relay contact */
  contact?: string;
  /** Relay software information */
  software?: string;
  /** Relay software version */
  version?: string;
  /** List of NIP numbers supported by the relay */
  supported_nips?: number[];
  /** List of MIME types supported for the content field */
  supported_content_types?: string[];
  /** Server limitation details */
  limitation?: RelayLimitation;
  /** Payments information */
  payments_url?: string;
  /** Relay fees information */
  fees?: RelayFees;
  /** Relay icon */
  icon?: string;
  /** Alternative relay URLs */
  relay_countries?: string[];
  /** Language tags in BCP47 format */
  language_tags?: string[];
  /** Tags for categorization */
  tags?: string[];
  /** URL to the community/forum */
  posting_policy?: string;
  /** Relay retention policies */
  retention?: {
    [key: string]: {
      /** Time in seconds */
      time?: number;
      /** Number of events to keep */
      count?: number;
    };
  };
  /** Community moderation policy */
  moderation?: {
    /** Allow_list of pubkeys */
    allow_list?: string[];
    /** Block_list of pubkeys */
    block_list?: string[];
  };
}

/**
 * Backwards compatibility alias
 * @deprecated Use `RelayInfo` instead.
 */
export type RelayInformation = RelayInfo;

/**
 * Statistics about a relay connection
 */
export interface RelayStats {
  /** URL of the relay */
  url: string;
  /** Current connection status */
  status: RelayStatus;
  /** Total number of events received */
  eventsReceived: number;
  /** Total number of events published */
  eventsPublished: number;
  /** Number of successful publishes */
  publishSuccesses: number;
  /** Number of failed publishes */
  publishFailures: number;
  /** Connection attempts made */
  connectionAttempts: number;
  /** Last successful connection time */
  lastConnected?: Date;
  /** Last disconnection time */
  lastDisconnected?: Date;
  /** Number of active subscriptions */
  activeSubscriptions: number;
  /** Average latency in milliseconds */
  averageLatency?: number;
  /** Relay information document (if available) */
  info?: RelayInfo;
}

/**
 * Group of relays with specific purpose (read, write, fallback)
 */
export interface RelayGroup {
  /** Name of this relay group */
  name: string;
  /** Relays for reading events */
  read: string[];
  /** Relays for writing events */
  write: string[];
  /** Fallback relays (used if primary ones fail) */
  fallback?: string[];
  /** Whether to allow unlisted relays to be used */
  allowUnlisted?: boolean;
  /** Minimum number of relays needed for operations to succeed */
  minRequired?: number;
}

/**
 * WebSocket ready states
 */
export enum WebSocketReadyState {
  /** Connection has not yet been established */
  CONNECTING = 0,
  /** Connection is established and communication is possible */
  OPEN = 1,
  /** Connection is going through the closing handshake */
  CLOSING = 2,
  /** Connection has been closed or could not be opened */
  CLOSED = 3,
}

/**
 * Reconnection strategy configuration
 */
export interface ReconnectionStrategy {
  /** Whether to automatically reconnect */
  enabled: boolean;
  /** Maximum number of reconnection attempts (0 for unlimited) */
  maxAttempts: number;
  /** Initial delay before first reconnection attempt (ms) */
  initialDelay: number;
  /** Maximum delay between reconnection attempts (ms) */
  maxDelay: number;
  /** Factor by which to increase delay between attempts */
  backoffFactor: number;
  /** Whether to add random jitter to delay times */
  useJitter: boolean;
  /** Maximum jitter percentage (0-1) */
  jitterFactor: number;
  /** Custom function to calculate next delay */
  calculateDelay?: (
    attempt: number,
    initialDelay: number,
    maxDelay: number,
  ) => number;
}

/**
 * Relay capabilities representing what features a relay supports
 */
export interface RelayCapabilities {
  /** Supported NIPs */
  supportedNips: number[];
  /** Whether the relay supports filters with "search" field from NIP-50 */
  supportsSearch: boolean;
  /** Whether the relay supports author filtering with prefixes */
  supportsAuthorPrefixes: boolean;
  /** Whether the relay requires authentication (NIP-42) */
  requiresAuthentication: boolean;
  /** Whether the relay supports custom tag filters */
  supportsTagFilters: boolean;
  /** Whether the relay supports payment features */
  supportsPayments: boolean;
  /** Maximum content length supported */
  maxContentLength?: number;
  /** Maximum number of filters per subscription */
  maxFilters?: number;
  /** Maximum number of subscriptions per connection */
  maxSubscriptions?: number;
  /** Maximum limit value for events */
  maxLimit?: number;
  /** Ephemeral event support */
  supportsEphemeral: boolean;
}

/**
 * Options for metrics collection on relay performance
 */
export interface MetricsCollectorOptions {
  /** Whether to collect metrics */
  enabled: boolean;
  /** How often to collect metrics in milliseconds */
  sampleInterval: number;
  /** Maximum number of metrics samples to keep */
  maxSamples: number;
  /** Whether to track message statistics */
  trackMessages: boolean;
  /** Whether to track latency */
  trackLatency: boolean;
  /** Whether to track bandwidth usage */
  trackBandwidth: boolean;
  /** Custom metrics to collect */
  customMetrics?: {
    [key: string]: (relay: RelayInterface) => number | string | boolean | null;
  };
}

/**
 * Statistics for relay message processing
 */
export interface RelayMessageStats {
  /** Total messages sent */
  messagesSent: number;
  /** Total messages received */
  messagesReceived: number;
  /** Total bytes sent */
  bytesSent: number;
  /** Total bytes received */
  bytesReceived: number;
  /** Message counts by type (sent) */
  sentByType: {
    /** EVENT messages sent */
    EVENT: number;
    /** REQ messages sent */
    REQ: number;
    /** CLOSE messages sent */
    CLOSE: number;
  };
  /** Message counts by type (received) */
  receivedByType: {
    /** EVENT messages received */
    EVENT: number;
    /** EOSE messages received */
    EOSE: number;
    /** OK messages received */
    OK: number;
    /** NOTICE messages received */
    NOTICE: number;
    /** AUTH messages received */
    AUTH: number;
    /** CLOSED messages received */
    CLOSED: number;
  };
  /** Events rejected by validation */
  eventsRejected: number;
  /** Authentication attempts */
  authAttempts: number;
  /** Successful authentications */
  authSuccesses: number;
}

/**
 * Profile metadata structure for kind 0 events
 * https://github.com/nostr-protocol/nips/blob/master/01.md
 */
export interface ProfileMetadata {
  /** Display name or nickname of the user */
  name?: string;
  /** Short biography or about text */
  about?: string;
  /** URL to the user's profile picture */
  picture?: string;
  /** NIP-05 identifier (internet identifier for verification) */
  nip05?: string;
  /** URL to banner image */
  banner?: string;
  /** User's website URL */
  website?: string;
  /** Lightning payment address or LNURL */
  lud06?: string;
  /** Lightning Address (user@domain.com) */
  lud16?: string;
  /** Custom display name shown when reacting to a note */
  display_name?: string;
  /** User's username/handle */
  username?: string;
  /** User's display location */
  location?: string;
  /** A Bitcoin address in bech32 format */
  bitcoin?: string;
  /** LNURL */
  lnurl?: string;
  /** Price feeds for showing NIP-15 badges or service price */
  nip15?: string;
  /** Mastodon address for federation */
  mastodon?: string;
  /** Nonce used for proof of work */
  nonce?: string;
  /** Allow additional custom metadata fields */
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Debug options for relay operation
 */
export interface RelayDebugOptions {
  /** Whether to log verbose messages */
  verbose: boolean;
  /** Whether to log connection events */
  logConnections: boolean;
  /** Whether to log subscription events */
  logSubscriptions: boolean;
  /** Whether to log events */
  logEvents: boolean;
  /** Whether to log all messages */
  logMessages: boolean;
  /** Whether to log validation failures */
  logValidationFailures: boolean;
  /** Custom log handler */
  logHandler?: (level: string, message: string, data?: unknown) => void;
  /** Whether to track error statistics */
  trackErrors: boolean;
  /** Whether to record message history */
  recordMessageHistory: boolean;
  /** Maximum message history to keep */
  maxMessageHistory: number;
}

/**
 * Test context for relay testing
 */
export interface RelayTestContext {
  /** The relay instance being tested */
  relay: RelayInterface;
  /** Original methods/properties that were mocked during testing */
  originals: {
    /** Original WebSocket instance */
    ws?: WebSocket | null;
    /** Original on method for event handlers */
    on?: <E extends RelayEvent>(
      event: E,
      callback: RelayEventCallbacks[E],
    ) => void;
    /** Original off method for event handlers */
    off?: <E extends RelayEvent>(
      event: E,
      callback: RelayEventCallbacks[E],
    ) => void;
  };
  /** Mock functions used during testing */
  mocks: {
    /** Mock WebSocket send function */
    send?: jest.Mock;
    /** Mock connect function */
    connect?: jest.Mock;
    /** Mock disconnect function */
    disconnect?: jest.Mock;
    /** Mock event handlers by event type */
    handlers?: {
      [key in RelayEvent]?: jest.Mock;
    };
  };
  /** Captured callbacks from event registrations */
  capturedCallbacks: {
    /** Callbacks for ok events */
    ok?: RelayEventCallbacks[RelayEvent.OK][];
    /** Callbacks for other event types */
    [key: string]: RelayEventCallbacks[keyof RelayEventCallbacks][] | undefined;
  };
  /** Options passed to the relay */
  options?: {
    /** Connection timeout in milliseconds */
    connectionTimeout?: number;
    /** Delay between buffering events and processing them (ms) */
    bufferFlushDelay?: number;
    /** Whether to automatically reconnect on disconnection */
    autoReconnect?: boolean;
    /** Maximum number of reconnection attempts (0 for unlimited) */
    maxReconnectAttempts?: number;
    /** Maximum delay between reconnection attempts (ms) */
    maxReconnectDelay?: number;
  };
}

/**
 * Enum for standard relay error types
 */
export enum RelayErrorType {
  /** Connection error when attempting to connect to relay */
  CONNECTION_ERROR = "connection_error",
  /** Timeout occurred during a relay operation */
  TIMEOUT = "timeout",
  /** Connection was lost or closed during an operation */
  DISCONNECTED = "disconnected",
  /** Failed to validate an event (signature, id, etc.) */
  VALIDATION_ERROR = "validation_error",
  /** Event was rejected by the relay */
  EVENT_REJECTED = "event_rejected",
  /** Rate limit exceeded on the relay */
  RATE_LIMITED = "rate_limited",
  /** Authentication required but not provided */
  AUTH_REQUIRED = "auth_required",
  /** Authentication attempt failed */
  AUTH_FAILED = "auth_failed",
  /** IP address is blocked or restricted */
  IP_BLOCKED = "ip_blocked",
  /** Relay is in read-only mode */
  READ_ONLY = "read_only",
  /** Event payload is too large */
  PAYLOAD_TOO_LARGE = "payload_too_large",
  /** Relay could not process the message */
  INVALID_MESSAGE = "invalid_message",
  /** Maximum subscriptions reached */
  MAX_SUBSCRIPTIONS = "max_subscriptions",
  /** Unknown error */
  UNKNOWN = "unknown",
}

/**
 * Standardized relay error interface
 */
export interface RelayError {
  /** Type of error that occurred */
  type: RelayErrorType;
  /** Human-readable error message */
  message: string;
  /** URL of the relay where the error occurred */
  relay: string;
  /** Original error object if available */
  originalError?: Error | unknown;
  /** Timestamp when the error occurred */
  timestamp: number;
  /** Context-specific error details */
  details?: {
    /** Event ID if the error is related to a specific event */
    eventId?: string;
    /** Subscription ID if the error is related to a specific subscription */
    subscriptionId?: string;
    /** HTTP status code if applicable */
    statusCode?: number;
    /** Raw response from the relay if available */
    rawResponse?: string;
    /** Additional custom properties */
    [key: string]: unknown;
  };
  /** Whether this error can be retried */
  isRetryable: boolean;
}

/**
 * Interface for relay implementations
 */
export interface RelayInterface {
  readonly url: string;
  readonly status: RelayStatus;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  send(message: string): void;
  on<E extends RelayEvent>(event: E, callback: RelayEventCallbacks[E]): void;
  off<E extends RelayEvent>(event: E, callback: RelayEventCallbacks[E]): void;
  subscribe(
    filters: NostrFilter[],
    onEvent: (event: NostrEvent) => void,
    onEose?: () => void,
  ): string;
  unsubscribe(subscriptionId: string): void;
  publish(event: NostrEvent): Promise<PublishResponse>;
}

/**
 * Options for Nostr event validation
 */
export interface ValidationOptions {
  /** Whether to validate event signatures */
  validateSignatures?: boolean;
  /** Maximum allowed timestamp deviation in seconds from the current time (0 to disable) */
  maxTimestampDrift?: number;
  /** Whether to validate that event IDs match the computed hash */
  validateIds?: boolean;
  /** Whether to check for required fields based on event kind */
  validateFields?: boolean;
  /** Whether to validate tag structure and formats */
  validateTags?: boolean;
  /** Whether to validate content against expected format for the event kind */
  validateContent?: boolean;
  /** Custom validation function */
  customValidator?: (event: NostrEvent) => boolean | Promise<boolean>;
}

/**
 * Type for extracting events by specific kind
 */
export type EventOfKind<K extends number> = Omit<NostrEvent, "kind"> & {
  kind: K;
};

/** Metadata event (kind 0) */
export type MetadataEvent = EventOfKind<NostrKind.Metadata>;

/** Short text note event (kind 1) */
export type TextNoteEvent = EventOfKind<NostrKind.ShortNote>;

/** Recommend relay event (kind 2) */
export type RecommendRelayEvent = EventOfKind<NostrKind.RecommendRelay>;

/** Contacts/follow list event (kind 3) */
export type ContactsEvent = EventOfKind<NostrKind.Contacts>;

/** Direct message event (kind 4) */
export type DirectMessageEvent = EventOfKind<NostrKind.DirectMessage>;

/** Deletion event (kind 5) */
export type DeletionEvent = EventOfKind<NostrKind.Deletion>;

/** Repost event (kind 6) */
export type RepostEvent = EventOfKind<NostrKind.Repost>;

/** Reaction event (kind 7) */
export type ReactionEvent = EventOfKind<NostrKind.Reaction>;

/** Badge award event (kind 8) */
export type BadgeAwardEvent = EventOfKind<NostrKind.BadgeAward>;

/**
 * Helper type for extracting tag values from an event
 */
export interface TaggedEvent<T extends string> extends NostrEvent {
  tagValues: (name: T) => string[];
  getTag: (name: T, index?: number) => string | undefined;
}

/**
 * Typed tag values for easier type checking
 */
export type TagValues = {
  /** Event reference */
  e: string[];
  /** Public key reference */
  p: string[];
  /** Address for parameterized replaceable events (NIP-01) */
  a: string[];
  /** Identifier (replaceable events) */
  d: string[];
  /** Topic */
  t: string[];
  /** Reference */
  r: string[];
  /** Geohash */
  g: string[];
  /** URL */
  u: string[];
  /** Content warning */
  c: string[];
  /** Language */
  l: string[];
  /** MIME type */
  m: string[];
  /** Subject */
  s: string[];

  // Add additional tag types as needed
  [key: string]: string[];
};

/**
 * Type-safe tag extraction result
 */
export type EventTags = {
  [K in keyof TagValues]: TagValues[K];
};

export enum NIP20Prefix {
  Duplicate = "duplicate:",
  PoW = "pow:",
  RateLimited = "rate-limited:",
  Invalid = "invalid:",
  Error = "error:",
  Blocked = "blocked:",
  AuthRequired = "auth-required:",
  Restricted = "restricted:",
}

export interface ParsedOkReason {
  prefix?: NIP20Prefix;
  message: string; // The message part after the prefix, or the full message if no prefix
  rawMessage: string; // The original, unparsed message from the relay
}
