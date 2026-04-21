// Hedy API Typen basierend auf https://www.hedy.ai/developers
// Stand: 2026-04-21

export type HedyRegion = "eu" | "us";

export interface HedyParticipant {
  name?: string;
  email?: string;
  role?: string;
}

export interface HedySession {
  id: string;
  title?: string;
  startedAt?: string; // ISO
  endedAt?: string; // ISO
  participants?: HedyParticipant[];
  topicId?: string;
  recap?: string;
  notes?: string;
  transcript?: string;
  cleanedTranscript?: string;
  language?: string;
  duration?: number;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface HedyHighlight {
  id: string;
  sessionId?: string;
  title?: string;
  timestamp?: string;
  quote?: string;
  cleanedQuote?: string;
  mainIdea?: string;
  insight?: string;
  [key: string]: unknown;
}

export interface HedyTodo {
  id: string;
  sessionId?: string;
  title?: string;
  description?: string;
  assignee?: string;
  dueDate?: string;
  status?: string;
  [key: string]: unknown;
}

export interface HedyApiListResponse<T> {
  success?: boolean;
  data?: T[];
  hasMore?: boolean;
  next?: string;
  total?: number;
}

export interface HedyApiObjectResponse<T> {
  success?: boolean;
  data?: T;
}

export interface HedyClientOptions {
  apiKey: string;
  region?: HedyRegion;
  baseUrl?: string; // Override (fuer Tests)
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface HedyBundle {
  session: HedySession;
  highlights: HedyHighlight[];
  todos: HedyTodo[];
}
