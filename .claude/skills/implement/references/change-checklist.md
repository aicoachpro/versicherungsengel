# Änderungs-Checkliste — PFLICHT nach jeder Code-Änderung

## Standard-Checkliste
- [ ] Dokumentation aktualisieren — Alle DOC_FILES auf aktuelle VERSION bringen
- [ ] Git Commit + Push — Code UND Doku gemeinsam committen
- [ ] Linear Issue updaten — Status + Kommentar
- [ ] CHANGELOG.md — Eintrag ergänzen

## Bei neuer API-Integration
- [ ] API Key in `.env.local` + `.env.example`
- [ ] Rate Limiting implementieren
- [ ] Error-Logging: Keys sanitizen
- [ ] Timeout setzen (max 15s)
- [ ] Fallback bei API-Ausfall

## Bei Datenbank-Änderung
- [ ] Drizzle-Migration erstellen
- [ ] Backup-Hinweis an Operator
- [ ] Schema in SYSTEM_ARCHITECTURE.md dokumentieren

## Bei neuer UI-Komponente
- [ ] Mobile-Ansicht testen
- [ ] shadcn/ui Patterns verwenden
- [ ] Tailwind CSS 4 Konventionen
