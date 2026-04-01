import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, insurances } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { logAudit, getAuditUser } from "@/lib/audit";
import { createContact, updateContact, findContactByHandle } from "@/lib/superchat";

// Superchat Custom Attribute IDs (workspace-spezifisch)
const SC_CA = {
  LEADQUELLE: "ca_qovxvsnZGEJmPscEky8HU",
  LEADPRODUKT: "ca_TUwAmMu5QOzpmf2wIcbKW",
  LEADEINGANGSDATUM: "ca_by8bMKbLolULXKjXwJ64u",
  LEAD_CONVERSION: "ca_kLorvm5KXX5ikAyMc5SNO",
  KUNDENTYP: "ca_4RJmHLCpPTZ8lZS8qV85R",
  STRASSE: "ca_sWumDPFT36T4daP0F8QdY",
  PLZ: "ca_PvTaFBZYJqsX48qW4uRov",
  ORT: "ca_caCze4Tq3cslzGpZLTzgG",
};

// Mapping VE-Sparten → Superchat Lead Produkt Optionen (multi_select)
const SPARTE_MAPPING: Record<string, string> = {
  "Haftpflicht": "Haftpflichtversicherung",
  "Inhalt": "Firmenversicherung",
  "D&O": "Vermögensschadenhaftpflicht",
  "Flotte": "Flottenversicherung",
  "Rechtsschutz": "Rechtsschutzversicherung",
  "KV": "privaten Krankenversicherung",
};

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

  // Versicherungsprodukte als Lead Produkt (multi_select)
  const allInsurances = db.select().from(insurances).where(eq(insurances.leadId, leadId)).all();
  const produkte = allInsurances
    .map((i) => SPARTE_MAPPING[i.sparte || ""] || "")
    .filter(Boolean);

  // Custom Attributes
  const custom_attributes: Array<{ id: string; value: string | string[] }> = [
    { id: SC_CA.LEADQUELLE, value: "Versicherungsengel" },
    { id: SC_CA.KUNDENTYP, value: ["Lead"] },
    { id: SC_CA.LEAD_CONVERSION, value: "Offen" },
  ];
  if (lead.eingangsdatum) {
    custom_attributes.push({ id: SC_CA.LEADEINGANGSDATUM, value: lead.eingangsdatum.split("T")[0] });
  }
  if (produkte.length) {
    custom_attributes.push({ id: SC_CA.LEADPRODUKT, value: produkte });
  }
  if (lead.strasse) {
    custom_attributes.push({ id: SC_CA.STRASSE, value: lead.strasse });
  }
  if (lead.plz) {
    custom_attributes.push({ id: SC_CA.PLZ, value: lead.plz });
  }
  if (lead.ort) {
    custom_attributes.push({ id: SC_CA.ORT, value: lead.ort });
  }

  try {
    let contactId = lead.superchatContactId;
    let action: "create" | "update";

    if (contactId) {
      // Bestehenden Kontakt aktualisieren
      await updateContact(contactId, {
        first_name,
        last_name,
        phone,
        email,
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
      try {
        const result = await createContact({
          first_name,
          last_name,
          phone,
          email,
          custom_attributes,
        });
        contactId = result.id;
        action = "create";
      } catch (createErr: unknown) {
        const err409 = createErr as Error & { status?: number };
        if (err409.status === 409) {
          // Kontakt existiert bereits — per Cursor-Pagination suchen
          const existing = (phone ? await findContactByHandle(phone) : null)
            || (email ? await findContactByHandle(email) : null);
          if (existing?.id) {
            contactId = existing.id;
            // Handles NICHT mitsenden — die existieren ja schon
            await updateContact(contactId!, {
              first_name,
              last_name,
              custom_attributes,
            });
            action = "update";
          } else {
            // Kontakt existiert in Superchat aber ist über API nicht findbar
            // (z.B. WhatsApp-Konversations-Kontakte). Manuelle Verknüpfung nötig.
            return NextResponse.json(
              {
                error: "Kontakt existiert bereits in Superchat mit dieser Nummer/E-Mail. Bitte öffne Superchat, suche den Kontakt und verknüpfe ihn manuell.",
                needsManualLink: true,
              },
              { status: 409 }
            );
          }
        } else {
          throw createErr;
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
