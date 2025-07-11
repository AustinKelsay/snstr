/**
 * Minimal NIP-46 Implementation from Scratch
 * 
 * This example demonstrates a basic NIP-46 remote signing implementation 
 * supporting both NIP-44 (preferred) and NIP-04 (legacy) encryption methods
 * for secure communication between client and bunker.
 * 
 * Key NIP-46 concepts demonstrated:
 * - remote-signer-pubkey: Used in connection string for communication
 * - user-pubkey: Retrieved via get_public_key after connection
 * - Two-step connection: connect() then get_public_key()
 * 
 * NIP-44 is preferred for new implementations due to better security,
 * but NIP-04 is maintained for backward compatibility with existing clients.
 */
import {
  generateKeypair,
  signEvent,
  verifySignature,
  encryptNIP44,
  decryptNIP44,
  encryptNIP04 as _encryptNIP04,
  decryptNIP04 as _decryptNIP04,
  NostrEvent,
  EventTemplate,
  NIP46Request,
  NIP46Response,
  NIP46Method,
} from "../../../src";
import { getEventHash } from "../../../src/nip01/event";
import WebSocket from "ws";

// Wrapper functions to provide NIP-44 style API for NIP-04 (for consistency)
const encryptNIP04 = (plaintext: string, privateKey: string, publicKey: string): string => {
  return _encryptNIP04(privateKey, publicKey, plaintext);
};

const decryptNIP04 = (ciphertext: string, privateKey: string, publicKey: string): string => {
  return _decryptNIP04(privateKey, publicKey, ciphertext);
};

// Type definitions
type UnsignedEvent = Omit<NostrEvent, "id" | "sig">;
type NostrEventToSign = EventTemplate & { tags: string[][] };

interface Keypair {
  publicKey: string;
  privateKey: string;
}

// Simple in-memory relay for testing
class TestRelay {
  private server: WebSocket.Server;
  private clients: WebSocket[] = [];
  public url: string;

  constructor(port: number) {
    this.server = new WebSocket.Server({ port });
    this.url = `ws://localhost:${port}`;

    this.server.on("connection", (ws) => {
      this.clients.push(ws);

      ws.on("message", (data) => {
        // Broadcast message to all clients
        this.clients.forEach((client) => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(data.toString());
          }
        });
      });

      ws.on("close", () => {
        this.clients = this.clients.filter((client) => client !== ws);
      });
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.on("listening", () => {
        console.log(`Test relay started on ${this.url}`);
        resolve();
      });
    });
  }

  async close(): Promise<void> {
    this.clients.forEach((client) => client.close());
    this.server.close();
  }
}

// NIP-46 Client
class MinimalNIP46Client {
  private socket: WebSocket;
  private clientKeys: Keypair;
  private signerPubkey: string;
  private pendingRequests: Map<
    string,
    { resolve: (result: string) => void; reject: (error: Error) => void }
  > = new Map();

  constructor(relayUrl: string) {
    this.socket = new WebSocket(relayUrl);
    this.clientKeys = { publicKey: "", privateKey: "" };
    this.signerPubkey = "";
  }

  async connect(connectionString: string): Promise<string> {
    // Parse connection string
    const url = new URL(connectionString);
    this.signerPubkey = url.hostname;

    // Generate client keypair
    this.clientKeys = await generateKeypair();

    // Connect to socket
    if (this.socket.readyState !== WebSocket.OPEN) {
      await this.waitForOpen();
    }

    // Set up message handler
    this.socket.on("message", (data) => {
      this.handleMessage(data.toString());
    });

    // Send connect request (establishes connection but doesn't return user pubkey)
    return await this.sendRequest("connect", [this.signerPubkey]);
  }
  
  async getPublicKey(): Promise<string> {
    return await this.sendRequest("get_public_key", []);
  }

  async signEvent(eventData: NostrEventToSign): Promise<string> {
    return await this.sendRequest("sign_event", [JSON.stringify(eventData)]);
  }

  async ping(): Promise<string> {
    return await this.sendRequest("ping", []);
  }

