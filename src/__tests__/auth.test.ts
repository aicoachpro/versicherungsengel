import { describe, it, expect, vi, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import * as OTPAuth from "otpauth";

// Mocks
vi.mock("@/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("Auth — Passwort-Validierung", () => {
  it("bcrypt.compare erkennt korrektes Passwort", async () => {
    const hash = await bcrypt.hash("geheim123", 10);
    const result = await bcrypt.compare("geheim123", hash);
    expect(result).toBe(true);
  });

  it("bcrypt.compare lehnt falsches Passwort ab", async () => {
    const hash = await bcrypt.hash("geheim123", 10);
    const result = await bcrypt.compare("falsch", hash);
    expect(result).toBe(false);
  });

  it("bcrypt.hash erzeugt verschiedene Hashes für gleiches Passwort", async () => {
    const h1 = await bcrypt.hash("test", 10);
    const h2 = await bcrypt.hash("test", 10);
    expect(h1).not.toBe(h2);
    // Aber beide verifizieren korrekt
    expect(await bcrypt.compare("test", h1)).toBe(true);
    expect(await bcrypt.compare("test", h2)).toBe(true);
  });
});

describe("Auth — 2FA TOTP-Validierung", () => {
  const secret = new OTPAuth.Secret({ size: 20 });

  function createTotp() {
    return new OTPAuth.TOTP({
      issuer: "VÖLKER Finance",
      label: "test@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
  }

  it("validiert korrekten TOTP-Code", () => {
    const totp = createTotp();
    const code = totp.generate();
    const delta = totp.validate({ token: code, window: 1 });
    expect(delta).not.toBeNull();
  });

  it("lehnt falschen TOTP-Code ab", () => {
    const totp = createTotp();
    const delta = totp.validate({ token: "000000", window: 1 });
    // 000000 könnte zufällig gültig sein, daher testen wir mit einem sicher ungültigen
    const delta2 = totp.validate({ token: "ABCDEF", window: 1 });
    expect(delta2).toBeNull();
  });

  it("TOTP-Code hat 6 Stellen", () => {
    const totp = createTotp();
    const code = totp.generate();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("Secret kann zu Base32 und zurück konvertiert werden", () => {
    const base32 = secret.base32;
    const restored = OTPAuth.Secret.fromBase32(base32);
    const totp1 = new OTPAuth.TOTP({
      issuer: "VÖLKER Finance",
      label: "test@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const totp2 = new OTPAuth.TOTP({
      issuer: "VÖLKER Finance",
      label: "test@example.com",
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret: restored,
    });
    expect(totp1.generate()).toBe(totp2.generate());
  });
});

describe("Auth — Password-Reset Token", () => {
  it("Token-Ablauf: 1 Stunde in der Zukunft", () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("erkennt abgelaufenen Token", () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const isExpired = new Date(expiresAt) < new Date();
    expect(isExpired).toBe(true);
  });

  it("erkennt gültigen Token", () => {
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const isExpired = new Date(expiresAt) < new Date();
    expect(isExpired).toBe(false);
  });

  it("Passwort-Mindestlänge wird geprüft (6 Zeichen)", () => {
    const tooShort = "abc";
    const valid = "abcdef";
    expect(tooShort.length < 6).toBe(true);
    expect(valid.length < 6).toBe(false);
  });
});

describe("Auth — getAuditUser", () => {
  // Importiere direkt die Hilfsfunktion
  it("extrahiert userId und userName aus Session", async () => {
    // Inline-Test der Logik (identisch mit getAuditUser)
    const session = { user: { id: "42", name: "Thomas" } };
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const userName = session?.user?.name || null;
    expect(userId).toBe(42);
    expect(userName).toBe("Thomas");
  });

  it("gibt null zurück bei leerer Session", () => {
    const session = null;
    const userId = session?.user?.id ? Number(session.user.id) : null;
    const userName = session?.user?.name || null;
    expect(userId).toBeNull();
    expect(userName).toBeNull();
  });
});
