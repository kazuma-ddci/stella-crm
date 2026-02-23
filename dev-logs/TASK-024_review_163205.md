全ての情報が揃いました。レビュー結果をまとめます。

---

## TASK-024 キャッシュフロー予測画面 コードレビュー

### 対象コミット
`6ddc1be feat(TASK-024): 実装 (attempt 1)`

### 仕様整合性チェック

| 要件（要望書 3.8） | 実装状況 |
|---|---|
| 入金予定（請求グループの支払期限から） | `actions.ts:151-184` - InvoiceGroup.paymentDueDateから取得 |
| 出金予定（取引の支払予定日） | `actions.ts:187-218` - Transaction.paymentDueDateから取得 |
| 出金予定（定期取引の実行日） | `actions.ts:221-260` - RecurringTransactionから展開 |
| 出金予定（クレカ引落日＋利用額集計） | `actions.ts:262-313` - closingDay/paymentDayで期間計算 |
| 口座別残高予測（初期残高起点の積み上げ） | `actions.ts:106-145` + `316-398` |
| 日別残高推移グラフ | `cashflow-client.tsx:316-369` - recharts LineChart |
| 残高アラート閾値の警告 | `actions.ts:373-392` + `cashflow-client.tsx:154-187` |
| Server Actions: getCashflowForecast | `actions.ts:79` |

### 問題点

#### 1. [MAJOR] 入金予定が口座別残高予測に反映されない

`actions.ts:174-181`: InvoiceGroupの入金先は`OperatingCompanyBankAccount`（請求書表示用口座）であり、`PaymentMethod`（残高管理用決済手段）ではない。そのため`paymentMethodId: null`が設定され、日別残高計算（`actions.ts:332`の`if (pmId != null)`ガード）で完全にスキップされる。

```typescript
// actions.ts:174-181
forecastItems.push({
  ...
  paymentMethodId: null,           // ← 常にnull
  paymentMethodName: ig.bankAccount?.bankName ?? null,
});
```

```typescript
// actions.ts:332-336 — null の場合スキップされる
if (pmId != null) {
  const current = dayMap.get(pmId) ?? 0;
  const delta = item.type === "incoming" ? item.amount : -item.amount;
  dayMap.set(pmId, current + delta);
}
```

**影響**: 口座別残高予測にも合計残高予測にも入金予定が含まれず、残高が実際より低く表示される。キャッシュフロー予測の信頼性を大きく損なう。残高アラートも不正確になる。

**修正案**: `InvoiceGroup`（または`OperatingCompanyBankAccount`）に`paymentMethodId`を持たせてPaymentMethodと紐づけるか、OperatingCompanyBankAccountとPaymentMethodのマッピングテーブルを用意して入金先のPaymentMethodを特定できるようにする。

#### 2. [MINOR] RecurringTransactionの保存済みtaxAmountを無視

`actions.ts:248`: 定期取引には`taxAmount`カラムがあり手修正可能だが、実装では`amount * taxRate / 100`で再計算している。selectクエリにも`taxAmount`を含んでいない。

```typescript
// actions.ts:248
const taxAmount = Math.floor((rt.amount! * rt.taxRate) / 100);
```

**修正案**: selectに`taxAmount`を追加し、`rt.taxAmount ?? Math.floor(...)` で保存値を優先使用する。

#### 3. [MINOR] forecastDaysのバリデーション不足

`page.tsx:12`: `Number(params.days)`がNaNの場合、`addDays(today, NaN)`で無効な日付が生成され予測が壊れる。

```typescript
const forecastDays = params.days ? Number(params.days) : 90;
```

**修正案**: `const forecastDays = params.days && !isNaN(Number(params.days)) ? Number(params.days) : 90;` またはクランプ処理を追加。

#### 4. [MINOR] getClosingPeriodのコメントがロジックと不一致

`actions.ts:517`: コメントの例は「締め期間: 2月16日〜3月15日」だが、実際のコードは「1月16日〜2月15日」を返す（コードの方が正しい）。

```typescript
// コメント: 例: 締め日15日、引落日10日、引落月3月 → 締め期間: 2月16日〜3月15日
// 実際: closingTo = Feb 15, from = Jan 16 → Jan 16 〜 Feb 15
```

#### 5. [MINOR] N+1クエリパターン

`actions.ts:111-130`: 決済手段ごとにBankTransactionのaggregate 2回（incoming/outgoing）を実行。決済手段数が多い場合にパフォーマンス劣化。

**修正案**: `groupBy`で一括集計し、アプリ側で振り分ける。

---

### 良い点

- 定期取引の日付展開ロジック（`expandRecurringDates`）が月末日対応含め堅実
- クレカ引落の締め期間計算がコメントは不正確だがロジック自体は正しい
- チャートデータの間引き処理で大量データ時のパフォーマンスを考慮
- アラートが最初の発生日のみ記録する設計で冗長通知を防止
- Server Component + Client Componentの適切な分離
- recharts導入は日別残高推移グラフの要件に合致

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "InvoiceGroupの入金予定にpaymentMethodIdが紐付けられず（OperatingCompanyBankAccountとPaymentMethodが未連携）、口座別残高予測と合計残高予測に入金予定が一切反映されない。日別残高推移グラフも出金のみ反映され、残高アラートも不正確になる",
      "suggestion": "OperatingCompanyBankAccountにpaymentMethodIdカラムを追加してPaymentMethodと紐づけるか、InvoiceGroupに入金先PaymentMethodを指定するカラムを追加する。短期的にはOperatingCompanyBankAccount.bankNameとPaymentMethod.nameで名称マッチングするワークアラウンドも検討可"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "RecurringTransactionの保存済みtaxAmountを使わず、amount * taxRate / 100で再計算している。ユーザーが手修正した消費税額が反映されない",
      "suggestion": "selectにtaxAmountを追加し、rt.taxAmount ?? Math.floor(rt.amount! * rt.taxRate / 100) で保存値を優先使用する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/cashflow/page.tsx",
      "description": "searchParamsのdays値にバリデーションがなく、不正値でNaNが渡されると予測が壊れる",
      "suggestion": "const raw = Number(params.days); const forecastDays = raw > 0 && raw <= 365 ? raw : 90; でバリデーション追加"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "getClosingPeriodのコメント例が実際のロジックと不一致（コメント: 2/16〜3/15、実際のコード出力: 1/16〜2/15）",
      "suggestion": "コメントを「例: 締め日15日、引落日10日、引落月3月 → 締め期間: 1月16日〜2月15日」に修正"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/cashflow/actions.ts",
      "description": "決済手段ごとにBankTransaction.aggregateを2回実行するN+1クエリパターン。決済手段数増加時にパフォーマンス劣化",
      "suggestion": "groupByでpaymentMethodId + directionごとに一括集計し、アプリ側で振り分ける"
    }
  ],
  "summary": "キャッシュフロー予測の基本構造（入出金予定の収集、定期取引展開、クレカ引落計算、日別残高推移、アラート）は要望書・設計書に概ね準拠している。ただしInvoiceGroupの入金予定がPaymentMethodと紐付けられないため、口座別残高予測に入金が反映されない点がmajor。この問題はOperatingCompanyBankAccountとPaymentMethodの連携が現スキーマに存在しないことに起因し、スキーマ拡張（paymentMethodIdカラム追加等）での対応が必要。"
}
```
