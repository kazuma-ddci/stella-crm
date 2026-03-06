# SPEC-ACCOUNTING-002: STP財務のプロジェクトスコーピング（会話ログ要約 + 実装評価）

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-ACCOUNTING-002 |
| ステータス | draft（ログ要約 + コード監査） |
| 作成日 | 2026-02-24 |
| 元ログ | `docs/specs/conversation-log-2026-02-24-project-scoping.jsonl` |
| 監査対象 | STP財務（transactions / invoices / payment-groups / generate） |
| 監査方法 | コード静的確認（実行確認なし） |

---

## 1. ログから抽出したユーザー要望（全件）

### 1.1 実装要望（主要求・2026-02-24 10:00:00Z）

ユーザーの主要求は、STP財務機能を「プロジェクト単位」でスコープすること。

目的:
- `/stp/finance/*` では **STPプロジェクトのデータのみ** を表示する
- 請求/支払グループ作成時に `projectId` を自動付与する
- 将来の SRD / SLP 等とのデータ混在に備え、クエリ側で `projectId` スコープを入れる

前提としてログに明示されている既存インフラ:
- `SystemProjectBinding`（`routeKey="stp"` -> `projectId=1`）
- `getSystemProjectContext("stp")`（5分キャッシュ）
- `MasterProject` に STP/SRD/SLP/Stella/Common がある

### 1.2 実装計画（ユーザー指定の Phase 1-5）

#### Phase 1: Prismaスキーマ + マイグレーション
- `InvoiceGroup` に `projectId` と `MasterProject` リレーション追加
- `PaymentGroup` に `projectId` と `MasterProject` リレーション追加
- `MasterProject` に逆リレーション追加
  - `finInvoiceGroups`
  - `finPaymentGroups`
- マイグレーションで以下を実施
  - カラム追加
  - FK制約追加
  - 既存データバックフィル（`InvoiceGroup` / `PaymentGroup` / `Transaction` の `projectId` を STP=1 に設定）

#### Phase 2: サーバーアクションに `projectId` フィルタ追加
- `transactions/actions.ts`
  - `listTransactions(..., projectId?)`
  - `listDeletedTransactions(projectId?)`
- `invoices/actions.ts`
  - `getInvoiceGroups(projectId?)`
  - `getUngroupedTransactions(counterpartyId?, projectId?)`
  - `createInvoiceGroup(data)` に `projectId?: number` を追加し保存時に反映
  - `createCorrectionInvoiceGroup` は元請求の `projectId` を継承
- `payment-groups/actions.ts`
  - `getPaymentGroups(projectId?)`
  - `getUngroupedExpenseTransactions(counterpartyId?, projectId?)`
  - `createPaymentGroup(data)` に `projectId?: number` を追加し保存時に反映

#### Phase 3: STPページで `getSystemProjectContext("stp")` を使う
- `transactions/page.tsx`
  - `projectId` を取得し一覧/削除一覧クエリへ渡す
- `invoices/page.tsx`
  - `projectId` を取得し請求一覧/未グループ取引クエリへ渡す
  - `InvoicesPageClient` に `projectId` prop を渡す
- `payment-groups/page.tsx`
  - 同様に `projectId` をクエリ + クライアントへ渡す

#### Phase 4: クライアントコンポーネントで `projectId` を伝播
- 請求管理系
  - `invoices-page-client.tsx`
  - `ungrouped-transactions-panel.tsx`
  - `create-invoice-group-modal.tsx`
- 支払管理系
  - `payment-groups-page-client.tsx`
  - `ungrouped-expenses-panel.tsx`
  - `create-payment-group-modal.tsx`

ログ上の実装過程で発見された派生要件（明示に近い）:
- `InvoiceGroupsTable` も `CreateInvoiceGroupModal` を開くため `projectId` prop 伝播が必要
- `PaymentGroupsTable` も `CreatePaymentGroupModal` を開くため `projectId` prop 伝播が必要
- `CreateInvoiceGroupModal` / `CreatePaymentGroupModal` の `useEffect` 依存配列に `projectId` を含める必要がある

