# Issue Writing Guidelines — Versicherungsengel

**Version:** 1.0
**Purpose:** Standardized issue creation for Claude + Operator collaboration

---

## Quick Reference

### Title Format
```
[Action] [Component] — [Detail/Benefit]
```

**Examples:**
- "Build Auth Service — JWT-based Session Management"
- "Add Rate Limiting to API Gateway"
- "Fix Memory Leak in Worker Process"

### Description Structure
```
## Was
[What is being built/changed? Technical overview]

## Warum
[Why does this matter? Business value? Performance gain?]

## Kontext
[Related issues? Dependencies? Background?]

## Workflow-Type
`direct` (build immediately) or `epic` (multiple sub-tasks)

## Komplexität
`low`, `medium`, or `high`

## Abhängigkeiten
- Benötigt: [VE-XX] (must be done first)
- Beeinflusst: [VE-YY] (affected by this change)

## Akzeptanzkriterien
- [ ] Specific requirement 1
- [ ] Specific requirement 2
- [ ] Documentation updated (CLAUDE.md + SYSTEM_ARCHITECTURE.md)
- [ ] Git Push

## Agent Team Setup
**Team nötig:** Ja/Nein — [reason]
```

---

## When Claude Creates an Issue

Always add at the top of the description:

```markdown
> Ideation Source: Claude AI Agent
> Created during [context]
> Recommendation: [priority suggestion]
```

---

## Anti-Patterns

| Schlecht | Gut |
|----------|-----|
| "Improve the system" | "Optimize Worker Loop — Add Delta-Based Change Detection" |
| "Build something cool" | "- [ ] Feature X implemented and tested" |
| "Add new component" | "Depends on VE-50. Blocked until dependency deployed." |
| "Make it faster" | "Reduce latency from 150ms to <100ms" |

---

*Issue Writing Guidelines — Versicherungsengel | Based on OpenCLAW Governance Framework*
