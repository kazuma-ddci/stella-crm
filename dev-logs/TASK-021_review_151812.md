全ての情報が揃いました。レビュー結果をまとめます。

---

## TASK-021 コードレビュー: 按分テンプレート管理画面

### 対象コミット
`f5d4ce1` feat(TASK-021): 実装 (attempt 1)

### 変更ファイル（実装コード3ファイル）
- `src/app/accounting/masters/allocation-templates/page.tsx` (64行)
- `src/app/accounting/masters/allocation-templates/allocation-templates-table.tsx` (580行)
- `src/app/accounting/masters/allocation-templates/actions.ts` (289行)

---

### 1. テーブル定義 vs Prismaスキーマ vs 設計書

| 項目 | 設計書 | Prismaスキーマ | 実装 | 判定 |
|------|--------|---------------|------|------|
| AllocationTemplate.name | String | String | ✓ | OK |
| AllocationTemplate.isActive | Boolean @default(true) | Boolean @default(true) | ✓ | OK |
| AllocationTemplate.deletedAt | DateTime? | DateTime? | ✓ (論理削除) | OK |
| AllocationTemplate.createdBy/updatedBy | Int / Int? | Int / Int? | ✓ | OK |
| AllocationTemplateLine.costCenterId | Int? (未確定枠) | Int? | ✓ | OK |
| AllocationTemplateLine.allocationRate | Decimal | Decimal | ✓ (Prisma.Decimal使用) | OK |
| AllocationTemplateLine.label | String? | String? | ✓ | OK |
| AllocationTemplateLine.createdBy/updatedBy | Int? / Int? | Int? / Int? | createdByのみ設定 | 後述 |
| AllocationTemplateOverride.snapshotRates | Json | Json | ✓ | OK |
| AllocationTemplateOverride.reason | String? | String? | 未実装 | 後述 |
| AllocationTemplateOverride.@@unique | [transactionId, allocationTemplateId] | ✓ | upsertで保護 | OK |

---

### 2. 要望書フロー・設計書バリデーション

| 要件 | 出典 | 実装状況 |
|------|------|----------|
| テンプレート一覧表示 | 2.6.2 | ✓ CrudTable で実装 |
| 新規作成（名称+明細） | 2.6.2 | ✓ |
| 合計100%バリデーション | 2.6.2, 6.3 | ✓ サーバー側(validateLines) + クライアント側(リアルタイム表示) |
| 未確定枠(costCenterId=null)選択可能 | 2.6.2, 6.3 | ✓ `_undecided`オプション |
| +ボタンで行追加UI | 2.6.2 | ✓ LinesEditorコンポーネント |
| 名称重複チェック | — | ✓ deletedAt:null範囲で重複検知 |
| 明細変更時の影響確認ダイアログ | 5.4.1 | ✓ getAffectedTransactions + Dialog |
| 変更前維持/変更後適用の個別選択 | 5.4.1 | ✓ チェックボックスで個別・一括選択 |
| AllocationTemplateOverride作成 | 5.4.1 | ✓ createTemplateOverrides |
| **クローズ済み月関与時の権限チェック** | **5.4.1** | **警告表示のみ。ブロック未実装** |
| **按分率変更 → 新テンプレート作成** | **5.4.1** | **未実装（直接編集可能）** |

---

### 3. 個別指摘事項

#### Issue 1: クローズ済み月関与時の権限チェック未実装 [major]

**設計書 5.4.1:**
> - 非管理者: テンプレート編集自体不可（オープン月のみ適用という中途半端な変更は許可しない）
> - 経理管理者: 編集可、クローズ月含めて影響一覧を表示

**実装 (`allocation-templates-table.tsx:250-254`):** `hasClosedMonth` の結果は警告メッセージ表示のみ。`handleApplyChanges` で権限チェック・ブロックロジックが存在しない。非管理者でもクローズ済み月の取引に影響する変更を適用できてしまう。

**修正案:** `updateAllocationTemplate` (サーバー側) でクローズ月関与時にセッションユーザーの権限（経理管理者か）を確認し、非管理者であれば `throw new Error("クローズ済みの月に関わるテンプレートの変更は経理管理者権限が必要です")` でブロックする。

---

#### Issue 2: 按分率変更時の新テンプレート作成ガイダンスが未実装 [major]

**設計書 5.4.1 変更種別ルール:**
> - 按分率そのものの変更（配分方針変更）: 新テンプレート作成（バージョン管理）。旧テンプレートは既存取引で引き続き参照される
> - 未確定枠の割当確定等の明細変更: 既存テンプレート編集可（影響確認画面を表示）

**実装:** 按分率変更も未確定枠割当も区別なく既存テンプレートの直接編集が可能。Override機構で過去取引の保護は可能だが、設計の意図（按分率変更は新テンプレート、明細変更は既存編集）と異なる。

**修正案:** 2つのアプローチが考えられる:
- (A) 編集時に按分率の変更を検知したら「按分率が変更されています。新テンプレートとして作成することを推奨します」と案内し、「新テンプレートとして保存」ボタンを追加
- (B) 按分率カラムを編集不可にし、率変更はクローン→新テンプレート作成のフローに限定

---

#### Issue 3: AllocationTemplateOverride.reason が未実装 [minor]

**設計書 ⑨ AllocationTemplateOverride:**
> reason String? // 維持理由（任意）

`createTemplateOverrides` で `reason` フィールドが設定されていない。ダイアログUIにも理由入力欄がない。任意フィールドだが、設計書に定義されている。

---

#### Issue 4: deleteAllocationTemplate に使用中チェックがない [minor]