#### Phase 5: 取引候補生成で SystemProjectBinding 利用
- `src/app/stp/finance/generate/actions.ts` の `MasterProject.findFirst({ code: "stp" })` をやめる
- `getSystemProjectContext("stp")` から `projectId` を取得して利用する

### 1.3 受け入れ確認（ログ内の検証観点）
- マイグレーション適用・Prisma generate・アプリ再起動
- バックフィル確認（`InvoiceGroup.projectId` 等が既存データで1）
- ビルド成功（TypeScriptエラーなし）
- `/stp/finance/transactions` が STP データのみ表示
- `/stp/finance/invoices` が STP データのみ表示、新規作成時 `projectId=1`
- `/stp/finance/payment-groups` も同様

### 1.4 後続の運用要望（実装スコープ外だがログ内に存在）
- 変更を「機能ごと」に分けてコミットしてほしい（後続で7コミットに分割）
- 会話ログをファイルに出力してほしい
- ただし「要約」ではなく **会話履歴全部（トランスクリプト全体）** を出力してほしい（ユーザーが明示的に修正）

---

## 2. 実装評価（コード照合）

### 2.1 結論（要約）

- **Phase 1-5 の明示チェック項目は概ね実装済み**
- ただし、ユーザーの背景要件にある「全クエリにプロジェクトフィルタ」を厳密に満たす観点では **未完了（部分達成）**
- 特に `invoices/actions.ts` / `payment-groups/actions.ts` の多くの更新・削除・状態変更系アクションが `id` ベースのみで動作し、`projectId` スコープをサーバー側で強制していない

判定:
- **明示Phase要件準拠:** ✅ ほぼ満たす
- **背景要件（全クエリ厳格スコープ）準拠:** ⚠️ 部分達成

### 2.2 良い点（要件どおり実装されている箇所）

#### A. Prismaスキーマ/マイグレーション
- `MasterProject` に逆リレーション追加済み
  - `prisma/schema.prisma:824`
  - `prisma/schema.prisma:825`
- `InvoiceGroup.projectId` + relation 追加済み
  - `prisma/schema.prisma:2335`
  - `prisma/schema.prisma:2336`
- `PaymentGroup.projectId` + relation 追加済み
  - `prisma/schema.prisma:2382`
  - `prisma/schema.prisma:2383`
- マイグレーションにカラム追加/FK/バックフィルSQLあり
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:2`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:5`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:8`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:11`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:14`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:15`
  - `prisma/migrations/20260224100132_add_project_id_to_invoice_payment_groups/migration.sql:16`

#### B. 取引一覧（STPページの絞り込み）
- `listTransactions` / `listDeletedTransactions` に `projectId` 引数追加 + where条件追加
  - `src/app/stp/finance/transactions/actions.ts:47`
  - `src/app/stp/finance/transactions/actions.ts:50`
  - `src/app/stp/finance/transactions/actions.ts:54`
  - `src/app/stp/finance/transactions/actions.ts:96`
  - `src/app/stp/finance/transactions/actions.ts:97`
  - `src/app/stp/finance/transactions/actions.ts:102`
- `transactions/page.tsx` で `getSystemProjectContext("stp")` を使ってクエリに渡している
  - `src/app/stp/finance/transactions/page.tsx:4`
  - `src/app/stp/finance/transactions/page.tsx:7`
  - `src/app/stp/finance/transactions/page.tsx:10`
  - `src/app/stp/finance/transactions/page.tsx:11`

#### C. 請求管理（一覧・未グループ・作成・訂正）
- `getInvoiceGroups(projectId?)` の where に `projectId` 条件追加
  - `src/app/stp/finance/invoices/actions.ts:73`
  - `src/app/stp/finance/invoices/actions.ts:77`
- `getUngroupedTransactions(counterpartyId?, projectId?)` に `projectId` 条件追加
  - `src/app/stp/finance/invoices/actions.ts:117`
  - `src/app/stp/finance/invoices/actions.ts:119`
  - `src/app/stp/finance/invoices/actions.ts:126`
