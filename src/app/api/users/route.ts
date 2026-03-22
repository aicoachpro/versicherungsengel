import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, passwordResetTokens } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendWelcomeEmail } from "@/lib/email";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const user = db
    .select()
    .from(users)
    .where(eq(users.id, Number(session.user.id)))
    .get();
  if (!user || user.role !== "admin") return null;
  return user;
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const allUsers = db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      totpEnabled: users.totpEnabled,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(sql`${users.createdAt} DESC`)
    .all();

  return NextResponse.json(allUsers);
}

export async function POST(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.name || !body.email) {
    return NextResponse.json({ error: "Name und E-Mail erforderlich" }, { status: 400 });
  }

  const existing = db.select().from(users).where(eq(users.email, body.email)).get();
  if (existing) {
    return NextResponse.json({ error: "E-Mail-Adresse bereits vergeben" }, { status: 400 });
  }

  // Set a random temporary password — user will set their own via invite link
  const tempPassword = crypto.randomBytes(16).toString("hex");
  const hash = await bcrypt.hash(tempPassword, 10);
  const result = db
    .insert(users)
    .values({
      name: body.name,
      email: body.email,
      passwordHash: hash,
      role: body.role || "user",
    })
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .get();

  // Create invite token (24h validity)
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.insert(passwordResetTokens).values({
    userId: result.id,
    token,
    expiresAt,
  }).run();

  // Send welcome email
  const baseUrl = process.env.AUTH_URL || req.nextUrl.origin;
  const setPasswordUrl = `${baseUrl}/reset-password?token=${token}`;
  try {
    await sendWelcomeEmail(body.email, setPasswordUrl, body.name, admin.name);
  } catch (error) {
    console.error("Failed to send welcome email:", error);
  }

  return NextResponse.json(result, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const body = await req.json();
  if (!body.id) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.email) updates.email = body.email;
  if (body.role) updates.role = body.role;
  if (body.password) updates.passwordHash = await bcrypt.hash(body.password, 10);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Keine Änderungen" }, { status: 400 });
  }

  const result = db
    .update(users)
    .set(updates)
    .where(eq(users.id, body.id))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .get();

  return NextResponse.json(result);
}

export async function DELETE(req: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "ID erforderlich" }, { status: 400 });

  if (id === admin.id) {
    return NextResponse.json({ error: "Du kannst dich nicht selbst löschen" }, { status: 400 });
  }

  // Prüfen ob Nutzer existiert
  const userToDelete = db.select().from(users).where(eq(users.id, id)).get();
  if (!userToDelete) {
    return NextResponse.json({ error: "Nutzer nicht gefunden" }, { status: 404 });
  }

  try {
    // Zuerst abhängige Datensätze löschen (Foreign Key)
    db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, id)).run();
    db.delete(users).where(eq(users.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Fehler beim Löschen des Nutzers:", message);
    return NextResponse.json({ error: `Löschen fehlgeschlagen: ${message}` }, { status: 500 });
  }
}
