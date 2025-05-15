import { NostrEvent } from "../src/types/nostr";
import * as nip07 from "../src/nip07";

// Mock window.nostr object for testing
const mockEvent: Omit<NostrEvent, "id" | "pubkey" | "sig"> = {
  kind: 1,
  created_at: Math.floor(Date.now() / 1000),
  tags: [],
  content: "Test content",
};

const mockSignedEvent: NostrEvent = {
  ...mockEvent,
  id: "test-id",
  pubkey: "test-pubkey",
  sig: "test-signature",
};

// Mock implementation functions
const mockGetPublicKey = jest.fn().mockResolvedValue("test-pubkey");
const mockSignEvent = jest.fn().mockResolvedValue(mockSignedEvent);
const mockEncryptNip04 = jest.fn().mockResolvedValue("encrypted-with-nip04");
const mockDecryptNip04 = jest.fn().mockResolvedValue("decrypted-with-nip04");
const mockEncryptNip44 = jest.fn().mockResolvedValue("encrypted-with-nip44");
const mockDecryptNip44 = jest.fn().mockResolvedValue("decrypted-with-nip44");

describe("NIP-07 Core Functions", () => {
  beforeEach(() => {
    // Reset mocks between tests
    jest.clearAllMocks();

    // Setup the global window object with mock nostr implementation
    (global as any).window = {
      nostr: {
        getPublicKey: mockGetPublicKey,
        signEvent: mockSignEvent,
        nip04: {
          encrypt: mockEncryptNip04,
          decrypt: mockDecryptNip04,
        },
        nip44: {
          encrypt: mockEncryptNip44,
          decrypt: mockDecryptNip44,
        },
      },
    };
  });

  afterEach(() => {
    // Clean up the mock
    delete (global as any).window;
  });

  describe("hasNip07Support", () => {
    it("should return true when window.nostr is available", () => {
      expect(nip07.hasNip07Support()).toBe(true);
    });

    it("should return false when window.nostr is not available", () => {
      delete (global as any).window.nostr;
      expect(nip07.hasNip07Support()).toBe(false);
    });

    it("should return false when window is not defined", () => {
      delete (global as any).window;
      expect(nip07.hasNip07Support()).toBe(false);
    });
  });

  describe("getPublicKey", () => {
    it("should call window.nostr.getPublicKey and return the result", async () => {
      const result = await nip07.getPublicKey();
      expect(result).toBe("test-pubkey");
      expect(mockGetPublicKey).toHaveBeenCalledTimes(1);
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.getPublicKey()).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockGetPublicKey.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.getPublicKey()).rejects.toThrow(
        "Failed to get public key",
      );
    });
  });

  describe("signEvent", () => {
    it("should call window.nostr.signEvent and return the signed event", async () => {
      const result = await nip07.signEvent(mockEvent);
      expect(result).toEqual(mockSignedEvent);
      expect(mockSignEvent).toHaveBeenCalledTimes(1);
      expect(mockSignEvent).toHaveBeenCalledWith(mockEvent);
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.signEvent(mockEvent)).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockSignEvent.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.signEvent(mockEvent)).rejects.toThrow(
        "Failed to sign event",
      );
    });
  });

  describe("encryptNip04", () => {
    it("should call window.nostr.nip04.encrypt and return the encrypted message", async () => {
      const result = await nip07.encryptNip04("recipient-pubkey", "plaintext");
      expect(result).toBe("encrypted-with-nip04");
      expect(mockEncryptNip04).toHaveBeenCalledTimes(1);
      expect(mockEncryptNip04).toHaveBeenCalledWith(
        "recipient-pubkey",
        "plaintext",
      );
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.encryptNip04("pubkey", "plaintext")).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if nip04 encryption is not supported", async () => {
      delete (global as any).window.nostr.nip04;
      await expect(nip07.encryptNip04("pubkey", "plaintext")).rejects.toThrow(
        "NIP-04 encryption not supported",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockEncryptNip04.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.encryptNip04("pubkey", "plaintext")).rejects.toThrow(
        "Failed to encrypt message",
      );
    });
  });

  describe("decryptNip04", () => {
    it("should call window.nostr.nip04.decrypt and return the decrypted message", async () => {
      const result = await nip07.decryptNip04("sender-pubkey", "ciphertext");
      expect(result).toBe("decrypted-with-nip04");
      expect(mockDecryptNip04).toHaveBeenCalledTimes(1);
      expect(mockDecryptNip04).toHaveBeenCalledWith(
        "sender-pubkey",
        "ciphertext",
      );
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.decryptNip04("pubkey", "ciphertext")).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if nip04 decryption is not supported", async () => {
      delete (global as any).window.nostr.nip04;
      await expect(nip07.decryptNip04("pubkey", "ciphertext")).rejects.toThrow(
        "NIP-04 decryption not supported",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockDecryptNip04.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.decryptNip04("pubkey", "ciphertext")).rejects.toThrow(
        "Failed to decrypt message",
      );
    });
  });

  describe("encryptNip44", () => {
    it("should call window.nostr.nip44.encrypt and return the encrypted message", async () => {
      const result = await nip07.encryptNip44("recipient-pubkey", "plaintext");
      expect(result).toBe("encrypted-with-nip44");
      expect(mockEncryptNip44).toHaveBeenCalledTimes(1);
      expect(mockEncryptNip44).toHaveBeenCalledWith(
        "recipient-pubkey",
        "plaintext",
      );
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.encryptNip44("pubkey", "plaintext")).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if nip44 encryption is not supported", async () => {
      delete (global as any).window.nostr.nip44;
      await expect(nip07.encryptNip44("pubkey", "plaintext")).rejects.toThrow(
        "NIP-44 encryption not supported",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockEncryptNip44.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.encryptNip44("pubkey", "plaintext")).rejects.toThrow(
        "Failed to encrypt message",
      );
    });
  });

  describe("decryptNip44", () => {
    it("should call window.nostr.nip44.decrypt and return the decrypted message", async () => {
      const result = await nip07.decryptNip44("sender-pubkey", "ciphertext");
      expect(result).toBe("decrypted-with-nip44");
      expect(mockDecryptNip44).toHaveBeenCalledTimes(1);
      expect(mockDecryptNip44).toHaveBeenCalledWith(
        "sender-pubkey",
        "ciphertext",
      );
    });

    it("should throw an error if NIP-07 is not supported", async () => {
      delete (global as any).window.nostr;
      await expect(nip07.decryptNip44("pubkey", "ciphertext")).rejects.toThrow(
        "NIP-07 extension not available",
      );
    });

    it("should throw an error if nip44 decryption is not supported", async () => {
      delete (global as any).window.nostr.nip44;
      await expect(nip07.decryptNip44("pubkey", "ciphertext")).rejects.toThrow(
        "NIP-44 decryption not supported",
      );
    });

    it("should throw an error if the extension call fails", async () => {
      mockDecryptNip44.mockRejectedValueOnce(new Error("Extension error"));
      await expect(nip07.decryptNip44("pubkey", "ciphertext")).rejects.toThrow(
        "Failed to decrypt message",
      );
    });
  });
});
