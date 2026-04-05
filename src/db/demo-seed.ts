/**
 * Demo-Seed: Bef\u00fcllt die Datenbank mit realistischen Fake-Daten.
 * Wird NUR ausgef\u00fchrt wenn DEMO_MODE=true UND keine Leads existieren.
 */
import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";

export function seedDemoData(sqlite: Database.Database) {
  const leadCount = sqlite.prepare("SELECT count(*) as c FROM leads").get() as { c: number };
  if (leadCount.c > 0) {
    console.log("Demo-Seed: Leads existieren bereits, \u00fcbersprungen.");
    return;
  }

  console.log("Demo-Seed: Starte Bef\u00fcllung mit Demo-Daten...");

  // --- Demo User ---
  const existingUser = sqlite.prepare("SELECT id FROM users WHERE email = ?").get("demo@versicherungsengel.de");
  if (!existingUser) {
    const hash = bcrypt.hashSync("Demo2026!", 10);
    sqlite.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)"
    ).run("Max Mustermann", "demo@versicherungsengel.de", hash, "admin");
    console.log("Demo-User erstellt: demo@versicherungsengel.de / Demo2026!");
  }

  // --- Demo Lead Provider ---
  const existingProvider = sqlite.prepare("SELECT id FROM lead_providers LIMIT 1").get();
  if (!existingProvider) {
    sqlite.prepare(
      `INSERT INTO lead_providers (name, lead_type, min_per_month, cost_per_lead, billing_model, carry_over, start_month, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run("WVD Leadservice", "Gewerbe-Leads", 5, 250, "prepaid", 1, "2026-01", 1);
  }

  // --- Demo Leads ---
  const insertLead = sqlite.prepare(`
    INSERT INTO leads (
      name, phase, termin, ansprechpartner, email, telefon,
      strasse, plz, ort, branche, gewerbeart,
      product_id, assigned_to, termin_kosten, eingangsdatum,
      folgetermin, folgetermin_typ, provider_id,
      reklamiert_at, reklamation_status, reklamation_notiz,
      notizen, umsatz
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, 1, 250, ?,
      ?, ?, 1,
      ?, ?, ?,
      ?, ?
    )
  `);

  const demoLeads = [
    // --- Abgeschlossen (4) ---
    {
      name: "M\u00fcller Elektrotechnik GmbH", phase: "Abgeschlossen",
      termin: "2026-01-15 10:00", ansprechpartner: "Hans M\u00fcller",
      email: "h.mueller@mueller-elektro.de", telefon: "0221 9876543",
      strasse: "Industriestr. 12", plz: "50968", ort: "K\u00f6ln",
      branche: "Handwerk", gewerbeart: "hauptberuflich",
      productId: 5, eingangsdatum: "2026-01-08",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Firmenversicherung abgeschlossen, 5 MA", umsatz: 4800,
    },
    {
      name: "Autohaus Bergmann KG", phase: "Abgeschlossen",
      termin: "2026-02-03 14:00", ansprechpartner: "Petra Bergmann",
      email: "p.bergmann@autohaus-bergmann.de", telefon: "089 1234567",
      strasse: "M\u00fcnchner Str. 45", plz: "80339", ort: "M\u00fcnchen",
      branche: "Handel", gewerbeart: "hauptberuflich",
      productId: 6, eingangsdatum: "2026-01-22",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Flottenversicherung f\u00fcr 12 Fahrzeuge", umsatz: 8500,
    },
    {
      name: "IT-Systemhaus Krause", phase: "Abgeschlossen",
      termin: "2026-02-10 09:30", ansprechpartner: "Stefan Krause",
      email: "s.krause@krause-it.de", telefon: "030 5557890",
      strasse: "Berliner Allee 78", plz: "10115", ort: "Berlin",
      branche: "IT", gewerbeart: "hauptberuflich",
      productId: 22, eingangsdatum: "2026-01-28",
      folgetermin: "2026-04-10 10:00", folgeterminTyp: "Cross-Selling",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Cyberschutz abgeschlossen, Cross-Selling BHP geplant", umsatz: 3200,
    },
    {
      name: "Malerbetrieb Hoffmann", phase: "Abgeschlossen",
      termin: "2026-03-05 11:00", ansprechpartner: "Werner Hoffmann",
      email: "w.hoffmann@maler-hoffmann.de", telefon: "0711 3334455",
      strasse: "Schillerstr. 9", plz: "70173", ort: "Stuttgart",
      branche: "Handwerk", gewerbeart: "hauptberuflich",
      productId: 2, eingangsdatum: "2026-02-20",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "BHP + Inhaltsversicherung abgeschlossen", umsatz: 2900,
    },

    // --- Angebot erstellt (2) ---
    {
      name: "Schneider IT Solutions", phase: "Angebot erstellt",
      termin: "2026-03-12 14:30", ansprechpartner: "Lisa Schneider",
      email: "l.schneider@schneider-it.de", telefon: "040 6667788",
      strasse: "Hafenstr. 22", plz: "20457", ort: "Hamburg",
      branche: "IT", gewerbeart: "hauptberuflich",
      productId: 22, eingangsdatum: "2026-03-01",
      folgetermin: "2026-04-05 10:00", folgeterminTyp: "Angebot nachfassen",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Cyberschutz-Angebot \u00fcber 2.400 EUR/Jahr verschickt", umsatz: null,
    },
    {
      name: "Gasthaus zum L\u00f6wen GmbH", phase: "Angebot erstellt",
      termin: "2026-03-18 16:00", ansprechpartner: "Maria Schmidt",
      email: "m.schmidt@gasthaus-loewen.de", telefon: "0621 9990011",
      strasse: "Marktplatz 3", plz: "68159", ort: "Mannheim",
      branche: "Gastronomie", gewerbeart: "hauptberuflich",
      productId: 4, eingangsdatum: "2026-03-05",
      folgetermin: "2026-04-08 14:00", folgeterminTyp: "Angebot nachfassen",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Firmenrechtsschutz-Angebot erstellt, wartet auf R\u00fcckmeldung", umsatz: null,
    },

    // --- Follow-up (3) ---
    {
      name: "B\u00e4ckerei Sonnenschein", phase: "Follow-up",
      termin: "2026-03-20 09:00", ansprechpartner: "Klaus Weber",
      email: "k.weber@baeckerei-sonnenschein.de", telefon: "0511 2223344",
      strasse: "Brotweg 7", plz: "30159", ort: "Hannover",
      branche: "Handel", gewerbeart: "hauptberuflich",
      productId: 2, eingangsdatum: "2026-03-10",
      folgetermin: "2026-04-07 09:30", folgeterminTyp: "Nachfassen",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Interesse an BHP, Unterlagen angefordert", umsatz: null,
    },
    {
      name: "Friseursalon Elegance", phase: "Follow-up",
      termin: "2026-03-22 11:30", ansprechpartner: "Sandra Fischer",
      email: "s.fischer@salon-elegance.de", telefon: "0351 4445566",
      strasse: "Hauptstr. 15", plz: "01067", ort: "Dresden",
      branche: "Dienstleistung", gewerbeart: "hauptberuflich",
      productId: 7, eingangsdatum: "2026-03-12",
      folgetermin: "2026-04-09 11:00", folgeterminTyp: "Nachfassen",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Haftpflicht + Inhalt, will Vergleichsangebot", umsatz: null,
    },
    {
      name: "Schreinerei Holzmann", phase: "Follow-up",
      termin: "2026-03-25 10:00", ansprechpartner: "Thomas Holzmann",
      email: "t.holzmann@schreinerei-holzmann.de", telefon: "0911 7778899",
      strasse: "Waldstr. 31", plz: "90402", ort: "N\u00fcrnberg",
      branche: "Handwerk", gewerbeart: "hauptberuflich",
      productId: 5, eingangsdatum: "2026-03-15",
      folgetermin: "2026-04-11 10:00", folgeterminTyp: "Beratung",
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Firmenversicherung, 3 MA, will alle Sparten pr\u00fcfen", umsatz: null,
    },

    // --- Termin stattgefunden (3) ---
    {
      name: "Dachdeckerei Sturm & Sohn", phase: "Termin stattgefunden",
      termin: "2026-03-28 13:00", ansprechpartner: "Markus Sturm",
      email: "m.sturm@dachdecker-sturm.de", telefon: "0231 1112233",
      strasse: "Dachstr. 5", plz: "44135", ort: "Dortmund",
      branche: "Handwerk", gewerbeart: "hauptberuflich",
      productId: 2, eingangsdatum: "2026-03-18",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Termin war gut, BHP-Bedarf hoch, Angebot folgt", umsatz: null,
    },
    {
      name: "Logistik Zentrum Meyer", phase: "Termin stattgefunden",
      termin: "2026-03-30 15:00", ansprechpartner: "Jens Meyer",
      email: "j.meyer@lz-meyer.de", telefon: "0201 3334455",
      strasse: "Speditionsweg 88", plz: "45127", ort: "Essen",
      branche: "Logistik", gewerbeart: "hauptberuflich",
      productId: 6, eingangsdatum: "2026-03-20",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Flottenversicherung f\u00fcr 25 LKW, komplexer Fall", umsatz: null,
    },
    {
      name: "Praxis Dr. Neumann", phase: "Termin stattgefunden",
      termin: "2026-04-01 10:30", ansprechpartner: "Dr. Andrea Neumann",
      email: "a.neumann@praxis-neumann.de", telefon: "069 5556677",
      strasse: "Gesundheitsallee 4", plz: "60313", ort: "Frankfurt",
      branche: "Gesundheit", gewerbeart: "hauptberuflich",
      productId: 16, eingangsdatum: "2026-03-22",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Verm\u00f6gensschadenhaftpflicht f\u00fcr Arztpraxis", umsatz: null,
    },

    // --- Termin eingegangen (4) ---
    {
      name: "Sanitär Becker OHG", phase: "Termin eingegangen",
      termin: null, ansprechpartner: "Frank Becker",
      email: "f.becker@sanitaer-becker.de", telefon: "0228 8889900",
      strasse: "R\u00f6hrweg 11", plz: "53111", ort: "Bonn",
      branche: "Handwerk", gewerbeart: "hauptberuflich",
      productId: 2, eingangsdatum: "2026-03-28",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: null, umsatz: null,
    },
    {
      name: "Webdesign Fuchs", phase: "Termin eingegangen",
      termin: null, ansprechpartner: "Anna Fuchs",
      email: "a.fuchs@webdesign-fuchs.de", telefon: "0176 12345678",
      strasse: "Digitalstr. 20", plz: "04109", ort: "Leipzig",
      branche: "IT", gewerbeart: "nebenberuflich",
      productId: 7, eingangsdatum: "2026-03-30",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: null, umsatz: null,
    },
    {
      name: "Caf\u00e9 Bl\u00fctentraum", phase: "Termin eingegangen",
      termin: null, ansprechpartner: "Sabine Lang",
      email: "s.lang@cafe-bluetentraum.de", telefon: "0341 6667788",
      strasse: "Parkstr. 2", plz: "04105", ort: "Leipzig",
      branche: "Gastronomie", gewerbeart: "hauptberuflich",
      productId: 5, eingangsdatum: "2026-04-01",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: null, umsatz: null,
    },
    {
      name: "Immobilien Stein & Partner", phase: "Termin eingegangen",
      termin: null, ansprechpartner: "Robert Stein",
      email: "r.stein@stein-immo.de", telefon: "0761 2223344",
      strasse: "Schlossallee 50", plz: "79098", ort: "Freiburg",
      branche: "Immobilien", gewerbeart: "hauptberuflich",
      productId: 16, eingangsdatum: "2026-04-02",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: null, umsatz: null,
    },

    // --- Verloren (2) ---
    {
      name: "Fahrschule Tempo", phase: "Verloren",
      termin: "2026-02-15 09:00", ansprechpartner: "Ralf Braun",
      email: "r.braun@fahrschule-tempo.de", telefon: "0371 4445566",
      strasse: "Lernstr. 8", plz: "09111", ort: "Chemnitz",
      branche: "Dienstleistung", gewerbeart: "hauptberuflich",
      productId: 7, eingangsdatum: "2026-02-01",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: "2026-03-01", reklamationStatus: "offen", reklamationNotiz: "Lead hat nie reagiert, Termin war ung\u00fcltig",
      notizen: "Kein Interesse, hat bereits Allianz-Vertrag", umsatz: null,
    },
    {
      name: "Tanzschule Rhythmus", phase: "Verloren",
      termin: "2026-02-20 16:00", ansprechpartner: "Julia Klein",
      email: "j.klein@tanzschule-rhythmus.de", telefon: "0241 7778899",
      strasse: "Tanzweg 6", plz: "52062", ort: "Aachen",
      branche: "Dienstleistung", gewerbeart: "nebenberuflich",
      productId: 2, eingangsdatum: "2026-02-05",
      folgetermin: null, folgeterminTyp: null,
      reklamiertAt: null, reklamationStatus: null, reklamationNotiz: null,
      notizen: "Preis zu hoch, hat \u00fcber Check24 abgeschlossen", umsatz: null,
    },
  ];

  // Insert leads in a transaction
  const insertLeads = sqlite.transaction(() => {
    for (const l of demoLeads) {
      insertLead.run(
        l.name, l.phase, l.termin, l.ansprechpartner, l.email, l.telefon,
        l.strasse, l.plz, l.ort, l.branche, l.gewerbeart,
        l.productId, l.eingangsdatum,
        l.folgetermin, l.folgeterminTyp,
        l.reklamiertAt, l.reklamationStatus, l.reklamationNotiz,
        l.notizen, l.umsatz
      );
    }
  });
  insertLeads();
  console.log(`Demo-Seed: ${demoLeads.length} Leads erstellt.`);

  // --- Demo Activities ---
  const insertActivity = sqlite.prepare(`
    INSERT INTO activities (lead_id, datum, kontaktart, notiz, created_at) VALUES (?, ?, ?, ?, ?)
  `);

  const demoActivities = [
    // Lead 1: M\u00fcller Elektrotechnik (Abgeschlossen)
    { leadId: 1, datum: "2026-01-08", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch gef\u00fchrt, Interesse an Firmenversicherung", createdAt: "2026-01-08 09:00:00" },
    { leadId: 1, datum: "2026-01-15", kontaktart: "Vor-Ort", notiz: "Beratungstermin vor Ort, Bedarfsanalyse durchgef\u00fchrt", createdAt: "2026-01-15 11:00:00" },
    { leadId: 1, datum: "2026-01-20", kontaktart: "E-Mail", notiz: "Angebot per Mail verschickt", createdAt: "2026-01-20 14:00:00" },
    { leadId: 1, datum: "2026-01-28", kontaktart: "Telefon", notiz: "Zusage erhalten, Antrag ausgef\u00fcllt", createdAt: "2026-01-28 10:00:00" },

    // Lead 2: Autohaus Bergmann (Abgeschlossen)
    { leadId: 2, datum: "2026-01-22", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, 12 Fahrzeuge zu versichern", createdAt: "2026-01-22 10:00:00" },
    { leadId: 2, datum: "2026-02-03", kontaktart: "Vor-Ort", notiz: "Termin im Autohaus, Fahrzeugliste aufgenommen", createdAt: "2026-02-03 15:00:00" },
    { leadId: 2, datum: "2026-02-10", kontaktart: "E-Mail", notiz: "Flottenangebot verschickt, \u00fcber 8.500 EUR/Jahr", createdAt: "2026-02-10 09:00:00" },
    { leadId: 2, datum: "2026-02-18", kontaktart: "Telefon", notiz: "Vertrag unterschrieben, Start 01.03.", createdAt: "2026-02-18 11:00:00" },

    // Lead 3: IT-Systemhaus Krause (Abgeschlossen)
    { leadId: 3, datum: "2026-01-28", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, gro\u00dfes Interesse an Cyberschutz", createdAt: "2026-01-28 14:00:00" },
    { leadId: 3, datum: "2026-02-10", kontaktart: "Vor-Ort", notiz: "IT-Infrastruktur analysiert, Risikobewertung erstellt", createdAt: "2026-02-10 10:00:00" },
    { leadId: 3, datum: "2026-02-20", kontaktart: "E-Mail", notiz: "Cyberschutz-Angebot \u00fcber 3.200 EUR verschickt", createdAt: "2026-02-20 16:00:00" },

    // Lead 4: Malerbetrieb Hoffmann (Abgeschlossen)
    { leadId: 4, datum: "2026-02-20", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, BHP + Inhalt gew\u00fcnscht", createdAt: "2026-02-20 09:00:00" },
    { leadId: 4, datum: "2026-03-05", kontaktart: "Vor-Ort", notiz: "Betriebsbegehung, Risiko gut einsch\u00e4tzbar", createdAt: "2026-03-05 12:00:00" },
    { leadId: 4, datum: "2026-03-12", kontaktart: "Telefon", notiz: "Vertrag abgeschlossen, Policierung l\u00e4uft", createdAt: "2026-03-12 10:00:00" },

    // Lead 5: Schneider IT Solutions (Angebot erstellt)
    { leadId: 5, datum: "2026-03-01", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, Cyberschutz f\u00fcr 15-MA-Firma", createdAt: "2026-03-01 10:00:00" },
    { leadId: 5, datum: "2026-03-12", kontaktart: "Vor-Ort", notiz: "Beratungstermin, sehr technisch versiert", createdAt: "2026-03-12 15:00:00" },
    { leadId: 5, datum: "2026-03-20", kontaktart: "E-Mail", notiz: "Angebot \u00fcber 2.400 EUR/Jahr verschickt", createdAt: "2026-03-20 09:00:00" },

    // Lead 6: Gasthaus zum L\u00f6wen (Angebot erstellt)
    { leadId: 6, datum: "2026-03-05", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, Rechtsschutz dringend ben\u00f6tigt", createdAt: "2026-03-05 11:00:00" },
    { leadId: 6, datum: "2026-03-18", kontaktart: "Vor-Ort", notiz: "Termin im Restaurant, gute Atmosph\u00e4re", createdAt: "2026-03-18 17:00:00" },

    // Lead 7: B\u00e4ckerei Sonnenschein (Follow-up)
    { leadId: 7, datum: "2026-03-10", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, Interesse an BHP", createdAt: "2026-03-10 09:00:00" },
    { leadId: 7, datum: "2026-03-20", kontaktart: "Vor-Ort", notiz: "Termin in der B\u00e4ckerei, Risiko besichtigt", createdAt: "2026-03-20 10:00:00" },
    { leadId: 7, datum: "2026-03-25", kontaktart: "WhatsApp", notiz: "Unterlagen per WhatsApp angefordert", createdAt: "2026-03-25 14:00:00" },

    // Lead 8: Friseursalon Elegance (Follow-up)
    { leadId: 8, datum: "2026-03-12", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, will Vergleichsangebot zu HUK", createdAt: "2026-03-12 10:00:00" },
    { leadId: 8, datum: "2026-03-22", kontaktart: "Vor-Ort", notiz: "Beratung im Salon, 2 Angestellte", createdAt: "2026-03-22 12:00:00" },

    // Lead 9: Schreinerei Holzmann (Follow-up)
    { leadId: 9, datum: "2026-03-15", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, alle Sparten gew\u00fcnscht", createdAt: "2026-03-15 09:00:00" },
    { leadId: 9, datum: "2026-03-25", kontaktart: "Vor-Ort", notiz: "Werkstattbegehung, Maschinenpark besichtigt", createdAt: "2026-03-25 11:00:00" },

    // Lead 10: Dachdeckerei Sturm (Termin stattgefunden)
    { leadId: 10, datum: "2026-03-18", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, dringender BHP-Bedarf", createdAt: "2026-03-18 14:00:00" },
    { leadId: 10, datum: "2026-03-28", kontaktart: "Vor-Ort", notiz: "Termin vor Ort, hoher Beratungsbedarf", createdAt: "2026-03-28 14:00:00" },

    // Lead 11: Logistik Zentrum Meyer (Termin stattgefunden)
    { leadId: 11, datum: "2026-03-20", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, 25 LKW zu versichern", createdAt: "2026-03-20 10:00:00" },
    { leadId: 11, datum: "2026-03-30", kontaktart: "Vor-Ort", notiz: "Fuhrparkbesichtigung, Fahrzeugliste erhalten", createdAt: "2026-03-30 16:00:00" },

    // Lead 12: Praxis Dr. Neumann (Termin stattgefunden)
    { leadId: 12, datum: "2026-03-22", kontaktart: "E-Mail", notiz: "Anfrage per E-Mail, Verm\u00f6gensschaden", createdAt: "2026-03-22 08:00:00" },
    { leadId: 12, datum: "2026-04-01", kontaktart: "Vor-Ort", notiz: "Beratung in der Praxis, sehr interessiert", createdAt: "2026-04-01 11:00:00" },

    // Lead 17: Fahrschule Tempo (Verloren)
    { leadId: 17, datum: "2026-02-01", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, wenig Interesse", createdAt: "2026-02-01 09:00:00" },
    { leadId: 17, datum: "2026-02-15", kontaktart: "Vor-Ort", notiz: "Termin, Lead war unvorbereitet", createdAt: "2026-02-15 10:00:00" },
    { leadId: 17, datum: "2026-02-25", kontaktart: "Telefon", notiz: "Absage, hat bereits Allianz-Vertrag", createdAt: "2026-02-25 14:00:00" },

    // Lead 18: Tanzschule Rhythmus (Verloren)
    { leadId: 18, datum: "2026-02-05", kontaktart: "Telefon", notiz: "Erstgespr\u00e4ch, Preissensitiv", createdAt: "2026-02-05 10:00:00" },
    { leadId: 18, datum: "2026-02-20", kontaktart: "Vor-Ort", notiz: "Beratung, will mehrere Angebote vergleichen", createdAt: "2026-02-20 17:00:00" },
    { leadId: 18, datum: "2026-03-10", kontaktart: "WhatsApp", notiz: "Absage per WhatsApp, hat \u00fcber Check24 abgeschlossen", createdAt: "2026-03-10 11:00:00" },
  ];

  const insertActivitiesTransaction = sqlite.transaction(() => {
    for (const a of demoActivities) {
      insertActivity.run(a.leadId, a.datum, a.kontaktart, a.notiz, a.createdAt);
    }
  });
  insertActivitiesTransaction();
  console.log(`Demo-Seed: ${demoActivities.length} Aktivit\u00e4ten erstellt.`);

  // --- Demo Insurances (Fremdvertr\u00e4ge) ---
  const insertInsurance = sqlite.prepare(`
    INSERT INTO insurances (bezeichnung, lead_id, sparte, versicherer, produkt, beitrag, zahlweise, ablauf, notizen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoInsurances = [
    // Lead 1: M\u00fcller Elektrotechnik
    { bezeichnung: "BHP Allianz", leadId: 1, sparte: "Haftpflicht", versicherer: "Allianz", produkt: "Betriebshaftpflicht Plus", beitrag: 1200, zahlweise: "j\u00e4hrlich", ablauf: "2026-12-31", notizen: "Bestandsvertrag, l\u00e4uft Ende 2026 aus" },
    { bezeichnung: "Inhaltsversicherung HUK", leadId: 1, sparte: "Inhalt", versicherer: "HUK-Coburg", produkt: "Gewerbe-Inhalt Komfort", beitrag: 850, zahlweise: "j\u00e4hrlich", ablauf: "2026-06-30", notizen: "L\u00e4uft bald aus \u2013 Cross-Selling-Chance!" },

    // Lead 3: IT-Systemhaus Krause
    { bezeichnung: "D&O DEVK", leadId: 3, sparte: "D&O", versicherer: "DEVK", produkt: "D&O Kompakt", beitrag: 2400, zahlweise: "j\u00e4hrlich", ablauf: "2027-03-31", notizen: "Bestehender D&O-Vertrag" },

    // Lead 7: B\u00e4ckerei Sonnenschein
    { bezeichnung: "Gewerbe-Rechtsschutz ARAG", leadId: 7, sparte: "Rechtsschutz", versicherer: "ARAG", produkt: "Firmen-Rechtsschutz", beitrag: 780, zahlweise: "j\u00e4hrlich", ablauf: "2026-09-30", notizen: "Nur Rechtsschutz, keine BHP" },

    // Lead 10: Dachdeckerei Sturm
    { bezeichnung: "Betriebshaftpflicht Gothaer", leadId: 10, sparte: "Haftpflicht", versicherer: "Gothaer", produkt: "BHP Handwerk", beitrag: 1800, zahlweise: "halbj\u00e4hrlich", ablauf: "2026-08-15", notizen: "Alte BHP, Deckungsl\u00fccken vermutet" },
    { bezeichnung: "Unfallversicherung Alte Leipziger", leadId: 10, sparte: "Sonstiges", versicherer: "Alte Leipziger", produkt: "Gruppen-Unfall", beitrag: 960, zahlweise: "j\u00e4hrlich", ablauf: "2027-01-01", notizen: "F\u00fcr 8 Mitarbeiter" },
  ];

  const insertInsurancesTransaction = sqlite.transaction(() => {
    for (const ins of demoInsurances) {
      insertInsurance.run(
        ins.bezeichnung, ins.leadId, ins.sparte, ins.versicherer,
        ins.produkt, ins.beitrag, ins.zahlweise, ins.ablauf, ins.notizen
      );
    }
  });
  insertInsurancesTransaction();
  console.log(`Demo-Seed: ${demoInsurances.length} Fremdvertr\u00e4ge erstellt.`);

  // --- Demo Provisions ---
  const insertProvision = sqlite.prepare(`
    INSERT INTO provisions (
      import_id, buchungs_datum, vers_nehmer, bsz, vers_nummer,
      datev_konto, konto_name, buchungstext, erfolgs_datum, vtnr,
      prov_basis, prov_satz, betrag, lead_id, match_confidence, confirmed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const demoProvisions = [
    // Lead 1: M\u00fcller Elektrotechnik
    { importId: 0, buchungsDatum: "2026-02-01", versNehmer: "M\u00fcller, Hans", bsz: "AS", versNummer: "AS-9397100001",
      datevKonto: "8051", kontoName: "Abschluss H", buchungstext: "Firmenversicherung", erfolgsDatum: "2026-02-01",
      vtnr: "93971", provBasis: 4800, provSatz: 15, betrag: 720, leadId: 1, matchConfidence: 0.95, confirmed: 1 },
    { importId: 0, buchungsDatum: "2026-03-01", versNehmer: "M\u00fcller, Hans", bsz: "F", versNummer: "AS-9397100001",
      datevKonto: "8052", kontoName: "Folge H", buchungstext: "Firmenversicherung", erfolgsDatum: "2026-03-01",
      vtnr: "93971", provBasis: 4800, provSatz: 5, betrag: 240, leadId: 1, matchConfidence: 0.95, confirmed: 1 },

    // Lead 2: Autohaus Bergmann
    { importId: 0, buchungsDatum: "2026-03-01", versNehmer: "Bergmann, Petra", bsz: "AS", versNummer: "KF-4521700002",
      datevKonto: "8041", kontoName: "Abschluss KFZ", buchungstext: "Flottenversicherung", erfolgsDatum: "2026-03-01",
      vtnr: "45217", provBasis: 8500, provSatz: 12, betrag: 1020, leadId: 2, matchConfidence: 0.92, confirmed: 1 },
    { importId: 0, buchungsDatum: "2026-04-01", versNehmer: "Bergmann, Petra", bsz: "F", versNummer: "KF-4521700002",
      datevKonto: "8042", kontoName: "Folge KFZ", buchungstext: "Flottenversicherung", erfolgsDatum: "2026-04-01",
      vtnr: "45217", provBasis: 8500, provSatz: 4, betrag: 340, leadId: 2, matchConfidence: 0.92, confirmed: 1 },

    // Lead 3: IT-Systemhaus Krause
    { importId: 0, buchungsDatum: "2026-03-01", versNehmer: "Krause, Stefan", bsz: "AS", versNummer: "CY-7783200003",
      datevKonto: "8061", kontoName: "Abschluss Sach", buchungstext: "Cyberschutzversicherung", erfolgsDatum: "2026-03-01",
      vtnr: "77832", provBasis: 3200, provSatz: 20, betrag: 640, leadId: 3, matchConfidence: 0.98, confirmed: 1 },

    // Lead 4: Malerbetrieb Hoffmann
    { importId: 0, buchungsDatum: "2026-03-15", versNehmer: "Hoffmann, Werner", bsz: "AS", versNummer: "BH-6654300004",
      datevKonto: "8051", kontoName: "Abschluss H", buchungstext: "Betriebshaftpflicht", erfolgsDatum: "2026-03-15",
      vtnr: "66543", provBasis: 1800, provSatz: 18, betrag: 324, leadId: 4, matchConfidence: 0.96, confirmed: 1 },
    { importId: 0, buchungsDatum: "2026-03-15", versNehmer: "Hoffmann, Werner", bsz: "AS", versNummer: "IN-6654300005",
      datevKonto: "8062", kontoName: "Abschluss Sach", buchungstext: "Inhaltsversicherung", erfolgsDatum: "2026-03-15",
      vtnr: "66543", provBasis: 1100, provSatz: 15, betrag: 165, leadId: 4, matchConfidence: 0.96, confirmed: 1 },
  ];

  const insertProvisionsTransaction = sqlite.transaction(() => {
    for (const p of demoProvisions) {
      insertProvision.run(
        p.importId, p.buchungsDatum, p.versNehmer, p.bsz, p.versNummer,
        p.datevKonto, p.kontoName, p.buchungstext, p.erfolgsDatum, p.vtnr,
        p.provBasis, p.provSatz, p.betrag, p.leadId, p.matchConfidence, p.confirmed ? 1 : 0
      );
    }
  });
  insertProvisionsTransaction();
  console.log(`Demo-Seed: ${demoProvisions.length} Provisionen erstellt.`);

  // --- Company Settings ---
  const upsertSetting = sqlite.prepare(`
    INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);

  upsertSetting.run("company.name", "Mustermann Versicherungen");
  upsertSetting.run("company.subtitle", "Allianz Generalvertretung");
  upsertSetting.run("company.color", "#003781");
  console.log("Demo-Seed: Company-Settings gesetzt.");

  console.log("Demo-Seed: Bef\u00fcllung abgeschlossen!");
}