- `createInvoiceGroup(data)` に `projectId?: number` が追加され、保存時に反映
  - `src/app/stp/finance/invoices/actions.ts:161`
  - `src/app/stp/finance/invoices/actions.ts:168`
  - `src/app/stp/finance/invoices/actions.ts:213`
- `createCorrectionInvoiceGroup` で元請求の `projectId` 継承
  - `src/app/stp/finance/invoices/actions.ts:472`
  - `src/app/stp/finance/invoices/actions.ts:490`
  - `src/app/stp/finance/invoices/actions.ts:500`
- `invoices/page.tsx` で `projectId` を取得し、一覧/未グループ取得 + クライアントに渡す
  - `src/app/stp/finance/invoices/page.tsx:4`
  - `src/app/stp/finance/invoices/page.tsx:7`
  - `src/app/stp/finance/invoices/page.tsx:11`
  - `src/app/stp/finance/invoices/page.tsx:12`
  - `src/app/stp/finance/invoices/page.tsx:55`
- クライアント側の `projectId` 伝播（ユーザー計画 + 派生要件）
  - `src/app/stp/finance/invoices/invoices-page-client.tsx:17`
  - `src/app/stp/finance/invoices/invoices-page-client.tsx:26`
  - `src/app/stp/finance/invoices/invoices-page-client.tsx:77`
  - `src/app/stp/finance/invoices/invoices-page-client.tsx:121`
  - `src/app/stp/finance/invoices/ungrouped-transactions-panel.tsx:26`
  - `src/app/stp/finance/invoices/ungrouped-transactions-panel.tsx:42`
  - `src/app/stp/finance/invoices/ungrouped-transactions-panel.tsx:104`
  - `src/app/stp/finance/invoices/invoice-groups-table.tsx:105`
  - `src/app/stp/finance/invoices/invoice-groups-table.tsx:113`
  - `src/app/stp/finance/invoices/invoice-groups-table.tsx:384`
  - `src/app/stp/finance/invoices/create-invoice-group-modal.tsx:29`
  - `src/app/stp/finance/invoices/create-invoice-group-modal.tsx:38`
  - `src/app/stp/finance/invoices/create-invoice-group-modal.tsx:78`
  - `src/app/stp/finance/invoices/create-invoice-group-modal.tsx:91`
  - `src/app/stp/finance/invoices/create-invoice-group-modal.tsx:151`

#### D. 支払管理（一覧・未グループ・作成）
- `getPaymentGroups(projectId?)` の where に `projectId`
  - `src/app/stp/finance/payment-groups/actions.ts:53`
  - `src/app/stp/finance/payment-groups/actions.ts:57`
- `getUngroupedExpenseTransactions(counterpartyId?, projectId?)` に `projectId` 条件追加
  - `src/app/stp/finance/payment-groups/actions.ts:97`
  - `src/app/stp/finance/payment-groups/actions.ts:99`
  - `src/app/stp/finance/payment-groups/actions.ts:106`
- `createPaymentGroup(data)` に `projectId?: number` 追加 + 保存時反映
  - `src/app/stp/finance/payment-groups/actions.ts:141`
  - `src/app/stp/finance/payment-groups/actions.ts:148`
  - `src/app/stp/finance/payment-groups/actions.ts:205`
- `payment-groups/page.tsx` で `projectId` を取得し、クエリ + クライアントに渡す
  - `src/app/stp/finance/payment-groups/page.tsx:7`
  - `src/app/stp/finance/payment-groups/page.tsx:10`
  - `src/app/stp/finance/payment-groups/page.tsx:14`
  - `src/app/stp/finance/payment-groups/page.tsx:15`
  - `src/app/stp/finance/payment-groups/page.tsx:42`
