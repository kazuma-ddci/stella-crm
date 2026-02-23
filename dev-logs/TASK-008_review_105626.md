レビュー対象のすべてのファイルと仕様書を確認しました。以下がレビュー結果です。

---

## レビュー結果

### コミット: `4510ecb feat(TASK-008): 実装 (attempt 2)`

このコミットは attempt 1 のレビュー指摘に対する修正で、主に以下の3点を改善しています:

1. **taxType バリデーションの一元化**: `createTransaction`/`updateTransaction` で個別にパースしていた `taxType` を `validateTransactionData` に統合
2. **税区分に応じた計算式の修正**: 税込(tax_included)/税抜(tax_excluded)で消費税額・源泉徴収額・合計額の計算を正しく分岐
3. **契約終了警告の改善**: `periodTo` もチェック対象に追加、`periodFrom` の null ガード追加

---

### チェック観点別レビュー

**1. テーブル定義 vs Prismaスキーマ vs 設計書**
- `Transaction` モデルの全カラム（taxType含む）がPrismaスキーマ・設計書と完全一致 ✅
- `taxType String @default("tax_excluded")` がスキーマ・設計書・バリデーションで統一 ✅

**2. フロー・ステータス遷移**
- 今回のコミットは新規作成・編集のみが対象でステータス遷移には触れていない ✅（TASK-008のスコープ通り）

**3. バリデーションルール（設計書6.1）**
- counterpartyId 必須 ✅
- expenseCategoryId 必須 ✅
- amount >= 0 ✅
- periodFrom <= periodTo ✅
- allocationTemplateId と costCenterId の排他制約 ✅
- 按分なしの場合 costCenterId 必須 ✅
- taxType のバリデーション追加 ✅（今回の修正）

**4. ポリモーフィック参照（設計書6.7）**
- Attachment 作成時 `transactionId` のみ設定、他FK は null ✅

**5. TypeScript型安全性・エラーハンドリング**
- `validateTransactionData` の返り値に `taxType` を追加し、呼び出し元で `validated.taxType` を使用 ✅
- 消費税額の妥当性チェック: エラーではなく `console.warn` で追跡（手動修正を許容する設計意図に合致）✅
- `calculateTaxAmount` が値を返すようになり、`recalculateAll` で一貫した再計算が可能に ✅

**6. 既存コードパターンとの整合**
- `useCallback` + deps 配列のパターン踏襲 ✅
- Server Action のバリデーション → DB操作のパターン踏襲 ✅

---

### 仕様との照合（要望書2.1.2 入力項目）

| 入力項目 | 実装状態 |
|---|---|
| 種別（売上/経費） | ✅ RadioGroup |
| 取引先（選択式） | ✅ Combobox |
| 費目（種別でフィルタ） | ✅ Select + filteredCategories |
| 金額 | ✅ Input[number] |
| 消費税額（自動計算+手修正） | ✅ 税区分対応済み |
| 発生期間（From〜To） | ✅ Input[date] × 2 |
| 按分ON/OFF | ✅ Checkbox排他制御 |
| プロジェクト（按分OFF） | ✅ ラベル「プロジェクト」（要望書通り） |
| 按分テンプレート（按分ON） | ✅ Combobox + 明細プレビュー |
| 契約（任意） | ✅ Combobox |
| 源泉徴収（10.21%デフォルト） | ✅ 経費時のみ表示 |
| 支払予定日 | ✅ 経費時のみ表示 |
| 決済手段 | ✅ 経費時のみ表示 |
| 摘要・メモ | ✅ Textarea |
| 証憑（複数アップロード） | ✅ ファイルアップロード |

### プロジェクトページ作成ルール（要望書2.1.4）
- 自動設定: `projectContext.costCenterId` でプリセット ✅
- 変更警告: toast.error + 変更ブロック ✅（設計書の「保存不可」に合致）
- 按分トグル: `projectContext` 存在時に disabled ✅

### 契約終了警告（設計書5.0）
- `endDate < fromDate || endDate < toDate` で期間全体をカバー ✅
- ダイアログ選択肢: 登録を続行 / 契約情報を確認 / キャンセル ✅（設計書5.0の3選択肢と一致）

---

### 指摘事項

**minor-1**: `actions.ts:113` — `console.warn` はサーバーサイドの本番環境では検知しにくい。将来的にログ収集が整備されたら構造化ログへの移行が望ましいが、現時点では機能上の問題はない。

**minor-2**: `transaction-form.tsx:400` — 契約終了警告の条件 `endDate < fromDate || endDate < toDate` は、`fromDate <= toDate` が保証される前提では `endDate < toDate` だけで十分（`endDate < fromDate` なら必ず `endDate < toDate`）。ただし可読性のために両方書くのは問題ない。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/actions.ts",
      "description": "消費税額乖離の警告が console.warn のみ。本番環境では見逃される可能性がある",
      "suggestion": "将来的にログ基盤（Sentry等）を導入した際に、構造化ログに移行する。現時点では対応不要"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/transactions/transaction-form.tsx",
      "description": "契約終了警告の条件 endDate < fromDate || endDate < toDate は冗長（fromDate <= toDate が保証されるため endDate < toDate だけで同値）",
      "suggestion": "可読性のためこのままでもOK。最適化する場合は endDate < toDate のみに簡略化"
    }
  ],
  "summary": "attempt 1 からの改善として、taxType バリデーションの一元化、税込/税抜の計算分岐、契約終了警告の改善が適切に実装されている。設計書5.0の入力項目・表示条件、要望書2.1.2の全入力項目、設計書6.1のバリデーションルール、設計書6.7の排他制約すべてが仕様通りに実装されている。critical/major の問題はなく、minor 2件のみ。"
}
```
