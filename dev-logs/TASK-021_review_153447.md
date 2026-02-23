全ファイルの確認が完了しました。設計書・要望書と照合しながらレビュー結果をまとめます。

---

## レビュー結果

### 対象コミット
`acc5544` feat(TASK-021): 実装 (attempt 2)

### 変更概要
前回レビュー（Issue 1〜6）で指摘された問題への修正コミット。3ファイル変更、524行追加。

---

### チェック 1: テーブル定義 Prisma ↔ 設計書

| モデル | 設計書 | Prisma | 一致 |
|---|---|---|---|
| AllocationTemplate | ⑥ | schema:2449 | ✅ |
| AllocationTemplateLine | ⑦ | schema:2473 | ✅ |
| AllocationTemplateOverride | ⑨ (reason含む) | schema:2517 | ✅ |

### チェック 2: 要望書 2.6 按分管理フローの実装

| 要件 | 状態 | 実装箇所 |
|---|---|---|
| 2.6.2 テンプレート名称+明細（按分先+按分率） | ✅ | `actions.ts:53-67` |
| 2.6.2 合計100%バリデーション | ✅ | `actions.ts:317-331` (validateLines) |
| 2.6.2 未確定枠選択可能 | ✅ | `allocation-templates-table.tsx:168` (`_undecided`) |
| 2.6.2 +ボタンで行追加UI | ✅ | `allocation-templates-table.tsx:115-117, 133-136` (LinesEditor) |
| 2.6.3 按分率変更→新テンプレート作成 | ✅ | `allocation-templates-table.tsx:79-100` (detectRateChanges) + rateChangeDialog |
| 2.6.3 明細変更→テンプレート編集+影響確認 | ✅ | `allocation-templates-table.tsx:392-425` (impactDialog) |
| 2.6.3 影響取引の一括/個別選択 | ✅ | `allocation-templates-table.tsx:726-770` (Checkbox + toggleKeepTransaction) |
| 2.6.3 クローズ月関与時の管理者権限チェック | ✅ | サーバー側: `actions.ts:88-98`, クライアント側: `allocation-templates-table.tsx:484` |

### チェック 3: 設計書 5.4, 5.4.1, 6.3 バリデーション

| ルール | 状態 | 備考 |
|---|---|---|
| 5.4.1 按分率変更→新テンプレート | ✅ | `detectRateChanges` + `handleCreateAsNewTemplate` |
| 5.4.1 非率変更→既存テンプレート編集 | ✅ | 影響確認ダイアログ経由 |
| 5.4.1 変更前維持→OverrideレコードA作成 | ✅ | `createTemplateOverrides` + snapshotRates |
| 5.4.1 非管理者→テンプレート編集自体不可 | ✅ | サーバー・クライアント両方で制御 |
| 5.4.1 管理者→編集可+影響一覧表示 | ✅ | `isAdmin`による分岐表示 |
| 6.3 合計100%制約 | ✅ | `validateLines` |
| 6.3 未確定枠許可 | ✅ | `costCenterId: null` |
| 6.3 Override uniqueA制約 | ✅ | Prisma `@@unique` + upsert |
| 設計書⑨ reason フィールド | ✅ | `actions.ts:252, 272, 277` |

### チェック 4: 設計書 6.7 ポリモーフィック排他制約

TASK-021の範囲では該当なし。AllocationTemplateOverrideはポリモーフィック参照テーブルではないため対象外。

### チェック 5: TypeScript型安全性・エラーハンドリング

- `getSession()` の権限チェック: `session.permissions.some(p => p.permissionLevel === "admin")` — 既存パターン (`master-data-permission.ts:10`) と一致 ✅
- UTC月初計算のヘルパー関数: `getUTCMonthStart` — 3箇所で一貫して使用 ✅
- Promise reject/resolve のハンドリング: ダイアログ閉じ時に適切にreject ✅
- `isPending` でボタン二重押し防止 ✅

### チェック 6: 既存コードパターン準拠

- `Record<string, unknown>` 型のServer Action引数: 既存CrudTableパターン準拠 ✅
- `revalidatePath` による再検証: 既存パターン準拠 ✅
- 論理削除 (`deletedAt`): 既存パターン準拠 ✅
- `Prisma.Decimal` での按分率操作: 既存パターン準拠 ✅
- toast通知: 既存パターン準拠 ✅

---

### 指摘事項

**Minor 1: updateTemplate + createOverrides の非原子性**

`handleApplyChanges` (`allocation-templates-table.tsx:504-556`) で `updateAllocationTemplate` と `createTemplateOverrides` が別々のServer Actionとして順次呼び出されている。1つ目が成功し2つ目が失敗した場合、テンプレート明細は更新されるが Override が作成されず、「変更前維持」を選択した取引が意図せず新しい按分率で計算される可能性がある。

発生確率は極めて低い（DBコネクション断等）が、設計書 5.4.1 の「変更前維持を選んだ取引にはOverrideレコードを作成」を確実に保証するには、1つのServer Action内でDBトランザクションにまとめることが望ましい。

**Minor 2: 名前のみ変更時のクローズ月エラーのUX**

非管理者がクローズ月関与テンプレートの名前やisActiveのみを変更する場合、クライアント側では事前警告なくそのまま送信され、サーバー側で拒否される。影響確認ダイアログはlines変更時のみ表示されるため、名前のみ変更のケースではサーバーエラーがそのまま表示される。

設計書 5.4.1 の「テンプレート編集自体不可」は正しく実装されている（サーバーで拒否）が、UX上は事前に警告がある方がベター。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/allocation-templates-table.tsx",
      "description": "handleApplyChanges内でupdateAllocationTemplateとcreateTemplateOverridesが別々のServer Actionとして呼ばれており、前者成功・後者失敗時にデータ不整合が起きる可能性がある",
      "suggestion": "updateAllocationTemplateのServer Action内にOverride作成を含め、prisma.$transactionで一括実行する。引数にkeepTransactionIds, snapshotRates, reasonを追加し、1つのServer Actionで完結させる"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/allocation-templates-table.tsx",
      "description": "非管理者がクローズ月関与テンプレートの名前/isActiveのみ変更する場合、クライアント側の事前チェックがなくサーバーエラーで拒否される（影響確認ダイアログは表示されない）",
      "suggestion": "handleUpdate冒頭でcheckClosedMonthInvolvement + isAdmin判定を行い、非管理者にはtoastで事前警告を出してearly returnする。または、CrudTableの編集ボタン自体をdisabledにする"
    }
  ],
  "summary": "前回レビュー指摘6件（クローズ月権限チェック、按分率変更検出→新テンプレート作成、維持理由、使用中チェック、updatedBy設定、UTC月初計算）が全て適切に修正されている。設計書5.4/5.4.1/6.3の仕様に忠実な実装。Prismaスキーマとの整合性も問題なし。残る2件のminor指摘はデータ整合性の堅牢化とUX改善の提案であり、機能的な不具合ではない。"
}
```
