import { Nostr } from "../client/nostr";
import { NostrEvent } from "../types/nostr";
import { getPublicKey, signEvent } from "../utils/crypto";
import { getEventHash } from "../utils/event";
import { createEvent, createSignedEvent } from "../utils/event";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import {
  NIP47Method,
  NIP47Request,
  NIP47Response,
  NIP47EventKind,
  NIP47NotificationType,
  NIP47Notification,
  WalletImplementation,
  NIP47ErrorCode,
  ERROR_CATEGORIES,
  ERROR_RECOVERY_HINTS,
} from "./types";

/**
 * Options for the NostrWalletService
 */
export interface NostrWalletServiceOptions {
  /**
   * List of relay URLs to connect to
   */
  relays: string[];

  /**
   * Public key of the wallet service
   */
  pubkey: string;

  /**
   * Private key of the wallet service
   */
  privkey: string;

  /**
   * Name of the wallet service (optional)
   */
  name?: string;

  /**
   * Supported methods
   */
  methods: string[];

  /**
   * Supported notification types
   */
  notificationTypes?: string[];

  /**
   * List of authorized client public keys.
   * If provided, only these clients will be able to use the service.
   * If not provided, all clients will be authorized (not recommended for production).
   */
  authorizedClients?: string[];
}

/**
 * Nostr Wallet Service implementation
 *
 * This class provides an implementation of the NIP-47 wallet service protocol
 * which allows wallet providers to handle wallet operations over Nostr.
 */
export class NostrWalletService {
  private pubkey: string;
  private privkey: string;
  private relays: string[];
  private name: string;
  private client: Nostr;
  private supportedMethods: string[];
  private supportedNotificationTypes: string[];
  private walletImpl: WalletImplementation;
  private subIds: string[] = [];
  private authorizedClients: string[] = [];

  constructor(
    options: NostrWalletServiceOptions,
    walletImpl: WalletImplementation,
  ) {
    if (!options.pubkey) {
      throw new Error("Missing pubkey in service options");
    }

    if (!options.privkey) {
      throw new Error("Missing privkey in service options");
    }

    if (!options.relays || options.relays.length === 0) {
      throw new Error("At least one relay must be specified");
    }

    if (!options.methods || options.methods.length === 0) {
      throw new Error("At least one method must be supported");
    }

    this.pubkey = options.pubkey;
    this.privkey = options.privkey;
    this.relays = options.relays;
    this.name = options.name || "NostrWalletService";
    this.supportedMethods = options.methods;
    this.supportedNotificationTypes = options.notificationTypes || [];
    this.walletImpl = walletImpl;
    this.client = new Nostr(this.relays);
    this.authorizedClients = options.authorizedClients || [];
  }

  /**
   * Initialize the service, connect to relays, and publish capabilities
   */
  public async init(): Promise<void> {
    // Connect to relays
    await this.client.connectToRelays();
    console.log(`Service connected to relays: ${this.relays.join(", ")}`);

    // Set up subscription to receive requests
    this.setupSubscription();
    console.log(`Service subscribed to requests`);

    // Publish info event
    await this.publishInfoEvent();
    console.log(
      `Service published info event with methods: ${this.supportedMethods.join(", ")}`,
    );
  }

  /**
   * Disconnect from relays
   */
  public disconnect(): void {
    if (this.subIds.length > 0) {
      this.client.unsubscribe(this.subIds);
      this.subIds = [];
    }
  }

  /**
   * Publish the info event to advertise capabilities
   */
  private async publishInfoEvent(): Promise<void> {
    // Create tags
    const tags: string[][] = [];

    // Add notifications tag if applicable
    if (this.supportedNotificationTypes.length > 0) {
      tags.push(["notifications", this.supportedNotificationTypes.join(" ")]);
    }

    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.INFO,
      content: this.supportedMethods.join(" "),
      tags,
    };

    // Create and sign the event
    const unsignedEvent = createEvent(eventTemplate, this.pubkey);
    const id = await getEventHash(unsignedEvent);
    const sig = await signEvent(id, this.privkey);

    // Create the full signed event
    const signedEvent: NostrEvent = {
      ...unsignedEvent,
      id,
      sig,
    };

    console.log("Publishing INFO event:", JSON.stringify(signedEvent));

