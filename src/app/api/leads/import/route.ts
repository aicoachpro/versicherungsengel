import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProducts } from "@/db/schema";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { parseTermin } from "@/lib/parse-termin";
import { eq } from "drizzle-orm";

interface ImportLead {
  name: string;
  ansprechpartner?: string;
  email?: string;
  telefon?: string;
  website?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  gewerbeart?: string;
  branche?: string;
  unternehmensgroesse?: string;
  umsatzklasse?: string;
  termin?: string;
  eingangsdatum?: string;
  terminKosten?: number;
  umsatz?: number;
  notizen?: string;
  naechsterSchritt?: string;
  produkt?: string;
  providerId?: number;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const rows: ImportLead[] = body.leads;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: "Keine Leads zum Importieren" }, { status: 400 });
  }

  const results: { row: number; success: boolean; error?: string; name?: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row.name || !row.name.trim()) {
      results.push({ row: i + 1, success: false, error: "Name fehlt" });
      continue;
    }

    try {
      // Produkt-Name zu productId aufloesen
      let productId: number | null = null;
      if (row.produkt?.trim()) {
        const produktName = row.produkt.trim().toLowerCase();
        const allProducts = db.select().from(leadProducts).all();
        const match = allProducts.find((p) =>
          p.name.toLowerCase() === produktName ||
          p.name.toLowerCase().includes(produktName) ||
          produktName.includes(p.name.toLowerCase())
        );
        if (match) productId = match.id;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const values: any = {
        name: row.name.trim(),
        phase: "Termin eingegangen",
        ansprechpartner: row.ansprechpartner?.trim() || null,
        email: row.email?.trim() || null,
        telefon: row.telefon?.trim() || null,
        website: row.website?.trim() || null,
        strasse: row.strasse?.trim() || null,
        plz: row.plz?.trim() || null,
        ort: row.ort?.trim() || null,
        gewerbeart: row.gewerbeart?.trim() || null,
        branche: row.branche?.trim() || null,
        unternehmensgroesse: row.unternehmensgroesse?.trim() || null,
        umsatzklasse: row.umsatzklasse?.trim() || null,
        termin: parseTermin(row.termin?.trim()) || null,
        eingangsdatum: row.eingangsdatum?.trim() || new Date().toISOString().split("T")[0],
        terminKosten: row.terminKosten ?? 320,
        umsatz: row.umsatz || null,
        notizen: row.notizen?.trim() || null,
        naechsterSchritt: row.naechsterSchritt?.trim() || null,
        providerId: row.providerId || null,
        productId,
      };
      const result = db.insert(leads).values(values).returning().get();

      results.push({ row: i + 1, success: true, name: result.name });
    } catch (err) {
      results.push({ row: i + 1, success: false, error: String(err), name: row.name });
    }
  }

  const imported = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  const { userId, userName } = getAuditUser(session);
  logAudit({
    userId, userName,
    action: "create",
    entity: "lead",
    entityId: 0,
    entityName: `Import: ${imported} Leads`,
    changes: { imported, failed, total: rows.length },
  });

  return NextResponse.json({ imported, failed, total: rows.length, details: results }, { status: 201 });
}
