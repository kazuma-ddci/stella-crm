全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## レビュー結果

### 全体評価

MonthlyCloseLog ベースのイベントソーシングパターンへの移行、STP側の閲覧限定化、各操作ファイルへの `ensureMonthNotClosed` ガードの追加、PLスナップショット生成など、設計書の主要な要件は概ね実装されています。しかし、**更新操作で新しい日付のクローズチェック漏れ**が複数ファイルに存在し、クローズ済み月へのデータ流入を許す穴があります。

---

### 観点別チェック

#### 1. テーブル定義 (Prisma vs 設計書)
MonthlyCloseLog のスキーマ定義は設計書㉓と完全一致。`projectId`, `targetMonth`, `action`, `reason`, `snapshotData`, `performedBy`, `performedAt`、インデックスも一致。**問題なし。**

#### 2. フロー・ステータス遷移
- クローズ: `closeMonth` で既にクローズ済みチェック → エラー ✅
- 再オープン: `reopenMonth` で未クローズチェック → エラー、理由必須バリデーション ✅
- STP側からクローズ/再オープン操作を完全に削除 → 設計書「閲覧のみ」に合致 ✅
- 履歴はMonthlyCloseLogに全イベント記録 ✅

#### 3. バリデーションルール (設計書6.6)
- **クローズ済み月の編集禁止**: 各操作ファイルに `ensureMonthNotClosed` 追加済み。ただし **更新操作で新旧両方の日付チェックが必要**（後述 major issue）
- **再オープン理由必須**: サーバー側 (`monthly-close.ts:80`) + クライアント側 (disabled ボタン) で二重バリデーション ✅

#### 4. スナップショット
- クローズ時にPLスナップショット生成・保存 ✅
- 仕様3.9.4「クローズ済み月のPLはスナップショットの数値を使用」→ 現実装はライブ計算のみで、保存されたスナップショットを表示に使っていない（後述 minor issue）

---

### 問題点

#### Major: 更新操作で新しい日付のクローズチェック漏れ（3ファイル共通パターン）

**影響**: オープン月のレコードの日付をクローズ済み月に変更でき、実質的にクローズ済み月にデータが流入する。

| ファイル | 関数 | チェック対象 | 漏れ |
|---|---|---|---|
| `bank-transactions/actions.ts` | `updateBankTransaction` | `existing.transactionDate` のみ | 新しい `validated.transactionDate` 未チェック |
| `journal/actions.ts` | `updateJournalEntry` | `existing.journalDate` のみ | 新しい `validated.journalDate` 未チェック |
| `transactions/actions.ts` | `updateTransaction` | `existing.periodFrom/To` のみ | 新しい `validated.periodFrom/To` 未チェック |

**修正案** (例: bank-transactions):
```typescript
// 既存レコードの月チェック（既存通り）
await ensureMonthNotClosed(existing.transactionDate);
// 新しい日付の月チェック（追加）
await ensureMonthNotClosed(validated.transactionDate);
```

#### Minor: クローズ済み月のPL表示にスナップショット未使用

`src/app/accounting/monthly-close/actions.ts:80-114` — `getMonthlyCloseData` は全月ともJournalEntryからライブ計算している。仕様3.9.4「クローズ済み月のPLはスナップショットの数値を使用」に反する。クローズ済みで変更不可なので実質同値だが、仕様忠実性の観点から、クローズ済み月は `snapshotData` のサマリー値を使うべき。

#### Minor: 経理管理者の権限チェック未実装

`closeMonthAction` / `reopenMonthAction` にロールチェックがない。仕様3.9.1「経理管理者のみ実行可能」。ただし仕様Section 10で権限管理は後日対応と明記されているため、現段階では許容可能。

#### Minor: STP側と経理側でPL集計ロジックが異なる

- 経理側 (`accounting/monthly-close/actions.ts`): JournalEntry（確定済み仕訳）から集計
- STP側 (`stp/finance/monthly-close/actions.ts`): StpRevenueRecord/StpExpenseRecord から集計

同じ「月次クローズ状況」画面でPL数値が異なる可能性がある。STP側は移行期間中の暫定措置と理解するが、ユーザー混乱の原因になりうる。

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/bank-transactions/actions.ts",
      "description": "updateBankTransaction で既存レコードの transactionDate のみクローズチェックしており、新しい validated.transactionDate をチェックしていない。オープン月のレコードの日付をクローズ済み月に変更可能。",
      "suggestion": "ensureMonthNotClosed(existing.transactionDate) の直後に ensureMonthNotClosed(validated.transactionDate) を追加"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/journal/actions.ts",
      "description": "updateJournalEntry で既存レコードの journalDate のみクローズチェックしており、新しい validated.journalDate をチェックしていない。",
      "suggestion": "ensureMonthNotClosed(existing.journalDate) の直後に ensureMonthNotClosed(validated.journalDate) を追加"
    },
    {
      "severity": "major",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "updateTransaction で既存レコードの periodFrom/periodTo のみクローズチェックしており、新しい validated.periodFrom/periodTo をチェックしていない。",
      "suggestion": "既存チェック checkMonthlyClose(existing.periodFrom, existing.periodTo) の直後に checkMonthlyClose(validated.periodFrom, validated.periodTo) を追加"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/monthly-close/actions.ts",
      "description": "仕様3.9.4「クローズ済み月のPLはスナップショットの数値を使用」に対し、getMonthlyCloseData は全月ともJournalEntryからライブ計算している。snapshotData を保存しているが表示に使用していない。",
      "suggestion": "クローズ済み月の場合は MonthlyCloseLog.snapshotData の summary.totalRevenue/totalExpense を使用するよう分岐を追加"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/monthly-close/actions.ts",
      "description": "closeMonthAction / reopenMonthAction に経理管理者の権限チェックがない（仕様3.9.1）。Section 10で後日対応のため現段階は許容可能だが、TODOコメントがあると望ましい。",
      "suggestion": "// TODO: 経理管理者権限チェック（Section 10で後日実装）のコメントを追加"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/monthly-close/actions.ts",
      "description": "STP側のPL集計がStpRevenueRecord/StpExpenseRecordベースで、経理側（JournalEntryベース）と異なる。同じ月でPL数値が食い違う可能性がある。",
      "suggestion": "移行完了後にSTP側も経理側と同じJournalEntryベースの集計に統一するか、画面上に「STP売上・経費レコードベース」の注記を追加"
    }
  ],
  "summary": "MonthlyCloseLog への移行、イベントソーシングパターン、PLスナップショット生成、STP側の閲覧限定化は設計書通り正しく実装されている。しかし更新操作（bank-transactions, journal, transactions）で新しい日付のクローズチェックが漏れており、クローズ済み月へのデータ流入を許すバグが3箇所ある。これは月次クローズの根幹機能を損なうため major とし、verdict は NG。修正は各 update 関数に新日付のチェックを1行追加するだけで完了する。"
}
```