    // Publish the event
    await this.client.publishEvent(signedEvent);
  }

  /**
   * Set up subscription to receive requests
   */
  private setupSubscription(): void {
    // Subscribe to request events directed at this service
    const filter = {
      kinds: [NIP47EventKind.REQUEST],
      "#p": [this.pubkey],
    };

    this.subIds = this.client.subscribe([filter], (event: NostrEvent) => {
      this.handleEvent(event);
    });
  }

  /**
   * Handle incoming events
   */
  private async handleEvent(event: NostrEvent): Promise<void> {
    if (event.kind !== NIP47EventKind.REQUEST) {
      return;
    }

    try {
      // Extract pubkey of the client from the 'p' tag
      const clientPubkey = event.tags.find((tag) => tag[0] === "p")?.[1];
      if (!clientPubkey) {
        console.error("Request event missing p tag");
        return;
      }

      // Check for expiration
      const expirationTag = event.tags.find((tag) => tag[0] === "expiration");
      if (expirationTag && expirationTag.length > 1) {
        const expiration = parseInt(expirationTag[1], 10);
        const now = Math.floor(Date.now() / 1000);

        if (now > expiration) {
          console.log(
            `Request ${event.id} has expired (${expiration} < ${now})`,
          );
          // Return error response for expired request
          await this.sendErrorResponse(
            clientPubkey,
            event.pubkey,
            NIP47ErrorCode.REQUEST_EXPIRED,
            "Request has expired",
            event.id,
            "unknown", // Method unknown at this point, we haven't decrypted the request yet
          );
          return;
        }
      }

      // Check if client is authorized when authorization list is provided
      if (
        this.authorizedClients.length > 0 &&
        !this.authorizedClients.includes(event.pubkey)
      ) {
        console.error(
          `Client ${event.pubkey} not authorized to use the service`,
        );
        await this.sendErrorResponse(
          clientPubkey,
          event.pubkey,
          NIP47ErrorCode.UNAUTHORIZED_CLIENT,
          "Client not authorized to use this wallet service",
          event.id,
          "unknown", // Method unknown at this point, we haven't decrypted the request yet
        );
        return;
      }

      console.log(
        `Handling request from ${event.pubkey}. Event ID: ${event.id}`,
      );
      console.log(`Event content length: ${event.content.length}`);

      let decrypted: string;
      try {
        // Always decrypt with receiver's private key and sender's public key
        decrypted = decryptNIP04(event.content, this.privkey, event.pubkey);
        console.log(
          "Successfully decrypted content: ",
          decrypted.substring(0, 50) + "...",
        );
      } catch (decryptError) {
        console.error("Failed to decrypt message:", decryptError);
        // We no longer need the fallback since we're using consistent key ordering
        throw new Error("Failed to decrypt message");
      }

      const request: NIP47Request = JSON.parse(decrypted);

      // Handle the request
      const response = await this.handleRequest(request);

      // Send the response
      await this.sendResponse(event.pubkey, response, event.id);
    } catch (error) {
      console.error("Error handling request:", error);
    }
  }

  /**
   * Send a response to a client
   */
  private async sendResponse(
    clientPubkey: string,
    response: NIP47Response,
    requestId: string,
  ): Promise<void> {
    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.RESPONSE,
      content: "",
      tags: [
        ["p", clientPubkey],
        ["e", requestId],
      ],
    };

    // Create the event
    const unsignedEvent = createEvent(eventTemplate, this.pubkey);

    console.log(`Encrypting response for ${clientPubkey}`);
    console.log(`Response will reference request ID: ${requestId}`);
    console.log(`Response tags: ${JSON.stringify(unsignedEvent.tags)}`);

    // Always encrypt with sender's private key and receiver's public key
    const encryptedContent = encryptNIP04(
      JSON.stringify(response),
      this.privkey,
      clientPubkey,
    );

    unsignedEvent.content = encryptedContent;

    // Sign the event
    const signedEvent = await createSignedEvent(unsignedEvent, this.privkey);

    console.log(
      `Sending response for request ${requestId}:`,
      JSON.stringify(response).substring(0, 100) + "...",
    );
    console.log(`Response event ID: ${signedEvent.id}`);

    // Debug logs to confirm tags
    console.log("Final response tags:", JSON.stringify(signedEvent.tags));

    // Publish the event
    await this.client.publishEvent(signedEvent);
    console.log(`Response published successfully!`);
  }

  /**
   * Create a properly formatted successful response according to NIP-47 spec
   */
  private createSuccessResponse(method: string, result: any): NIP47Response {
    return {
      result_type: method,
      result,
      error: null,
    };
  }

  /**
   * Create a properly formatted error response according to NIP-47 spec
   */
  private createErrorResponse(
    method: string,
    errorCode: string,
    errorMessage: string,
    data?: any,
  ): NIP47Response {
    // Determine error category and recovery hint
    const category = ERROR_CATEGORIES[errorCode];
    const recoveryHint = ERROR_RECOVERY_HINTS[errorCode];

    return {
      result_type: method,
      result: null,
      error: {
        code: errorCode,
        message: errorMessage,
        category,
        recoveryHint,
        data,
      },
    };
  }

  /**
   * Handle a request and produce a response
   */
  private async handleRequest(request: NIP47Request): Promise<NIP47Response> {
    // Check if method is supported
    if (!this.supportedMethods.includes(request.method)) {
      return this.createErrorResponse(
        request.method,
        "INVALID_REQUEST",
        `Method ${request.method} not supported`,
      );
    }

    try {
      let result;

      // Execute the appropriate method
      switch (request.method) {
        case NIP47Method.GET_INFO:
          result = await this.walletImpl.getInfo();
          break;

        case NIP47Method.GET_BALANCE:
          result = await this.walletImpl.getBalance();
          break;

        case NIP47Method.PAY_INVOICE:
          result = await this.walletImpl.payInvoice(
            request.params.invoice,
            request.params.amount,
            request.params.maxfee,
          );
          break;

        case NIP47Method.MAKE_INVOICE:
          result = await this.walletImpl.makeInvoice(
            request.params.amount,
            request.params.description,
            request.params.description_hash,
            request.params.expiry,
          );
          break;

        case NIP47Method.LOOKUP_INVOICE:
          try {
            result = await this.walletImpl.lookupInvoice({
              payment_hash: request.params.payment_hash,
              invoice: request.params.invoice,
            });
          } catch (error: any) {
            // Enhance NOT_FOUND errors with more context for lookupInvoice
            if (error.code === NIP47ErrorCode.NOT_FOUND) {
              const lookupType = request.params.payment_hash
                ? "payment_hash"
                : "invoice";
              const lookupValue =
                request.params.payment_hash || request.params.invoice;

              return this.createErrorResponse(
                request.method,
                NIP47ErrorCode.NOT_FOUND,
                `Invoice not found: Could not find ${lookupType}: ${lookupValue} in the wallet's database`,
              );
            }
            throw error;
          }
          break;

        case NIP47Method.LIST_TRANSACTIONS:
          const transactions = await this.walletImpl.listTransactions(
            request.params.from,
            request.params.until,
            request.params.limit,
            request.params.offset,
            request.params.unpaid,
            request.params.type,
          );
          result = { transactions };
          break;

        case NIP47Method.SIGN_MESSAGE:
          result = await this.walletImpl.signMessage?.(request.params.message);
          break;

        default:
          return this.createErrorResponse(
            request.method,
            "INVALID_REQUEST",
            `Method ${request.method} not supported`,
          );
      }

      return this.createSuccessResponse(request.method, result);
    } catch (error: any) {
      return this.createErrorResponse(
        request.method,
        error.code || "INTERNAL_ERROR",
        error.message || "An error occurred processing the request",
        error.data,
      );
    }
  }

  /**
   * Send a notification to a client
   */
  public async sendNotification(
    clientPubkey: string,
    type: string,
    notification: any,
  ): Promise<void> {
    // Check if notification type is supported
    if (!this.supportedNotificationTypes.includes(type)) {
      throw new Error(`Notification type ${type} not supported`);
    }

    // Create the notification object
    const notificationObj: NIP47Notification = {
      notification_type: type,
      notification,
    };

    // Create event template
    const eventTemplate = {
      kind: NIP47EventKind.NOTIFICATION,
      content: "",
      tags: [["p", clientPubkey]],
    };

    // Create the event
    const unsignedEvent = createEvent(eventTemplate, this.pubkey);

    // Always encrypt with sender's private key and receiver's public key
    const encryptedContent = encryptNIP04(
      JSON.stringify(notificationObj),
      this.privkey,
      clientPubkey,
    );

    unsignedEvent.content = encryptedContent;

    // Sign the event
    const signedEvent = await createSignedEvent(unsignedEvent, this.privkey);

    // Publish the event
    await this.client.publishEvent(signedEvent);
  }

  /**
   * Send an error response to a client
   */
  private async sendErrorResponse(
    clientPubkey: string,
    senderPubkey: string,
    errorCode: string,
    errorMessage: string,
    requestId: string,
    method: string = "unknown",
    data?: any,
  ): Promise<void> {
    // Create error response using the utility method
    const response = this.createErrorResponse(
      method,
      errorCode,
      errorMessage,
      data,
    );

    // Send response
    await this.sendResponse(senderPubkey, response, requestId);
  }
}
