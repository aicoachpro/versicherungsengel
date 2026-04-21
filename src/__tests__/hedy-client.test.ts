import { describe, it, expect, vi } from "vitest";
import { HedyClient, HedyApiError } from "@/lib/hedy/client";

function mockFetch(responses: Array<{ status: number; body: string | object }>) {
  let call = 0;
  return vi.fn(async () => {
    const r = responses[Math.min(call, responses.length - 1)];
    call++;
    const body = typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return new Response(body, { status: r.status, headers: { "Content-Type": "application/json" } });
  }) as unknown as typeof fetch;
}

describe("HedyClient", () => {
  it("setzt Bearer-Token und EU-URL", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch;
    const client = new HedyClient({ apiKey: "abc123", region: "eu", fetchImpl });
    await client.listSessions({ limit: 5 });
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(String(call[0])).toContain("https://eu-api.hedy.bot/sessions");
    expect(String(call[0])).toContain("limit=5");
    const init = call[1] as RequestInit;
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer abc123");
  });

  it("US-Region greift auf api.hedy.bot zu", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })) as unknown as typeof fetch;
    const client = new HedyClient({ apiKey: "k", region: "us", fetchImpl });
    await client.listSessions();
    const call = (fetchImpl as unknown as { mock: { calls: unknown[][] } }).mock.calls[0];
    expect(String(call[0])).toContain("https://api.hedy.bot/sessions");
  });

  it("extrahiert Sessions aus data-Feld", async () => {
    const fetchImpl = mockFetch([{ status: 200, body: { success: true, data: [{ id: "s1" }, { id: "s2" }] } }]);
    const client = new HedyClient({ apiKey: "k", fetchImpl });
    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).toBe("s1");
  });

  it("akzeptiert rohes Array (Zapier-Format)", async () => {
    const fetchImpl = mockFetch([{ status: 200, body: [{ id: "s1" }] }]);
    const client = new HedyClient({ apiKey: "k", fetchImpl });
    const sessions = await client.listSessions();
    expect(sessions).toHaveLength(1);
  });

  it("wirft HedyApiError bei 401", async () => {
    const fetchImpl = mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
    const client = new HedyClient({ apiKey: "wrong", fetchImpl });
    await expect(client.listSessions()).rejects.toThrow(HedyApiError);
  });

  it("testConnection liefert ok=true bei 200", async () => {
    const fetchImpl = mockFetch([{ status: 200, body: { data: [] } }]);
    const client = new HedyClient({ apiKey: "k", fetchImpl });
    const r = await client.testConnection();
    expect(r.ok).toBe(true);
  });

  it("testConnection liefert ok=false bei 401", async () => {
    const fetchImpl = mockFetch([{ status: 401, body: { error: "unauthorized" } }]);
    const client = new HedyClient({ apiKey: "wrong", fetchImpl });
    const r = await client.testConnection();
    expect(r.ok).toBe(false);
    expect(r.status).toBe(401);
    expect(r.message).toContain("ungueltig");
  });

  it("konstruiert nicht ohne API-Key", () => {
    expect(() => new HedyClient({ apiKey: "" })).toThrow(HedyApiError);
  });

  it("extrahiert Session-Objekt aus data-Wrapper", async () => {
    const fetchImpl = mockFetch([{ status: 200, body: { data: { id: "s1", title: "Meeting" } } }]);
    const client = new HedyClient({ apiKey: "k", fetchImpl });
    const s = await client.getSession("s1");
    expect(s.id).toBe("s1");
    expect(s.title).toBe("Meeting");
  });

  it("getBundle toleriert fehlende Highlights/Todos", async () => {
    // session.ok, highlights 404, todos 500 -> highlights/todos = []
    const responses = [
      { status: 200, body: { data: { id: "s1", title: "X" } } }, // session
      { status: 404, body: { error: "nf" } }, // highlights
      { status: 500, body: { error: "boom" } }, // todos
    ];
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      const r = responses[call++];
      return new Response(JSON.stringify(r.body), { status: r.status });
    }) as unknown as typeof fetch;
    const client = new HedyClient({ apiKey: "k", fetchImpl });
    const b = await client.getBundle("s1");
    expect(b.session.id).toBe("s1");
    expect(b.highlights).toEqual([]);
    expect(b.todos).toEqual([]);
  });
});
