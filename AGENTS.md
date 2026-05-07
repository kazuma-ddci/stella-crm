# Stella CRM - Codex Operating Guide

This file is the primary instruction surface for Codex in this repository. Keep it concise; load the linked docs and skills only when the task needs them.

## Mission

Build Stella CRM as a production-grade business system, not a prototype. Prioritize correctness, data safety, permission safety, maintainability, and clear user-facing behavior over quick-looking patches.

The owner is an AI engineer but not a web application engineer. Explain changes using screen names, feature names, and visible field labels first. Avoid leading with database table or column names unless they are necessary; if necessary, put them in parentheses after the Japanese explanation.

## Start Every Task

1. Run `git status --short --branch` and preserve all existing user/other-agent changes.
2. Identify whether the request is implementation, review, planning, or documentation only. If the user says not to implement, do not edit code.
3. Check relevant confirmed specs in `docs/specs/index.md` before touching related behavior.
4. For edits, lock the smallest target set first when `.claude/lock.py` exists: `python3 .claude/lock.py check file1,file2` then `python3 .claude/lock.py acquire file1,file2 "task"`. Release before the final answer.
5. If `prisma/schema.prisma` or `prisma/migrations` is involved, treat it as high-risk and avoid parallel edits.

## Core Safety Rules

- Never run `git reset --hard`, `git checkout -- <path>`, destructive `rm`, or broad cleanup commands unless the user explicitly asks and approves the consequence.
- Never revert or overwrite changes you did not make. If unexpected edits appear in files you are using, stop and ask.
- Do not run `ssh` yourself. For VPS work, output commands for the user to run manually.
- Do not propose destructive operations against stg/prod VPS databases (`migrate reset`, `DROP`, `TRUNCATE`, volume deletion, reseeding) as a normal fix. Find non-destructive paths.
- Do not change `.env` `DATABASE_URL` to make local commands work.
- Do not use `npx next dev` locally. Use Docker for the dev server.
- Do not use `prisma db push`.

## Development Commands

Use Docker for the app runtime:

```bash
docker compose up app -d
docker compose restart app
```

When Prisma schema changes, complete all steps:

```bash
docker compose exec app npx prisma migrate deploy
npx prisma generate
docker compose exec app npx prisma generate
docker compose restart app
```

Validation commands:

```bash
npm run build
npm run lint
npm run test
npm run test:specs
```

Run the smallest useful validation first, then broader checks when the risk justifies it. UI or form behavior changes usually need browser verification; default to headless unless the user explicitly asks for a visible browser.

## Confirmed Specs

`docs/specs/` is the source of truth. `confirmed` specs require user approval before behavior changes.

Current high-signal specs include:

- `SPEC-STP-001`: advisor category display format.
- `SPEC-STP-002`: hearing form job-type linkage.
- `SPEC-UI-001`: textarea/modal long-text layout.
- `SPEC-UI-002`: company-select UI/UX pattern.
- `SPEC-AUTH-001`: staff-management permission ceiling.

When a change touches a spec, read the specific file, respect `forbidden_changes`, and add or run guard tests when available.

## Architecture Rules

- `src/app/finance/`: shared finance layer used by accounting and project staff.
- `src/app/accounting/`: accounting-only workflows.
- `src/app/{stp,hojo,slp,srd}/finance/`: project-specific finance automation and trackers.
- New master data dependencies must be surfaced in `src/app/admin/setup-status/actions.ts` so `/admin/setup-status` catches missing production setup.
- Server Actions must enforce server-side permission checks. UI filtering alone is never enough.
- Prisma dynamic `update` paths should prefer relation operations (`connect` / `disconnect`) over direct FK assignment when that relation is involved.

Read details when relevant:

- `docs/claude/finance-module-structure.md`
- `docs/claude/dev-server-and-prisma.md`
- `docs/claude/setup-status-check.md`
- `docs/architecture.md`
- `docs/business-rules.md`
- `docs/business-logic.md`

## Project-Specific Memory

- Date fields in forms use `DatePicker` from `@/components/ui/date-picker`; do not add `<Input type="date">`.
- Avoid Japanese `localeCompare` in Client Components because SSR/browser ordering can differ and cause hydration errors. Sort by numeric IDs, codes, or ASCII-safe keys instead.
- SLP notification template `{{staffName}}` must come from the Proline staff mapping name when Proline-facing text is generated; do not casually revert it to internal staff names.
- STP contract-history amounts are tax-included. Generated accounting transactions should use tax-included handling.
- KPI management is currently STP-scoped. Expanding it to other projects requires explicit permission and key design changes.
- Dialog width in this project is controlled by `DialogContent` `size` props and data attributes. Prefer `size`, then inline `style` for exact widths.

## UI Quality Bar

Preserve the existing design system unless the user asks for a new visual direction. For frontend work:

- Use existing shared components before inventing new UI.
- Make table, modal, and form behavior robust on desktop and mobile.
- Keep long text scrollable; do not let modals grow past the viewport.
- Company selects must be searchable and display `{companyCode} - {companyName}` where that spec applies.
- Inline edits must update only submitted fields and keep confirmation/change-log behavior intact.

## Codex Skills

Use these repo-local skills when their trigger matches:

- `.agents/skills/stella-crm-codex-workflow/SKILL.md`: work modes, lock protocol, review/implementation workflow.
- `.agents/skills/stella-crm-architecture/SKILL.md`: architecture, Prisma, finance/accounting, permissions, setup status.
- `.agents/skills/stella-crm-spec-ops/SKILL.md`: confirmed specs, `/check-specs`, `/record`-style documentation.
- `.agents/skills/stella-crm-ui-patterns/SKILL.md`: CrudTable, inline edit, long text UI, DatePicker, Dialog, company select.
- `.agents/skills/stella-crm-slp-contact-history/SKILL.md`: SLP contact history V2, Zoom/meeting/session notification context.

Legacy Claude command prompts are archived for reference in `docs/codex/commands/`. Treat them as guidance, not automatic permission to commit, push, or perform risky operations.
