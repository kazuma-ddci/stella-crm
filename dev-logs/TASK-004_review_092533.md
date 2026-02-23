全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## レビュー結果: TASK-004 取引先マスタ管理画面 (attempt 2)

### コミット: fc921c1 `feat(TASK-004): 実装 (attempt 2)`

---

### 仕様書との整合性チェック

| チェック項目 | 結果 |
|---|---|
| **Prismaスキーマ vs 設計書⑯** | 完全一致（全カラム・リレーション一致） |
| **設計書5.7: 類似名称チェック（前方一致/部分一致/正規化比較）** | 正規化比較を追加実装済み（全角/半角、カタカナ/ひらがな、スペース除去、小文字化） |
| **設計書5.7: 「既存を選択」/「新規作成」の選択肢** | 各候補に「選択」ボタン + フッターに「新規作成する」ボタンを配置 |
| **設計書8.6: 新規作成時Counterparty自動作成** | `addCompany`、`createCompany` 両方にフック追加済み |
| **設計書8.6: 更新時Counterparty名称同期** | `companies/actions.ts`、`companies/[id]/actions.ts` 両方に実装済み |
| **設計書8.6: 削除時Counterpartyは論理削除しない** | `deleteCompany` はCounterpartyに触れない（正しい） |
| **要望書2.8.1: CRMにない取引先の管理** | `onAdd`でCRM紐づけなし（companyId=null）の取引先作成可能 |
| **要望書2.8.2: 重複防止** | 類似名称チェック + 完全一致重複チェック（createCounterparty内） |
| **バリデーション: 名称・種別必須** | `createCounterparty`、`updateCounterparty` で検証済み |
| **companyId排他チェック** | 1企業1取引先の制約を作成・更新の両方で検証済み |

---

### 変更内容の評価

**1. 正規化比較関数 `normalizeCounterpartyName`** (`actions.ts:10-25`)
- スペース除去、全角英数→半角、カタカナ→ひらがな、小文字化 — 妥当な実装
- `companies/actions.ts` の `normalizeCompanyName` と同等のアプローチで一貫性あり

**2. Promise保留パターンの類似ダイアログ** (`counterparties-table.tsx:130-137`)
- CrudTableの`onAdd`がPromiseを返す設計を活用し、ダイアログ表示中はPromiseを保留
- ユーザー操作（新規作成 / 選択 / キャンセル）でresolve/reject — CrudTableのloading状態と自然に連携

**3. page.tsxのinclude削除** (`page.tsx:10`)
- CRM企業列の表示は`companyOptions`での逆引きで解決しており、includeは不要 — 正しいリファクタ

**4. 設計書8.6同期フック** (`companies/actions.ts`, `companies/[id]/actions.ts`)
- try/catchで囲んで同期失敗時は無視 — メイン操作（企業作成/更新）に影響させない設計

---

### 指摘事項

**Minor 1: `handleSelectExisting` がrejectでエラートーストを表示する**
- `counterparties-table.tsx:164`: `reject(new Error(\`既存の取引先「${candidate.name}」を選択しました\`))` 
- CrudTableの`handleAdd`内の`catch`で `toast.error()` として表示される（`crud-table.tsx:570-571`）
- 「既存を選択」は設計書5.7上の正常フローであり、エラー表示は不適切
- **修正案**: メッセージを「新規作成をキャンセルしました（既存: ${candidate.name}）」等に変更するか、CrudTable側でinfo/warning区別をサポートする

**Minor 2: `updateCompany`のnameガード不整合**
- `companies/actions.ts:128`: `if ("name" in data)` — falsyチェックなし
- `companies/[id]/actions.ts:76`: `if ("name" in data && data.name)` — falsyチェックあり
- `data.name`が空文字の場合、前者はCounterparty名を空文字に更新してしまう
- **修正案**: `companies/actions.ts:128` を `if ("name" in data && data.name)` に統一

**Minor 3: `checkSimilarCounterparties`の全件ロード**
- `actions.ts:35-47`: 全取引先をメモリにロードしてフィルタリング
- コメントにある通りDBレベル正規化が難しいための設計判断として妥当
- 取引先が数千件を超える場合はパフォーマンス懸念あり
- **対応案**: 将来的にDB側にnormalized_nameカラムを追加、またはページネーション対応

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/counterparties-table.tsx",
      "description": "handleSelectExisting が reject(new Error(...)) を使用しており、CrudTable 側で toast.error() として表示される。「既存を選択」は設計書5.7の正常フローであり、エラー表示はUX上不適切",
      "suggestion": "メッセージを「新規作成をキャンセルしました」等に変更し、エラーではなくキャンセルであることを明示する"
    },
    {
      "severity": "minor",
      "file": "src/app/companies/actions.ts",
      "description": "128行目の updateCompany 内 Counterparty 同期条件が if (\"name\" in data) のみで、data.name が空文字の場合に Counterparty 名を空文字に更新する。companies/[id]/actions.ts:76 では if (\"name\" in data && data.name) で防御済み",
      "suggestion": "if (\"name\" in data && data.name) に統一する"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "checkSimilarCounterparties が全取引先をメモリにロードして正規化比較する。現時点では問題ないが、取引先が数千件を超えた場合のスケーラビリティ懸念",
      "suggestion": "将来的に normalized_name カラムの追加、またはDB側のunaccent拡張等で最適化を検討"
    }
  ],
  "summary": "設計書5.7（重複検知・類似名称チェック）と設計書8.6（MasterStellaCompanyとの同期）を正しく実装。attempt 1からの改善点（正規化比較の導入、Promise保留パターンでのCrudTable連携、「既存を選択」オプション）も適切。指摘は全てminorレベルのUX改善・防御的コーディング・将来のスケーラビリティに関するもの。"
}
```
