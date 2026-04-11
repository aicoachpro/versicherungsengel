import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Nur Admins duerfen Verzeichnisse browsen
  const user = db.select().from(users).where(eq(users.id, Number(session.user.id))).get();
  if (!user || user.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  let dir = searchParams.get("path") || "/";

  // Pfad sanitizen — keine .. erlauben
  dir = path.resolve(dir);

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith("."))
      .map((e) => ({
        name: e.name,
        path: path.join(dir, e.name),
        isObsidianVault: fs.existsSync(path.join(dir, e.name, ".obsidian")),
      }))
      .sort((a, b) => {
        // Obsidian Vaults zuerst
        if (a.isObsidianVault && !b.isObsidianVault) return -1;
        if (!a.isObsidianVault && b.isObsidianVault) return 1;
        return a.name.localeCompare(b.name);
      });

    return NextResponse.json({
      current: dir,
      parent: dir === "/" ? null : path.dirname(dir),
      dirs,
      isObsidianVault: fs.existsSync(path.join(dir, ".obsidian")),
    });
  } catch {
    return NextResponse.json({ error: "Verzeichnis nicht lesbar" }, { status: 400 });
  }
}
