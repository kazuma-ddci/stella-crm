全情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-004 取引先マスタ管理画面 (attempt 3)

### コミット: `cde7d45` `feat(TASK-004): 実装 (attempt 3)`

### 変更概要
前回レビュー（attempt 2）で指摘された3件のminor issueに対する修正コミット。

| 修正対象 | 内容 |
|---|---|
| `counterparties-table.tsx` + `crud-table.tsx` | 「既存を選択」時のrejectに`isCancel`フラグを追加し、`toast.error()`→`toast.info()`に変更。ダイアログ閉じ+フォームリセットも実施 |
| `companies/actions.ts:128` | Counterparty同期条件を `if ("name" in data)` → `if ("name" in data && data.name)` に修正（falsy防御） |
| `actions.ts:35,48` | TODOコメント追加 + `take: 5000` 安全制限の追加 |

---

### 仕様書との整合性チェック

| チェック項目 | 結果 |
|---|---|
| **Prismaスキーマ vs 設計書⑯** | 完全一致（全カラム・リレーション・デフォルト値一致） |
| **設計書5.7: 類似名称チェック（前方一致/部分一致/正規化比較）** | 正規化比較実装済み（全角/半角、カタカナ/ひらがな、スペース除去、小文字化）。ダイアログで「既存を選択」/「新規作成する」を提供 |
| **設計書8.6: 新規作成時Counterparty自動作成** | 前回コミットで実装済み（本コミットでは同期条件のfalsy修正のみ） |
| **設計書8.6: 更新時Counterparty名称同期** | `companies/actions.ts`, `companies/[id]/actions.ts` 両方で実装済み。本コミットでfalsy防御を統一 |
| **設計書8.6: 削除時Counterpartyは論理削除しない** | `deleteCompany`はCounterpartyに触れない（正しい） |
| **要望書2.8.1: CRMにない取引先管理** | companyId=nullで作成可能 |
| **要望書2.8.2: 重複防止** | 類似名称チェック + 完全一致重複チェック + 1企業1取引先の排他チェック |
| **セクション6バリデーション** | Counterparty固有のバリデーションルールは6.1-6.10に記載なし。実装上の名称・種別必須/companyId排他チェックは妥当 |
| **セクション6.7ポリモーフィック排他制約** | Counterpartyは対象外（該当なし） |

---

### 前回指摘の修正確認

**Minor 1（`handleSelectExisting`のエラートースト問題）: 修正済み**
- `counterparties-table.tsx:164-166`: `isCancel: true`フラグ付きErrorで reject
- `crud-table.tsx:571-578`: `isCancel`を検出し、`toast.info()` + ダイアログ閉じ + フォームリセット
- UXフロー: 「既存を選択」→ info トースト「新規作成をキャンセルしました（既存: XXX）」→ ダイアログ閉じ → 正常終了

**Minor 2（`updateCompany`のnameガード不整合）: 修正済み**
- `companies/actions.ts:128`: `if ("name" in data && data.name)` — falsy防御を追加

**Minor 3（全件ロードのスケーラビリティ）: 対応済み**
- `actions.ts:35`: TODOコメントで将来の改善方針を明記
- `actions.ts:48`: `take: 5000` で安全制限を追加

---

### 新たな指摘事項

**Minor 1: `isCancel`パターンがType Assertionベース**
- `counterparties-table.tsx:165`: `(error as Error & { isCancel: boolean }).isCancel = true` — 動作上は問題ないが、カスタムErrorクラスの方がTypeScript的に堅牢
- ただし、この用途（CrudTableとの1箇所の連携）では十分であり、過度な抽象化は不要

**Minor 2: `take: 5000`で5001件目以降が類似チェック対象外になる**
- TODOコメントで将来対応方針（normalized_nameカラム追加）を明記しており、現段階では実用上問題なし
- 取引先数が5000件を超える見込みが出た時点で対応すればよい

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/counterparties-table.tsx",
      "description": "isCancel フラグを Error オブジェクトに動的追加する方式は型安全性がやや弱い（Type Assertion依存）",
      "suggestion": "現段階では許容範囲。将来的に同パターンが増えた場合は CancelError クラスの導入を検討"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "take: 5000 により、5001件目以降の取引先が類似チェック対象外になる。TODOコメントで将来対応方針は明記済み",
      "suggestion": "取引先数が増加した際に normalized_name カラム追加でDB側検索に移行"
    }
  ],
  "summary": "前回レビュー（attempt 2）で指摘された3件のminor issueを全て適切に修正。isCancel フラグによるUX改善（toast.error→toast.info）、falsy防御の統一、take制限の追加はいずれも妥当。設計書⑯のテーブル定義と完全一致し、設計書5.7（重複検知）・8.6（CRM同期）の仕様要件を満たしている。新たな指摘も全てminorレベルであり、実装品質は良好。"
}
```
