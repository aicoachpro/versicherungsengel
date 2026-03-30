import { db } from "@/db";
import { auditLogs } from "@/db/schema";

type Action = "create" | "update" | "delete" | "archive" | "restore";
type Entity = "lead" | "insurance" | "activity" | "document" | "user";

interface AuditParams {
  userId: number | null;
  userName: string | null;
  action: Action;
  entity: Entity;
  entityId: number;
  entityName?: string;
  changes?: Record<string, unknown>;
}

export function logAudit({
  userId,
  userName,
  action,
  entity,
  entityId,
  entityName,
  changes,
}: AuditParams) {
  try {
    db.insert(auditLogs).values({
      userId,
      userName,
      action,
      entity,
      entityId,
      entityName: entityName || null,
      changes: changes ? JSON.stringify(changes) : null,
    }).run();
  } catch (err) {
    console.error("Audit-Log Fehler:", err);
  }
}

/**
 * Extrahiert userId und userName aus einer NextAuth Session.
 */
export function getAuditUser(session: { user?: { id?: string; name?: string | null } } | null) {
  return {
    userId: session?.user?.id ? Number(session.user.id) : null,
    userName: session?.user?.name || null,
  };
}
