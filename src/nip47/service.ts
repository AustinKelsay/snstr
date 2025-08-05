import { Nostr } from "../nip01/nostr";
import { NostrEvent } from "../types/nostr";
import { signEvent } from "../utils/crypto";
import { getEventHash } from "../nip01/event";
import { getUnixTime } from "../utils/time";
import { createEvent, createSignedEvent } from "../nip01/event";
import { encrypt as encryptNIP04, decrypt as decryptNIP04 } from "../nip04";
import { encrypt as encryptNIP44, decrypt as decryptNIP44 } from "../nip44";
import {
  NIP47Method,
  NIP47Request,
  NIP47Response,
  NIP47EventKind,
  NIP47Notification,
  WalletImplementation,
  NIP47ErrorCode,
  ERROR_CATEGORIES,
  ERROR_RECOVERY_HINTS,
  NIP47NotificationType,
  NIP47RequestParams,
  PayInvoiceParams,
  MakeInvoiceParams,
  LookupInvoiceParams,
  ListTransactionsParams,
  SignMessageParams,
  NIP47ResponseResult,
  NIP47EncryptionScheme,
} from "./types";
import { 
  validateArrayAccess, 
  safeArrayAccess,
  SecurityValidationError 
} from "../utils/security-validator";

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
  methods: NIP47Method[];

  /**
   * Supported notification types
   */
  notificationTypes?: NIP47NotificationType[];

  /**
   * List of authorized client public keys.
   * If provided, only these clients will be able to use the service.
   * If not provided, all clients will be authorized (not recommended for production).
   */
  authorizedClients?: string[];

  /**
   * Supported encryption schemes (optional, defaults to both NIP-04 and NIP-44)
   */
  encryptionSchemes?: NIP47EncryptionScheme[];
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
  private supportedMethods: NIP47Method[];
  private supportedNotificationTypes: NIP47NotificationType[];
  private supportedEncryption: NIP47EncryptionScheme[];
  private walletImpl: WalletImplementation;
  private subIds: string[] = [];
  private authorizedClients: string[] = [];
  private requestEncryption = new Map<string, NIP47EncryptionScheme>(); // Track encryption per request

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
    this.supportedEncryption = options.encryptionSchemes || [
      NIP47EncryptionScheme.NIP44_V2,
      NIP47EncryptionScheme.NIP04
    ];
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
  public async disconnect(): Promise<void> {
    try {
      // Clean up subscriptions
      if (this.subIds.length > 0) {
        this.client.unsubscribe(this.subIds);
        this.subIds = [];
      }

      // Make sure we aren't leaving any pending operations
      try {
        await this.client.disconnectFromRelays();
      } catch (error) {
        console.error("Error disconnecting service from relays:", error);
      }

      // Short delay to allow any other cleanup to complete
      return new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error("Error during service disconnect:", error);
    }
  }

  /**
   * Publish the info event to advertise capabilities
   */
  private async publishInfoEvent(): Promise<void> {
    // Create tags
    const tags: string[][] = [];

    // Add encryption tag
    tags.push(["encryption", this.supportedEncryption.join(" ")]);

    // Add notifications tag if applicable
    if (this.supportedNotificationTypes.length > 0) {
      tags.push([
        "notifications",
        this.supportedNotificationTypes.join(" "),
      ]);
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

    // Determine the pubkey of the client making the request
    const requesterClientPubkey = event.pubkey;
    
    // Determine the pubkey of the service (us) from the p-tag, if present, with safe access
    let servicePubkeyTagged: string | undefined;
    try {
      const pTag = event.tags.find((tag) => {
        try {
          return validateArrayAccess(tag, 0) && safeArrayAccess(tag, 0) === "p";
        } catch {
          return false;
        }
      });
      
      if (pTag && validateArrayAccess(pTag, 1)) {
        const pubkeyValue = safeArrayAccess(pTag, 1);
        if (typeof pubkeyValue === "string") {
          servicePubkeyTagged = pubkeyValue;
        }
      }
    } catch (error) {
      if (error instanceof SecurityValidationError) {
        console.warn(`NIP-47: Bounds checking error in p-tag parsing: ${error.message}`);
      }
    }

    if (!servicePubkeyTagged || servicePubkeyTagged !== this.pubkey) {
      // If there's no p-tag for us, or it's not for us, ignore.
      // Or, if strict, error back if p-tag is for someone else. For now, ignore.
      console.warn(
        `Request ${event.id} not directly addressed to this service based on p-tag. Expected ${this.pubkey}, got ${servicePubkeyTagged}. Ignoring.`,
      );
      return;
    }

    let decryptedContent: string | undefined;
    let nip47Request: NIP47Request | undefined;

    try {
      // Check for expiration (can be done before decryption) with safe access
      let expirationTimestamp: number | undefined;
      try {
        const expirationTag = event.tags.find((tag) => {
          try {
            return validateArrayAccess(tag, 0) && safeArrayAccess(tag, 0) === "expiration";
          } catch {
            return false;
          }
        });
        
        if (expirationTag && validateArrayAccess(expirationTag, 1)) {
          const expirationValue = safeArrayAccess(expirationTag, 1);
          if (typeof expirationValue === "string") {
            const parsedExpiration = parseInt(expirationValue, 10);
            if (!isNaN(parsedExpiration)) {
              expirationTimestamp = parsedExpiration;
            }
          }
        }
      } catch (error) {
        if (error instanceof SecurityValidationError) {
          console.warn(`NIP-47: Bounds checking error in expiration parsing: ${error.message}`);
        }
      }
      
      if (expirationTimestamp) {
        const now = getUnixTime();
        if (now > expirationTimestamp) {
          console.log(
            `Request ${event.id} has already expired (${expirationTimestamp} < ${now}).`,
          );
          // Send error response for already expired request
          // The recipient is the original requester (event.pubkey)
          // The second parameter to sendErrorResponse is 'senderPubkey' (effectively, who was targeted, i.e. this.pubkey)
          await this.sendErrorResponse(
            requesterClientPubkey,
            this.pubkey, // The service is the context for this "sender"
            NIP47ErrorCode.REQUEST_EXPIRED,
            "Request has expired",
            event.id,
            NIP47Method.UNKNOWN, // Method is unknown before decryption
          );
          return;
        }
      }

      // Check if client is authorized (can also be done before decryption)
      if (
        this.authorizedClients.length > 0 &&
        !this.authorizedClients.includes(requesterClientPubkey)
      ) {
        console.error(
          `Client ${requesterClientPubkey} not authorized to use the service. Request ID: ${event.id}`,
        );
        await this.sendErrorResponse(
          requesterClientPubkey,
          this.pubkey,
          NIP47ErrorCode.UNAUTHORIZED_CLIENT,
          "Client not authorized to use this wallet service",
          event.id,
          NIP47Method.UNKNOWN,
        );
        return;
      }

      console.log(
        `Handling request from ${requesterClientPubkey}. Event ID: ${event.id}`,
      );
      console.log(`Event content length: ${event.content.length}`);

      // Extract encryption scheme from request
      let requestEncryption: NIP47EncryptionScheme = NIP47EncryptionScheme.NIP04; // Default
      try {
        const encryptionTag = event.tags.find((tag) => {
          try {
            return validateArrayAccess(tag, 0) && safeArrayAccess(tag, 0) === "encryption";
          } catch {
            return false;
          }
        });
        
        if (encryptionTag && validateArrayAccess(encryptionTag, 1)) {
          const encryptionValue = safeArrayAccess(encryptionTag, 1);
          if (typeof encryptionValue === "string" && 
              Object.values(NIP47EncryptionScheme).includes(encryptionValue as NIP47EncryptionScheme)) {
            requestEncryption = encryptionValue as NIP47EncryptionScheme;
          }
        }
      } catch (error) {
        if (error instanceof SecurityValidationError) {
          console.warn(`NIP-47: Bounds checking error in encryption tag parsing: ${error.message}`);
        }
      }

      // Check if we support the requested encryption
      if (!this.supportedEncryption.includes(requestEncryption)) {
        console.error(
          `Unsupported encryption scheme ${requestEncryption} for event ${event.id}`,
        );
        // Since we can't decrypt, we can't send an encrypted error response
        // Following NIP-47 spec, we should not respond
        return;
      }

      // Store the encryption scheme for this request
      this.requestEncryption.set(event.id, requestEncryption);

      try {
        if (requestEncryption === NIP47EncryptionScheme.NIP44_V2) {
          decryptedContent = await decryptNIP44(
            event.content,
            this.privkey,
            requesterClientPubkey,
          );
        } else {
          decryptedContent = decryptNIP04(
            this.privkey,
            requesterClientPubkey,
            event.content,
          );
        }
        console.log(
          "Successfully decrypted content: ",
          decryptedContent.substring(0, 50) + "...",
        );
      } catch (decryptError) {
        console.error(
          `Failed to decrypt message for event ${event.id}:`,
          decryptError,
        );
        // Do not send an error response here as per NIP-47 spec (section: "failed to decrypt")
        // "The recipient SHOULD NOT send a response event if it cannot decrypt the content."
        // Clean up stored encryption scheme
        this.requestEncryption.delete(event.id);
        return;
      }

      nip47Request = JSON.parse(decryptedContent) as NIP47Request;

      // Now that we have the request method, we can use it if an expiration occurs during processing

      if (expirationTimestamp) {
        const nowMs = Date.now();
        const expirationMs = expirationTimestamp * 1000;
        const timeoutDurationMs = expirationMs - nowMs;

        if (timeoutDurationMs <= 0) {
          // This case should ideally be caught by the earlier check, but as a safeguard after decryption:
          console.log(
            `Request ${event.id} (method: ${nip47Request.method}) expired just before wallet call.`,
          );
          const errorRsp = this.createErrorResponse(
            nip47Request.method,
            NIP47ErrorCode.REQUEST_EXPIRED,
            "Request has expired",
          );
          await this.sendResponse(requesterClientPubkey, errorRsp, event.id);
          return;
        }

        let timeoutHandle: NodeJS.Timeout | undefined;

        const walletCallPromise = this.handleRequest(nip47Request).finally(
          () => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
          },
        );

        const timeoutPromise = new Promise<NIP47Response>((resolve) => {
          timeoutHandle = setTimeout(() => {
            console.log(
              `Request ${event.id} (method: ${nip47Request!.method}) timed out during wallet processing.`,
            );
            resolve(
              this.createErrorResponse(
                nip47Request!.method, // nip47Request is guaranteed to be defined here
                NIP47ErrorCode.REQUEST_EXPIRED,
                "Request expired during processing",
              ),
            );
          }, timeoutDurationMs);
        });

        const response = await Promise.race([
          walletCallPromise,
          timeoutPromise,
        ]);
        // Ensure timeout is cleared if it hasn't fired and walletCall won, or if it did fire.
        if (timeoutHandle) clearTimeout(timeoutHandle);

        await this.sendResponse(requesterClientPubkey, response, event.id);
      } else {
        // No valid expiration tag, proceed normally
        const response = await this.handleRequest(nip47Request);
        await this.sendResponse(requesterClientPubkey, response, event.id);
      }
    } catch (error) {
      // General error handling for unexpected issues during the try block
      // (e.g., JSON parsing error if content is not valid JSON after decryption, or other unexpected errors)
      console.error(`Error processing request ${event.id}:`, error);

      // Determine method if possible, otherwise use UNKNOWN
      const methodForError = nip47Request?.method || NIP47Method.UNKNOWN;

      // It's important not to send an error response if the initial error was due to decryption failure
      // which is handled by returning early without response.
      // This catch block is for errors *after* successful decryption or if decryption wasn't the issue.
      if (decryptedContent !== undefined) {
        // Check if decryption was attempted and potentially successful
        await this.sendErrorResponse(
          requesterClientPubkey,
          this.pubkey,
          NIP47ErrorCode.INTERNAL_ERROR,
          error instanceof Error ? error.message : "Internal server error",
          event.id,
          methodForError,
        );
      } else {
        // If decryption was not even attempted or failed in a way that decryptedContent is still undefined,
        // and we somehow reached here, log it but don't send NIP-47 error to avoid breaking NIP-47 rule for decryption failure.
        console.error(
          `Unhandled error for event ${event.id} where decryption state is unclear. No NIP-47 response sent.`,
        );
      }
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

    // Get the encryption scheme used in the request
    const encryptionScheme = this.requestEncryption.get(requestId) || NIP47EncryptionScheme.NIP04;
    
    // Clean up after retrieving
    this.requestEncryption.delete(requestId);

    // Encrypt with the same scheme as the request
    let encryptedContent: string;
    if (encryptionScheme === NIP47EncryptionScheme.NIP44_V2) {
      encryptedContent = await encryptNIP44(
        JSON.stringify(response),
        this.privkey,
        clientPubkey,
      );
    } else {
      encryptedContent = encryptNIP04(
        this.privkey,
        clientPubkey,
        JSON.stringify(response),
      );
    }

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
  private createSuccessResponse(
    method: NIP47Method,
    result: NIP47ResponseResult,
  ): NIP47Response {
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
    method: NIP47Method,
    errorCode: NIP47ErrorCode,
    errorMessage: string,
    data?: Record<string, unknown>,
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
   * Type guard for PayInvoiceParams
   */
  private isPayInvoiceParams(
    method: NIP47Method,
    params: NIP47RequestParams,
  ): params is PayInvoiceParams {
    return (
      method === NIP47Method.PAY_INVOICE &&
      typeof params === "object" &&
      params !== null &&
      typeof (params as PayInvoiceParams).invoice === "string" &&
      ((params as PayInvoiceParams).amount === undefined ||
        typeof (params as PayInvoiceParams).amount === "number") &&
      ((params as PayInvoiceParams).maxfee === undefined ||
        typeof (params as PayInvoiceParams).maxfee === "number")
    );
  }

  /**
   * Type guard for MakeInvoiceParams
   */
  private isMakeInvoiceParams(
    method: NIP47Method,
    params: NIP47RequestParams,
  ): params is MakeInvoiceParams {
    return (
      method === NIP47Method.MAKE_INVOICE &&
      typeof params === "object" &&
      params !== null &&
      typeof (params as MakeInvoiceParams).amount === "number" &&
      ((params as MakeInvoiceParams).description === undefined ||
        typeof (params as MakeInvoiceParams).description === "string") &&
      ((params as MakeInvoiceParams).description_hash === undefined ||
        typeof (params as MakeInvoiceParams).description_hash === "string") &&
      ((params as MakeInvoiceParams).expiry === undefined ||
        typeof (params as MakeInvoiceParams).expiry === "number")
    );
  }

  /**
   * Type guard for LookupInvoiceParams
   */
  private isLookupInvoiceParams(
    method: NIP47Method,
    params: NIP47RequestParams,
  ): params is LookupInvoiceParams {
    return (
      method === NIP47Method.LOOKUP_INVOICE &&
      typeof params === "object" &&
      params !== null &&
      // Must have at least one of payment_hash or invoice
      (typeof (params as LookupInvoiceParams).payment_hash === "string" ||
        typeof (params as LookupInvoiceParams).invoice === "string")
    );
  }

  /**
   * Type guard for ListTransactionsParams
   */
  private isListTransactionsParams(
    method: NIP47Method,
    params: NIP47RequestParams,
  ): params is ListTransactionsParams {
    return (
      method === NIP47Method.LIST_TRANSACTIONS &&
      typeof params === "object" &&
      params !== null &&
      ((params as ListTransactionsParams).from === undefined ||
        typeof (params as ListTransactionsParams).from === "number") &&
      ((params as ListTransactionsParams).until === undefined ||
        typeof (params as ListTransactionsParams).until === "number") &&
      ((params as ListTransactionsParams).limit === undefined ||
        typeof (params as ListTransactionsParams).limit === "number") &&
      ((params as ListTransactionsParams).offset === undefined ||
        typeof (params as ListTransactionsParams).offset === "number") &&
      ((params as ListTransactionsParams).unpaid === undefined ||
        typeof (params as ListTransactionsParams).unpaid === "boolean") &&
      ((params as ListTransactionsParams).type === undefined ||
        typeof (params as ListTransactionsParams).type === "string")
    );
  }

  /**
   * Type guard for SignMessageParams
   */
  private isSignMessageParams(
    method: NIP47Method,
    params: NIP47RequestParams,
  ): params is SignMessageParams {
    return (
      method === NIP47Method.SIGN_MESSAGE &&
      typeof params === "object" &&
      params !== null &&
      typeof (params as SignMessageParams).message === "string"
    );
  }

  /**
   * Handle a request and produce a response
   */
  private async handleRequest(request: NIP47Request): Promise<NIP47Response> {
    // Check if method is supported
    if (!this.supportedMethods.includes(request.method)) {
      return this.createErrorResponse(
        request.method,
        NIP47ErrorCode.INVALID_REQUEST,
        `Method ${request.method} not supported`,
      );
    }

    try {
      let result;

      // Execute the appropriate method
      switch (request.method) {
        case NIP47Method.GET_INFO:
          result = await this.walletImpl.getInfo();
          // Add encryption information to the result
          result = {
            ...result,
            encryption: this.supportedEncryption,
          };
          break;

        case NIP47Method.GET_BALANCE:
          result = await this.walletImpl.getBalance();
          break;

        case NIP47Method.PAY_INVOICE:
          if (this.isPayInvoiceParams(request.method, request.params)) {
            result = await this.walletImpl.payInvoice(
              request.params.invoice,
              request.params.amount,
              request.params.maxfee,
            );
          } else {
            return this.createErrorResponse(
              request.method,
              NIP47ErrorCode.INVALID_REQUEST,
              "Invalid parameters for pay_invoice method",
            );
          }
          break;

        case NIP47Method.MAKE_INVOICE:
          if (this.isMakeInvoiceParams(request.method, request.params)) {
            result = await this.walletImpl.makeInvoice(
              request.params.amount,
              request.params.description,
              request.params.description_hash,
              request.params.expiry,
            );
          } else {
            return this.createErrorResponse(
              request.method,
              NIP47ErrorCode.INVALID_REQUEST,
              "Invalid parameters for make_invoice method",
            );
          }
          break;

        case NIP47Method.LOOKUP_INVOICE:
          if (this.isLookupInvoiceParams(request.method, request.params)) {
            try {
              result = await this.walletImpl.lookupInvoice({
                payment_hash: request.params.payment_hash,
                invoice: request.params.invoice,
              });
            } catch (error: unknown) {
              const err = error as {
                code?: NIP47ErrorCode;
                message?: string;
                data?: Record<string, unknown>;
              };
              // Enhance NOT_FOUND errors with more context for lookupInvoice
              if (err.code === NIP47ErrorCode.NOT_FOUND) {
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
          } else {
            return this.createErrorResponse(
              request.method,
              NIP47ErrorCode.INVALID_REQUEST,
              "Invalid parameters for lookup_invoice method",
            );
          }
          break;

        case NIP47Method.LIST_TRANSACTIONS: {
          if (this.isListTransactionsParams(request.method, request.params)) {
            const transactions = await this.walletImpl.listTransactions(
              request.params.from,
              request.params.until,
              request.params.limit,
              request.params.offset,
              request.params.unpaid,
              request.params.type,
            );
            result = { transactions };
          } else {
            return this.createErrorResponse(
              request.method,
              NIP47ErrorCode.INVALID_REQUEST,
              "Invalid parameters for list_transactions method",
            );
          }
          break;
        }

        case NIP47Method.SIGN_MESSAGE:
          if (this.isSignMessageParams(request.method, request.params)) {
            if (!this.walletImpl.signMessage) {
              return this.createErrorResponse(
                request.method,
                NIP47ErrorCode.INVALID_REQUEST,
                "sign_message method not implemented by wallet",
              );
            }
            result = await this.walletImpl.signMessage(request.params.message);
          } else {
            return this.createErrorResponse(
              request.method,
              NIP47ErrorCode.INVALID_REQUEST,
              "Invalid parameters for sign_message method",
            );
          }
          break;

        default:
          return this.createErrorResponse(
            request.method,
            NIP47ErrorCode.INVALID_REQUEST,
            `Method ${request.method} not supported`,
          );
      }

      return this.createSuccessResponse(request.method, result);
    } catch (error: unknown) {
      const err = error as {
        code?: NIP47ErrorCode;
        message?: string;
        data?: Record<string, unknown>;
      };
      return this.createErrorResponse(
        request.method,
        err.code || NIP47ErrorCode.INTERNAL_ERROR,
        err.message || "An error occurred processing the request",
        err.data,
      );
    }
  }

  /**
   * Send a notification to a client
   */
  public async sendNotification(
    clientPubkey: string,
    type: NIP47NotificationType,
    notification: Record<string, unknown>,
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

    // Send notifications for each supported encryption scheme
    const publishPromises: Promise<void>[] = [];

    // Send NIP-04 encrypted notification if supported
    if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP04)) {
      const nip04Promise = (async () => {
        const eventTemplate = {
          kind: NIP47EventKind.NOTIFICATION,
          content: "",
          tags: [["p", clientPubkey]],
        };

        const unsignedEvent = createEvent(eventTemplate, this.pubkey);
        const encryptedContent = encryptNIP04(
          this.privkey,
          clientPubkey,
          JSON.stringify(notificationObj),
        );
        unsignedEvent.content = encryptedContent;

        const signedEvent = await createSignedEvent(unsignedEvent, this.privkey);
        await this.client.publishEvent(signedEvent);
      })();
      publishPromises.push(nip04Promise);
    }

    // Send NIP-44 encrypted notification if supported
    if (this.supportedEncryption.includes(NIP47EncryptionScheme.NIP44_V2)) {
      const nip44Promise = (async () => {
        const eventTemplate = {
          kind: NIP47EventKind.NOTIFICATION_NIP44,
          content: "",
          tags: [["p", clientPubkey]],
        };

        const unsignedEvent = createEvent(eventTemplate, this.pubkey);
        const encryptedContent = await encryptNIP44(
          JSON.stringify(notificationObj),
          this.privkey,
          clientPubkey,
        );
        unsignedEvent.content = encryptedContent;

        const signedEvent = await createSignedEvent(unsignedEvent, this.privkey);
        await this.client.publishEvent(signedEvent);
      })();
      publishPromises.push(nip44Promise);
    }

    // Wait for all notifications to be published
    await Promise.all(publishPromises);
  }

  /**
   * Send an error response to a client
   */
  private async sendErrorResponse(
    clientPubkey: string,
    serviceContextPubkey: string,
    errorCode: NIP47ErrorCode,
    errorMessage: string,
    requestId: string,
    method: NIP47Method,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // Create error response using the utility method
    const response = this.createErrorResponse(
      method,
      errorCode,
      errorMessage,
      data,
    );

    // Send response TO the clientPubkey (the original requester)
    await this.sendResponse(clientPubkey, response, requestId);
  }
}
