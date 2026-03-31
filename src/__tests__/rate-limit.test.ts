import { describe, it, expect, beforeEach } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  // Jeder Test bekommt einen eigenen Key, damit kein State-Leak
  let testKey: string;
  beforeEach(() => {
    testKey = `test-${Date.now()}-${Math.random()}`;
  });

  it("erlaubt den ersten Request", () => {
    const result = checkRateLimit(testKey, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.retryAfterMs).toBe(0);
  });

  it("zählt remaining korrekt runter", () => {
    checkRateLimit(testKey, 3, 60_000);
    checkRateLimit(testKey, 3, 60_000);
    const result = checkRateLimit(testKey, 3, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("blockiert bei Limit-Überschreitung", () => {
    for (let i = 0; i < 3; i++) {
      checkRateLimit(testKey, 3, 60_000);
    }
    const result = checkRateLimit(testKey, 3, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("gibt retryAfterMs zurück wenn blockiert", () => {
    for (let i = 0; i < 2; i++) {
      checkRateLimit(testKey, 2, 60_000);
    }
    const result = checkRateLimit(testKey, 2, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("verschiedene Keys sind unabhängig", () => {
    const key1 = `${testKey}-a`;
    const key2 = `${testKey}-b`;
    checkRateLimit(key1, 1, 60_000);
    // key1 ist jetzt voll
    const r1 = checkRateLimit(key1, 1, 60_000);
    expect(r1.allowed).toBe(false);
    // key2 hat noch Platz
    const r2 = checkRateLimit(key2, 1, 60_000);
    expect(r2.allowed).toBe(true);
  });
});
