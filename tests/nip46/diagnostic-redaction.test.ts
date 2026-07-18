import {
  type DiagnosticLogArgument,
  type DiagnosticLogger,
  NostrRemoteSignerBunker,
  NostrRemoteSignerClient,
  LogLevel,
  SimpleNIP46Bunker,
  SimpleNIP46Client,
  generateKeypair,
} from "../../src";
import { NostrRelay } from "../../src/testing";

interface CapturedDiagnostic {
  level: keyof DiagnosticLogger;
  message: string;
  args: DiagnosticLogArgument[];
}

function createCapturingLogger(): {
  logger: DiagnosticLogger;
  diagnostics: CapturedDiagnostic[];
} {
  const diagnostics: CapturedDiagnostic[] = [];
  const capture =
    (level: keyof DiagnosticLogger) =>
    (message: string, ...args: DiagnosticLogArgument[]): void => {
      diagnostics.push({ level, message, args });
    };

  return {
    logger: {
      error: capture("error"),
      warn: capture("warn"),
      info: capture("info"),
      debug: capture("debug"),
      trace: capture("trace"),
    },
    diagnostics,
  };
}

function renderDiagnostics(diagnostics: CapturedDiagnostic[]): string {
  return JSON.stringify(diagnostics);
}

function expectNoSensitiveDiagnostics(
  diagnostics: CapturedDiagnostic[],
  sensitiveValues: string[],
): void {
  const rendered = renderDiagnostics(diagnostics);

  for (const sensitiveValue of sensitiveValues) {
    expect(rendered).not.toContain(sensitiveValue);
  }

  expect(diagnostics.length).toBeGreaterThan(0);

  for (const level of ["info", "debug", "trace"] as const) {
    const atLevel = renderDiagnostics(
      diagnostics.filter((diagnostic) => diagnostic.level === level),
    );
    for (const sensitiveValue of sensitiveValues) {
      expect(atLevel).not.toContain(sensitiveValue);
    }
  }
}

