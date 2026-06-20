# Changelog

All notable changes to GhostWatch are documented here.

## [0.2.0] - 2026-06-19

### Added
- SSRF guardrails for monitor URLs (blocks private networks and metadata endpoints by default)
- Zod validation for monitor create/update API payloads
- Automatic check result retention job (default: 90 days, configurable)
- Vitest test suite covering scheduling, URL security, and validation
- CI jobs for typecheck, tests, and dependency audit
- Dependabot configuration for npm and GitHub Actions
- PostgreSQL backup and restore guide (`docs/deploy/backups.md`)

### Changed
- Minimum password length increased from 6 to 8 characters on registration
- Helm external CronJob now uses `GET` (POST still supported on `/api/cron/execute`)
- Cron tick summary includes `retentionDeleted` count

### Fixed
- Helm CronJob HTTP method mismatch with `/api/cron/execute`

## [0.1.0] - 2026-04-01

Initial public release — self-hosted uptime monitoring, alerting, and status pages.
