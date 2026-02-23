TASK-018の実装が完了しました。TypeScriptコンパイルエラーもありません。

## 実装内容まとめ

### 作成ファイル（3ファイル）

**1. `src/app/accounting/masters/auto-journal/actions.ts`** - Server Actions
- `createAutoJournalRule` - ルール新規作成（入力検証、勘定科目・取引先・費目の存在チェック、借方≠貸方チェック）
- `updateAutoJournalRule` - ルール更新（部分更新対応、既存パターン踏襲）
- `deleteAutoJournalRule` - ルール論理削除（`deletedAt`パターン）
- `reorderAutoJournalRules` - 優先度並び替え（連番再採番、`$transaction`使用）
- `checkConflictingRules` - 競合ルールチェック（設計書5.6: 同じ取引先×種別×費目のルール検出）
- `executeAutoJournal` - 自動仕訳実行（設計書5.5: ルールマッチング→JournalEntry draft自動生成）
- `suggestRuleFromJournal` - 手動仕訳からルール追加提案（設計書5.6: 仕訳の借方/貸方からルール候補生成+競合チェック）

**2. `src/app/accounting/masters/auto-journal/auto-journal-table.tsx`** - テーブルコンポーネント
- CrudTableベースの一覧表示（取引先、種別、費目、借方科目、貸方科目、優先度、有効フラグ）
- `customRenderers` でFK値をラベル表示（無効化された選択肢も「（無効）」表示）
- `sortableItems` + `onReorder` で優先度の並び替え対応
- 作成・更新時に競合警告ダイアログ表示（Promise保留パターン、counterpartiesの類似チェックと同じ方式）

**3. `src/app/accounting/masters/auto-journal/page.tsx`** - ページ
- Server Componentでデータ取得（`Promise.all`で4テーブル並列取得）
- テーブルコンポーネントへオプションデータをpropsで渡す

### 設計書準拠ポイント
- Prismaスキーマ ⑰ AutoJournalRule の全フィールド・リレーション対応
- 設計書5.5: priority昇順マッチング → 最初のルール適用 → JournalEntry(draft)自動生成
- 設計書5.6: 同条件ルールの競合警告表示、保存は可能だが警告あり
- 要望書3.2.3/3.2.4: 手動仕訳からルール提案、優先度並び替え