- クライアント側の `projectId` 伝播（ユーザー計画 + 派生要件）
  - `src/app/stp/finance/payment-groups/payment-groups-page-client.tsx:18`
  - `src/app/stp/finance/payment-groups/payment-groups-page-client.tsx:26`
  - `src/app/stp/finance/payment-groups/payment-groups-page-client.tsx:75`
  - `src/app/stp/finance/payment-groups/payment-groups-page-client.tsx:122`
  - `src/app/stp/finance/payment-groups/ungrouped-expenses-panel.tsx:25`
  - `src/app/stp/finance/payment-groups/ungrouped-expenses-panel.tsx:41`
  - `src/app/stp/finance/payment-groups/ungrouped-expenses-panel.tsx:243`
  - `src/app/stp/finance/payment-groups/payment-groups-table.tsx:104`
  - `src/app/stp/finance/payment-groups/payment-groups-table.tsx:111`
  - `src/app/stp/finance/payment-groups/payment-groups-table.tsx:378`
  - `src/app/stp/finance/payment-groups/create-payment-group-modal.tsx:29`
  - `src/app/stp/finance/payment-groups/create-payment-group-modal.tsx:38`
  - `src/app/stp/finance/payment-groups/create-payment-group-modal.tsx:80`
  - `src/app/stp/finance/payment-groups/create-payment-group-modal.tsx:93`
  - `src/app/stp/finance/payment-groups/create-payment-group-modal.tsx:146`

#### E. 取引候補生成（projectId取得元の置換）
- `generate/actions.ts` に `getSystemProjectContext` import 追加
  - `src/app/stp/finance/generate/actions.ts:22`
- `stpProjectId` を `getSystemProjectContext("stp")` から取得
  - `src/app/stp/finance/generate/actions.ts:435`
  - `src/app/stp/finance/generate/actions.ts:436`

---

## 3. 未達 / リスク（重要）

### 3.1 重要: 「全クエリに projectId フィルタ」の要件は未完了（サーバー側で抜けが多い）

ユーザー要望の背景には「将来の他プロジェクトのデータ混在に備え、全クエリにプロジェクトフィルタが必要」とあります。

今回の実装は **一覧取得と新規作成の主要パス** は対応済みですが、`invoices/actions.ts` / `payment-groups/actions.ts` の多くの操作系アクションは `id` ベースのみで、`projectId` スコープの強制がありません。

#### 代表例1: create系で選択取引のサーバー側検証に `projectId` がない
- 請求グループ作成時、選択取引の取得クエリに `projectId` 条件がない
  - `src/app/stp/finance/invoices/actions.ts:174`
- その後の `updateMany` も `id` のみで紐付け
  - `src/app/stp/finance/invoices/actions.ts:220`
- 支払グループ作成も同様
  - `src/app/stp/finance/payment-groups/actions.ts:154`
  - `src/app/stp/finance/payment-groups/actions.ts:212`

影響:
- UIから通常操作する限りは一覧側のフィルタで見えにくいが、サーバーアクションを直接叩ける/不正IDが渡ると他プロジェクト取引の混入余地が残る

#### 代表例2: 更新・削除・ステータス変更系が `findUnique({ id })` ベース
- 請求グループ
  - 更新: `src/app/stp/finance/invoices/actions.ts:250`, `src/app/stp/finance/invoices/actions.ts:285`
  - 取引追加: `src/app/stp/finance/invoices/actions.ts:303`, `src/app/stp/finance/invoices/actions.ts:315`, `src/app/stp/finance/invoices/actions.ts:332`
  - 取引削除: `src/app/stp/finance/invoices/actions.ts:374`, `src/app/stp/finance/invoices/actions.ts:387`, `src/app/stp/finance/invoices/actions.ts:412`
  - 削除: `src/app/stp/finance/invoices/actions.ts:432`, `src/app/stp/finance/invoices/actions.ts:445`, `src/app/stp/finance/invoices/actions.ts:458`
  - 採番/状態変更/経理引渡なども同様に `id` ベース
    - `src/app/stp/finance/invoices/actions.ts:551`
    - `src/app/stp/finance/invoices/actions.ts:603`
    - `src/app/stp/finance/invoices/actions.ts:663`
    - `src/app/stp/finance/invoices/actions.ts:700`
    - `src/app/stp/finance/invoices/actions.ts:774`
