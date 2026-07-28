import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import {
  NIP47EncryptionScheme,
  NIP47ErrorCode,
  NIP47Method,
  NostrWalletConnectClient,
  NostrWalletService,
  WalletImplementation,
} from "../../src/nip47";
import { NostrRelay } from "../../src/testing";
import { generateKeypair } from "../../src/utils/crypto";
import { getUnixTime } from "../../src/utils/time";

class LifecycleWallet implements WalletImplementation {
  public getBalance = jest.fn(async () => 42);

  public async getInfo() {
    return {
      alias: "Lifecycle Wallet",
      methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
    };
  }

  public async payInvoice(): Promise<never> {
    throw new Error("Not implemented for lifecycle tests");
  }

  public async makeInvoice(): Promise<never> {
    throw new Error("Not implemented for lifecycle tests");
  }

  public async lookupInvoice(): Promise<never> {
    throw new Error("Not implemented for lifecycle tests");
  }

  public async listTransactions(): Promise<never> {
    throw new Error("Not implemented for lifecycle tests");
  }
}

describe("NIP-47 service lifecycle", () => {
  let relay: NostrRelay;
  let service: NostrWalletService;
  let wallet: LifecycleWallet;
  let serviceKeys: Awaited<ReturnType<typeof generateKeypair>>;
  const clients: NostrWalletConnectClient[] = [];

  beforeEach(async () => {
    relay = new NostrRelay(0);
    await relay.start();
    serviceKeys = await generateKeypair();
    wallet = new LifecycleWallet();
    service = new NostrWalletService(
      {
        relays: [relay.url],
        pubkey: serviceKeys.publicKey,
        privkey: serviceKeys.privateKey,
        methods: [NIP47Method.GET_INFO, NIP47Method.GET_BALANCE],
        encryptionSchemes: [NIP47EncryptionScheme.NIP44_V2],
      },
      wallet,
    );
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((client) => client.disconnect()));
    await service.disconnect();
    await relay.close();
  });

  test("sequential initialization keeps one active request subscription", async () => {
    await service.init();
    await service.init();

    expect(relay.subs.size).toBe(1);
  });

  test("concurrent initialization is single-flight and keeps one subscription", async () => {
    const firstInitialization = service.init();
    const secondInitialization = service.init();

    expect(secondInitialization).toBe(firstInitialization);
    await Promise.all([firstInitialization, secondInitialization]);
    expect(relay.subs.size).toBe(1);
  });

  test("disconnect is idempotent and releases the request subscription", async () => {
    await service.init();

    await expect(
      Promise.all([service.disconnect(), service.disconnect()]),
    ).resolves.toEqual([undefined, undefined]);
    await expect(service.disconnect()).resolves.toBeUndefined();
    expect(relay.subs.size).toBe(0);
  });

  test("a later disconnect invalidates initialization queued behind teardown", async () => {
    await service.init();

    const firstDisconnect = service.disconnect();
    const queuedInitialization = service.init();
    const laterDisconnect = service.disconnect();

    await laterDisconnect;
    await expect(queuedInitialization).rejects.toThrow(
      "Service initialization cancelled by disconnect",
    );
    await firstDisconnect;
    expect(relay.subs.size).toBe(0);

    await service.init();
    expect(relay.subs.size).toBe(1);
  });

  test("disconnect invalidates initialization already in flight", async () => {
    const initialization = service.init();
    const disconnection = service.disconnect();

    await disconnection;
    await expect(initialization).rejects.toThrow(
      "Service initialization cancelled by disconnect",
    );
    expect(relay.subs.size).toBe(0);

    await service.init();
    expect(relay.subs.size).toBe(1);
  });

  test("initialization after disconnect restores one expiration-aware subscription", async () => {
    await service.init();
    await service.disconnect();

    await service.init();
    expect(relay.subs.size).toBe(1);

    const clientKeys = await generateKeypair();
    const client = new NostrWalletConnectClient({
      pubkey: serviceKeys.publicKey,
      secret: clientKeys.privateKey,
      relays: [relay.url],
      preferredEncryption: NIP47EncryptionScheme.NIP44_V2,
    });
    clients.push(client);
    await client.init();

    await expect(
      client.getBalance({ expiration: getUnixTime() - 5 }),
    ).rejects.toMatchObject({ code: NIP47ErrorCode.REQUEST_EXPIRED });
    expect(wallet.getBalance).not.toHaveBeenCalled();
  }, 10000);
});
