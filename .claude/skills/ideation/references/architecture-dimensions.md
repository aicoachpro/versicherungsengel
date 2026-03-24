# Architektur-Dimensionen — Versicherungsengel

Jede Story wird gegen diese Dimensionen geprüft:

| # | Dimension | Kernfragen |
|---|-----------|------------|
| 1 | **Reliability** | Graceful Degradation? Self-Healing nötig? Kill-Switch vorhanden? |
| 2 | **Data Integrity** | SSoT eingehalten? Kein Dual-Write? Atomic Writes? Race Conditions? |
| 3 | **Security** | API-Keys in .env? Inputs validiert? Tokens in Logs sanitized? |
| 4 | **Performance** | Latenz akzeptabel? Rate Limits eingehalten? Memory stabil? |
| 5 | **Maintainability** | Keine Code-Duplikation? Config SSoT? Doku aktuell? |
