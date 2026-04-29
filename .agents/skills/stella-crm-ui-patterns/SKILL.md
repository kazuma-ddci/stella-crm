---
name: stella-crm-ui-patterns
description: Stella CRM UI implementation patterns. Use for CrudTable creation or column changes, inline editing, modal/dialog layout, textarea/long-text editing, DatePicker date inputs, searchable company selects, shadcn dialog sizing, and UI regressions in this repository.
---

# Stella CRM UI Patterns

## Read first when relevant

- CrudTable reference: `docs/components/crud-table.md`
- Inline edit reference: `docs/components/inline-edit.md`
- Company code labels: `docs/components/company-code-label.md`
- Responsive layout: `docs/components/responsive-layout.md`
- Long text confirmed spec: `docs/specs/SPEC-UI-001.md`
- Company select confirmed spec: `docs/specs/SPEC-UI-002.md`

## Date inputs

Use `DatePicker` from `@/components/ui/date-picker` for date fields.

Do not add `<Input type="date">`.

## Company selects

When the company select spec applies:

- Use searchable select/combobox behavior.
- Display labels as `{companyCode} - {companyName}`.
- Do not display internal IDs to users.
- In table display vs edit-ID cases, use the established display-to-edit mapping pattern.

## Inline edit

- Update only fields submitted by the inline edit payload.
- Do not rebuild a full update object with unrelated fields.
- For relation fields, convert values carefully and use relation operations where needed.
- Preserve confirmation dialogs and change-log behavior.
- For multiselect labels, show selected labels, not just counts.

## Long text and modals

Follow `SPEC-UI-001`:

- Do not add `field-sizing-content` to the shared textarea.
- Keep modal content bounded by viewport height.
- Keep header/footer visible; scroll the content area.
- Use `whitespace-pre-wrap` and `break-words` for long text display.

## Dialog width

This project's `DialogContent` has a `size` prop and data-attribute max-width rules.

- Prefer an existing `size` value first.
- If exact content-area width is needed, use inline `style`.
- Do not assume `className="max-w-*"` will override data-attribute rules.
- If the user says "80% of the screen", clarify or infer whether they mean the content area excluding the sidebar; often they do.

## Japanese sorting

Do not use Japanese `localeCompare` in Client Components. Use numeric IDs, stable codes, dates, or ASCII-safe keys.

## Verification

For UI changes, verify:

- Desktop and mobile layout.
- Empty, short, and long content.
- Keyboard and submit/cancel paths for forms.
- Reload persistence after save.
- Permission/disabled states if the UI hides or blocks actions.
