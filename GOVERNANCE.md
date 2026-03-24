# Governance Blueprint — AI-Driven Development Lifecycle

**Version:** 1.0.0 | **Stand:** 2026-03-24
**Projekt:** Versicherungsengel
**Zweck:** Vollständige Beschreibung des Governance-Setups.

---

## 1. Übersicht

Dieses Framework verbindet vier Plattformen zu einem durchgängigen Development Lifecycle:

| Plattform | Rolle |
|-----------|-------|
| **Linear** | Backlog, Sprint Planning, Issue Tracking — jede Arbeit beginnt mit einem Issue |
| **GitHub** | Code Repository, Versionierung — kein Code ohne Commit + Push |
| **TheBrain/Obsidian** | Dokumentation, Change-Log, Wissensmanagement |
| **Telegram** (optional) | Operator-Kommunikation, Alerts, System-Notifications |

### Kernprinzipien

1. **Kein Code ohne Issue.** Jede Änderung wird durch ein Linear-Issue autorisiert.
2. **Kein Issue ohne Struktur.** Jede Story folgt einem definierten Template.
3. **Keine Änderung ohne Dokumentation.** Jede Code-Änderung zieht Doku-Updates nach sich.
4. **Single Source of Truth.** `lib/config.js → VERSION` steuert alle Versions-Nummern zentral.
5. **Automatische Überwachung.** Self-Healing Agent prüft alle 15 Min, ob Doku und Code synchron sind.

---

## 2. Story-Governance

### Titel-Format
```
[Action] [Component] — [Detail/Benefit]
```

### Pflicht-Sektionen: Was, Warum, Kontext, Abhängigkeiten, Akzeptanzkriterien, Agent Team Setup

Siehe `.claude/ISSUE_WRITING_GUIDELINES.md` für Details.

---

## 3. Development Lifecycle

```
Idee → /ideation → Linear Issue → /backlog → Priorisierung → /implement → Code + Doku → Git Push → Done
```

### Git-Workflow

1. Branch: `feature/{VE-XX}-{slug}`
2. Commit: `v{VERSION} — VE-XX: {Titel}`
3. Push + PR → Merge nach main

---

## 4. Auto-Healing & Documentation Sync

### Prinzip

`lib/config.js → VERSION` ist die Single Source of Truth. Alle Dokumentationsdateien müssen dieselbe Version tragen.

### Check M — Versions-Sync (alle 15 Min)
- config.js lesbar + VERSION definiert?
- Für jede Datei in DOC_FILES: Version per Regex extrahieren und gegen config.js VERSION vergleichen

### Doc-Sync (lib/doc-sync.js)
- Aktualisiert Versionsstrings in allen DOC_FILES
- Spiegelt ins TheBrain Vault (mit Frontmatter)

---

## 5. Unverbrüchliche Regeln

| # | Regel |
|---|-------|
| 1 | NIEMALS einen Plan umsetzen ohne Issue |
| 2 | NIEMALS ein Issue schließen ohne Change-Log |
| 3 | NIEMALS Code ändern ohne Rückfrage beim Operator |
| 4 | NIEMALS eine Umsetzung als abgeschlossen melden ohne Git-Push |
| 5 | NIEMALS ein Issue ohne Labels anlegen |

---

## 6. Architektur-Dimensionen (Quality Gate)

| # | Dimension | Kernfragen |
|---|-----------|------------|
| 1 | **Reliability** | Graceful Degradation? Self-Healing nötig? |
| 2 | **Data Integrity** | SSoT eingehalten? Kein Dual-Write? |
| 3 | **Security** | API-Keys in .env? Inputs validiert? |
| 4 | **Performance** | Latenz akzeptabel? Rate Limits? |
| 5 | **Maintainability** | Keine Code-Duplikation? Config SSoT? Doku aktuell? |

---

*Basiert auf dem OpenCLAW Governance Framework — MIT License*
