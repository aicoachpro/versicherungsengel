---
name: ideation
description: Ideen strukturiert in Linear-Issues umwandeln
version: 1.0.0
---

# /ideation — Idee zu Linear Issue

Wandelt eine Idee des Operators in ein strukturiertes Linear-Issue um.

## Workflow

1. **Idee aufnehmen** — Operator beschreibt die Idee
2. **Research** (falls nötig) — Technische Machbarkeit prüfen
3. **Kontext laden** — Backlog + Architektur + Config einlesen, Duplikat-Check
4. **Story entwerfen** — Draft mit allen Pflicht-Sektionen (siehe ISSUE_WRITING_GUIDELINES.md)
5. **Draft präsentieren** — HUMAN-IN-THE-LOOP: Operator prüft und gibt OK
6. **Linear Issue erstellen** — Issue mit Labels anlegen

## Pflicht-Sektionen

Jedes Issue MUSS enthalten: Was, Warum, Kontext, Abhängigkeiten, Akzeptanzkriterien, Agent Team Setup.

Siehe `references/story-template-feature.md` und `.claude/ISSUE_WRITING_GUIDELINES.md`.

## Architektur-Dimensionen

Jede Story wird gegen diese Dimensionen geprüft:
1. Reliability
2. Data Integrity
3. Security
4. Performance
5. Maintainability

## Regeln

- NIEMALS ein Issue ohne Labels anlegen
- NIEMALS den Operator-Text kürzen oder umformulieren
- Issue-Prefix: VE-
- Linear Team: Voelker AI Solutions
