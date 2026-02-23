全3件の指摘事項を修正しました。以下が変更のサマリーです。

---

### 修正内容

**Minor 1: `handleSelectExisting` のエラートースト問題** (2ファイル)
- `counterparties-table.tsx:164`: reject するエラーに `isCancel = true` プロパティを付与し、メッセージを「新規作成をキャンセルしました（既存: ...）」に変更
- `crud-table.tsx:569-575`: catch ブロックで `isCancel` を検出した場合は `toast.info()` + フォームクローズに切り替え（`toast.error()` ではなく正常フローとして扱う）

**Minor 2: `updateCompany` の name ガード不整合** (1ファイル)
- `companies/actions.ts:128`: `if ("name" in data)` → `if ("name" in data && data.name)` に変更し、`companies/[id]/actions.ts:76` と統一。空文字での Counterparty 名更新を防止

**Minor 3: `checkSimilarCounterparties` のスケーラビリティ** (1ファイル)
- `actions.ts:35`: `take: 5000` の安全制限を追加
- TODO コメントで将来の `normalized_name` カラム追加による DB 側検索への移行方針を明記