  async nip44Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    return await this.sendRequest("nip44_encrypt", [thirdPartyPubkey, plaintext]);
  }

  async nip44Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    return await this.sendRequest("nip44_decrypt", [thirdPartyPubkey, ciphertext]);
  }

  async nip04Encrypt(thirdPartyPubkey: string, plaintext: string): Promise<string> {
    return await this.sendRequest("nip04_encrypt", [thirdPartyPubkey, plaintext]);
  }

  async nip04Decrypt(thirdPartyPubkey: string, ciphertext: string): Promise<string> {
    return await this.sendRequest("nip04_decrypt", [thirdPartyPubkey, ciphertext]);
  }

  private async waitForOpen(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.socket.on("open", resolve);
      this.socket.on("error", reject);
    });
  }

  private async sendRequest(method: string, params: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      // Generate request ID
      const id = Math.random().toString(36).substring(2, 10);

      // Convert string method to NIP46Method enum
      let methodEnum: NIP46Method;
      switch (method) {
        case "connect":
          methodEnum = NIP46Method.CONNECT;
          break;
        case "get_public_key":
          methodEnum = NIP46Method.GET_PUBLIC_KEY;
          break;
        case "sign_event":
          methodEnum = NIP46Method.SIGN_EVENT;
          break;
        case "ping":
          methodEnum = NIP46Method.PING;
          break;
        case "nip44_encrypt":
          methodEnum = NIP46Method.NIP44_ENCRYPT;
          break;
        case "nip44_decrypt":
          methodEnum = NIP46Method.NIP44_DECRYPT;
          break;
        case "nip04_encrypt":
          methodEnum = NIP46Method.NIP04_ENCRYPT;
          break;
        case "nip04_decrypt":
          methodEnum = NIP46Method.NIP04_DECRYPT;
          break;
        default:
          reject(new Error(`Unknown NIP46 method: ${method}`));
          return;
      }

      // Create request object
      const request: NIP46Request = { id, method: methodEnum, params };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, 10000);

      // Store resolver and rejecter
      this.pendingRequests.set(id, {
        resolve: (resultValue: string) => {
          clearTimeout(timeout);
          resolve(resultValue);
        },
        reject: (errorValue: Error) => {
          clearTimeout(timeout);
          reject(errorValue);
        },
      });

      // Encrypt and send request
      try {
        const json = JSON.stringify(request);
        const encrypted = encryptNIP44(
          json,
          this.clientKeys.privateKey,
          this.signerPubkey,
        );

        // Create and send event
        this.sendEvent({
          kind: 24133,
          content: encrypted,
          tags: [["p", this.signerPubkey]],
          pubkey: this.clientKeys.publicKey,
          created_at: Math.floor(Date.now() / 1000),
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private async sendEvent(event: UnsignedEvent): Promise<void> {
    // Add created_at if not present
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }

    // Calculate ID
    const id = await getEventHash(event);

    // Sign the event
    const sig = await signEvent(id, this.clientKeys.privateKey);

    // Create complete event
    const completeEvent: NostrEvent = {
      ...event,
      id,
      sig,
    };

    // Send to relay
    this.socket.send(JSON.stringify(["EVENT", completeEvent]));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Only handle EVENT messages
      if (!Array.isArray(message) || message[0] !== "EVENT") return;

      const event = message[1] as NostrEvent;

      // Only handle events from the signer pubkey
      if (event.pubkey !== this.signerPubkey) return;

      // Only handle events to our client
      const pTag = event.tags.find(
        (tag: string[]) =>
          tag[0] === "p" && tag[1] === this.clientKeys.publicKey,
      );
      if (!pTag) return;

      // Decrypt content
      try {
        const decrypted = decryptNIP44(
          event.content,
          this.clientKeys.privateKey,
          this.signerPubkey,
        );

        // Parse response
        const response = JSON.parse(decrypted) as NIP46Response;

        // Find and call handler
        const promiseControls = this.pendingRequests.get(response.id);
        if (promiseControls) {
          this.pendingRequests.delete(response.id); // Remove before calling resolve/reject
          if (response.error) {
            promiseControls.reject(new Error(response.error));
          } else if (response.result !== undefined) {
            promiseControls.resolve(response.result);
          } else {
            // If response has neither result nor error, but has an ID we know, reject.
            promiseControls.reject(
              new Error("Invalid response: missing result and error."),
            );
          }
        }
      } catch (error) {
        console.error("Failed to decrypt or parse message:", error);
      }
    } catch (error) {
      console.error("Failed to handle message:", error);
    }
  }
}

// NIP-46 Bunker
class MinimalNIP46Bunker {
  private socket: WebSocket;
  private userKeys: Keypair;
  private signerKeys: Keypair;
  private connectedClients: Set<string> = new Set();

  constructor(relayUrl: string, userPubkey: string, signerPubkey?: string) {
    this.socket = new WebSocket(relayUrl);
    this.userKeys = { publicKey: userPubkey, privateKey: "" };
    this.signerKeys = {
      publicKey: signerPubkey || userPubkey,
      privateKey: "",
    };
  }

  setUserPrivateKey(privateKey: string): void {
    this.userKeys.privateKey = privateKey;
  }

  setSignerPrivateKey(privateKey: string): void {
    this.signerKeys.privateKey = privateKey;
  }

