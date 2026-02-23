全修正完了です。`npx tsc --noEmit` もエラーなしでパスしました。

## 修正サマリー

### Major（3件）: changelog記録をDBトランザクション内に移動

| 関数 | ファイル | 修正内容 |
|------|---------|---------|
| `confirmTransaction` | `transactions/actions.ts` | `prisma.$transaction(async (tx) => {...})` で囲み、`recordChangeLog` に `tx` を渡すよう変更 |
| `hideTransaction` | `transactions/actions.ts` | 同上 |
| `deleteJournalEntry` | `journal/actions.ts` | 同上 |
| `updateAllocationTemplate` | `allocation-templates/actions.ts` | 配列形式 `$transaction([...])` → `$transaction(async (tx) => {...})` に変更し、`recordChangeLogs` をトランザクション内に移動して `tx` を渡すよう変更 |

### Minor（3件）: デッドコード削除

| ファイル | 修正内容 |
|---------|---------|
| `changelog/actions.ts` | 未使用import `revalidatePath`, `getSession` を削除 |
| `changelog-section.tsx` | 未使用import `Button` を削除 |
| `changelog/actions.ts` | 未使用export `ALLOCATION_TEMPLATE_LINE_LOG_FIELDS` を削除 |
