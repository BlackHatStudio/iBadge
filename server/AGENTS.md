# Server AGENTS — Server-specific guidance for AI coding agents

Purpose: provide targeted, actionable CI/build and developer guidance for the server portion of the repository.

Quick server commands
- Dev: `npm run server:dev` (from repo root) or `npm run dev` in `server/`
- Build: `npm run build` (in `server/`)
- Type-check: `npm run typecheck` (in `server/`)
- Start (production): `npm run start` (in `server/`)

CI / Build rules
- Node & npm: follow repo `engines` (Node >=20.9, npm >=10). Use the same Node minor/patch in CI images when possible.
- Install dependencies at repo root: `npm install`.
- Server build step (CI job):
  1. `cd server`
  2. `npm ci`
  3. `npm run typecheck` — fail early on TS errors.
  4. `npm run build` — produces `dist/` output.
  5. Optionally run lightweight smoke tests against the built server binary.
- Keep `dist/` out of commits; CI artifacts should carry the build output.

Testing & verification
- There are no server unit tests in the repo by default. For PR verification, run `npm run typecheck` and `npm run build` to validate changes.
- For changes affecting integration (DB, migrations, deployment), validate against `docs/deployment.md` and `sql/` migration scripts.

Configuration
- Use `.env` templates and runtime config; do not hard-code production DB or credentials in code. Refer to `deployment/` for packaging and `runtime-config.template.js` for runtime patterns.

Where to look for server logic
- Entry: `server/src/index.ts`
- DB access helpers: `src/lib/ibadge-db.ts` (root) and server-side repository/service modules under `server/src` where present.

How agents should behave on server edits
- Prefer small, focused patches that only touch server files for backend work.
- Link to `docs/architecture.md` or the relevant feature doc when proposing API or DB changes.
- For changes that touch installers or deployment packaging, consult `deployment/` and `docs/deployment.md` before editing packaging scripts.

Suggested follow-ups
- Add a CI job template file (e.g., `.github/workflows/server-ci.yml`) that implements the above steps.
