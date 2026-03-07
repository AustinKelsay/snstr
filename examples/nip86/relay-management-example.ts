import {
  LocalKeySigner,
  RelayManagementClient,
  createReportEvent,
  generateKeypair,
  parseReportEvent,
  useRelayManagementFetchImplementation,
  withProtectedTag,
} from "../../src";

async function run() {
  const adminKeys = await generateKeypair();
  const signer = new LocalKeySigner(adminKeys.privateKey);

  useRelayManagementFetchImplementation(
    (async (_url: string, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body || "{}")) as {
        method?: string;
      };

      if (request.method === "supportedmethods") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            result: ["supportedmethods", "banpubkey", "listbannedpubkeys"],
          }),
        } as Response;
      }

      return {
        ok: true,
        status: 200,
        json: async () => ({ result: true }),
      } as Response;
    }) as typeof fetch,
  );

  const management = new RelayManagementClient("wss://relay.example.com", {
    signer,
  });

  const supportedMethods = await management.supportedMethods();
  console.log("Supported relay management methods:", supportedMethods);

  const reportTemplate = createReportEvent([
    {
      type: "e",
      value: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
      reportType: "spam",
      pubkey:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  ]);

  const protectedReport = {
    ...reportTemplate,
    tags: withProtectedTag(reportTemplate.tags || []),
  };

  const signedReport = await signer.signEvent(protectedReport);
  console.log("Signed protected report:", parseReportEvent(signedReport));
}

run().catch((error) => {
  console.error("NIP-86 example failed:", error);
});
