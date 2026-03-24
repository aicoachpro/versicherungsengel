# Versicherungsengel — System Architecture

**Version:** 1.0.0 | **Stand:** 2026-03-24

## Überblick

Lead-Management & Versicherungs-CRM für Versicherungsvermittler. Web-Applikation mit Dashboard, Pipeline-Verwaltung, Folgetermin-System und Pushover-Benachrichtigungen.

## Komponenten

| Komponente | Technologie | Pfad |
|-----------|-------------|------|
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4 | `src/app/`, `src/components/` |
| **Backend/API** | Next.js API Routes | `src/app/api/` |
| **Datenbank** | SQLite (better-sqlite3, Drizzle ORM) | `src/db/`, `data/` |
| **Auth** | NextAuth v5 + 2FA (OTP) | `src/lib/auth.ts`, `src/middleware.ts` |
| **UI-Bibliothek** | shadcn/ui, Recharts, dnd-kit, cmdk | `src/components/ui/` |
| **E-Mail** | Resend | `src/lib/` |
| **Monitoring** | Pushover-Benachrichtigungen | `src/instrumentation.ts` |

## Datenfluss

```
Browser → Next.js App Router → API Routes → Drizzle ORM → SQLite
                                    ↓
                              NextAuth (Session)
                                    ↓
                              Resend (E-Mail) / Pushover (Alerts)
```

## Externe Abhängigkeiten

| Service | Zweck | Auth |
|---------|-------|------|
| Linear | Issue Tracking | API Key (MCP) |
| GitHub | Code Repository | Git + SSH |
| Pushover | Push-Benachrichtigungen | App Token |
| Resend | E-Mail-Versand | API Key |
| Hostinger VPS | Deployment | SSH |
