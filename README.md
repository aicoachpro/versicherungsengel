# Versicherungsengel CRM

Lead-Management & Versicherungs-CRM fuer Versicherungsvermittler. Fullstack-Webanwendung mit Dashboard, Pipeline-Verwaltung, Folgetermin-System und integrierten Benachrichtigungen.

## Features

- **Lead-Management** — CRUD mit Drag & Drop Pipeline-Board (6 Phasen)
- **Versicherungsverwaltung** — Fremdvertraege pro Lead mit Ablauf-Warnungen
- **Aktivitaeten-Tracking** — Kontakthistorie (Telefon, E-Mail, WhatsApp, Vor-Ort, LinkedIn)
- **Cross-Selling** — Multi-Select Versicherungsprodukte pro Lead
- **Folgetermin-System** — Automatische Push-Erinnerungen via Pushover
- **Dokumentenverwaltung** — Upload/Download von Angeboten, Policen, E-Mails
- **Dashboard** — KPIs, Umsatz-Charts, Pipeline-Funnel, Termine
- **Nutzerverwaltung** — Admin-Panel mit Rollen (Admin/User) und 2FA (TOTP)
- **Archiv** — Soft-Delete mit Wiederherstellung
- **API-Ingest** — Externe Lead-Erfassung (n8n, Webhooks)
- **MCP-Server** — Claude AI Integration via Model Context Protocol

## Tech Stack

| Layer | Technologie |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, Recharts, dnd-kit |
| Backend | Next.js API Routes, Drizzle ORM |
| Datenbank | SQLite (better-sqlite3, WAL-Modus) |
| Auth | NextAuth v5 (JWT) + TOTP 2FA |
| E-Mail | Resend |
| Push | Pushover |
| AI | MCP-Server (Model Context Protocol SDK) |
| Deploy | Docker (Multi-Stage Build), Traefik |

## Schnellstart

### Voraussetzungen

- Node.js 20+
- npm

### Installation

```bash
git clone https://github.com/aicoachpro/versicherungsengel.git
cd versicherungsengel
npm install
```

### Umgebungsvariablen

Erstelle eine `.env.local` im Projektverzeichnis:

```env
# Pflicht
AUTH_SECRET=           # openssl rand -base64 32
AUTH_TRUST_HOST=true
AUTH_URL=              # z.B. http://localhost:3000

# E-Mail (Resend)
RESEND_API_KEY=
RESEND_FROM=           # Absender-E-Mail

# Push-Benachrichtigungen (Pushover)
PUSHOVER_USER_KEY=
PUSHOVER_API_TOKEN=

# Cron-Sicherheit
CRON_SECRET=           # Beliebiger geheimer String

# Optional
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
MIRO_ACCESS_TOKEN=
```

### Entwicklung starten

```bash
npm run dev
```

