#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Config aus Umgebungsvariablen
const CRM_URL = process.env.CRM_URL || "https://leads.voelkergroup.cloud";
const API_KEY = process.env.CRM_API_KEY;

if (!API_KEY) {
  console.error("Fehler: CRM_API_KEY Umgebungsvariable nicht gesetzt");
  process.exit(1);
}

// Helper: API-Aufruf mit Bearer Token
async function crmFetch(path, options = {}) {
  const url = `${CRM_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  return res;
}

// MCP Server erstellen
const server = new McpServer({
  name: "versicherungsengel-crm",
  version: "1.0.0",
});

// Tool 1: Lead suchen
server.tool(
  "crm_search_lead",
  "Sucht einen Lead im Versicherungsengel CRM nach Name oder Ansprechpartner. Nutze dieses Tool, um den richtigen Lead zu finden, bevor du eine Aktivität anlegst.",
  {
    query: z.string().describe("Suchbegriff: Firmenname oder Name des Ansprechpartners"),
  },
  async ({ query }) => {
    const res = await crmFetch("/api/leads/search", {
      method: "POST",
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { content: [{ type: "text", text: `Fehler bei der Lead-Suche: ${res.status} — ${text.slice(0, 200)}` }] };
    }

    const data = await res.json();

    if (data.anzahl === 0) {
      return {
        content: [{ type: "text", text: `Kein Lead gefunden für "${query}". Bitte den Nutzer nach dem korrekten Namen fragen.` }],
      };
    }

    const list = data.treffer.map(
      (l) => `- **${l.name}** (ID: ${l.id}) — Ansprechpartner: ${l.ansprechpartner || "–"}, Phase: ${l.phase}${l.archivedAt ? " [archiviert]" : ""}`
    );

    return {
      content: [{
        type: "text",
        text: `${data.anzahl} Lead(s) gefunden:\n\n${list.join("\n")}`,
      }],
    };
  }
);

// Tool 2: Aktivität anlegen
server.tool(
  "crm_add_activity",
  "Legt eine neue Aktivität (Gesprächsnotiz, Telefonat, E-Mail etc.) bei einem Lead im Versicherungsengel CRM an. Nutze crm_search_lead zuerst, um die Lead-ID zu ermitteln.",
  {
    leadId: z.number().optional().describe("ID des Leads (bevorzugt, aus crm_search_lead)"),
    leadName: z.string().optional().describe("Name des Leads (falls ID nicht bekannt — das System sucht automatisch)"),
    kontaktart: z
      .enum(["Telefon", "E-Mail", "WhatsApp", "Vor-Ort", "LinkedIn", "Sonstiges"])
      .default("Sonstiges")
      .describe("Art des Kontakts"),
    datum: z.string().optional().describe("Datum und Uhrzeit (ISO-Format, z.B. 2026-03-30T10:00). Standard: jetzt"),
    notiz: z.string().describe("Gesprächsnotiz oder Zusammenfassung"),
  },
  async ({ leadId, leadName, kontaktart, datum, notiz }) => {
    if (!leadId && !leadName) {
      return {
        content: [{ type: "text", text: "Fehler: Entweder leadId oder leadName muss angegeben werden." }],
      };
    }

    const body = {
      ...(leadId ? { leadId } : { leadName }),
      kontaktart: kontaktart || "Sonstiges",
      datum: datum || new Date().toISOString().slice(0, 16),
      notiz,
    };

    const res = await crmFetch("/api/activities/ingest", {
      method: "POST",
      body: JSON.stringify(body),
    });

    if (!res.ok && res.status !== 201 && res.status !== 300) {
      const text = await res.text();
      return { content: [{ type: "text", text: `Fehler: ${res.status} — ${text.slice(0, 200)}` }] };
    }

    const data = await res.json();

    if (res.status === 201) {
      return {
        content: [{
          type: "text",
          text: `Aktivität erfolgreich angelegt bei **${data.lead.name}** (ID: ${data.lead.id}).\n\nKontaktart: ${kontaktart}\nDatum: ${datum || "jetzt"}\nNotiz: ${notiz}`,
        }],
      };
    }

    if (res.status === 300) {
      const options = data.treffer
        .map((t) => `- **${t.name}** (ID: ${t.id}) — ${t.ansprechpartner || "–"}`)
        .join("\n");
      return {
        content: [{
          type: "text",
          text: `Mehrere Leads gefunden für "${leadName}":\n\n${options}\n\nBitte den Nutzer fragen, welcher gemeint ist, und dann mit der leadId erneut aufrufen.`,
        }],
      };
    }

    return {
      content: [{ type: "text", text: `Fehler: ${data.error || "Unbekannter Fehler"}${data.hinweis ? `\n${data.hinweis}` : ""}` }],
    };
  }
);

// Tool 3: Lead-Details abrufen
server.tool(
  "crm_get_lead",
  "Ruft vollständige Details eines Leads ab — Stammdaten, Fremdverträge, Aktivitäten und Dokumente.",
  {
    leadId: z.number().describe("ID des Leads"),
  },
  async ({ leadId }) => {
    const res = await crmFetch("/api/leads/search", {
      method: "POST",
      body: JSON.stringify({ leadId }),
    });

    if (!res.ok) {
      const text = await res.text();
      return { content: [{ type: "text", text: `Fehler: ${res.status} — ${text.slice(0, 200)}` }] };
    }

    const data = await res.json();
    const lead = data.lead;

    if (!lead) {
      return { content: [{ type: "text", text: `Kein Lead mit ID ${leadId} gefunden.` }] };
    }

    let text = `# ${lead.name}\n\n`;
    text += `**Phase:** ${lead.phase}\n`;
    text += `**Ansprechpartner:** ${lead.ansprechpartner || "–"}\n`;
    text += `**E-Mail:** ${lead.email || "–"}\n`;
    text += `**Telefon:** ${lead.telefon || "–"}\n`;
    text += `**Branche:** ${lead.branche || "–"}\n`;
    text += `**Unternehmensgröße:** ${lead.unternehmensgroesse || "–"}\n`;
    text += `**Umsatzklasse:** ${lead.umsatzklasse || "–"}\n`;
    text += `**Gewerbeart:** ${lead.gewerbeart || "–"}\n`;
    text += `**Eingangsdatum:** ${lead.eingangsdatum || "–"}\n`;
    text += `**Umsatz:** ${lead.umsatz ? `${lead.umsatz} €` : "–"}\n`;
    text += `**Notizen:** ${lead.notizen || "–"}\n`;

    if (lead.crossSelling) {
      try {
        const cs = JSON.parse(lead.crossSelling);
        if (cs.length > 0) text += `**Cross-Selling:** ${cs.join(", ")}\n`;
      } catch { /* ignore */ }
    }

    const insurances = data.vertrage || [];
    const activities = data.aktivitaeten || [];

    if (insurances.length > 0) {
      text += `\n## Fremdverträge (${insurances.length})\n\n`;
      insurances.forEach((v) => {
        text += `- **${v.bezeichnung}** — ${v.versicherer || "–"} | ${v.sparte || "–"} | ${v.beitrag ? `${v.beitrag} €/Jahr` : "–"}\n`;
      });
    }

    if (activities.length > 0) {
      text += `\n## Aktivitäten (${activities.length})\n\n`;
      activities.forEach((a) => {
        const datum = new Date(a.datum).toLocaleString("de-DE");
        text += `- **${datum}** [${a.kontaktart}] ${a.notiz || "–"}\n`;
      });
    }

    return { content: [{ type: "text", text }] };
  }
);

// Server starten
const transport = new StdioServerTransport();
await server.connect(transport);
