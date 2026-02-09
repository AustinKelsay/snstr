import { NostrRelay } from "./ephemeral-relay";

let relay: NostrRelay | null = null;

export async function startEphemeralRelay(port: number = 0): Promise<string> {
  relay = new NostrRelay(port);
  await relay.start();
  return relay.url;
}

export async function stopEphemeralRelay(): Promise<void> {
  if (relay) {
    try {
      // Close the relay and wait for it to finish
      await relay.close();
    } catch (error) {
      console.error("Error closing ephemeral relay:", error);
    } finally {
      // Ensure the relay reference is cleared even if there's an error
      relay = null;

      // Add a longer delay to ensure all resources are released
      // This helps prevent test failures due to port conflicts
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
