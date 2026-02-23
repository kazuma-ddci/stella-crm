全ての情報が揃いました。レビュー結果をまとめます。

---

## TASK-014 レビュー: 請求書テンプレート管理画面

### 総評

全体的に既存の会計マスタ画面パターン（accounts, expense-categories等）に忠実に従った良い実装です。設計書 ㉕ InvoiceTemplate のテーブル定義との整合性、要望書 4.2 の要件カバー、テンプレート変数プレビュー機能の実装が確認できます。ただし、更新時のバリデーション処理順に問題が1件あります。

### 各チェック観点

**1. テーブル定義とPrismaスキーマの整合性** — OK
- Prismaスキーマ（`prisma/schema.prisma:2974-2992`）の全カラムが設計書 ㉕ と完全一致
- `page.tsx` のデータ変換で全カラムを適切にマッピング

**2. 要望書フロー** — OK
- 要望書 4.2 の要件: 法人別複数テンプレート、送付用/発行依頼用種別、メール件名/本文テンプレート、テンプレート変数 — すべて実装済み
- テンプレート変数は要望書記載の7種 + `{{受信メールアドレス}}` を追加（要望書の「等」に含まれる範囲で問題なし）

**3. バリデーションルール** — 問題あり（後述）
- 必須チェック、templateType有効値チェック、運営法人存在チェック、名称重複チェック、isDefaultの排他制御 — すべて実装済み
- ただし更新時の処理順序に問題あり

**4. ポリモーフィック参照の排他制約（6.7）** — 該当なし
- InvoiceTemplate には排他FK制約の対象カラムなし

**5. TypeScript型安全性・エラーハンドリング** — 問題あり（後述）

**6. 既存コードパターンとの整合性** — OK
- `page.tsx`: Promise.all並列取得、deletedAt:null フィルタ、data変換、companyOptions生成 — 既存パターン準拠
- `invoice-templates-table.tsx`: CrudTable + ColumnDef + CustomRenderers + CustomFormFields — 既存パターン準拠
- `actions.ts`: getSession、部分更新（`"field" in data`）、重複チェック（`id: { not: id }`）、revalidatePath、論理削除 — 既存パターン準拠
- `sidebar.tsx`: FileText アイコンは既にインポート済み、追加位置も適切

---

### 検出した問題

#### [MAJOR] updateInvoiceTemplate の名称重複チェック順序

**`actions.ts:97-116`**: `name` の重複チェックが `operatingCompanyId` / `templateType` の変更処理より先に実行されるため、旧値でチェックが行われる。

CrudTable はフォーム全フィールドを一括送信するため、name・templateType・operatingCompanyId が同時に `in data` に入る。しかし処理順序が:
1. `name` チェック（line 97） → `operatingCompanyId=旧値`, `templateType=旧値` で重複検索
2. `templateType` 変更（line 118） → `templateType` を更新
3. `operatingCompanyId` 変更（line 127） → `operatingCompanyId` を更新

結果、templateType や operatingCompanyId を変更した場合、**新しい法人×種別での同名重複を検出できない**。

#### [MINOR] TemplateField の null 変換による TypeError リスク

**`invoice-templates-table.tsx:84`**: `onChange((e.target.value || null))` でユーザーが全テキストを消すと `null` が送信される。Server Action 側の `(data.emailSubjectTemplate as string).trim()` で `null.trim()` → TypeError の可能性がある。CrudTable の `required: true` フロントバリデーションで通常は防がれるが、サーバーサイドの防御がない。

#### [MINOR] isDefault 排他制御の非トランザクション

**`actions.ts:52-62, 159-170`**: `updateMany`（既存デフォルト解除）と `create`/`update` が別クエリで実行されており、並行リクエストでレースコンディションの可能性がある。既存マスタ画面と同じパターンではあるが、isDefault の排他制御は InvoiceTemplate 固有の要件。

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/accounting/masters/invoice-templates/actions.ts",
      "description": "updateInvoiceTemplate で name の重複チェック（L97-116）が operatingCompanyId/templateType の変更処理（L118-140）より先に実行されるため、旧値（current.operatingCompanyId, current.templateType）で検索される。法人や種別を変更した場合、新しい組み合わせでの同名重複を検出できない。",
      "suggestion": "全フィールドの最終値を先に確定させてから、まとめて重複チェックを行う。operatingCompanyId と templateType の更新処理を name チェックの前に移動するか、全フィールド確定後に一括で重複チェックするロジックに変更する。例: if ('operatingCompanyId' in data) { operatingCompanyId = ...; } → if ('templateType' in data) { templateType = ...; } → if ('name' in data || 'operatingCompanyId' in data || 'templateType' in data) { /* 最終値で重複チェック */ }"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/invoice-templates/invoice-templates-table.tsx",
      "description": "TemplateField の onChange (L84) で e.target.value || null としており、全テキスト削除時に null が Server Action に送信される。actions.ts の (data.emailSubjectTemplate as string).trim() で TypeError が発生する可能性がある。",
      "suggestion": "onChange を onChange(e.target.value) に変更するか、Server Action 側で null チェックを追加する（例: const subject = ((data.emailSubjectTemplate as string) ?? '').trim()）"
    },
    {
      "severity": "minor",
      "file": "src/app/accounting/masters/invoice-templates/actions.ts",
      "description": "isDefault の排他制御（updateMany + create/update）が単一トランザクション内で実行されていないため、並行リクエストで複数のデフォルトが同時に設定されるレースコンディションの可能性がある。",
      "suggestion": "prisma.$transaction で updateMany と create/update をまとめて実行する"
    }
  ],
  "summary": "設計書・要望書との整合性、既存パターン準拠は良好。updateInvoiceTemplate の重複チェック順序問題（major）が1件あり、修正が必要。"
}
```
