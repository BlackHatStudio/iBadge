# AGENTS — Guidance for AI coding agents

Purpose: give AI coding agents the minimal, actionable context needed to be productive in this repository.

Quick commands
- Install deps: `npm install`
- Frontend dev: `npm run dev`
- Backend dev: `npm run server:dev`
- Build frontend: `npm run build`
- Build server: `npm run build:server`
- Run all builds: `npm run build:all`
- Tests: `npm run test`

Key docs (link, don't embed)
- Docs index: [docs/README.md](docs/README.md)
- Architecture: [docs/architecture.md](docs/architecture.md)
- Design (UI/layout rules): [docs/design.md](docs/design.md)
- API/database mapping: [docs/api-database-mapping.md](docs/api-database-mapping.md)
- Development workflow: [docs/development.md](docs/development.md)
- Testing: [docs/testing.md](docs/testing.md)
- Deployment: [docs/deployment.md](docs/deployment.md)

Repository rules and conventions (short)
- Kiosk resilience: keep kiosk functionality offline-first; do not lose badge scans on network failure. See [CLAUDE.md](CLAUDE.md) and [docs/features/kiosk.md](docs/features/kiosk.md).
- Frontend API calls must go through `src/lib/api.ts` and `src/lib/app-config.ts`.
- Backend DB access should be isolated behind `src/lib/ibadge-db.ts` and attendee repository/service modules.
- Server-specific CI/build guidance is in `server/AGENTS.md`.
- Never hard-code production URLs, SQL credentials, or install paths; use runtime config, `.env` templates, or deployment settings.
- Do not overwrite generated installer or deployment outputs unless the task is explicitly about packaging.

Where to verify changes
- Unit tests: `npm run test`
- Frontend build check: `npm run build`
- Server build/type-check: `npm run build:server`
- For deployment-related changes, consult [docs/deployment.md](docs/deployment.md) and [docs/windows-server-2022-deployment-package-plan.md](docs/windows-server-2022-deployment-package-plan.md).

How agents should behave
- Link to docs rather than duplicating them.
- Keep changes minimal and focused; prefer small, well-scoped patches.
- When modifying docs, update the matching file under `docs/` rather than burying long rationale in the instruction file.

Suggested follow-ups
- Create a small skill that can run and report `npm run test` and `npm run build` results.
- Add a focused agent-instruction file for the server side if we want stricter CI/build rules.

---
This file is intentionally short. Refer to the linked docs for detailed policies and procedures.
