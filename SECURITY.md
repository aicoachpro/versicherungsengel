# Versicherungsengel — Security

## API Key Policy

- Alle API Keys in `.env.local` — NIEMALS im Code oder Chat
- `.env.local` ist in `.gitignore` — wird nicht committed
- Neue Keys immer auch in `.env.example` (ohne Werte) dokumentieren

## Auth

- NextAuth v5 mit 2FA (TOTP)
- Session-basierte Authentifizierung
- Middleware schützt alle Routen außer Login und API-Ingest

## Threat Model

[Wird bei Bedarf erweitert — z.B. nach Security-Review mit /security-architect]

## Incident Response

1. API Key kompromittiert → sofort rotieren, .env.local updaten, deployen
2. Unauthorized Access → Session invalidieren, Logs prüfen
