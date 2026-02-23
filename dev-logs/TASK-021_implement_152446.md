全6件の修正が完了し、`tsc --noEmit` もエラーなしで通りました。修正内容をまとめます。

---

## 修正内容サマリー

### Issue 1 [major]: クローズ済み月関与時の権限チェック
- **`actions.ts`**: `updateAllocationTemplate` の先頭で `checkClosedMonthInvolvement` を呼び、クローズ月が関与する場合に `session.permissions` で admin 権限をチェック。非管理者は `throw Error` でブロック
- **`page.tsx`**: `getSession()` で `isAdmin` を判定し、クライアントコンポーネントに prop として渡す
- **`allocation-templates-table.tsx`**: `isAdmin` prop を受け取り、非管理者の場合は「変更を適用」ボタンを `disabled` にし、警告メッセージを赤色で表示

### Issue 2 [major]: 按分率変更時の新テンプレート作成ガイダンス
- **`allocation-templates-table.tsx`**: `detectRateChanges` 関数で既存行のID単位で按分率変更を検知。按分率が変更された場合は専用ダイアログを表示し、「新テンプレートとして保存」のフローに誘導。旧テンプレートは変更せず、`createAllocationTemplate` で新テンプレートを作成
- 按分率未変更（costCenterId/labelのみ変更）の場合は従来通りの影響確認フローに進む

### Issue 3 [minor]: AllocationTemplateOverride.reason フィールド
- **`actions.ts`**: `createTemplateOverrides` に `reason?: string` パラメータを追加し、upsert の create/update 両方で `reason` を設定
- **`allocation-templates-table.tsx`**: 影響確認ダイアログで「変更前維持」チェックがある場合に `Textarea` で維持理由入力欄を表示

### Issue 4 [minor]: deleteAllocationTemplate の使用中チェック
- **`actions.ts`**: 削除前に `Transaction` と `RecurringTransaction` の参照件数を確認。使用中の場合は件数を含むエラーメッセージで削除をブロック

### Issue 5 [minor]: 明細リプレース時の updatedBy 設定
- **`actions.ts`**: `updateAllocationTemplate` の明細リプレース（deleteMany→create）時に、新しい明細行に `updatedBy: staffId` を設定

### Issue 6 [minor]: getAffectedTransactions の月計算をUTC基準に修正
- **`actions.ts`**: `getUTCMonthStart` ヘルパー関数を追加し、`getAffectedTransactions` と `checkClosedMonthInvolvement` の両方で `Date.UTC` / `getUTCFullYear` / `getUTCMonth` を使用するように修正