describe("NIP-46 diagnostic redaction", () => {
  let relay: NostrRelay;
  let relayUrl: string;

  beforeAll(async () => {
    relay = new NostrRelay(0);
    await relay.start();
    relayUrl = relay.url;
  });

  afterAll(async () => {
    await relay.close();
  });

  test("advanced client and simple bunker never expose protocol secrets", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const connectionSecret = "connection-secret-advanced-client";
    const eventPlaintext = "private-event-advanced-client";
    const encryptionPlaintext = "private-encryption-advanced-client";
    const recipientKeys = await generateKeypair();
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        secret: connectionSecret,
        defaultPermissions: [
          "get_public_key",
          "ping",
          "sign_event",
          "nip44_encrypt",
        ],
        logger: bunkerDiagnostics.logger,
      },
    );
    const client = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 3000,
      logger: clientDiagnostics.logger,
    });

    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);

    try {
      await bunker.start();
      await client.connect(bunker.getConnectionString());
      await client.signEvent({
        kind: 1,
        content: eventPlaintext,
        created_at: 1_700_000_000,
        tags: [],
      });
      await client.nip44Encrypt(recipientKeys.publicKey, encryptionPlaintext);

      expectNoSensitiveDiagnostics(clientDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
        encryptionPlaintext,
      ]);
      expectNoSensitiveDiagnostics(bunkerDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
        encryptionPlaintext,
      ]);
      expect(renderDiagnostics(clientDiagnostics.diagnostics)).toContain(
        "sign_event",
      );
      expect(renderDiagnostics(bunkerDiagnostics.diagnostics)).toContain(
        "sign_event",
      );
    } finally {
      await client.disconnect().catch(() => undefined);
      await bunker.stop().catch(() => undefined);
    }
  });

  test("simple client and advanced bunker never expose protocol secrets", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const connectionSecret = "connection-secret-simple-client";
    const eventPlaintext = "private-event-simple-client";
    const encryptionPlaintext = "private-encryption-simple-client";
    const recipientKeys = await generateKeypair();
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new NostrRemoteSignerBunker({
      userPubkey: userKeys.publicKey,
      signerPubkey: signerKeys.publicKey,
      relays: [relayUrl],
      secret: connectionSecret,
      defaultPermissions: [
        "get_public_key",
        "ping",
        "sign_event",
        "nip44_encrypt",
      ],
      logger: bunkerDiagnostics.logger,
    });
    const client = new SimpleNIP46Client([relayUrl], {
      timeout: 3000,
      logger: clientDiagnostics.logger,
    });

    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);

    try {
      await bunker.start();
      await client.connect(bunker.getConnectionString());
      await client.signEvent({
        kind: 1,
        content: eventPlaintext,
        created_at: 1_700_000_001,
        tags: [],
      });
      await client.nip44Encrypt(recipientKeys.publicKey, encryptionPlaintext);

      expectNoSensitiveDiagnostics(clientDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
        encryptionPlaintext,
      ]);
      expectNoSensitiveDiagnostics(bunkerDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
        encryptionPlaintext,
      ]);
      expect(renderDiagnostics(clientDiagnostics.diagnostics)).toContain(
        "sign_event",
      );
      expect(renderDiagnostics(bunkerDiagnostics.diagnostics)).toContain(
        "sign_event",
      );
    } finally {
      await client.disconnect().catch(() => undefined);
      await bunker.stop().catch(() => undefined);
    }
  });

  test("legacy simple facades redact secret connect responses", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const connectionSecret = "legacy-connect-response-secret";
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        secret: connectionSecret,
        defaultPermissions: ["get_public_key"],
        logger: bunkerDiagnostics.logger,
      },
    );
    const client = new SimpleNIP46Client([relayUrl], {
      timeout: 3000,
      logger: clientDiagnostics.logger,
    });

    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);

    try {
      await bunker.start();
      await client.connect(bunker.getConnectionString());

      expectNoSensitiveDiagnostics(clientDiagnostics.diagnostics, [
        connectionSecret,
      ]);
      expectNoSensitiveDiagnostics(bunkerDiagnostics.diagnostics, [
        connectionSecret,
      ]);
      expect(renderDiagnostics(clientDiagnostics.diagnostics)).toContain(
        "Connect response requires secret",
      );
    } finally {
      await client.disconnect().catch(() => undefined);
      await bunker.stop().catch(() => undefined);
    }
  });

  test("invalid secrets retain safe failure metadata", async () => {
    const userKeys = await generateKeypair();
    const signerKeys = await generateKeypair();
    const expectedSecret = "expected-connect-secret";
    const rejectedSecret = "rejected-connect-secret";
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        secret: expectedSecret,
        logger: bunkerDiagnostics.logger,
      },
    );
    const client = new NostrRemoteSignerClient({
      relays: [relayUrl],
      timeout: 3000,
      logger: clientDiagnostics.logger,
    });

    bunker.setUserPrivateKey(userKeys.privateKey);
    bunker.setSignerPrivateKey(signerKeys.privateKey);

    try {
      await bunker.start();
      const rejectedConnectionString = bunker
        .getConnectionString()
        .replace(expectedSecret, rejectedSecret);

      await expect(client.connect(rejectedConnectionString)).rejects.toThrow(
        /invalid secret/i,
      );

      expectNoSensitiveDiagnostics(clientDiagnostics.diagnostics, [
        expectedSecret,
        rejectedSecret,
      ]);
      expectNoSensitiveDiagnostics(bunkerDiagnostics.diagnostics, [
        expectedSecret,
        rejectedSecret,
      ]);
      const failureDiagnostics = renderDiagnostics(
        bunkerDiagnostics.diagnostics,
      );
      expect(failureDiagnostics).toMatch(/invalid secret/i);
      expect(failureDiagnostics).toContain("connect");
    } finally {
      await client.disconnect().catch(() => undefined);
      await bunker.stop().catch(() => undefined);
    }
  });

  test("throwing diagnostics cannot alter public behavior", async () => {
    const userKeys = await generateKeypair();
    const setLevel = jest.fn(() => {
      throw new Error("set level failed");
    });
    const throwDiagnostic = (): never => {
      throw new Error("diagnostic failed");
    };
    const logger = {
      error: throwDiagnostic,
      warn: throwDiagnostic,
      info: throwDiagnostic,
      debug: throwDiagnostic,
      trace: throwDiagnostic,
      setLevel,
    };

    expect(
      () =>
        new NostrRemoteSignerBunker({
          userPubkey: userKeys.publicKey,
          logger,
        }),
    ).not.toThrow();

    const client = new SimpleNIP46Client([], { logger });
    expect(() => client.setLogLevel(LogLevel.TRACE)).not.toThrow();
    expect(setLevel).toHaveBeenCalledWith(LogLevel.TRACE);
  });
});
