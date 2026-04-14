import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { leads, leadProviders, leadProducts } from "@/db/schema";
import { and, eq, like, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const providerIdStr = searchParams.get("providerId");
  const month = searchParams.get("month");

  if (!providerIdStr || !month) {
    return NextResponse.json(
      { error: "providerId und month sind erforderlich" },
      { status: 400 },
    );
  }

  const providerId = Number(providerIdStr);
  if (!providerId || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "Ungueltige Parameter" }, { status: 400 });
  }

  const provider = db
    .select()
    .from(leadProviders)
    .where(eq(leadProviders.id, providerId))
    .get();
  if (!provider) {
    return NextResponse.json({ error: "Provider nicht gefunden" }, { status: 404 });
  }

  const monthPrefix = `${month}%`;
  const rows = db
    .select({
      id: leads.id,
      name: leads.name,
      ansprechpartner: leads.ansprechpartner,
      phase: leads.phase,
      productId: leads.productId,
      productName: leadProducts.name,
      reklamiertAt: leads.reklamiertAt,
      reklamationStatus: leads.reklamationStatus,
      reklamationNotiz: leads.reklamationNotiz,
      eingangsdatum: leads.eingangsdatum,
    })
    .from(leads)
    .leftJoin(leadProducts, eq(leads.productId, leadProducts.id))
    .where(
      and(
        eq(leads.providerId, providerId),
        like(leads.eingangsdatum, monthPrefix),
      ),
    )
    .orderBy(sql`${leads.eingangsdatum} ASC`)
    .all();

  const total = rows.length;
  const reklamiertGenehmigt = rows.filter(
    (r) => r.reklamationStatus === "genehmigt",
  ).length;
  const netto = total - reklamiertGenehmigt;

  return NextResponse.json({
    provider: {
      id: provider.id,
      name: provider.name,
      minPerMonth: provider.minPerMonth,
    },
    month,
    stats: {
      total,
      netto,
      reklamiertGenehmigt,
      minPerMonth: provider.minPerMonth,
    },
    leads: rows.map((r) => ({
      id: r.id,
      name: r.name,
      ansprechpartner: r.ansprechpartner,
      phase: r.phase,
      productName: r.productName,
      reklamiert: !!r.reklamiertAt,
      reklamationStatus: r.reklamationStatus,
      reklamationNotiz: r.reklamationNotiz,
      eingangsdatum: r.eingangsdatum,
    })),
  });
}
