---
name: implement
description: Linear-Issue Schritt für Schritt implementieren
version: 1.0.0
---

# /implement — Issue umsetzen

Implementiert ein Linear-Issue mit vollständigem Workflow.

## Workflow

1. **Issue identifizieren** — Linear Issue laden, Description lesen
2. **Abhängigkeiten prüfen** — Benötigte Issues done?
3. **Context sammeln** — Betroffene Dateien, CLAUDE.md, config.js
4. **Plan + Approval** — HUMAN-IN-THE-LOOP: Dateiliste, Änderungen, Risiken
5. **Implementieren** — Code, Doku-Update, Git Commit + Push
6. **Validation** — Syntax, Akzeptanzkriterien prüfen
7. **Backlog aktualisieren** — Issue → Done + Kommentar
8. **Ergebnis-Tabelle** — Was wurde implementiert, Status

## Git-Workflow

1. Branch: `feature/VE-XX-{slug}`
2. Commit: `v{VERSION} — VE-XX: {Titel}`
3. Push + PR erstellen

## Änderungs-Checkliste (PFLICHT)

Siehe `references/change-checklist.md`.

## Regeln

- NIEMALS Code ändern ohne vorherige Rückfrage beim Operator
- NIEMALS eine Umsetzung als abgeschlossen melden ohne Git-Push
- Issue-Prefix: VE-
