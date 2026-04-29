---
name: stella-crm-slp-contact-history
description: Stella CRM SLP contact history, meeting, Zoom, recording, reminder, thanks-message, and Proline staff-name workflow. Use when changing feature/new-contact-history work, contact history V2, SlpMeetingSession flows, Zoom webhook/API integration, session notifications, Slack/Telegram middleware boundaries, or SLP customer-facing notification templates.
---

# Stella CRM SLP Contact History

## Read first

- `docs/plans/contact-history-unification-plan.md`
- `docs/plans/slp-meeting-session-refactor-plan.md`
- `docs/plans/slp-contact-history-zoom-refactor-plan.md`
- `docs/slp-feature-overview.md`
- `docs/slp-proline-integration-manual.md`
- `docs/slp-reserve-relay-system.md`
- `docs/slp-staff-guide.md`

## Current branch context

`feature/new-contact-history` is focused on contact history V2 and meeting/session automation. Treat this area as high risk because it touches customer communication, Zoom state, reminders, recording, and history data.

## Product decisions to preserve

- CRM is the source of truth for contact histories.
- Slack/Telegram bot behavior belongs to a separate middleware app when it involves bot UI or personal calendar-change webhooks.
- CRM may expose REST APIs for middleware, but should not absorb Slack/Telegram bot responsibilities casually.
- Multiple meetings in one contact history are mainly for accidental Zoom disconnect or time-limit relink cases. Separate meeting times should generally be separate contact histories.
- Some meeting fields may stay in the database but be hidden from forms when users do not need to edit them.

## Meeting state direction

Basic status should drive meeting state:

- Scheduled: meeting remains scheduled.
- Completed with URL/host integration: move through retrieval state and then completed/failed based on API result.
- Completed without URL/host integration: mark completed without retrieval.
- Cancelled: skip retrieval and remove calendar/meeting artifacts where appropriate.
- Rescheduled: keep scheduled state and update time.

If AI minutes are fetched, append them idempotently and prevent duplicate appends with the existing guard fields/patterns.

## Staff name rule

For Proline-facing SLP notification text, `{{staffName}}` must come from the Proline staff mapping name, not casually from the internal staff master name.

Before changing notification code, inspect the current source path and preserve the mapping priority. If no mapping exists, decide fallback behavior deliberately and involve the user if business-facing text changes.

## Implementation guardrails

- Keep Zoom webhook handling idempotent.
- Avoid duplicate reminders, duplicate thanks messages, and duplicate recording/minutes ingestion.
- Preserve existing customer-visible URLs and template variables unless the user approves changes.
- Use transactions when updating session/contact state plus history/log records together.
- Do not remove columns only because fields are hidden in the UI.

## Validation

At minimum, validate the scenario touched:

- Reservation/session creation.
- Reminder scheduling/sending.
- Zoom webhook ingestion.
- Recording/minutes completion.
- Thanks-message generation.
- Cancellation/reschedule behavior.
- Permission and project-scope checks for SLP staff.