  async start(): Promise<void> {
    // Connect to socket
    if (this.socket.readyState !== WebSocket.OPEN) {
      await this.waitForOpen();
    }

    // Set up message handler
    this.socket.on("message", (data) => {
      this.handleMessage(data.toString());
    });
  }

  getConnectionString(relayUrl: string): string {
    return `bunker://${this.signerKeys.publicKey}?relay=${encodeURIComponent(relayUrl)}`;
  }

  private async waitForOpen(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.socket.on("open", resolve);
      this.socket.on("error", reject);
    });
  }

  private async handleMessage(data: string): Promise<void> {
    try {
      const message = JSON.parse(data);

      // Only handle EVENT messages
      if (!Array.isArray(message) || message[0] !== "EVENT") return;

      const event = message[1] as NostrEvent;

      // Only handle events to our signer pubkey
      const pTag = event.tags.find(
        (tag: string[]) =>
          tag[0] === "p" && tag[1] === this.signerKeys.publicKey,
      );
      if (!pTag) return;

      // Decrypt content
      try {
        const decrypted = decryptNIP44(
          event.content,
          this.signerKeys.privateKey,
          event.pubkey,
        );

        // Parse request
        const request = JSON.parse(decrypted) as NIP46Request;

        // Handle request
        const response = await this.handleRequest(request, event.pubkey);

        // Send response
        await this.sendResponse(event.pubkey, response);
      } catch (error) {
        console.error("Failed to handle client request:", error);
      }
    } catch (error) {
      console.error("Failed to handle message:", error);
    }
  }

  private async handleRequest(
    request: NIP46Request,
    clientPubkey: string,
  ): Promise<NIP46Response> {
    const { id, method, params } = request;
    let result: string | undefined;
    let error: string | undefined;

    try {
      switch (method) {
        case "connect":
          // Check if signer pubkey matches
          if (params[0] === this.signerKeys.publicKey) {
            this.connectedClients.add(clientPubkey);
            result = "ack";
          } else {
            error = "Invalid signer pubkey";
          }
          break;

        case "get_public_key":
          result = this.userKeys.publicKey;
          break;

        case "ping":
          result = "pong";
          break;

        case "sign_event":
          if (!this.connectedClients.has(clientPubkey)) {
            error = "Not connected";
            break;
          }

          try {
            // Parse event data
            const eventData = JSON.parse(params[0]) as NostrEventToSign;

            // Add pubkey and timestamp if needed
            const completeEventData: UnsignedEvent = {
              kind: eventData.kind,
              content: eventData.content,
              created_at: eventData.created_at || Math.floor(Date.now() / 1000),
              tags: eventData.tags,
              pubkey: this.userKeys.publicKey,
            };

            // Calculate ID
            const id = await getEventHash(completeEventData);

            // Sign the event
            const sig = await signEvent(id, this.userKeys.privateKey);

            // Create complete signed event
            const signedEvent: NostrEvent = {
              ...completeEventData,
              id,
              sig,
            };

            result = JSON.stringify(signedEvent);
          } catch (signError) {
            error = `Failed to sign event: ${signError instanceof Error ? signError.message : String(signError)}`;
          }
          break;

        case "nip44_encrypt":
          if (!this.connectedClients.has(clientPubkey)) {
            error = "Not connected";
            break;
          }
          try {
            const [thirdPartyPubkey, plaintext] = params;
            result = encryptNIP44(plaintext, this.userKeys.privateKey, thirdPartyPubkey);
          } catch (encryptError) {
            error = `NIP-44 encryption failed: ${encryptError instanceof Error ? encryptError.message : String(encryptError)}`;
          }
          break;

        case "nip44_decrypt":
          if (!this.connectedClients.has(clientPubkey)) {
            error = "Not connected";
            break;
          }
          try {
            const [thirdPartyPubkey, ciphertext] = params;
            result = decryptNIP44(ciphertext, this.userKeys.privateKey, thirdPartyPubkey);
          } catch (decryptError) {
            error = `NIP-44 decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`;
          }
          break;

        case "nip04_encrypt":
          if (!this.connectedClients.has(clientPubkey)) {
            error = "Not connected";
            break;
          }
          try {
            const [thirdPartyPubkey, plaintext] = params;
            result = encryptNIP04(plaintext, this.userKeys.privateKey, thirdPartyPubkey);
          } catch (encryptError) {
            error = `NIP-04 encryption failed: ${encryptError instanceof Error ? encryptError.message : String(encryptError)}`;
          }
          break;

        case "nip04_decrypt":
          if (!this.connectedClients.has(clientPubkey)) {
            error = "Not connected";
            break;
          }
          try {
            const [thirdPartyPubkey, ciphertext] = params;
            result = decryptNIP04(ciphertext, this.userKeys.privateKey, thirdPartyPubkey);
          } catch (decryptError) {
            error = `NIP-04 decryption failed: ${decryptError instanceof Error ? decryptError.message : String(decryptError)}`;
          }
          break;

        default:
          error = `Unsupported method: ${method}`;
      }
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    return { id, result, error };
  }

  private async sendResponse(
    clientPubkey: string,
    response: NIP46Response,
  ): Promise<void> {
    try {
      // Encrypt the response
      const json = JSON.stringify(response);
      const encrypted = encryptNIP44(
        json,
        this.signerKeys.privateKey,
        clientPubkey,
      );

      // Create and send event
      await this.sendEvent({
        kind: 24133,
        content: encrypted,
        tags: [["p", clientPubkey]],
        pubkey: this.signerKeys.publicKey,
        created_at: Math.floor(Date.now() / 1000),
      });
    } catch (error) {
      console.error("Failed to send response:", error);
    }
  }

  private async sendEvent(event: UnsignedEvent): Promise<void> {
    // Calculate ID
    const id = await getEventHash(event);

    // Sign the event
    const sig = await signEvent(id, this.signerKeys.privateKey);

    // Create complete event
    const completeEvent: NostrEvent = {
      ...event,
      id,
      sig,
    };

    // Send to relay
    this.socket.send(JSON.stringify(["EVENT", completeEvent]));
  }
}

