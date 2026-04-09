import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, insurances, leadProducts, leadProviders, superchatAttributes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createContact, updateContact, findContactByHandle } from "@/lib/superchat";

// Fallback IDs (werden durch DB-Sync ueberschrieben)
const FALLBACK_IDS: Record<string, string> = {
  "Leadquelle": "ca_qovxvsnZGEJmPscEky8HU",
  "Lead Produkt": "ca_TUwAmMu5QOzpmf2wIcbKW",
  "Lead Eingangsdatum": "ca_by8bMKbLolULXKjXwJ64u",
  "Lead Conversion": "ca_kLorvm5KXX5ikAyMc5SNO",
  "Kundentyp": "ca_4RJmHLCpPTZ8lZS8qV85R",
  "Straße und Hausnummer": "ca_sWumDPFT36T4daP0F8QdY",
  "Postleitzahl": "ca_PvTaFBZYJqsX48qW4uRov",
  "Ort": "ca_caCze4Tq3cslzGpZLTzgG",
  "Branche": "ca_BnbwJqkMAOzJOShc1AaHI",
  "Anrede": "ca_IZKZiiDJ7evJgkC8GyKep",
  "Briefanrede": "ca_Ur2v3OMBK8CkWQCofpDOf",
};

// Normalisiert einen String fuer Fuzzy-Matching gegen Superchat-Optionen
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

// Findet die beste Option aus einer Superchat-Option-Liste fuer einen gegebenen Wert
function matchOption(value: string, options: string[]): string | null {
  if (!value || !options?.length) return null;
  // 1. Exakte Uebereinstimmung (case-insensitive)
  const exact = options.find((o) => o.toLowerCase() === value.toLowerCase());
  if (exact) return exact;
  // 2. Normalisiert (ohne Umlaute/Sonderzeichen)
  const valueNorm = normalize(value);
  const norm = options.find((o) => normalize(o) === valueNorm);
  if (norm) return norm;
  // 3. Teilstring-Match (A enthaelt B oder B enthaelt A)
  const partial = options.find((o) => {
    const on = normalize(o);
    return on.includes(valueNorm) || valueNorm.includes(on);
  });
  if (partial) return partial;
  return null;
}

interface AttrInfo {
  id: string;
  type: string;
  options: string[];
}

// Laedt alle Superchat-Attribute aus der DB als Map name → info
function loadAttributeMap(): Map<string, AttrInfo> {
  const map = new Map<string, AttrInfo>();
  try {
    const rows = db.select().from(superchatAttributes).all();
    for (const r of rows) {
      let options: string[] = [];
      try {
        const parsed = JSON.parse(r.optionValues || "[]");
        options = Array.isArray(parsed) ? parsed.map((o: { value?: string }) => o.value || "").filter(Boolean) : [];
      } catch {
        // ignore
      }
      map.set(r.name, { id: r.id, type: r.type, options });
    }
  } catch {
    // Tabelle noch nicht migriert
  }
  // Fuer Namen die noch nicht in DB sind: Fallback-IDs verwenden (ohne Options)
  for (const [name, id] of Object.entries(FALLBACK_IDS)) {
    if (!map.has(name)) map.set(name, { id, type: "text", options: [] });
  }
  return map;
}