- 支払グループ
  - 更新/削除: `src/app/stp/finance/payment-groups/actions.ts:238`, `src/app/stp/finance/payment-groups/actions.ts:277`
  - 状態変更系: `src/app/stp/finance/payment-groups/actions.ts:324`, `src/app/stp/finance/payment-groups/actions.ts:361`, `src/app/stp/finance/payment-groups/actions.ts:401`, `src/app/stp/finance/payment-groups/actions.ts:443`
  - 取引追加/削除: `src/app/stp/finance/payment-groups/actions.ts:493`, `src/app/stp/finance/payment-groups/actions.ts:505`, `src/app/stp/finance/payment-groups/actions.ts:522`, `src/app/stp/finance/payment-groups/actions.ts:565`, `src/app/stp/finance/payment-groups/actions.ts:578`, `src/app/stp/finance/payment-groups/actions.ts:599`
  - グループ内取引取得/経理引渡: `src/app/stp/finance/payment-groups/actions.ts:632`, `src/app/stp/finance/payment-groups/actions.ts:660`, `src/app/stp/finance/payment-groups/actions.ts:711`

評価:
- 「STPページの主要表示をSTPに絞る」という観点では効果あり
- ただし「全クエリを projectId でスコープ」の厳密条件には未達

### 3.2 リスク: `getSystemProjectContext("stp")` が取れない時に fail-open になる

ページ側で `const projectId = ctx?.projectId;` とし、各アクションは `projectId` が未指定ならフィルタを外す実装です。

- 取引一覧: `src/app/stp/finance/transactions/page.tsx:8` + `src/app/stp/finance/transactions/actions.ts:54`
- 請求一覧: `src/app/stp/finance/invoices/page.tsx:8` + `src/app/stp/finance/invoices/actions.ts:77`
- 支払一覧: `src/app/stp/finance/payment-groups/page.tsx:11` + `src/app/stp/finance/payment-groups/actions.ts:57`

影響:
- `SystemProjectBinding` の設定不備時に全プロジェクト表示となる可能性

備考:
- これはログのコード例自体が `ctx?.projectId` を使っているため、今回実装は計画どおりではある
- ただし、運用上の安全性としては fail-closed（`ctx` 未取得時にエラー）にした方が要件目的に一致しやすい

### 3.3 参考（軽微）: generate の CostCenter 取得は引き続き `code: "stp"` を使用

- `src/app/stp/finance/generate/actions.ts:439`

これはユーザーが明示した差し替え対象（`MasterProject.findFirst({ code: "stp" })`）とは別で、今回のPhase 5要件には抵触しません。\
ただし「SystemProjectBinding使用」を将来的に一貫させるなら、ここも追随候補です。

---

## 4. 判定サマリー（要件別）

| 区分 | 判定 | コメント |
|------|------|----------|
| Phase 1 スキーマ変更 | ✅ PASS | `InvoiceGroup` / `PaymentGroup` の `projectId` と逆リレーション、マイグレーション/バックフィル確認済み |
| Phase 2 一覧系/作成系の追加引数・保存 | ✅ PASS | 指定関数の `projectId` 追加は実装済み |
| Phase 3 ページでの `getSystemProjectContext("stp")` | ✅ PASS | 3ページとも実装済み |
| Phase 4 クライアントへの `projectId` 伝播 | ✅ PASS | 指定ファイル + 派生の Table/Modal 経路まで到達 |
| Phase 5 generate の projectId 取得元置換 | ✅ PASS | `getSystemProjectContext("stp")` 使用に置換済み |
| 背景要件: 全クエリに projectId スコープ | ⚠️ PARTIAL | 多数の操作系アクションが未スコープ |
| 背景要件: STPページはSTPのみ（厳密） | ⚠️ PARTIAL | 通常系は満たすが `ctx` 未取得時は fail-open |

---

## 5. 監査時の前提・制約

- 本レポートは **コード静的確認のみ**（実行/DB/画面手動検証は未実施）
- ユーザー指示に従い、コード編集は行わず、`docs/specs` への本ファイル新規作成のみ実施
- コミット分割・トランスクリプト出力の運用要望は、本コード監査の評価対象外

