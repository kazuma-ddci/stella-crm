全6件の指摘事項を修正完了しました。`npx tsc --noEmit` もパスしています。

---

### 修正サマリー

#### Major (3件) - 更新操作で新日付のクローズチェック追加
| ファイル | 修正内容 |
|---|---|
| `bank-transactions/actions.ts:410` | `updateBankTransaction` に `ensureMonthNotClosed(validated.transactionDate)` 追加 |
| `journal/actions.ts:323` | `updateJournalEntry` に `ensureMonthNotClosed(validated.journalDate)` 追加 |
| `transactions/actions.ts:340` | `updateTransaction` に `checkMonthlyClose(validated.periodFrom, validated.periodTo)` 追加 |

これにより、オープン月のレコードの日付をクローズ済み月に変更する操作がブロックされます。

#### Minor (3件)
| ファイル | 修正内容 |
|---|---|
| `accounting/monthly-close/actions.ts` | クローズ済み月のPL表示に `snapshotData.summary` の値を使用するよう分岐追加（仕様3.9.4準拠） |
| `accounting/monthly-close/actions.ts` | `closeMonthAction` / `reopenMonthAction` に権限チェックのTODOコメント追加 |
| `stp/finance/monthly-close/actions.ts` | STP側PL集計が経理側と異なる旨の注記コメント追加 |
