全情報が揃いました。仕様書・設計書と実装の照合を行い、レビュー結果をまとめます。

---

## レビュー結果

### 1. Prismaスキーマと設計書の整合性

設計書⑯ Counterpartyテーブル定義と `prisma/schema.prisma` のモデル定義は**完全一致**しています。カラム名、型、デフォルト値、リレーション全て問題なし。

### 2. 要望書・設計書の要件カバレッジ

| 要件 | 状態 | 備考 |
|---|---|---|
| 一覧表示（名称、種別、CRM紐づき有無、有効フラグ） | OK | CrudTableで表示 |
| 新規作成 | OK | createCounterparty実装済み |
| 類似名称チェック（要望書2.8.2） | OK | checkSimilarCounterparties + ダイアログ |
| 編集 | OK | updateCounterparty（部分更新対応） |
| 同期処理（設計書8.6） | 一部乖離 | 後述 |
| 名称重複チェック | OK | 完全一致 + 類似検索 |
| companyId排他チェック | OK | 1企業→1取引先の排他制約あり |
| 論理削除 / mergedIntoId除外 | OK | クエリに `deletedAt: null, mergedIntoId: null` |
| createdBy/updatedBy記録 | OK | セッションから取得 |

### 3. 既存コードパターンとの整合性

accounts, expense-categories の既存パターン（Server Action構造、部分更新パターン、CrudTable連携、revalidatePath）に**概ね準拠**しています。

### 4. 型安全性・エラーハンドリング

- VALID_TYPES定数によるenum検証 OK
- エラー時のthrow + 日本語メッセージ OK
- startTransition + try/catch + toast OK

---

### 検出された問題

#### Issue 1: 設計書8.6との方式乖離（同期処理）

設計書8.6は「**MasterStellaCompanyのCRUDアクションにフックを追加**」と明記しています。つまり、企業の新規作成・更新時に**自動的に**Counterpartyが同期される設計です。

実装は手動バッチ同期（syncCounterpartiesボタン）方式であり、MasterStellaCompanyのCRUDアクションにはフックが追加されていません。新規企業作成後、手動同期するまでCounterpartyに反映されない点が仕様と異なります。

#### Issue 2: 類似候補ダイアログの「既存を選択」オプション未実装

設計書5.7は「候補がある場合は確認ダイアログを表示し、**`既存を選択` / `新規作成`** を選ばせる」と記載していますが、実装は「キャンセル / 新規作成する」のみです。マスタ管理画面では「キャンセル」で実質的に代替可能ですが、仕様の意図（既存レコードを選択して利用できる）とは異なります。

#### Issue 3: handleAddのCrudTable連携フロー問題

`handleAdd`が類似候補を検出した場合、ダイアログを開いて`return`しています（throwしない）。CrudTableはこれを「追加成功」と解釈し、追加フォームを閉じてしまう可能性があります。その後ユーザーが類似候補ダイアログで「キャンセル」した場合、レコードは未作成なのにCrudTableは成功状態になるUXの不整合が発生します。

```typescript
// actions.ts:handleAdd — 類似候補発見時
if (candidates.length > 0) {
  setSimilarDialog({ open: true, candidates, pendingData: formData });
  return; // ← CrudTableは成功と解釈する可能性
}
```

**修正案**: `handleAdd`内で類似候補発見時に特殊な処理（例: throwで中断してダイアログを出す、またはCrudTableのonAddをラップしてPromiseを保留する）が必要です。

#### Issue 4: checkSimilarCounterpartiesのOR条件冗長

```typescript
OR: [
  { name: { startsWith: trimmed } },
  { name: { contains: trimmed } },
],
```

`contains`は`startsWith`の結果を完全に包含するため、`startsWith`条件は冗長です。

#### Issue 5: page.tsxの未使用リレーションinclude

```typescript
include: {
  company: { select: { id: true, name: true, companyCode: true } },
},
```

`company`リレーションをincludeしていますが、dataマッピングでは`cp.companyId`のみ使用しており、取得したcompanyオブジェクトは未使用です。不要なJOINクエリが発生しています。

#### Issue 6: 設計書5.7の正規化比較が未実装

設計書5.7は「前方一致/部分一致/**正規化比較**」の3方式を指定していますが、実装は前方一致と部分一致のみです（正規化比較＝全角/半角・カタカナ/ひらがな変換等の正規化後マッチング）。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "設計書8.6は「MasterStellaCompanyのCRUDアクションにフック追加」による自動同期を指定しているが、実装は手動バッチ同期（syncCounterpartiesボタン）方式。新規企業作成後、手動同期するまでCounterpartyに反映されない。",
      "suggestion": "MasterStellaCompanyのcreate/update Server Actionにフック（Counterparty自動作成・名称同期）を追加する。現在のバッチ同期は初期データ投入用として残し、通常運用はフック方式にする。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/counterparties-table.tsx",
      "description": "類似候補ダイアログに設計書5.7で指定された「既存を選択」オプションがない（キャンセル/新規作成のみ）。",
      "suggestion": "候補リストの各項目にSelectボタンを追加し、選択時にその取引先IDを返すコールバックを実装する（取引入力画面との連携で特に重要）。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/counterparties-table.tsx",
      "description": "handleAddが類似候補検出時にthrowせずreturnするため、CrudTableが追加成功と誤認する可能性がある。キャンセル時にレコード未作成なのにCrudTableが成功状態になるUX不整合。",
      "suggestion": "handleAdd内で類似候補発見時はPromiseをpendingにしてダイアログ確認後にresolve/rejectする、またはCrudTable側でvoid返却を未完了として扱う仕組みを導入する。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "checkSimilarCounterpartiesのOR条件でstartsWithはcontainsに完全に包含されるため冗長。",
      "suggestion": "startsWithを削除し、containsのみにする。または前方一致を優先表示したい場合はクエリを分けてマージする。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/page.tsx",
      "description": "counterpartiesクエリでcompanyリレーションをincludeしているが、dataマッピングではcompanyIdのみ使用しており、companyオブジェクトは未使用。不要なJOINが発生。",
      "suggestion": "include: { company: ... } を削除し、companyIdのみ取得する。または取得したcompany.nameをdata mappingに含めて一覧表示に活用する。"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/counterparties/actions.ts",
      "description": "設計書5.7で指定された正規化比較（全角/半角、カタカナ/ひらがな等の正規化後マッチング）が未実装。",
      "suggestion": "検索前に入力文字列とDB値を正規化（半角→全角統一、カタカナ→ひらがな統一等）してから比較するロジックを追加する。"
    }
  ],
  "summary": "Counterpartyテーブル定義はPrismaスキーマ・設計書と完全一致。CRUD操作、類似名称チェック、CRM企業同期の基本機能は実装済み。既存コードパターン（accounts, expense-categories）にも概ね準拠している。検出された6件はいずれもminor（設計書との方式乖離、UX改善、コード最適化）であり、機能の根幹に影響するcritical/majorの問題は無い。"
}
```
