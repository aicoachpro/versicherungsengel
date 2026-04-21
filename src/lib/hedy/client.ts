import type {
  HedyClientOptions,
  HedySession,
  HedyHighlight,
  HedyTodo,
  HedyApiListResponse,
  HedyApiObjectResponse,
  HedyBundle,
  HedyRegion,
} from "./types";

const DEFAULT_TIMEOUT_MS = 15_000;

function regionBaseUrl(region: HedyRegion): string {
  return region === "us" ? "https://api.hedy.bot" : "https://eu-api.hedy.bot";
}

export class HedyApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly body?: string,
  ) {
    super(message);
    this.name = "HedyApiError";
  }
}

export class HedyClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(opts: HedyClientOptions) {
    if (!opts.apiKey) {
      throw new HedyApiError("Hedy API-Key fehlt");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = opts.baseUrl?.replace(/\/$/, "") ?? regionBaseUrl(opts.region ?? "eu");
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  private async request<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
      }
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await this.fetchImpl(url.toString(), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      });

      const text = await res.text();

      if (!res.ok) {
        throw new HedyApiError(
          `Hedy API ${res.status} ${res.statusText}`,
          res.status,
          text.slice(0, 500),
        );
      }

      try {
        return JSON.parse(text) as T;
      } catch {
        throw new HedyApiError("Hedy API: ungueltige JSON-Antwort", res.status, text.slice(0, 200));
      }
    } catch (err) {
      if (err instanceof HedyApiError) throw err;
      if ((err as Error).name === "AbortError") {
        throw new HedyApiError(`Hedy API Timeout nach ${this.timeoutMs}ms`);
      }
      throw new HedyApiError(`Hedy API Fehler: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Liste Sessions — optional gefiltert.
   * Akzeptiert paginierte Response mit `data` Array oder rohes Array (Zapier-Format).
   */
  async listSessions(params?: { limit?: number; after?: string }): Promise<HedySession[]> {
    const resp = await this.request<HedyApiListResponse<HedySession> | HedySession[]>(
      "/sessions",
      params,
    );
    return extractList(resp);
  }

  async getSession(sessionId: string): Promise<HedySession> {
    const resp = await this.request<HedyApiObjectResponse<HedySession> | HedySession>(
      `/sessions/${encodeURIComponent(sessionId)}`,
    );
    return extractObject(resp);
  }

  async getSessionHighlights(sessionId: string): Promise<HedyHighlight[]> {
    const resp = await this.request<HedyApiListResponse<HedyHighlight> | HedyHighlight[]>(
      `/sessions/${encodeURIComponent(sessionId)}/highlights`,
    );
    return extractList(resp);
  }

  async getSessionTodos(sessionId: string): Promise<HedyTodo[]> {
    const resp = await this.request<HedyApiListResponse<HedyTodo> | HedyTodo[]>(
      `/sessions/${encodeURIComponent(sessionId)}/todos`,
    );
    return extractList(resp);
  }

  async getBundle(sessionId: string): Promise<HedyBundle> {
    const [session, highlights, todos] = await Promise.all([
      this.getSession(sessionId),
      this.getSessionHighlights(sessionId).catch(() => [] as HedyHighlight[]),
      this.getSessionTodos(sessionId).catch(() => [] as HedyTodo[]),
    ]);
    return { session, highlights, todos };
  }

  /**
   * Test: API-Key gueltig? 200 = ok, 401/403 = invalid, anderes = network/andere.
   */
  async testConnection(): Promise<{ ok: boolean; status?: number; message: string }> {
    try {
      await this.listSessions({ limit: 1 });
      return { ok: true, message: "Verbindung erfolgreich" };
    } catch (err) {
      if (err instanceof HedyApiError) {
        return {
          ok: false,
          status: err.status,
          message: err.status === 401 || err.status === 403
            ? "API-Key ungueltig oder keine Berechtigung"
            : err.message,
        };
      }
      return { ok: false, message: (err as Error).message };
    }
  }
}

function extractList<T>(resp: HedyApiListResponse<T> | T[]): T[] {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp?.data)) return resp.data;
  return [];
}

function extractObject<T>(resp: HedyApiObjectResponse<T> | T): T {
  if (resp && typeof resp === "object" && "data" in (resp as Record<string, unknown>)) {
    const obj = resp as HedyApiObjectResponse<T>;
    if (obj.data) return obj.data;
  }
  return resp as T;
}
