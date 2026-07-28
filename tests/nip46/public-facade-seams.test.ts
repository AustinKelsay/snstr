import {
  generateKeypair,
  NostrRemoteSignerBunker,
  NostrRemoteSignerClient,
  SimpleNIP46Bunker,
  SimpleNIP46Client,
} from "../../src";
import { LogLevel } from "../../src/nip46";
import {
  NIP46ConnectionError,
  NIP46DecryptionError,
  NIP46EncryptionError,
  NIP46Error,
  NIP46SigningError,
} from "../../src/nip46/types";
import { NostrRelay } from "../../src/testing";

jest.setTimeout(30000);

describe("NIP-46 public facade seams", () => {
  let relay: NostrRelay;
  let relayUrl: string;

  beforeEach(async () => {
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;
  });

  afterEach(async () => {
    await relay.close();
  });

  test("advanced client preserves success and reconnect behavior with the simple bunker", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      { logLevel: LogLevel.ERROR },
    );
    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);
    bunker.setDefaultPermissions(["get_public_key", "ping"]);

    const client = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 1000,
    });

    try {
      await bunker.start();
      const connectionString = bunker.getConnectionString();

      await expect(client.connect(connectionString)).resolves.toBe("ack");
      await expect(client.getUserPublicKey()).resolves.toBe(userKeys.publicKey);
      await expect(client.ping()).resolves.toBe("pong");

      await client.disconnect();
      await expect(client.ping()).rejects.toBeInstanceOf(NIP46ConnectionError);

      await expect(client.connect(connectionString)).resolves.toBe("ack");
      await expect(client.ping()).resolves.toBe("pong");
    } finally {
      await client.disconnect();
      await bunker.stop();
    }
  });

  test("advanced client cleans up a rejected connect before retrying", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        secret: "expected-secret",
        defaultPermissions: ["get_public_key", "ping"],
        logLevel: LogLevel.ERROR,
      },
    );
    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);
    const client = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 500,
    });

    try {
      await bunker.start();
      const connectionString = bunker.getConnectionString();
      await expect(
        client.connect(
          connectionString.replace("expected-secret", "rejected-secret"),
        ),
      ).rejects.toThrow(/invalid secret/i);
      await expect(client.ping()).rejects.toBeInstanceOf(NIP46ConnectionError);

      await expect(client.connect(connectionString)).resolves.toBe(
        "expected-secret",
      );
      await expect(client.ping()).resolves.toBe("pong");
    } finally {
      await client.disconnect();
      await bunker.stop();
    }
  });

  test("simple client preserves success and protocol failure behavior with the advanced bunker", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const bunker = new NostrRemoteSignerBunker({
      relays: [relayUrl],
      userPubkey: userKeys.publicKey,
      signerPubkey: signerKeys.publicKey,
      defaultPermissions: ["get_public_key", "ping"],
    });
    bunker.setPrivateKeys(userKeys.privateKey, signerKeys.privateKey);

    const client = new SimpleNIP46Client([relayUrl], {
      timeout: 1000,
      logLevel: LogLevel.ERROR,
    });

    try {
      await bunker.start();
      await expect(client.connect(bunker.getConnectionString())).resolves.toBe(
        userKeys.publicKey,
      );
      await expect(client.ping()).resolves.toBe(true);

      await expect(
        client.signEvent({
          kind: 1,
          content: "not permitted",
          created_at: Math.floor(Date.now() / 1000),
          tags: [],
        }),
      ).rejects.toBeInstanceOf(NIP46SigningError);
      await expect(
        client.nip44Encrypt(signerKeys.publicKey, "not permitted"),
      ).rejects.toBeInstanceOf(NIP46EncryptionError);
      await expect(
        client.nip44Decrypt(signerKeys.publicKey, "not permitted"),
      ).rejects.toBeInstanceOf(NIP46DecryptionError);

      await expect(client.getRelays()).rejects.toBeInstanceOf(NIP46Error);

      await client.disconnect();
      await expect(client.ping()).resolves.toBe(false);
      await expect(client.connect(bunker.getConnectionString())).resolves.toBe(
        userKeys.publicKey,
      );
      await expect(client.ping()).resolves.toBe(true);
    } finally {
      await client.disconnect();
      await bunker.stop();
    }
  });

  test("both client facades retain their public timeout and shutdown outcomes", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const dormantBunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      { logLevel: LogLevel.ERROR },
    );
    dormantBunker.setUserPrivateKey(userKeys.privateKey);
    dormantBunker.setSignerPrivateKey(signerKeys.privateKey);
    const connectionString = dormantBunker.getConnectionString();

    const advancedClient = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 75,
    });
    const simpleClient = new SimpleNIP46Client([relayUrl], {
      timeout: 75,
      logLevel: LogLevel.ERROR,
    });

    try {
      await expect(advancedClient.connect(connectionString)).rejects.toThrow(
        /timed out/i,
      );
      await expect(simpleClient.connect(connectionString)).rejects.toThrow(
        /timed out/i,
      );

      await expect(advancedClient.disconnect()).resolves.toBeUndefined();
      await expect(simpleClient.disconnect()).resolves.toBeUndefined();
      await expect(advancedClient.ping()).rejects.toBeInstanceOf(
        NIP46ConnectionError,
      );
      await expect(simpleClient.ping()).resolves.toBe(false);
    } finally {
      await advancedClient.disconnect();
      await simpleClient.disconnect();
      await dormantBunker.stop();
    }
  });

  test("both client facades settle requests after bunker shutdown", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        defaultPermissions: ["get_public_key", "ping"],
        logLevel: LogLevel.ERROR,
      },
    );
    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);

    const advancedClient = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 100,
    });
    const simpleClient = new SimpleNIP46Client([relayUrl], {
      timeout: 100,
      logLevel: LogLevel.ERROR,
    });

    try {
      await bunker.start();
      const connectionString = bunker.getConnectionString();
      await advancedClient.connect(connectionString);
      await simpleClient.connect(connectionString);

      await bunker.stop();
      await expect(advancedClient.ping()).rejects.toThrow(/timed out/i);
      await expect(simpleClient.ping()).resolves.toBe(false);
      await expect(advancedClient.disconnect()).resolves.toBeUndefined();
      await expect(simpleClient.disconnect()).resolves.toBeUndefined();
    } finally {
      await advancedClient.disconnect();
      await simpleClient.disconnect();
      await bunker.stop();
    }
  });

  test("concurrent bunker lifecycle calls share one public transition", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        defaultPermissions: ["get_public_key", "ping"],
        logLevel: LogLevel.ERROR,
      },
    );
    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);
    const client = new SimpleNIP46Client([relayUrl], {
      timeout: 200,
      logLevel: LogLevel.ERROR,
    });

    try {
      await Promise.all([bunker.start(), bunker.start(), bunker.start()]);
      await expect(client.connect(bunker.getConnectionString())).resolves.toBe(
        userKeys.publicKey,
      );
      await expect(client.ping()).resolves.toBe(true);

      await Promise.all([bunker.stop(), bunker.stop(), bunker.stop()]);
      await expect(client.ping()).resolves.toBe(false);
    } finally {
      await client.disconnect();
      await bunker.stop();
    }
  });
});
