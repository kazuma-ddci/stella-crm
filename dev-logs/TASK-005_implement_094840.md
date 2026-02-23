レビュー指摘2件の修正が完了しました。

### 修正内容まとめ

**Minor 1: 種別変更時のクレカ専用フィールドクリア** (`actions.ts:170-175`)
- `updatePaymentMethod` で `methodType` を変更した際、新しい種別が `credit_card` 以外であれば `closingDay` / `paymentDay` / `settlementAccountId` を `null` に設定するように修正

**Minor 2: settlementAccountId の参照整合性チェック** (`actions.ts:113-118`, `actions.ts:228-234`)
- `createPaymentMethod` と `updatePaymentMethod` の両方で、`settlementAccountId` が non-null の場合に、対象が実在する有効な銀行口座タイプの PaymentMethod であることを検証するチェックを追加
- 不正な場合は `"引落口座が見つからないか無効です"` エラーをスロー
