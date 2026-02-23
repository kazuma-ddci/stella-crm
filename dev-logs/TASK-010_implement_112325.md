全5件の指摘事項を修正完了しました。`tsc --noEmit` でコンパイルエラーもありません。

---

## 修正内容まとめ

### MAJOR-1: ソースデータ変更チェック実装
- `detectSourceChange` ヘルパー関数を追加。既存Transactionの `amount` と現在の契約金額を比較し、差異がある場合に `sourceDataChanged: true`, `previousAmount`, `latestCalculatedAmount` を設定
- CRM契約候補（売上・経費全種別）と定期取引候補の両方に適用
- `TransactionCandidate` 型に `existingTransactionId` を追加し、更新対象の特定が可能に
- `generateTransactions` で `sourceDataChanged` の場合は既存Transactionの金額を更新（`sourceDataChangedAt` も記録）
- UI側: バッジ表示の優先順位を「変更あり」>「生成済み」>「新規」に変更。変更ありの候補は選択可能で、金額カラムに旧金額→新金額を表示

### MAJOR-2: projectId 設定
- `TransactionCandidate` 型に `projectId` を追加
- `detectCrmCandidates` で `MasterProject(code: "stp")` を取得し、全CRM候補に設定
- `generateTransactions` の `create` データに `projectId` を含めるよう修正

### minor-1: N+1クエリ解消
- ループ前に一括取得:
  - `StpCompany` → `stpCompanyByCompanyId` Map
  - `StpAgentContractHistory` → `allAgentContractHistories` 配列
  - 代理店の `Counterparty` → `counterpartyByCompanyId` Map に追加
  - `StpAgentCommissionOverride` → `overrideMap` Map
- ループ内の4つの個別クエリを全て除去

### minor-2: monthsFromStart 計算修正
- `Math.floor((差分ms) / (30日のms))` → `(年差分 * 12) + 月差分` に修正

### minor-3: 成果報酬の代理店紹介報酬生成
- `candidatesWithJoin` ループ内で成果報酬売上の候補生成後、代理店がいる場合に `commission_performance` 経費候補を生成
- `buildCommissionConfig` の `perfType/perfRate/perfFixed` を使用した金額計算
