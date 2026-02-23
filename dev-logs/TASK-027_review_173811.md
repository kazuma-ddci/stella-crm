全情報を確認しました。レビュー結果をまとめます。

---

## TASK-027 レビュー: 変更履歴機能

### 1. テーブル定義の整合性

**Prismaスキーマ vs 設計書 ㉚ ChangeLog**: **完全一致** ✓

| カラム | 設計書 | Prismaスキーマ | 一致 |
|--------|--------|----------------|------|
| id | Int @id @default(autoincrement()) | 同 | ✓ |
| tableName | String | 同 | ✓ |
| recordId | Int | 同 | ✓ |
| changeType | String | 同 | ✓ |
| oldData | Json? | 同 | ✓ |
| newData | Json? | 同 | ✓ |
| changedBy | Int (FK→MasterStaff) | 同 | ✓ |
| changedAt | DateTime @default(now()) | 同 | ✓ |
| changer relation | MasterStaff @relation("ChangeLogChanger") | 同 | ✓ |

### 2. 仕様との整合性チェック

**要望書 6.1 共通変更履歴テーブル**: ✓
- テーブル名、レコードID、変更種別、変更前/後(JSON)、変更者、変更日時 → 全て実装済み
- 1テーブルで全テーブルの変更を管理 → ✓ `tableName` で識別

**要望書 6.2 必須記録対象**:
| 対象 | create | update | delete | ステータス変更 |
|------|--------|--------|--------|------------|
| Transaction | ✓ | ✓ | -(hideで代替) | confirm/return/resubmit/hide ✓ |
| JournalEntry | ✓ | ✓ | ✓ | confirm ✓ |
| AllocationTemplateLine | -(新規時は不要) | ✓ | -(一括置換で対応) | - |

**設計書 8.4**:
- 「各Server Actionで明示的に記録」→ ✓ 選択済み
- 対象テーブル: Transaction, JournalEntry, AllocationTemplateLine → ✓ 全て実装

### 3. Server Actions実装

**recordChangeLog** (`changelog/actions.ts:42`): ✓
- トランザクション対応（`tx?` パラメータ）
- `changedBy` で変更者を記録

**recordChangeLogs** (`changelog/actions.ts:64`): ✓
- 一括記録に `createMany` を使用

**getChangeLogs** (`changelog/actions.ts:92`): ✓
- テーブル名+レコードIDで検索

**getChangeLogsForTransaction** (`changelog/actions.ts:121`): ✓
- 取引本体 + 紐づく仕訳のログを一括取得
- 削除済み仕訳のログも含める（正しい: 履歴は全て表示すべき）

**extractChanges** (`changelog/actions.ts:177`): ✓
- Date、Object(Decimal含む)、プリミティブの3段階比較
- 差分なしの場合は `null` 返却で無駄な記録を防止

### 4. UI実装 (changelog-section.tsx)

- 取引詳細画面 (`transactions/[id]/edit/page.tsx`) への組み込み ✓
- 変更種別ごとのアイコン・バッジ色分け ✓
- DiffView（old→new矢印表示）✓
- CreateView / DeleteView ✓
- フィールド名の日本語ラベル、ステータスの日本語翻訳 ✓
- 金額のフォーマット（¥記号・カンマ区切り）✓
- ローディング状態 ✓

### 5. 発見した問題点

---

**問題 1: 4箇所でchangelog記録がDBトランザクション外**

`confirmTransaction`、`hideTransaction`、`deleteJournalEntry`、`updateAllocationTemplate`（明細変更時）では、データ更新とchangelog記録が別々のDB操作として実行されている。changelog記録が失敗した場合、監査対象テーブル（要望書 6.2）の変更が追跡漏れとなる。

対照的に `createTransaction`、`updateTransaction`、`returnTransaction`、`resubmitTransaction`、`createJournalEntry`、`updateJournalEntry`、`confirmJournalEntry` は正しく `$transaction` + `tx` パラメータを使用している。

- `confirmTransaction` (transactions/actions.ts:588-608): `prisma.transaction.update()` → `recordChangeLog()` が別操作
- `hideTransaction` (transactions/actions.ts:795-814): 同上
- `deleteJournalEntry` (journal/actions.ts:504-524): 同上
- `updateAllocationTemplate` (allocation-templates/actions.ts:138-179): `$transaction` の後に `recordChangeLogs` が別操作

---

**問題 2: 未使用import**

- `changelog/actions.ts:3`: `revalidatePath` が未使用
- `changelog/actions.ts:5`: `getSession` が未使用
- `changelog-section.tsx:5`: `Button` が未使用

---

**問題 3: `ALLOCATION_TEMPLATE_LINE_LOG_FIELDS` が未使用**

`changelog/actions.ts:283-288` で定義・exportされているが、どのファイルからもimportされていない。按分テンプレート明細のchangelogは手動でデータ構築しており、この定数は実際には使われていないデッドコード。

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "confirmTransaction（L588-608）とhideTransaction（L795-814）で、データ更新とchangelog記録がDBトランザクション外で別々に実行されている。changelog記録失敗時に監査証跡が欠落する。returnTransaction/resubmitTransaction等では正しく$transactionを使用しており、一貫性がない",
      "suggestion": "prisma.$transactionで囲み、recordChangeLogにtxを渡す。例: await prisma.$transaction(async (tx) => { await tx.transaction.update({...}); await recordChangeLog({...}, staffId, tx); });"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/journal/actions.ts",
      "description": "deleteJournalEntry（L504-524）で、論理削除とchangelog記録がDBトランザクション外で別々に実行されている。仕訳は要望書6.2で監査対象に指定されており、changelog欠落リスクがある",
      "suggestion": "prisma.$transactionで囲み、recordChangeLogにtxを渡す"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/masters/allocation-templates/actions.ts",
      "description": "updateAllocationTemplate（L138-179）で、$transactionによる明細更新の後にrecordChangeLogsがトランザクション外で呼ばれている。按分テンプレート明細は要望書6.2で必須記録対象",
      "suggestion": "$transaction内でrecordChangeLogsを呼ぶ。prisma.$transaction([...])の配列形式からasync (tx) => {}形式に変更し、tx引数を渡す"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/changelog/actions.ts",
      "description": "未使用import: revalidatePath（L3）とgetSession（L5）がimportされているが使用されていない",
      "suggestion": "import { revalidatePath } from 'next/cache'; と import { getSession } from '@/lib/auth'; を削除"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/changelog/changelog-section.tsx",
      "description": "未使用import: Button（L5）がimportされているが使用されていない",
      "suggestion": "import { Button } from '@/components/ui/button'; を削除"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/changelog/actions.ts",
      "description": "ALLOCATION_TEMPLATE_LINE_LOG_FIELDS（L283-288）が定義・exportされているが、どのファイルからもimportされていないデッドコード",
      "suggestion": "現在使用していないため削除するか、allocation-templates/actions.tsで手動構築部分をこの定数を使って書き換える"
    }
  ],
  "summary": "変更履歴機能の全体的な設計・実装は仕様に忠実で、recordChangeLog/getChangeLogs/extractChanges等のServer Actionsとchangelog-sectionのUI表示はよくできている。ただし、4箇所（confirmTransaction, hideTransaction, deleteJournalEntry, updateAllocationTemplate）でchangelog記録がDBトランザクション外に置かれており、他の操作（create/update/return/resubmit等）との一貫性が欠けている。要望書6.2で監査必須と指定されたテーブルの変更履歴が欠落するリスクがあるため、$transactionで囲む修正が必要"
}
```
