---
name: architecture-review
description: Code-Architektur gegen 5 Dimensionen prüfen
version: 1.0.0
---

# /architecture-review — Architektur-Review

Prüft die aktuelle Code-Architektur gegen die 5 Qualitäts-Dimensionen.

## Workflow

1. **Kontext laden** — SYSTEM_ARCHITECTURE.md, COMPONENT_INVENTORY.md, config.js
2. **Code analysieren** — Struktur, Abhängigkeiten, Patterns
3. **5-Dimensionen-Check** — Jede Dimension bewerten (1-5)
4. **Report erstellen** — Findings, Empfehlungen, Action Items

## Dimensionen

| # | Dimension | Prüfpunkte |
|---|-----------|------------|
| 1 | Reliability | Error Handling, Graceful Degradation |
| 2 | Data Integrity | SSoT, Atomic Writes, Race Conditions |
| 3 | Security | Auth, Input Validation, Key Management |
| 4 | Performance | Latenz, Memory, Bundle Size |
| 5 | Maintainability | Code-Duplikation, Config SSoT, Doku |

## Output

Report mit Score pro Dimension + konkrete Empfehlungen.