/**
 * Lead an Superchat übertragen (Create oder Update).
 * Body: { leadId: number }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { leadId } = await req.json();
  if (!leadId) return NextResponse.json({ error: "leadId ist Pflichtfeld" }, { status: 400 });

  const lead = db.select().from(leads).where(eq(leads.id, leadId)).get();
  if (!lead) return NextResponse.json({ error: "Lead nicht gefunden" }, { status: 404 });

  // Name aufteilen
  const parts = (lead.ansprechpartner || lead.name || "").split(" ");
  const first_name = parts[0] || "";
  const last_name = parts.slice(1).join(" ") || "";
  // Telefon in E.164 konvertieren: 0179... → +49179...
  let phone = lead.telefon?.replace(/[^0-9+]/g, "") || undefined;
  if (phone && phone.startsWith("0")) {
    phone = "+49" + phone.slice(1);
  } else if (phone && !phone.startsWith("+")) {
    phone = "+" + phone;
  }
  const email = lead.email || undefined;

  const attrMap = loadAttributeMap();
  const pushAttr = (
    attrs: Array<{ id: string; value: string | string[] }>,
    name: string,
    value: string | string[] | null | undefined
  ) => {
    if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return;
    const info = attrMap.get(name);
    if (!info) return;
    attrs.push({ id: info.id, value });
  };

  // Lead-Produkt-Name aus lead_products ermitteln
  let leadProduktName: string | null = null;
  if (lead.productId) {
    try {
      const lp = db.select().from(leadProducts).where(eq(leadProducts.id, lead.productId)).get();
      if (lp) leadProduktName = lp.name;
    } catch {
      // ignore
    }
  }

  // Leadquelle aus dem Anbieter
  let leadquelle: string | null = null;
  if (lead.providerId) {
    try {
      const prov = db.select().from(leadProviders).where(eq(leadProviders.id, lead.providerId)).get();
      if (prov) leadquelle = prov.name;
    } catch {
      // ignore
    }
  }
  if (!leadquelle) leadquelle = "Versicherungsengel"; // Fallback

  // Fuer Multi-/Single-Selects: Werte gegen Superchat-Optionen matchen
  const leadquelleInfo = attrMap.get("Leadquelle");
  const leadquelleMatched = leadquelleInfo?.options.length
    ? matchOption(leadquelle, leadquelleInfo.options) || leadquelle
    : leadquelle;

  const leadProduktInfo = attrMap.get("Lead Produkt");
  const produkte: string[] = [];

  // 1. Aus dem neuen productId-Feld
  if (leadProduktName) {
    const matched = leadProduktInfo?.options.length
      ? matchOption(leadProduktName, leadProduktInfo.options)
      : leadProduktName;
    if (matched) produkte.push(matched);
  }

  // 2. Aus abgeschlossenen Versicherungen (Legacy-Fallback)
  try {
    const allInsurances = db.select().from(insurances).where(eq(insurances.leadId, leadId)).all();
    for (const ins of allInsurances) {
      if (!ins.sparte) continue;
      const matched = leadProduktInfo?.options.length
        ? matchOption(ins.sparte, leadProduktInfo.options)
        : null;
      if (matched && !produkte.includes(matched)) produkte.push(matched);
    }
  } catch {
    // ignore
  }

  // Branche matchen
  const brancheInfo = attrMap.get("Branche");
  const brancheMatched = lead.branche && brancheInfo?.options.length
    ? matchOption(lead.branche, brancheInfo.options) || lead.branche
    : lead.branche;

  // Custom Attributes dynamisch zusammenbauen
  const custom_attributes: Array<{ id: string; value: string | string[] }> = [];
  pushAttr(custom_attributes, "Leadquelle", leadquelleMatched);
  pushAttr(custom_attributes, "Kundentyp", ["Lead"]);
  pushAttr(custom_attributes, "Lead Conversion", "Offen");
  if (lead.eingangsdatum) {
    pushAttr(custom_attributes, "Lead Eingangsdatum", lead.eingangsdatum.split("T")[0]);
  }
  if (produkte.length) {
    pushAttr(custom_attributes, "Lead Produkt", produkte);
  }
  pushAttr(custom_attributes, "Straße und Hausnummer", lead.strasse);
  pushAttr(custom_attributes, "Postleitzahl", lead.plz);
  pushAttr(custom_attributes, "Ort", lead.ort);
  pushAttr(custom_attributes, "Branche", brancheMatched);

  try {
    let contactId = lead.superchatContactId;
    let action: "create" | "update" = "create";

    if (contactId) {
      // Bestehenden Kontakt aktualisieren (ohne Handles — können durch Geister-Kontakte blockiert sein)
      await updateContact(contactId, {
        first_name,
        last_name,
        custom_attributes,
      });
      action = "update";
    } else {
      // Neuen Kontakt anlegen
      if (!phone && !email) {
        return NextResponse.json(
          { error: "Lead braucht Telefon oder E-Mail für Superchat-Übertragung" },
          { status: 400 }
        );
      }
      // Versuche Create mit verschiedenen Handle-Kombinationen bei 409
      const attempts: Array<{ phone?: string; email?: string }> = [
        { phone, email },                          // 1. Beide Handles
        ...(phone && email ? [{ phone }, { email }] : []),  // 2. Einzeln
      ];

      let created = false;
      for (const handles of attempts) {
        if (!handles.phone && !handles.email) continue;
        try {
          const result = await createContact({
            first_name,
            last_name,
            phone: handles.phone,
            email: handles.email,
            custom_attributes,
          });
          contactId = result.id;
          action = "create";
          created = true;
          break;
        } catch (err: unknown) {
          const e = err as Error & { status?: number };
          if (e.status !== 409) throw err;
          // 409 → nächsten Versuch probieren
        }
      }

      if (!created) {
        // Alle Handle-Kombinationen blockiert — Kontakt per API suchen
        const existing = (phone ? await findContactByHandle(phone) : null)
          || (email ? await findContactByHandle(email) : null);
        if (existing?.id) {
          contactId = existing.id;
          await updateContact(contactId!, { first_name, last_name, custom_attributes });
          action = "update";
        } else {
          // Handles existieren als Geister-Kontakte → mit Lead-spezifischer E-Mail anlegen
          const fallbackEmail = `lead-${leadId}@ve.voelkergroup.cloud`;
          const result = await createContact({
            first_name,
            last_name,
            email: fallbackEmail,
            custom_attributes,
          });
          contactId = result.id;
          action = "create";
        }
      }

      // superchatContactId am Lead speichern
      db.update(leads)
        .set({ superchatContactId: contactId, updatedAt: new Date().toISOString() })
        .where(eq(leads.id, leadId))
        .run();
    }

    const { userId, userName } = getAuditUser(session);
    logAudit({
      userId,
      userName,
      action: action === "create" ? "create" : "update",
      entity: "lead",
      entityId: leadId,
      entityName: `Superchat-Sync: ${lead.name}`,
    });

    return NextResponse.json({ success: true, contactId, action });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Superchat-Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
