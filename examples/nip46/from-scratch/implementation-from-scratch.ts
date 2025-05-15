import {
  generateKeypair,
  getPublicKey,
  signEvent,
  verifySignature,
  encryptNIP04,
  decryptNIP04,
} from "../../../src";
import { getEventHash } from "../../../src/nip01/event";
import WebSocket from "ws";
import { SimpleNIP46Client, SimpleNIP46Bunker } from "../../../src";

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
  private clientKeys: { publicKey: string; privateKey: string };
  private signerPubkey: string;
  private pendingRequests: Map<string, (result: any) => void> = new Map();

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

    // Send connect request
    const userPubkey = await this.sendRequest("connect", [this.signerPubkey]);

    // Get user public key
    return await this.sendRequest("get_public_key", []);
  }

  async signEvent(eventData: any): Promise<any> {
    return await this.sendRequest("sign_event", [JSON.stringify(eventData)]);
  }

  async ping(): Promise<string> {
    return await this.sendRequest("ping", []);
  }

  private async waitForOpen(): Promise<void> {
    if (this.socket.readyState === WebSocket.OPEN) return;

    return new Promise((resolve, reject) => {
      this.socket.on("open", resolve);
      this.socket.on("error", reject);
    });
  }

  private async sendRequest(method: string, params: string[]): Promise<any> {
    return new Promise((resolve, reject) => {
      // Generate request ID
      const id = Math.random().toString(36).substring(2, 10);

      // Create request object
      const request = { id, method, params };

      // Set up timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Request timed out: ${method}`));
      }, 10000);

      // Store resolver
      this.pendingRequests.set(id, (result) => {
        clearTimeout(timeout);
        resolve(result);
      });

      // Encrypt and send request
      try {
        const json = JSON.stringify(request);
        const encrypted = encryptNIP04(
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
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      }
    });
  }

  private async sendEvent(event: any): Promise<void> {
    // Add created_at if not present
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }

    // Calculate ID if not present
    if (!event.id) {
      event.id = await getEventHash(event);
    }

    // Sign if not signed
    if (!event.sig) {
      event.sig = await signEvent(event.id, this.clientKeys.privateKey);
    }

    // Send to relay
    this.socket.send(JSON.stringify(["EVENT", event]));
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Only handle EVENT messages
      if (!Array.isArray(message) || message[0] !== "EVENT") return;

      const event = message[1];

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
        const decrypted = decryptNIP04(
          event.content,
          this.clientKeys.privateKey,
          this.signerPubkey,
        );

        // Parse response
        const response = JSON.parse(decrypted);

        // Find and call handler
        const handler = this.pendingRequests.get(response.id);
        if (handler) {
          this.pendingRequests.delete(response.id);
          handler(response.result);
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
  private userKeys: { publicKey: string; privateKey: string };
  private signerKeys: { publicKey: string; privateKey: string };
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

      const event = message[1];

      // Only handle events to our signer pubkey
      const pTag = event.tags.find(
        (tag: string[]) =>
          tag[0] === "p" && tag[1] === this.signerKeys.publicKey,
      );
      if (!pTag) return;

      // Decrypt content
      try {
        const decrypted = decryptNIP04(
          event.content,
          this.signerKeys.privateKey,
          event.pubkey,
        );

        // Parse request
        const request = JSON.parse(decrypted);

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
    request: any,
    clientPubkey: string,
  ): Promise<any> {
    const { id, method, params } = request;
    let result;
    let error;

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
            const eventData = JSON.parse(params[0]);

            // Add pubkey
            eventData.pubkey = this.userKeys.publicKey;

            // Complete the event
            if (!eventData.created_at) {
              eventData.created_at = Math.floor(Date.now() / 1000);
            }

            // Calculate ID
            eventData.id = await getEventHash(eventData);

            // Sign the event
            eventData.sig = await signEvent(
              eventData.id,
              this.userKeys.privateKey,
            );

            result = JSON.stringify(eventData);
          } catch (signError: any) {
            error = `Failed to sign event: ${signError.message}`;
          }
          break;

        default:
          error = `Unsupported method: ${method}`;
      }
    } catch (e: any) {
      error = e.message;
    }

    return { id, result, error };
  }

  private async sendResponse(
    clientPubkey: string,
    response: any,
  ): Promise<void> {
    try {
      // Encrypt the response
      const json = JSON.stringify(response);
      const encrypted = encryptNIP04(
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
      });
    } catch (error) {
      console.error("Failed to send response:", error);
    }
  }

  private async sendEvent(event: any): Promise<void> {
    // Add created_at if not present
    if (!event.created_at) {
      event.created_at = Math.floor(Date.now() / 1000);
    }

    // Calculate ID if not present
    if (!event.id) {
      event.id = await getEventHash(event);
    }

    // Sign if not signed
    if (!event.sig) {
      event.sig = await signEvent(event.id, this.signerKeys.privateKey);
    }

    // Send to relay
    this.socket.send(JSON.stringify(["EVENT", event]));
  }
}

// Main demo
async function main() {
  console.log("=== NIP-46 Minimal Example ===");

  // Start a test relay
  const relay = new TestRelay(3789);
  await relay.start();

  try {
    // Generate keypairs
    console.log("\nGenerating keypairs...");
    const userKeypair = await generateKeypair();
    const signerKeypair = await generateKeypair();

    console.log(`User pubkey: ${userKeypair.publicKey}`);
    console.log(`Signer pubkey: ${signerKeypair.publicKey}`);

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

    // Create and connect client
    console.log("\nConnecting client...");
    const client = new MinimalNIP46Client(relay.url);
    const pubkey = await client.connect(connectionString);

    console.log(`Connected! Got pubkey: ${pubkey}`);
    console.log(
      `Matches original user pubkey: ${pubkey === userKeypair.publicKey}`,
    );

    // Test ping
    console.log("\nTesting ping...");
    const pong = await client.ping();
    console.log(`Ping response: ${pong}`);

    // Test signing
    console.log("\nTesting event signing...");
    const event = {
      kind: 1,
      content: "Hello from NIP-46 remote signing!",
      created_at: Math.floor(Date.now() / 1000),
      tags: [],
    };

    const signedEvent = await client.signEvent(event);
    console.log("Successfully signed event:");
    console.log(`- ID: ${JSON.parse(signedEvent).id}`);
    console.log(`- Pubkey: ${JSON.parse(signedEvent).pubkey}`);
    console.log(
      `- Signature: ${JSON.parse(signedEvent).sig.substring(0, 20)}...`,
    );

    // Verify signature
    const parsed = JSON.parse(signedEvent);
    const valid = await verifySignature(parsed.id, parsed.sig, parsed.pubkey);
    console.log(`Signature valid: ${valid}`);
  } catch (error: any) {
    console.error("ERROR:", error.message);
  } finally {
    // Clean up
    console.log("\nCleaning up...");
    await relay.close();
  }
}

main().catch(console.error);