Oeffne [http://localhost:3000](http://localhost:3000). Beim Erststart werden automatisch:
- Die SQLite-Datenbank angelegt
- Ein Default-Admin-User erstellt
- 15 Cross-Selling-Produkte geseedet
- Ein initialer API-Key generiert

### Datenbank-Migrationen

```bash
npx drizzle-kit generate    # Migration generieren
npx drizzle-kit migrate     # Migration ausfuehren
npx drizzle-kit studio      # Drizzle Studio oeffnen
```

## Projektstruktur

```
versicherungsengel/
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (app)/            # Geschuetzte Seiten
│   │   │   ├── dashboard/    # KPI-Dashboard (SSR)
│   │   │   ├── pipeline/     # Kanban-Board + Lead-Detail
│   │   │   ├── wiedervorlage/# Folgetermin-Uebersicht
│   │   │   ├── versicherungen/# Vertraege uebergreifend
│   │   │   ├── archiv/       # Archivierte Leads
│   │   │   ├── nutzer/       # Nutzerverwaltung (Admin)
│   │   │   └── settings/     # Passwort & 2FA
│   │   ├── api/              # REST-API Routen
│   │   │   ├── leads/        # CRUD + Ingest + Search + Export
│   │   │   ├── activities/   # CRUD + Ingest
│   │   │   ├── insurances/   # CRUD
│   │   │   ├── documents/    # Upload/Download
│   │   │   ├── produkte/     # Produktkatalog
│   │   │   ├── users/        # Nutzerverwaltung
│   │   │   ├── auth/         # NextAuth + 2FA + Password-Reset
│   │   │   ├── webhooks/     # Externe Webhooks
│   │   │   └── cron/         # Folgetermin-Erinnerungen
│   │   ├── login/
│   │   ├── forgot-password/
│   │   ├── reset-password/
│   │   └── verify-2fa/
│   ├── components/           # UI-Komponenten
│   │   ├── dashboard/        # KPI-Cards, Charts, Funnel
│   │   ├── pipeline/         # Kanban-Board, Lead-Dialog
│   │   ├── layout/           # Sidebar, Header
│   │   └── ui/               # shadcn/ui Basiskomponenten
│   ├── db/                   # Drizzle Schema
│   └── lib/                  # Auth, E-Mail, Push, Utils
├── mcp-server/               # MCP-Server fuer Claude AI
├── data/                     # SQLite-DB + Uploads
├── drizzle/                  # SQL-Migrationen
├── Dockerfile
└── docker-compose.yml
```

## API-Dokumentation

### Authentifizierte Routen (JWT erforderlich)

| Route | Methoden | Beschreibung |
|-------|----------|-------------|
| `/api/leads` | GET, POST, PATCH, DELETE | Lead-Management |
| `/api/leads/archive` | PATCH | Archivieren/Wiederherstellen |
| `/api/leads/export/[id]` | GET | Markdown-Export |
| `/api/activities` | GET, POST, DELETE | Aktivitaeten-Tracking |
| `/api/insurances` | GET, POST, PATCH, DELETE | Versicherungsvertraege |
| `/api/documents` | GET, POST, DELETE | Dokumentenverwaltung |
| `/api/documents/download/[id]` | GET | Datei-Download |
| `/api/produkte` | GET, POST | Produktkatalog |
| `/api/users` | GET, POST, PATCH, DELETE | Nutzerverwaltung (Admin) |

### Oeffentliche API-Routen (API-Key via Bearer Token)

| Route | Methode | Beschreibung |
|-------|---------|-------------|
| `/api/leads/ingest` | POST | Externe Lead-Erfassung |
| `/api/activities/ingest` | POST | Externe Aktivitaeten-Erfassung |
| `/api/leads/search` | POST | Lead-Suche (Name/ID) |
| `/api/webhooks/leads` | GET, POST | Webhook fuer externe Integrationen |

```bash
# Beispiel: Lead erstellen
curl -X POST https://your-domain/api/leads/ingest \
  -H "Authorization: Bearer <API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Musterfirma GmbH", "ansprechpartner": "Max Mustermann"}'
```

### Cron-Endpunkte

| Route | Beschreibung |
|-------|-------------|
| `/api/cron/reminders?secret=<CRON_SECRET>` | Folgetermin-Erinnerungen (alle 15 Min.) |

### Auth-Routen

| Route | Beschreibung |
|-------|-------------|
| `/api/auth/[...nextauth]` | Login, Logout, Session |
| `/api/auth/2fa/setup` | TOTP einrichten (QR-Code) |
| `/api/auth/2fa/verify` | 2FA aktivieren |
| `/api/auth/2fa/disable` | 2FA deaktivieren |
| `/api/auth/change-password` | Passwort aendern |
| `/api/auth/forgot-password` | Reset-E-Mail anfordern |
| `/api/auth/reset-password` | Passwort zuruecksetzen |

## Datenbank-Schema

```
users ──┬──< passwordResetTokens
        │
leads ──┬──< insurances
        ├──< activities
        └──< documents

produkte (standalone)
apiKeys (standalone)
```

**8 Tabellen:** users, leads, insurances, activities, documents, produkte, passwordResetTokens, apiKeys

Details zum Schema siehe `src/db/schema.ts`.

## MCP-Server (Claude AI Integration)

Der MCP-Server ermoeglicht Claude AI den direkten Zugriff auf das CRM.

### Verfuegbare Tools

| Tool | Beschreibung |
|------|-------------|
| `crm_search_lead` | Leads nach Name/Ansprechpartner suchen |
| `crm_add_activity` | Aktivitaet fuer einen Lead erstellen |
| `crm_get_lead` | Vollstaendige Lead-Details abrufen |

### Setup

```bash
cd mcp-server
npm install
```

Umgebungsvariablen fuer den MCP-Server:

```env
CRM_URL=http://localhost:3000
CRM_API_KEY=<API_KEY_AUS_DER_DATENBANK>
```

## Docker Deployment

### Build & Start

```bash
docker compose up -d --build
```

### Multi-Stage Build

1. **deps** — npm install (inkl. native Dependencies fuer better-sqlite3)
2. **builder** — `next build` mit Standalone-Output
3. **runner** — Minimales Produktions-Image

### Daten-Persistenz

SQLite-Datenbank und Uploads werden ueber ein Docker Volume (`app_data → /app/data/`) persistiert.

## Pipeline-Phasen

| Phase | Beschreibung |
|-------|-------------|
| Termin eingegangen | Neuer Lead, Termin vereinbart |
| Termin stattgefunden | Erstgespraech durchgefuehrt |
| Follow-up | Nachfassen erforderlich |
| Angebot erstellt | Angebot wurde uebergeben |
| Abgeschlossen | Deal gewonnen (conversion = 1) |
| Verloren | Deal verloren (conversion = 0) |

## Sicherheit

- Passwort-Hashing mit bcrypt
- JWT-basierte Sessions (kein Server-Side Session Store)
- TOTP 2FA (6-stellig, 30s Periode, kompatibel mit allen Authenticator-Apps)
- API-Key-Authentifizierung fuer oeffentliche Endpunkte
- Middleware schuetzt alle App-Routen
- Password-Reset mit Einmal-Tokens (1h Gueltigkeit)
- User-Einladung mit temporaeren Tokens (24h Gueltigkeit)

## Lizenz

Proprietaer. Alle Rechte vorbehalten.
