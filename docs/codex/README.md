# Codex Migration Notes

This directory keeps Codex-facing migration notes that should be tracked in git. The active always-on instruction file is the repository-root `AGENTS.md`.

## Worktrees

Current Codex-ready worktrees:

| Branch | Path | Purpose |
| --- | --- | --- |
| `feature/new-contact-history` | `/Users/shiozawakazuma/Myproject/stella-crm` | Active SLP contact-history implementation branch |
| `main` | `/Users/shiozawakazuma/Myproject/stella-crm/.codex-worktrees/main` | Clean main-branch Codex worktree |

Start Codex from the target path, for example:

```bash
codex -C /Users/shiozawakazuma/Myproject/stella-crm
codex -C /Users/shiozawakazuma/Myproject/stella-crm/.codex-worktrees/main
```

## Migrated surfaces

- `AGENTS.md`: Codex always-on project guide.
- `.agents/skills/stella-crm-*`: repo-local Codex skills for architecture, specs, UI, workflow, and SLP contact history.
- `docs/codex/commands/`: archived Claude slash-command prompts. These are reference material, not automatic permission to run git, deploy, or destructive commands.

## Operating rule

Keep Claude source files (`CLAUDE.md`, `.claude/`) until Codex has fully taken over. During the coexistence period, use the existing lock protocol before editing shared files when `.claude/lock.py` is present.
