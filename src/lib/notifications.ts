import { db } from "@/db";
import { notifications } from "@/db/schema";

type NotificationType = "new_lead" | "folgetermin" | "phase_change" | "reklamation" | "system";

export function createNotification(opts: {
  type: NotificationType;
  title: string;
  message: string;
  entityId?: number;
}) {
  return db.insert(notifications).values({
    type: opts.type,
    title: opts.title,
    message: opts.message,
    entityId: opts.entityId ?? null,
  }).run();
}
