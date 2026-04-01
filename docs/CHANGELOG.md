# Changelog

Alle relevanten Aenderungen am Versicherungsengel CRM.

## [1.0.0] — 2026-04-01

### Hinzugefuegt
- Superchat-Sync mit 5-Stufen-Fallback bei 409 Conflict (VOE-53)
- `findContactByHandle()` — Cursor-basierte Kontaktsuche in Superchat API
- Fallback-E-Mail `lead-{id}@ve.voelkergroup.cloud` fuer blockierte Handles

### Geaendert
- Superchat-Update sendet keine Handles mehr (verhindert 409 durch Geister-Kontakte)
- Reklamierte Leads aus Pipeline ausgeblendet (VOE-54)
- Lead-Detail Buttons responsive mit flex-wrap (VOE-54)

### Dokumentiert
- Superchat API Einschraenkungen (kein Suchendpunkt, Geister-Kontakte, Cursor-Pagination)
- Obsidian CRM-Dokumentation auf v1.5.0 aktualisiert

### Bekannte Einschraenkungen
- Superchat API v1.0 hat keinen Suchendpunkt — Filter-Parameter werden ignoriert
- Manche Handles sind durch unsichtbare "Geister-Kontakte" blockiert
- Kontakt-Suche limitiert auf 1000 Kontakte (10 Seiten)

## [0.1.0] — 2026-03-24

### Hinzugefuegt
- Initiales Release mit Dashboard, Pipeline, Folgetermin-System
- Superchat-Integration (Kontakte erstellen, Nachrichten senden/empfangen)
- Adressfelder (Strasse, PLZ, Ort) fuer Leads (VOE-52)
- Reklamations-System mit Pipeline-Filter und Monats-/Jahresfilter (VOE-54)
- Kundentyp als multi_select an Superchat (VOE-48)
- Alle Custom Attributes korrekt typisiert (VOE-48)
