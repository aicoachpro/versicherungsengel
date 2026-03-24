# Versicherungsengel — Development Process

**Version:** 1.0.0 | **Stand:** 2026-03-24

## Übersicht

Entwicklungsprozesse folgen dem OpenCLAW Governance Framework (siehe GOVERNANCE.md).

## Lifecycle

```
Idee → /ideation → Linear Issue → /backlog → Priorisierung → /implement → Code + Doku → Git Push → Done
```

## Git-Workflow

1. Branch erstellen: `feature/{issue-id}-{slug}`
2. Implementieren auf Branch
3. Commit: `v{VERSION} — VE-XX: {Titel}`
4. Push: `git push -u origin feature/...`
5. PR erstellen → Merge nach main

## Änderungs-Checkliste (PFLICHT)

- [ ] Dokumentation aktualisieren (alle DOC_FILES auf VERSION)
- [ ] Git Commit + Push
- [ ] Linear Issue updaten
- [ ] Bei neuer API: `.env.example` ergänzen, Rate Limiting, Error Handling
