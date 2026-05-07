---
name: stella-crm-architecture
description: Stella CRM architecture and backend guardrails. Use for Next.js App Router, Prisma, migrations, Docker dev server, finance/accounting module placement, auth/permission checks, setup-status checks, Server Actions, and production data safety in this repository.
---

# Stella CRM Architecture

## Read first when relevant

- Finance/accounting split: `docs/claude/finance-module-structure.md`
- Prisma and Docker: `docs/claude/dev-server-and-prisma.md`
- Setup status: `docs/claude/setup-status-check.md`
- Architecture overview: `docs/architecture.md`
- Business rules: `docs/business-rules.md`, `docs/business-logic.md`
- Database dictionary: `docs/database-dictionary.md`, `docs/DATABASE.md`

## Module placement

- Put project-shared finance functionality in `src/app/finance/`.
- Put accounting-only workflows in `src/app/accounting/`.
- Put project-specific finance automation in `src/app/{stp,hojo,slp,srd}/finance/`.
- If project staff without accounting permission must use it, it does not belong only under `accounting/`.

## Permission rules

- Server Actions must enforce permissions server-side.
- UI filtering is a convenience, not security.
- For `src/app/finance/`, use record-aware finance access helpers where records are involved.
- For `src/app/accounting/`, use accounting staff helpers.
- For new API routes, verify project scope and role level before data access.

## Prisma rules

- Do not use `prisma db push`.
- Do not run `npx next dev` locally.
- Do not change `.env` `DATABASE_URL` for local convenience.
- Schema changes require migration files and the full regenerate/restart sequence in `AGENTS.md`.
- For dynamic Prisma `update` data that touches relations, prefer `relation: { connect/disconnect }` over direct FK fields when the model has a relation.

## Setup status rule

When adding master data or making a feature depend on configured data, update `src/app/admin/setup-status/actions.ts` `checkDefinitions` so production can surface missing setup.

## Production/VPS safety

- Never execute `ssh` yourself.
- Never propose destructive stg/prod DB cleanup as routine troubleshooting.
- Give VPS commands for the user to run manually.
- Prefer backup, inspect, non-destructive migration, and reversible scripts.

## Validation

Choose checks based on risk:

- Pure TypeScript/backend change: `npm run build` or targeted type/test commands.
- Spec-protected behavior: `npm run test:specs`.
- Prisma schema: migration deploy/generate/restart sequence plus build.
- UI flow: browser verification in headless mode unless user requests visible mode.
