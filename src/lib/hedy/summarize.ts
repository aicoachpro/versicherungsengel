import type { HedyBundle, HedyHighlight, HedyTodo } from "./types";

/**
 * Baut aus einem Hedy-Bundle einen Markdown-formatierten Text,
 * der als Activity-Notiz oder in Lead-Notizen landen kann.
 */
export function summarizeBundle(bundle: HedyBundle): string {
  const parts: string[] = [];
  const { session, highlights, todos } = bundle;

  if (session.title) {
    parts.push(`# ${session.title}`);
  }

  const dauerMin = session.duration ? Math.round(session.duration / 60) : null;
  const meta: string[] = [];
  if (session.startedAt) meta.push(`Start: ${formatDate(session.startedAt)}`);
  if (dauerMin !== null) meta.push(`Dauer: ${dauerMin} min`);
  if (session.participants && session.participants.length > 0) {
    meta.push(`Teilnehmer: ${session.participants.map((p) => p.name || p.email).filter(Boolean).join(", ")}`);
  }
  if (meta.length > 0) parts.push(meta.join(" · "));

  if (session.recap) {
    parts.push("## Zusammenfassung");
    parts.push(session.recap.trim());
  }

  if (session.notes) {
    parts.push("## Meeting-Notizen");
    parts.push(session.notes.trim());
  }

  if (highlights.length > 0) {
    parts.push("## Highlights");
    parts.push(highlights.map(formatHighlight).join("\n"));
  }

  if (todos.length > 0) {
    parts.push("## Offene To-Dos");
    parts.push(todos.map(formatTodo).join("\n"));
  }

  parts.push(`\n_Importiert aus Hedy — Session ${session.id}_`);

  return parts.join("\n\n").trim();
}

function formatHighlight(h: HedyHighlight): string {
  const title = h.title || h.mainIdea || "Highlight";
  const quote = h.cleanedQuote || h.quote;
  const insight = h.insight;
  let line = `- **${title}**`;
  if (quote) line += `\n  > ${quote.replace(/\n+/g, " ")}`;
  if (insight) line += `\n  ${insight}`;
  return line;
}

function formatTodo(t: HedyTodo): string {
  const title = t.title || t.description || "ToDo";
  const meta: string[] = [];
  if (t.assignee) meta.push(`@${t.assignee}`);
  if (t.dueDate) meta.push(`faellig ${formatDate(t.dueDate)}`);
  const suffix = meta.length > 0 ? ` (${meta.join(", ")})` : "";
  return `- [ ] ${title}${suffix}`;
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}
