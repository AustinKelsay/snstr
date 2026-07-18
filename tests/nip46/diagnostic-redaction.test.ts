import {
  type DiagnosticLogArgument,
  type DiagnosticLogger,
  NostrRemoteSignerBunker,
  NostrRemoteSignerClient,
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

function expectSafeDiagnostics(
  diagnostics: CapturedDiagnostic[],
  sensitiveValues: string[],
): void {
  const rendered = renderDiagnostics(diagnostics);

  for (const sensitiveValue of sensitiveValues) {
    expect(rendered).not.toContain(sensitiveValue);
  }

  expect(rendered).toContain("sign_event");
  expect(diagnostics.length).toBeGreaterThan(0);
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
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new SimpleNIP46Bunker(
      [relayUrl],
      userKeys.publicKey,
      signerKeys.publicKey,
      {
        secret: connectionSecret,
        defaultPermissions: ["get_public_key", "ping", "sign_event"],
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

      expectSafeDiagnostics(clientDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
      ]);
      expectSafeDiagnostics(bunkerDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
      ]);
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
    const clientDiagnostics = createCapturingLogger();
    const bunkerDiagnostics = createCapturingLogger();
    const bunker = new NostrRemoteSignerBunker({
      userPubkey: userKeys.publicKey,
      signerPubkey: signerKeys.publicKey,
      relays: [relayUrl],
      secret: connectionSecret,
      defaultPermissions: ["get_public_key", "ping", "sign_event"],
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

      expectSafeDiagnostics(clientDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
      ]);
      expectSafeDiagnostics(bunkerDiagnostics.diagnostics, [
        connectionSecret,
        eventPlaintext,
      ]);
    } finally {
      await client.disconnect().catch(() => undefined);
      await bunker.stop().catch(() => undefined);
    }
  });
});
