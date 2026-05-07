---
name: stella-crm-codex-workflow
description: Stella CRM Codex execution workflow. Use when Codex works in this repository, especially for implementing, reviewing, planning, migrating Claude Code instructions, handling concurrent worktrees, acquiring file locks, deciding quick vs deep implementation mode, or translating legacy Claude slash commands.
---

# Stella CRM Codex Workflow

## Default posture

- Implement end-to-end when the user asks for a fix or change.
- Do not implement when the user explicitly says planning, review-only, or no edits.
- Keep user-facing explanations in Japanese and centered on screens/features, not database internals.
- Use subagents only when the user explicitly asks for agent delegation or parallel agent work; otherwise parallelize shell reads with `multi_tool_use.parallel` where useful.

## Required pre-edit sequence

1. Run `git status --short --branch`.
2. Determine exact target files.
3. If `.claude/lock.py` exists, run:

```bash
python3 .claude/lock.py check path/to/file1,path/to/file2
python3 .claude/lock.py acquire path/to/file1,path/to/file2 "short task description"
```

4. If a lock conflict appears, queue or wait according to `docs/claude/file-lock-protocol.md`.
5. Release the lock before the final answer:

```bash
python3 .claude/lock.py release <lock-id>
```

## Quick vs deep mode

Use quick mode for small, localized fixes:

- Read the relevant file and nearby patterns.
- Check only directly relevant specs.
- Make the smallest safe change.
- Run focused validation.

Use deep mode for high-risk work:

- DB schema or migration changes.
- Auth/permission logic.
- Cross-module refactors.
- UI flows involving forms, modals, inline edit, or several components.
- Confirmed specs or business rules.
- SLP contact-history/Zoom/session automation.

Deep mode workflow:

1. Decompose the request.
2. List likely impact files.
3. Check `docs/specs/index.md` and relevant spec files.
4. Read domain docs under `docs/`.
5. Plan validation before editing.
6. Implement with locks.
7. Run focused checks, then broader checks if risk warrants.

## Review mode

When the user asks for review, prioritize findings over summary:

- Report bugs, regressions, permission leaks, data-loss risks, and missing tests.
- Use file paths and line numbers.
- If there are no findings, say so and list residual risk briefly.
- Do not edit files during review-only tasks.

## Legacy command mapping

Legacy Claude command files are preserved under `docs/codex/commands/`.

- `/check-specs`: use `stella-crm-spec-ops`.
- `/record`: use `stella-crm-spec-ops` and update the appropriate docs.
- `/quick`: use quick mode above.
- `/deep`: use deep mode above.
- `/plan-up` and `/claude-codex`: read the archived command docs first if the user mentions them.
- `/git-iphone`: do not run automatically; committing/pushing still requires the user's current explicit intent.

## Final response checklist

- State what changed first.
- Mention validation run and results.
- Mention anything not run.
- Keep explanations concise and user-facing.
- Confirm lock release when a project lock was used.
