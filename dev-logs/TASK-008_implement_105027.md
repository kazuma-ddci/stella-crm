全ての修正が完了しました。`npx tsc --noEmit` もエラーなしです。

## 修正サマリー

### Major 修正（4件）

| ID | 問題 | 修正内容 |
|---|---|---|
| **M1** | 税込入力時の消費税計算が `amount * rate / 100`（税抜前提）で二重計上 | `calculateTaxAmount` に `taxType` パラメータ追加。税込時は `Math.floor(a - a / (1 + r/100))` で計算 |
| **M2** | 源泉徴収計算が常に `amount + taxAmount` で税込合計を算出（税込入力時に二重計上） | `calculateWithholding` に `taxType` 追加。税込時は `amount` をそのまま合計として使用 |
| **M3** | 税区分切替時に再計算が発動しない（`setTaxType` のみ） | `handleTaxTypeChange` を新規実装し、`recalculateAll` で消費税・源泉徴収を一括再計算 |
| **M4** | Server Action の `validateTransactionData` が `taxType` を検証せず素通し | `taxType` の値チェック追加、`validated.taxType` を返却、create/update で使用 |

### Minor 修正（3件）

| ID | 問題 | 修正内容 |
|---|---|---|
| **m1** | 源泉徴収税額の手動修正時に合計計算がインラインでDRY違反 | `getTotalAmount` ヘルパーを使用して taxType 対応しつつDRY化 |
| **m2** | 契約終了警告が `endDate < periodFrom` のみで `periodTo` を未チェック | `endDate < periodTo` もチェック対象に追加 |
| **m3** | 合計表示が税込入力時に `amount + taxAmount` で二重計上 | `getTotalAmount` で税込時は `amount` をそのまま返却 |
