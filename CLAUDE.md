# Versicherungsengel — AI System Reference

**Version:** 1.0.0 | **Stand:** 2026-04-01
**Repository:** https://github.com/aicoachpro/versicherungsengel.git

## Identität

Lead-Management & Versicherungs-CRM für Versicherungsvermittler. Web-Applikation mit Dashboard, Pipeline-Verwaltung, Folgetermin-System und Pushover-Benachrichtigungen.

## Meine Fähigkeiten

- Dashboard mit Lead-Übersicht, Statistiken, Gewerbeart-Verteilung
- Pipeline-Board (Drag & Drop) für Lead-Management
- Folgetermin-System mit Pushover-Erinnerungen (Cross-Selling)
- 2FA-Login (TOTP) mit NextAuth
- Nutzer-Verwaltung (CRUD mit Foreign-Key-Handling)
- Ingest-API für externe Lead-Erfassung
- E-Mail-Versand via Resend

## Regeln (NIEMALS)

1. **NIEMALS** Code ändern ohne Linear Issue
2. **NIEMALS** Issue schließen ohne Git Push + Changelog
3. **NIEMALS** API Keys im Chat — User trägt direkt in .env.local ein
4. **NIEMALS** Issue ohne Labels anlegen
5. **NIEMALS** .env.local oder Credentials committen
6. **NIEMALS** Datenbank-Migrationen ohne Backup-Hinweis

## System-Architektur

Siehe SYSTEM_ARCHITECTURE.md für Details.

| Layer | Technologie |
|-------|------------|
| Frontend | Next.js 16, React 19, Tailwind CSS 4, shadcn/ui |
| Backend | Next.js API Routes |
| Datenbank | SQLite (better-sqlite3 + Drizzle ORM) |
| Auth | NextAuth v5 + 2FA |
| Deploy | Docker auf Hostinger VPS |

## Config-Werte

Alle Config-Werte kommen aus `lib/config.js`. VERSION ist dort SSoT.

## Handoff-Prozess

Nach Feature-Entwicklung:
1. Code committen + pushen
2. CLAUDE.md updaten
3. Operator informieren: "Feature X fertig"