// Main demo
async function main() {
  console.log("=== NIP-46 From Scratch Implementation ===");
  console.log("Demonstrates the new NIP-46 flow:");
  console.log("1. Connect establishes the connection");
  console.log("2. get_public_key retrieves user's signing pubkey");
  console.log("3. Shows difference between remote-signer-pubkey and user-pubkey");
  console.log("");

  // Start a test relay
  const relay = new TestRelay(3789);
  await relay.start();

  try {
    // Generate keypairs
    console.log("\nGenerating keypairs...");
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair();

    console.log(`User pubkey (for signing): ${userKeypair.publicKey}`);
    console.log(`Signer pubkey (for communication): ${signerKeypair.publicKey}`);

    // Create and start bunker
    console.log("\nSetting up bunker...");
    const bunker = new MinimalNIP46Bunker(
      relay.url,
      userKeypair.publicKey,
      signerKeypair.publicKey,
    );
    bunker.setUserPrivateKey(userKeypair.privateKey);
    bunker.setSignerPrivateKey(signerKeypair.privateKey);
    await bunker.start();

    const connectionString = bunker.getConnectionString(relay.url);
    console.log(`Connection string: ${connectionString}`);
    console.log(`(Contains remote-signer-pubkey: ${signerKeypair.publicKey})`);

    // Create and connect client
    console.log("\nConnecting client...");
    const client = new MinimalNIP46Client(relay.url);
    
    // Connect establishes the connection
    const connectResult = await client.connect(connectionString);
    console.log(`Connected! Result: ${connectResult}`);

    // Get user public key (required after connect per NIP-46 spec)
    console.log("\nGetting user public key...");
    const userPubkey = await client.getPublicKey();
    console.log(`Retrieved user pubkey: ${userPubkey}`);
    console.log(`Matches original user pubkey: ${userPubkey === userKeypair.publicKey}`);
    console.log(`Different from signer pubkey: ${userPubkey !== signerKeypair.publicKey}`);

    // Test ping
    console.log("\nTesting ping...");
    const pong = await client.ping();
    console.log(`Ping response: ${pong}`);

    // Test signing
    console.log("\nTesting event signing...");
    const event: NostrEventToSign = {
      kind: 1,
      content: "Hello from NIP-46 remote signing!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const signedEvent = await client.signEvent(event);
    const parsedSignedEvent = JSON.parse(signedEvent) as NostrEvent;

    console.log("Successfully signed event:");
    console.log(`- ID: ${parsedSignedEvent.id}`);
    console.log(`- Pubkey: ${parsedSignedEvent.pubkey}`);
    console.log(`- Signature: ${parsedSignedEvent.sig.substring(0, 20)}...`);
    console.log(`- Signed with user pubkey: ${parsedSignedEvent.pubkey === userPubkey}`);

    // Verify signature
    const valid = await verifySignature(
      parsedSignedEvent.id,
      parsedSignedEvent.sig,
      parsedSignedEvent.pubkey,
    );
    console.log(`Signature valid: ${valid}`);
  } catch (error) {
    console.error(
      "ERROR:",
      error instanceof Error ? error.message : String(error),
    );
  } finally {
    // Clean up
    console.log("\nCleaning up...");
    await relay.close();
  }
}

main().catch(console.error);
