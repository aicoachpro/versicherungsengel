import { describe, it, expect } from "vitest";
import { isProviderPaused, isMonthFullyPaused } from "@/lib/provider-pause";

describe("isProviderPaused", () => {
  const today = new Date("2026-05-03T12:00:00Z");

  it("returns false when pausedUntil is null", () => {
    expect(isProviderPaused(null, today)).toBe(false);
    expect(isProviderPaused(undefined, today)).toBe(false);
  });

  it("returns true when pausedUntil is today or later", () => {
    expect(isProviderPaused("2026-05-03", today)).toBe(true);
    expect(isProviderPaused("2026-05-15", today)).toBe(true);
    expect(isProviderPaused("2027-01-01", today)).toBe(true);
  });

  it("returns false when pausedUntil is in the past", () => {
    expect(isProviderPaused("2026-05-02", today)).toBe(false);
    expect(isProviderPaused("2025-12-31", today)).toBe(false);
  });
});

describe("isMonthFullyPaused (VOE-175 overlap heuristic)", () => {
  it("returns false when pausedUntil is null", () => {
    expect(isMonthFullyPaused(null, "2026-05")).toBe(false);
  });

  it("treats current month as paused even if pause does not reach month-end", () => {
    // Pause from 03.05. to 15.05. → May should be paused
    expect(isMonthFullyPaused("2026-05-15", "2026-05", "2026-05-03")).toBe(true);
  });

  it("treats month as paused when pause spans the entire month", () => {
    expect(isMonthFullyPaused("2026-05-31", "2026-05", "2026-05-01")).toBe(true);
  });

  it("treats future month as paused only when pause reaches into it", () => {
    expect(isMonthFullyPaused("2026-06-15", "2026-06", "2026-05-03")).toBe(true);
    expect(isMonthFullyPaused("2026-05-31", "2026-06", "2026-05-03")).toBe(false);
  });

  it("does not pause months before pausedFrom", () => {
    // Pause starts 03.05.2026 → April should NOT be paused
    expect(isMonthFullyPaused("2026-05-31", "2026-04", "2026-05-03")).toBe(false);
  });

  it("falls back to start-of-month when pausedFrom is missing (backwards-compat)", () => {
    // Legacy provider with only pausedUntil = 31.05.: assume pause started 01.05.
    expect(isMonthFullyPaused("2026-05-31", "2026-05", null)).toBe(true);
    // April is NOT paused under fallback (pausedFrom defaults to 01.05.)
    expect(isMonthFullyPaused("2026-05-31", "2026-04", null)).toBe(false);
  });

  it("does not pause months after the pause ends", () => {
    expect(isMonthFullyPaused("2026-05-15", "2026-07", "2026-05-03")).toBe(false);
  });
});
