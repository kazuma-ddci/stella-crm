---
name: stella-crm-spec-ops
description: Stella CRM confirmed specification workflow. Use when adding, checking, updating, or recording specs; when the user mentions /check-specs or /record; when changes may affect confirmed business/UI/auth behavior; or when guard tests should be created for a decision.
---

# Stella CRM Spec Ops

## Source of truth

`docs/specs/index.md` is the spec index. Individual `docs/specs/SPEC-*.md` files are authoritative.

`confirmed` specs cannot be changed without explicit user approval.

## Before changing behavior

1. Read `docs/specs/index.md`.
2. Search the target file path and feature keywords in `docs/specs/`.
3. Open every related SPEC file.
4. Check `forbidden_changes`.
5. If the requested change conflicts with a confirmed spec, stop and ask for approval before editing.

## Check-specs output shape

When the user asks to check specs, report:

- Target file or feature.
- Related SPEC IDs and statuses.
- Forbidden changes.
- Whether implementation can proceed safely.
- Guard tests to run or create.

## Recording decisions

When the user asks to record a decision:

- Confirmed behavior or "do not change" rule: create/update `docs/specs/SPEC-*.md` and `docs/specs/index.md`.
- Bug/troubleshooting lesson: update `docs/troubleshooting.md`.
- Business logic: update `docs/business-logic.md` or `docs/business-rules.md`.
- Component usage pattern: update `docs/components/`.
- Database change: update `docs/DATABASE.md` or `docs/database-dictionary.md`.
- Master data: update `docs/master-data.md`.

## New confirmed SPEC template

Use the existing format in `docs/specs/`. Include:

- Metadata table.
- Background.
- Decision/details.
- Forbidden changes.
- Impacted files/components.
- Verification method.
- Rollback or change procedure.
- Change history.

## Guard tests

For testable confirmed logic, add a Vitest guard under `src/__tests__/specs/`.

- Include the SPEC ID in the test title and comment.
- Test all forbidden-change cases when practical.
- If UI-only behavior cannot be tested cheaply, document manual verification in the SPEC.
