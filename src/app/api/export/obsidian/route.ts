import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, activities, insurances, leadProducts, leadProviders, users } from "@/db/schema";
import { desc, eq, isNull } from "drizzle-orm";
import { validateApiRequest } from "@/lib/api-auth";

/**
 * Export-Endpoint fuer Obsidian-Sync (VOE-157).
 * Liefert Leads + Termine + Wiedervorlagen + Activities als strukturierte JSON,
 * die vom Mac-Sync-Script in Markdown-Dateien umgewandelt wird.
 *
 * Auth: Bearer-Token (api_keys-Tabelle).
 * Rate-Limit: 60 Req/Min.
 */
export async function GET(req: NextRequest) {
  const auth = validateApiRequest(req);
  if (!auth.authorized) return auth.response!;

  // Alle aktiven (nicht archivierten) Leads
  const allLeads = db
    .select()
    .from(leads)
    .where(isNull(leads.archivedAt))
    .orderBy(desc(leads.updatedAt))
    .all();

  // Lookups fuer Anreicherung
  const allProducts = db.select().from(leadProducts).all();
  const allProviders = db.select().from(leadProviders).all();
  const allUsers = db.select({ id: users.id, name: users.name }).from(users).all();
  const allActivities = db.select().from(activities).orderBy(desc(activities.datum)).all();
  const allInsurances = db.select().from(insurances).all();

  const productMap = new Map(allProducts.map((p) => [p.id, p.name]));
  const providerMap = new Map(allProviders.map((p) => [p.id, p.name]));
  const userMap = new Map(allUsers.map((u) => [u.id, u.name]));

  const enriched = allLeads.map((l) => ({
    id: l.id,
    name: l.name,
    phase: l.phase,
    ansprechpartner: l.ansprechpartner,
    email: l.email,
    telefon: l.telefon,
    website: l.website,
    strasse: l.strasse,
    plz: l.plz,
    ort: l.ort,
    branche: l.branche,
    unternehmensgroesse: l.unternehmensgroesse,
    umsatzklasse: l.umsatzklasse,
    leadTyp: l.leadTyp,
    termin: l.termin,
    folgetermin: l.folgetermin,
    folgeterminTyp: l.folgeterminTyp,
    eingangsdatum: l.eingangsdatum,
    terminKosten: l.terminKosten,
    umsatz: l.umsatz,
    naechsterSchritt: l.naechsterSchritt,
    notizen: l.notizen,
    crossSelling: l.crossSelling,
    provider: l.providerId ? providerMap.get(l.providerId) ?? null : null,
    product: l.productId ? productMap.get(l.productId) ?? null : null,
    assignedTo: l.assignedTo ? userMap.get(l.assignedTo) ?? null : null,
    reklamiertAt: l.reklamiertAt,
    reklamationStatus: l.reklamationStatus,
    activities: allActivities
      .filter((a) => a.leadId === l.id)
      .map((a) => ({ id: a.id, datum: a.datum, kontaktart: a.kontaktart, notiz: a.notiz })),
    insurances: allInsurances
      .filter((i) => i.leadId === l.id)
      .map((i) => ({
        id: i.id,
        bezeichnung: i.bezeichnung,
        sparte: i.sparte,
        versicherer: i.versicherer,
        produkt: i.produkt,
        beitrag: i.beitrag,
        zahlweise: i.zahlweise,
        ablauf: i.ablauf,
      })),
    createdAt: l.createdAt,
    updatedAt: l.updatedAt,
  }));

  // Offene Folgetermine in Zukunft (fuer Tasks)
  const now = new Date().toISOString();
  const openFolgetermine = enriched
    .filter((l) => l.folgetermin && l.folgetermin >= now && l.phase !== "Verloren" && l.phase !== "Abgeschlossen")
    .map((l) => ({
      leadId: l.id,
      leadName: l.name,
      ansprechpartner: l.ansprechpartner,
      folgetermin: l.folgetermin!,
      folgeterminTyp: l.folgeterminTyp,
      naechsterSchritt: l.naechsterSchritt,
      assignedTo: l.assignedTo,
    }));

  // Ueberfaellige Folgetermine (Wiedervorlage)
  const overdueFolgetermine = enriched
    .filter((l) => l.folgetermin && l.folgetermin < now && l.phase !== "Verloren" && l.phase !== "Abgeschlossen")
    .map((l) => ({
      leadId: l.id,
      leadName: l.name,
      folgetermin: l.folgetermin!,
      folgeterminTyp: l.folgeterminTyp,
      naechsterSchritt: l.naechsterSchritt,
    }));

  return NextResponse.json({
    exportedAt: new Date().toISOString(),
    apiKeyName: auth.apiKeyName,
    counts: {
      leads: enriched.length,
      openFolgetermine: openFolgetermine.length,
      overdueFolgetermine: overdueFolgetermine.length,
    },
    leads: enriched,
    openFolgetermine,
    overdueFolgetermine,
  });
}
