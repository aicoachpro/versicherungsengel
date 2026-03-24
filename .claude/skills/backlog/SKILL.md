---
name: backlog
description: Backlog anzeigen und priorisieren
version: 1.0.0
---

# /backlog — Backlog verwalten

Zeigt und priorisiert das Linear-Backlog für Versicherungsengel.

## Workflow

1. **Issues laden** — Alle offenen Issues aus Linear Team "Voelker AI Solutions" mit Prefix VE-
2. **Gruppieren** — Nach Status (Backlog, Current Sprint, In Progress)
3. **Abhängigkeiten anzeigen** — Blocked/Blocking Issues markieren
4. **Priorisierung vorschlagen** — Nach Business Value + Dependencies

## Output

Tabelle mit:
| Issue | Titel | Status | Priority | Labels | Blocked By |

## Regeln

- Linear Team: Voelker AI Solutions
- Issue-Prefix: VE-