`deleteAllocationTemplate` (`actions.ts:142-153`) でテンプレートを論理削除する際、`Transaction.allocationTemplateId` や `RecurringTransaction.allocationTemplateId` で参照されているかチェックしていない。論理削除なのでFK違反は発生しないが、使用中テンプレートが一覧から消えると運用上混乱する。

**修正案:** 削除前に参照件数を確認し、使用中なら「このテンプレートは N 件の取引で使用されています。削除しますか？」と警告する。

---

#### Issue 5: 明細リプレース時に updatedBy が未設定 [minor]

`updateAllocationTemplate` (`actions.ts:120-133`) で明細を `deleteMany` → `create` で全リプレースしているが、新しい明細行には `createdBy` のみ設定され `updatedBy` は未設定。設計書の AllocationTemplateLine には `updatedBy Int?` がある。リプレース戦略自体は合理的だが、既存明細の `createdBy` (原作成者) が失われる。

---

#### Issue 6: getAffectedTransactions の月計算でタイムゾーンリスク [minor]

`getAffectedTransactions` (`actions.ts:162-180`) で `new Date(d.getFullYear(), d.getMonth(), 1)` を使用してローカルタイムゾーンで月初を計算している。サーバーのタイムゾーンがUTCでない場合（JST等）、`accountingMonthlyClose.targetMonth`（UTC格納）との比較でミスマッチが発生する可能性がある。

**修正案:** UTC基準で月初を計算する:
```typescript
const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
```

---

### 4. 既存コードパターンとの整合性

| 観点 | 判定 | コメント |
|------|------|---------|
| ページ構造 (async server component) | ✓ | Promise.all並列取得、deletedAt:nullフィルタ |
| Server Actions パターン | ✓ | getSession、revalidatePath、throw Errorパターン |
| CrudTable使用 | ✓ | customRenderers、customFormFields、onAdd/onUpdate/onDelete |
| 論理削除パターン | ✓ | deletedAt + updatedBy |
| 入力バリデーション | ✓ | 名称必須、重複チェック、合計100%チェック |
| 型安全性 | △ | `Record<string, unknown>` の使用は既存パターンに準拠しているが型安全ではない |

---

### 5. 良い点

- **LinesEditorコンポーネント**: 行追加/削除UI、リアルタイム合計表示、100%バリデーションの視覚フィードバックが適切
- **影響確認ダイアログ**: Promise-based で CrudTable の保存フローに統合されている設計が良い
- **Overrideの upsert**: `@@unique` 制約に基づく `upsert` で重複防止
- **Prisma.Decimal 使用**: 浮動小数点の精度問題を回避

---

### 最終判定

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts + allocation-templates-table.tsx",
      "description": "クローズ済み月関与時の権限チェックが未実装。設計書5.4.1では非管理者はテンプレート編集自体が不可とされているが、警告メッセージ表示のみでブロックしていない。タスク要件にも明記されている項目。",
      "suggestion": "updateAllocationTemplate サーバーアクション内で checkClosedMonthInvolvement を呼び、クローズ月が関与する場合はセッションユーザーの権限（経理管理者か）を確認し、非管理者であれば throw Error でブロックする。"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/masters/allocation-templates/allocation-templates-table.tsx",
      "description": "設計書5.4.1「按分率そのものの変更 → 新テンプレート作成（バージョン管理）」が未実装。按分率変更でも既存テンプレートを直接編集可能になっており、Override機構で一定の保護はあるがデフォルトが「変更後適用」のため、意図しない過去取引への影響リスクがある。",
      "suggestion": "編集時に按分率の変更を検知し、率が変わっている場合は「新テンプレートとして保存」を促すUIを追加する。または按分率は既存テンプレートでは変更不可とし、率変更はクローン→新規作成フローに限定する。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts",
      "description": "AllocationTemplateOverride作成時にreasonフィールドが設定されていない。設計書⑨に定義されている任意フィールドだが、ダイアログUIにも入力欄がない。",
      "suggestion": "影響確認ダイアログに任意の理由入力欄を追加し、createTemplateOverridesにreasonパラメータを渡す。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts",
      "description": "deleteAllocationTemplateでテンプレート使用中チェック（Transaction/RecurringTransactionからの参照）がない。論理削除のためFK違反は出ないが、使用中テンプレートが一覧から消える運用上の問題がある。",
      "suggestion": "削除前にTransaction/RecurringTransactionの参照件数を確認し、使用中なら警告メッセージを返す。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts",
      "description": "getAffectedTransactionsの月初計算がローカルタイムゾーン依存（new Date(y,m,1)）。サーバーがJST等の場合、UTC格納のaccountingMonthlyClose.targetMonthとの比較でミスマッチの可能性。",
      "suggestion": "Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)でUTC基準の月初を計算する。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts",
      "description": "明細リプレース（deleteMany→create）で元の明細のcreatedBy/createdAtが失われる。変更のない明細行も新規作成として扱われるため、監査追跡性が低下する。",
      "suggestion": "変更検知して差分更新するか、現状のリプレース方式を維持する場合はChangeLogに変更前後を記録する。"
    }
  ],
  "summary": "基本的な一覧・CRUD・明細編集・影響確認ダイアログの実装は適切で、既存コードパターンにも準拠している。しかし、タスク要件に含まれるクローズ済み月関与時の権限チェック（設計書5.4.1）が警告表示のみでブロック未実装であること、および按分率変更時の新テンプレート作成ルール（設計書5.4.1）が未実装であることが major issue。これら2点の対応が必要。"
}
```
