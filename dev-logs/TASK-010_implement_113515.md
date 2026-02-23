全3件の指摘を修正しました。コンパイルエラーもありません。

### 修正内容まとめ

| 指摘 | 修正箇所 | 内容 |
|---|---|---|
| **MAJOR-1** | `actions.ts:1159-1190` | `generateTransactions`内で既存Transaction更新前に`findUnique`でステータスを取得し、`unconfirmed`/`confirmed`のみ更新を許可。`journalized`以降はスキップ |
| **minor-1** | `actions.ts:1183-1188` | Transaction更新時に`candidate.isWithholdingTarget`の場合、`withholdingTaxAmount`と`netPaymentAmount`も`update`のdataに含める |
| **minor-2** | `generate-candidates-client.tsx:176-181` | `setCandidates`のmap内で`selectedKeys.has(c.key)`の場合に`sourceDataChanged: false`も設定 |
