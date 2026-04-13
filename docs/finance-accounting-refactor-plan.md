# 経理モジュール分離リファクタリング計画書（A案）

**作成日**: 2026-04-13
**対象ブランチ**: `refactor/finance-accounting-split`（新規作成予定）
**対象コミット起点**: `d3a6fa3`
**レビュー予定**: OpenAI Codex による計画レビュー → 実装 → Codex による最終コードレビュー

---

## 📌 この計画書の読み方（最重要）

この計画書は、**Claude Code が実装する前に** Codex へレビュー依頼するための設計図です。以下の観点でレビューしてください：

1. **アーキテクチャの妥当性**（§2・§3）：3層構造の切り分けは正しいか
2. **権限ヘルパーの設計**（§4）：新ヘルパーの責務は明確か、境界ケースに漏れはないか
3. **移動対象ファイルのマッピング**（§5）：共通／経理専用の振り分けに誤りはないか
4. **段階的実装計画の妥当性**（§6）：Phase の順序・依存関係は正しいか、各Phaseで壊れ得る箇所の想定は十分か
5. **検証手順**（§7・§8）：型チェック・ビルド・スモークテストのカバレッジは十分か
6. **ロールバック手順**（§9）：各Phaseで問題が起きたときの切り戻しが機能するか
7. **リスクと対策**（§10）：見落とされたリスクはないか

---

## 1. 背景と目的

### 1.1 なぜやるのか

#### 直接の契機
2026-04-11 のリファクタリング（コミット `22881ed`・`9bbcf96`）で、経理モジュールに「ActionResult統一」と並行して **`requireStaffWithProjectPermission([{ project: "accounting", level: "view|edit" }])` という権限チェックが無差別に追加された**。結果として、STP/HOJO/SLP のスタッフがプロジェクト側で本来使えるはずの機能（取引詳細・請求グループ・支払グループ・コメント・変更履歴・経費申請）にアクセスできなくなった。

STPの「取引化を押した後に請求管理に移ると取引がみつかりません」というバグ報告がきっかけで判明。調査の結果、以下の5箇所で同種のバグが残っていることが確定した：

| # | 関数 | 場所 | 影響 |
|---|------|------|------|
| 1 | `getComments` | `src/app/accounting/comments/actions.ts:245` | STPコメント欄が全て空表示 |
| 2 | `getChangeLogs` | `src/app/accounting/changelog/actions.ts:96` | 変更履歴が見えない |
| 3 | `getChangeLogsForTransaction` | `src/app/accounting/changelog/actions.ts:128` | 同上 |
| 4 | `getGroupAllocationWarnings` | `src/app/accounting/transactions/allocation-group-item-actions.ts:722` | 按分警告取得不可 |
| 5 | `getProjectRecurringTransactions`・`getMonthlyExpenseSummary` | `src/app/accounting/expenses/new/actions.ts:646, 737` | STP/HOJO/SLP経費申請ページが落ちる |

（前回既に修正済み：`getTransactionById`・`getTransactionFormData`）

#### 根本原因
現状は `src/app/accounting/` 配下に **「経理専用」と「プロジェクト横断で共通利用」の機能が混在**している。このため：

- 関数を書くたびに「誰が使える関数か」を人間が毎回考えて権限チェックを書く必要がある
- 新プロジェクトを追加するたびに権限配列（`[{ project: "stp" }, { project: "hojo" }, ...]`）の更新漏れが発生
- 今回のような**大規模な権限チェック一括追加リファクタで機能が全断する**事故が起こりやすい

### 1.2 ビジネスフローと対応するコード構造

```
【プロジェクト固有ロジック】          【プロジェクト横断の共通】         【経理専用】
┌───────────────────┐              ┌──────────────────┐       ┌──────────────┐
│ STP:                │             │                  │       │              │
│ - 契約→売上自動生成 │──取引生成──→│ Transaction      │       │ 仕訳         │
│ - 経費自動生成      │             │ InvoiceGroup     │──────→│ 入出金消込   │
├───────────────────┤              │ PaymentGroup     │       │ 月次締め     │
│ HOJO:               │             │ Comment          │       │ キャッシュ   │
│ - 補助金→経費生成等 │             │ ChangeLog        │       │ フロー       │
├───────────────────┤              │ 経費申請フォーム  │       │ ダッシュボード│
│ SLP / SRD / 新PJ: …  │            │ (各Project側UIが │       │              │
│                     │             │  共通actions呼ぶ) │       │              │
└───────────────────┘              └──────────────────┘       └──────────────┘
      ↑                                    ↑                          ↑
  src/app/{pj}/finance/            src/app/finance/            src/app/accounting/
  （今後プロジェクト              （★新設）                   （既存の「経理専用」
   が増えるたびに増える）                                       部分のみ残る）
```

### 1.3 目的

この3層構造をディレクトリレベルで物理的に分離し、以下を達成する：

1. **権限ルールの明確化**: ディレクトリ単位で権限境界が定義される
2. **将来の拡張性**: 新プロジェクト追加時は `src/app/{newproject}/` だけ増やせば良い（共通部分は触らない）
3. **同種事故の再発防止**: 共通機能を「経理専用の権限チェック」で守る構造を物理的に不可能にする
4. **可読性向上**: ディレクトリ名から誰が使える機能かが一目で分かる

---

## 2. 設計原則

### 2.1 三層の定義

| 層 | 場所 | 誰が使う | 典型的な機能 |
|----|------|----------|--------------|
| **プロジェクト固有** | `src/app/{stp,hojo,slp,srd,...}/finance/` | そのプロジェクトのスタッフ | 自動生成ロジック（契約→売上、応募→報酬、補助金→経費）、トラッカーUI、プロジェクト固有テーブル |
| **プロジェクト横断共通** | `src/app/finance/`（★新設） | 全プロジェクト＋経理 | Transaction/InvoiceGroup/PaymentGroup のCRUD、確定・差し戻し・請求化・送付、コメント、変更履歴、添付、経費申請フォーム |
| **経理専用** | `src/app/accounting/` | 経理スタッフのみ | 仕訳、入出金消込、月次締め、キャッシュフロー、経理ダッシュボード、承認ワークフロー、各種マスタ |

### 2.2 分離の判定基準

あるファイル／関数を **共通（finance）** に置くか **経理専用（accounting）** に置くかは、次のテストで決める：

> **Q**: そのファイル／関数は、STP・HOJO・SLP・SRD等のプロジェクト側スタッフが（経理権限を持たなくても）使う必要があるか？
>
> - **Yes** → `src/app/finance/`
> - **No、経理スタッフだけが使う** → `src/app/accounting/`
> - **判断困難** → §5 の議論用リストに載せて人間判断

### 2.3 Next.js App Router 上の扱い

- `src/app/finance/` には **`page.tsx` を置かない**（URLルートにしない）。純粋に Server Actions と共有UIコンポーネントの置き場
- URLルート（ユーザーが画面でアクセスする`/accounting/xxx`・`/stp/xxx`等）はすべて既存位置を維持する → **URLの破壊的変更なし**
- `/stp/finance/transactions/[id]` 等、既存のSTP側ルートはそのままで、内部で `@/app/finance/transactions/actions` を import する形に書き換える

### 2.4 Server Actions の `"use server"` 運用

- 移動後も `"use server"` 指令は各 actions.ts の先頭で維持
- Import path の更新だけで、ランタイムの挙動は変わらない（Next.jsは `"use server"` ファイルから export された関数を自動的にSA として扱う）

---

## 3. 目標ディレクトリ構造（After）

### 3.1 全体像

```
src/app/
│
├── finance/                        ★ NEW: プロジェクト横断共通レイヤー
│   ├── transactions/
│   │   ├── actions.ts              ← 取引CRUD・確定・差し戻し・請求化
│   │   ├── allocation-actions.ts   ← 按分計算・確定
│   │   ├── allocation-group-item-actions.ts
│   │   ├── transaction-form.tsx    ← 取引編集フォーム（共有UI）
│   │   ├── transaction-status-badge.tsx
│   │   └── allocation-confirmation-panel.tsx
│   ├── comments/
│   │   ├── actions.ts              ← コメントCRUD
│   │   └── comment-section.tsx     ← コメント表示UI
│   ├── changelog/
│   │   ├── actions.ts              ← 変更履歴CRUD
│   │   ├── changelog-section.tsx   ← 変更履歴表示UI
│   │   └── log-fields.ts           ← ログ対象フィールド定義
│   └── expenses/
│       ├── actions.ts              ← 経費申請フォーム・承認
│       ├── manual-expense-form.tsx
│       └── expense-page-client.tsx ← mode="accounting"|"project"
│
├── accounting/                     ★ 経理専用だけを残す
│   ├── page.tsx
│   ├── verification/
│   ├── imports/
│   ├── dashboard/                  ← 経理ダッシュボード
│   ├── journal/                    ← 仕訳
│   ├── reconciliation/             ← 入出金消込
│   ├── monthly-close/              ← 月次締め
│   ├── cashflow/                   ← キャッシュフロー予測
│   ├── batch-complete/             ← 一括完了
│   ├── workflow/                   ← 経理承認ワークフロー
│   ├── invoice-check/              ← 請求書チェック
│   ├── bank-transactions/          ← 銀行取引インポート
│   ├── usdt-rates/                 ← USDTレート管理
│   ├── settings/                   ← 経理設定（MF連携・プロジェクト設定）
│   ├── budget/                     ← 予算管理
│   ├── masters/                    ← 各種マスタ
│   │   ├── accounts/
│   │   ├── cost-centers/
│   │   ├── expense-categories/
│   │   ├── payment-methods/
│   │   ├── counterparties/
│   │   ├── allocation-templates/
│   │   ├── auto-journal/
│   │   ├── recurring-transactions/
│   │   └── invoice-templates/
│   ├── transactions/               ← 経理用一覧・新規・編集ページだけ残る
│   │   ├── page.tsx                ← 経理用取引一覧
│   │   ├── new/page.tsx            ← 経理用新規作成
│   │   ├── [id]/edit/page.tsx      ← 経理用編集
│   │   ├── transactions-table.tsx  ← 経理用テーブル
│   │   └── transaction-status-actions.tsx
│   └── expenses/
│       └── new/page.tsx            ← 経理用エントリ（finance/expenses を利用）
│
├── stp/finance/                    ← そのまま（importパスだけ更新）
├── hojo/                           ← そのまま（importパスだけ更新）
├── slp/                            ← そのまま（importパスだけ更新）
└── srd/                            ← そのまま（変更なし）
```

### 3.2 URLルートは変更なし

この構造変更は**ユーザー体験には一切影響しない**（URLは全て既存のまま）：

| URL | 変更 |
|-----|------|
| `/accounting` | 不変 |
| `/accounting/transactions` | 不変 |
| `/accounting/journal` | 不変 |
| `/stp/finance/billing` | 不変 |
| `/stp/finance/transactions/[id]` | 不変 |
| `/stp/expenses/new` | 不変 |
| その他全ルート | 不変 |

---

## 4. 権限ヘルパー設計

### 4.1 新ヘルパー（`src/lib/auth/staff-action.ts` に追加）

```typescript
/**
 * プロジェクト横断の財務機能（取引・請求G・支払G・コメント・履歴・経費申請）を使うための権限。
 *
 * 経理プロジェクトの view 以上、または任意の事業プロジェクト（stp/hojo/srd/slp/stella）の
 * view 以上を持っていれば通る。
 *
 * 使用場所: src/app/finance/ 配下の全ての Server Actions
 *
 * 想定ユーザー:
 * - 経理スタッフ（自分が担当する取引の詳細を見る等）
 * - STP/HOJO/SLP等のプロジェクトスタッフ（自プロジェクトの取引を生成・編集する等）
 * - ファウンダー・システム管理者（自動パス）
 */
export async function requireStaffForFinance(
  level: PermissionLevel = "view"
): Promise<SessionUser>;

/**
 * 経理専用機能（仕訳・消込・月次締め・キャッシュフロー・承認ワークフロー・ダッシュボード等）
 * を使うための権限。
 *
 * 経理プロジェクトの指定レベル以上を持っていれば通る。事業プロジェクト側の権限は通らない。
 *
 * 使用場所: src/app/accounting/ 配下の全ての Server Actions
 *
 * 想定ユーザー:
 * - 経理スタッフのみ
 * - ファウンダー・システム管理者（自動パス）
 */
export async function requireStaffForAccounting(
  level: PermissionLevel = "view"
): Promise<SessionUser>;
```

### 4.2 既存ヘルパーとの関係

| ヘルパー | 動作 | 移行方針 |
|---------|------|---------|
| `requireStaff()` | staffであることだけ確認 | 残す（一般認証用） |
| `requireStaffWithAnyEditPermission()` | いずれかのPJでedit以上 | 残す（クロス機能用） |
| `requireStaffWithProjectPermission([...])` | 指定配列のORで評価 | 残す（特殊ケース用。ただしaccounting/finance配下では原則使わない） |
| **`requireStaffForFinance()`** ★新設 | 経理 OR 事業PJのview以上 | `src/app/finance/` 配下で使う |
| **`requireStaffForAccounting()`** ★新設 | 経理のみ | `src/app/accounting/` 配下で使う |

### 4.3 API Routes への適用

`src/app/api/finance/*` 配下のAPIルートは、既に `authorizeApi([{ project: "stp", level: "edit" }, { project: "accounting", level: "edit" }])` のように冗長な記述になっている。これも新ヘルパーで置換：

```typescript
// Before
const authz = await authorizeApi([
  { project: "stp", level: "edit" },
  { project: "accounting", level: "edit" },
]);

// After（api-auth.ts に新ヘルパーを追加）
const authz = await authorizeApiForFinance("edit");
```

これは **Phase 外のリファクタ** として後続で実施（優先度低）。本計画では既存の `authorizeApi([...])` を変えず、配列の要素を過不足ないように統一するだけに留める。

---

## 5. 移動対象ファイル マッピング表

### 5.1 `src/app/finance/` へ移動するファイル

#### 5.1.1 `finance/transactions/` 配下

| Before | After | 備考 |
|--------|-------|------|
| `src/app/accounting/transactions/actions.ts` | `src/app/finance/transactions/actions.ts` | 全export関数が共通（CRUD・確定・差し戻し等） |
| `src/app/accounting/transactions/allocation-actions.ts` | `src/app/finance/transactions/allocation-actions.ts` | 按分計算・確定（共通） |
| `src/app/accounting/transactions/allocation-group-item-actions.ts` | `src/app/finance/transactions/allocation-group-item-actions.ts` | 按分グループ操作（共通） |
| `src/app/accounting/transactions/transaction-form.tsx` | `src/app/finance/transactions/transaction-form.tsx` | STPも使う共有UI |
| `src/app/accounting/transactions/transaction-status-badge.tsx` | `src/app/finance/transactions/transaction-status-badge.tsx` | STPも使う共有UI |
| `src/app/accounting/transactions/allocation-confirmation-panel.tsx` | `src/app/finance/transactions/allocation-confirmation-panel.tsx` | 共有UI（要検証） |

**accountingに残すもの**（URL/ページ）:
| ファイル | 理由 |
|---------|------|
| `src/app/accounting/transactions/page.tsx` | 経理用取引一覧のURLルート |
| `src/app/accounting/transactions/new/page.tsx` | 経理用新規作成のURLルート |
| `src/app/accounting/transactions/[id]/edit/page.tsx` | 経理用編集のURLルート |
| `src/app/accounting/transactions/transactions-table.tsx` | page.tsx専用のテーブルコンポーネント |
| `src/app/accounting/transactions/transaction-status-actions.tsx` | 経理側の独自ステータス操作UI（要検証） |

#### 5.1.2 `finance/comments/` 配下

| Before | After |
|--------|-------|
| `src/app/accounting/comments/actions.ts` | `src/app/finance/comments/actions.ts` |
| `src/app/accounting/comments/comment-section.tsx` | `src/app/finance/comments/comment-section.tsx` |

#### 5.1.3 `finance/changelog/` 配下

| Before | After |
|--------|-------|
| `src/app/accounting/changelog/actions.ts` | `src/app/finance/changelog/actions.ts` |
| `src/app/accounting/changelog/changelog-section.tsx` | `src/app/finance/changelog/changelog-section.tsx` |
| `src/app/accounting/changelog/log-fields.ts` | `src/app/finance/changelog/log-fields.ts` |

#### 5.1.4 `finance/expenses/` 配下

| Before | After | 備考 |
|--------|-------|------|
| `src/app/accounting/expenses/new/actions.ts` | `src/app/finance/expenses/actions.ts` | ファイル名変更に注意（`new/` 階層を廃し、ルート直下に） |
| `src/app/accounting/expenses/new/expense-page-client.tsx` | `src/app/finance/expenses/expense-page-client.tsx` | mode=accounting/project両対応 |
| `src/app/accounting/expenses/new/manual-expense-form.tsx` | `src/app/finance/expenses/manual-expense-form.tsx` | 共通フォーム |

**accountingに残すもの**:
| ファイル | 理由 |
|---------|------|
| `src/app/accounting/expenses/new/page.tsx` | 経理用経費申請エントリのURLルート（`/accounting/expenses/new`）。中身は `finance/expenses` を import |

### 5.2 各プロジェクト側 import パス更新一覧（18箇所）

| # | ファイル | 現在のimport | 更新後 |
|---|----------|-------------|--------|
| 1 | `src/app/stp/expenses/new/page.tsx:7-8` | `@/app/accounting/expenses/new/actions` / `@/app/accounting/expenses/new/expense-page-client` | `@/app/finance/expenses/actions` / `@/app/finance/expenses/expense-page-client` |
| 2 | `src/app/stp/finance/billing/billing-lifecycle-view.tsx:50` | `@/app/accounting/transactions/actions` | `@/app/finance/transactions/actions` |
| 3 | `src/app/stp/finance/generate/actions.ts:123-124` | `@/app/accounting/changelog/actions` / `@/app/accounting/changelog/log-fields` | `@/app/finance/changelog/actions` / `@/app/finance/changelog/log-fields` |
| 4 | `src/app/stp/finance/transactions/[id]/page.tsx:9-13` | `@/app/accounting/transactions/actions` × 1, `.../transaction-status-badge` × 1, `.../transaction-form` × 1, `@/app/accounting/comments/comment-section` × 1, `@/app/accounting/changelog/changelog-section` × 1 | 全て `@/app/finance/...` |
| 5 | `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx:26` | `@/app/accounting/comments/comment-section` | `@/app/finance/comments/comment-section` |
| 6 | `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx:51` | `@/app/accounting/transactions/allocation-group-item-actions` | `@/app/finance/transactions/allocation-group-item-actions` |
| 7 | `src/app/stp/finance/invoices/actions.ts:7` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |
| 8 | `src/app/stp/finance/transactions/[id]/confirm-button.tsx:17` | `@/app/accounting/transactions/actions` | `@/app/finance/transactions/actions` |
| 9 | `src/app/stp/finance/transactions/transactions-table.tsx:28` | `@/app/accounting/transactions/actions` | `@/app/finance/transactions/actions` |
| 10 | `src/app/stp/finance/payment-groups/actions.ts:7` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |
| 11 | `src/app/stp/finance/transactions/transaction-preview-modal.tsx:22` | `@/app/accounting/transactions/actions` | `@/app/finance/transactions/actions` |
| 12 | `src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx:47` | `@/app/accounting/comments/comment-section` | `@/app/finance/comments/comment-section` |
| 13 | `src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx:78` | `@/app/accounting/transactions/allocation-group-item-actions` | `@/app/finance/transactions/allocation-group-item-actions` |
| 14 | `src/app/stp/finance/payment-groups/inbound-invoice-actions.ts:7` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |
| 15 | `src/app/stp/finance/transactions/actions.ts:6` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |
| 16 | `src/app/hojo/expenses/new/page.tsx:7-8` | `@/app/accounting/expenses/new/...` | `@/app/finance/expenses/...` |
| 17 | `src/app/slp/expenses/new/page.tsx:7-8` | `@/app/accounting/expenses/new/...` | `@/app/finance/expenses/...` |
| 18 | `src/app/accounting/transactions/new/page.tsx` | `../actions` (= `accounting/transactions/actions`) | `@/app/finance/transactions/actions` |

### 5.3 accounting 内部の import パス更新

`src/app/accounting/` 内から、移動したファイルを参照している箇所も全て更新が必要。`changelog/actions.ts` は中心ハブなので特に注意。

**accounting内で import 更新が必要と想定される主要ファイル**（Phase 1-5 で洗い出し・更新）:
- `accounting/transactions/*` → `finance/transactions/*` への相対 import は全て絶対パスに書き換え
- `accounting/journal/actions.ts` → `changelog/actions` を参照 → `@/app/finance/changelog/actions`
- `accounting/reconciliation/actions.ts` → 同上
- `accounting/batch-complete/actions.ts` → 同上
- `accounting/masters/counterparties/actions.ts` → 同上
- `accounting/masters/allocation-templates/actions.ts` → 同上
- `accounting/workflow/actions.ts` → 取引関連の actions を参照している可能性
- その他 accounting 内の actions.ts で `"./actions"` や `"../changelog/actions"` 等を参照している全箇所

**重要**: Phase 実行時には `grep -rn "@/app/accounting/(transactions|comments|changelog|expenses)" src/` を実行して**漏れゼロ**を確認。

### 5.4 権限ヘルパーの置換

全actions.ts内の `requireStaffWithProjectPermission([{ project: "accounting", ... }])` 呼び出しを、ファイルの配置先に応じて置換：

| ファイル配置先 | 置換後 |
|---------------|--------|
| `src/app/finance/` 配下 | `requireStaffForFinance("view"|"edit")` |
| `src/app/accounting/` 配下 | `requireStaffForAccounting("view"|"edit")` |

### 5.5 「判断困難」リスト（Codexレビュー時に再確認したい）

以下のファイルは、共通／経理専用の判定に迷いがある。Codexのレビューで再検証したい：

| ファイル | 迷っているポイント |
|---------|-------------------|
| `accounting/transactions/allocation-confirmation-panel.tsx` | 按分確定パネル。accounting/transactions/[id]/edit/page.tsx でも使う？ STP側でも使う？ import元を要確認 |
| `accounting/transactions/transaction-status-actions.tsx` | どこから呼ばれるか要確認。STPからも使うなら共通、accountingだけなら残す |
| `accounting/transactions/transactions-table.tsx` | accounting専用テーブルのはず。ただし finance-edit-dialog 等との依存関係確認 |
| `src/components/finance-edit-dialog.tsx` | components配下だが、共通化が適切か、accounting専用と分けるべきかは要判断 |
| `accounting/expenses/new/manual-expense-form.tsx` | プロジェクト側の経費申請フォームと完全に同一か、経理側で追加フィールドがあるか要確認 |
| `accounting/transactions/actions.ts` 内の `getAccountingTransactions` / `createAccountingTransaction` / `getAccountingTransactionFormData` | 関数名に「Accounting」が付いているが、accounting専用機能として分離すべきか、共通actions.tsに同居させるか |

**判断の方針案**:
- Phase 1 開始前に各ファイルを Read して import 関係を確定させる
- 迷う場合は「現時点で cross-project import されているか」のみで判定（されていなければaccounting残留、されていればfinance移動）

---

## 6. 段階的実装計画（Phase 分割）

### 6.1 全体戦略

- **戦略**: モジュール単位で atomic に移動（§6.3 で詳述）
- **ブランチ**: `refactor/finance-accounting-split` を main から切る
- **コミット粒度**: Phase ごとに 1〜2 コミット。各Phase終了時に必ず `tsc --noEmit` と `next build` を通す
- **並行作業**: 他セッションが main に push する可能性があるので、各Phase開始時に rebase を検討

### 6.2 Phase 全体像

| Phase | 内容 | 想定コミット数 | 所要時間目安 |
|-------|------|---------------|-------------|
| **Phase 0** | 準備（ブランチ作成、権限ヘルパー追加、既知バグ先行修正） | 1-2 | 30分 |
| **Phase 1** | `finance/changelog/` 移動（最も多く依存される基盤） | 1 | 30分 |
| **Phase 2** | `finance/comments/` 移動 | 1 | 30分 |
| **Phase 3** | `finance/transactions/` のactions系移動 | 1 | 60分 |
| **Phase 4** | `finance/transactions/` のUIコンポーネント移動 | 1 | 30分 |
| **Phase 5** | `finance/expenses/` 移動 | 1 | 30分 |
| **Phase 6** | 権限チェックを新ヘルパーに置換（全ファイル一括） | 1 | 60分 |
| **Phase 7** | 最終検証＋スモークテスト＋ドキュメント更新 | 1 | 60分 |
| **合計** | | 7-8 | 約5時間 |

### 6.3 各Phaseの詳細

#### Phase 0: 準備

**目的**: 実装基盤を整える。この段階ではまだファイル移動しない。

**手順**:
1. `git checkout main && git pull`
2. `git checkout -b refactor/finance-accounting-split`
3. `src/lib/auth/staff-action.ts` に新ヘルパー2つを追加（`requireStaffForFinance`・`requireStaffForAccounting`）。既存ヘルパーは触らない
4. **既知バグの先行修正**: Phase 6 完了まで待つと業務が止まるため、Phase 0 の時点で §1.1 に列挙した5箇所の権限チェックを暫定的に広げる（§7-1 の緊急バグ修正で実施済みの `getTransactionById`・`getTransactionFormData` と同じパターン）
5. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / ビルドOK確認
6. コミット: "refactor: 権限ヘルパー2種を追加＋既知バグの暫定修正"

**受け入れ条件**:
- [ ] 新ヘルパー2つが存在し、型エラーなし
- [ ] Dockerでビルド成功
- [ ] STPで取引詳細・請求管理・コメント・変更履歴・経費申請ページが開ける（スモークテスト簡易版）

**Note**: Phase 0 終了時点で「業務は回る」状態が達成される。以降のPhase 1-7はゆっくり進めても業務影響なし。

#### Phase 1: `finance/changelog/` 移動

**なぜこれが最初か**: `changelog/actions.ts` は8個のactionsから依存される中心ハブ。最初に移動することで、以降のPhaseでは「changelogはもう新しい場所にある」前提で進められる。

**手順**:
1. ファイルロック取得（`accounting/changelog/*` + `finance/changelog/*`）
2. `src/app/accounting/changelog/` → `src/app/finance/changelog/` へ `git mv`
3. 新しい `finance/changelog/actions.ts` の権限チェックを `requireStaffForFinance("view")` に置換（actions関数）。`recordChangeLog` は権限チェック不要（内部関数）、`getChangeLogs`・`getChangeLogsForTransaction` は `requireStaffForFinance("view")`
4. `grep -rn "@/app/accounting/changelog" src/` で呼び出し元を全列挙
5. 全呼び出し元の import パスを `@/app/finance/changelog/...` に書き換え
6. `grep -rn "from \"./actions\"" src/app/finance/changelog/` / `grep -rn "from \"../changelog/actions\"" src/app/accounting/` で相対 import もチェック
7. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / ビルドOK確認
8. コミット: "refactor: changelog を finance/ へ移動"

**検証項目**:
- [ ] 型エラーゼロ
- [ ] ビルド成功
- [ ] STP取引詳細画面で変更履歴セクションが表示される
- [ ] 経理取引編集画面で変更履歴セクションが表示される

**ロールバック**: `git reset --hard HEAD~1`

#### Phase 2: `finance/comments/` 移動

**手順**:
1. ファイルロック取得（`accounting/comments/*` + `finance/comments/*`）
2. `git mv src/app/accounting/comments src/app/finance/comments`
3. `finance/comments/actions.ts` の権限チェックを `requireStaffForFinance("view")` に置換（`getComments`）。`createComment` はログイン済みstaffなら誰でも可 → `requireStaff()` で良い
4. `grep -rn "@/app/accounting/comments" src/` で呼び出し元全列挙
5. 全呼び出し元のimportパスを `@/app/finance/comments/...` に書き換え
6. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP取引詳細のコメント欄が表示・投稿できる
- [ ] STP請求グループ・支払グループ詳細モーダルのコメント欄が表示・投稿できる
- [ ] 経理取引編集画面のコメント欄が表示・投稿できる

#### Phase 3: `finance/transactions/` のactions系移動

**対象ファイル**:
- `accounting/transactions/actions.ts` → `finance/transactions/actions.ts`
- `accounting/transactions/allocation-actions.ts` → `finance/transactions/allocation-actions.ts`
- `accounting/transactions/allocation-group-item-actions.ts` → `finance/transactions/allocation-group-item-actions.ts`

**手順**:
1. ファイルロック取得（上記3ファイル）
2. `git mv` で3ファイルを移動
3. 各actions.ts内の権限チェックを**関数ごとに適切なヘルパーに置換**:
   - 共通系（`getTransactionById`・`createTransaction`・`updateTransaction`・`confirmTransaction` 等）→ `requireStaffForFinance`
   - 経理専用系（`getAccountingTransactions`・`createAccountingTransaction`・`getAccountingTransactionFormData`）→ `requireStaffForAccounting`
4. 3ファイル間の相対importを絶対パスに書き換え（`"./allocation-actions"` → `"@/app/finance/transactions/allocation-actions"`）
5. `grep -rn "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions)" src/` で呼び出し元全列挙
6. 全呼び出し元のimportパスを更新
7. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP取引化→請求管理 の一連フローが動く
- [ ] STP取引確定・確定取消・削除が動く
- [ ] 経理取引一覧・新規・編集が動く
- [ ] 按分テンプレート操作が動く

#### Phase 4: `finance/transactions/` のUIコンポーネント移動

**対象ファイル**:
- `accounting/transactions/transaction-form.tsx` → `finance/transactions/transaction-form.tsx`
- `accounting/transactions/transaction-status-badge.tsx` → `finance/transactions/transaction-status-badge.tsx`
- `accounting/transactions/allocation-confirmation-panel.tsx` → `finance/transactions/allocation-confirmation-panel.tsx`

**手順**:
1. ファイルロック取得
2. `git mv`
3. 各UIファイル内の相対importを更新（`"./actions"` → `"./actions"` のまま維持、同じディレクトリ内のため不要）
4. `grep -rn "@/app/accounting/transactions/(transaction-form|transaction-status-badge|allocation-confirmation-panel)" src/` で呼び出し元全列挙
5. 呼び出し元のimportパス更新
6. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP取引詳細画面で編集フォーム・ステータスバッジ・按分確定パネルが正しく表示
- [ ] 経理取引編集画面で同上

#### Phase 5: `finance/expenses/` 移動

**対象ファイル**:
- `accounting/expenses/new/actions.ts` → `finance/expenses/actions.ts`
- `accounting/expenses/new/expense-page-client.tsx` → `finance/expenses/expense-page-client.tsx`
- `accounting/expenses/new/manual-expense-form.tsx` → `finance/expenses/manual-expense-form.tsx`

**注意**: `accounting/expenses/new/page.tsx` は**移動しない**（URLルート `/accounting/expenses/new` 維持のため）。内容だけ書き換えて、`@/app/finance/expenses/*` を import する形にする。

**手順**:
1. ファイルロック取得
2. `git mv` で3ファイルを移動（ディレクトリ構造変更: `accounting/expenses/new/` → `finance/expenses/`）
3. 権限チェックを置換:
   - `getProjectRecurringTransactions`・`getMonthlyExpenseSummary`・`getExpenseFormData`・`getMyExpenses`・`getPendingApprovals`・`submitExpenseRequest`・`approveByProjectApprover`・`rejectByProjectApprover` → `requireStaffForFinance`
   - `getAllRecurringTransactions` → `requireStaffForAccounting("view")`（経理専用の全PJ横断ビュー）
4. `accounting/expenses/new/page.tsx` の import を更新
5. `stp/expenses/new/page.tsx`・`hojo/expenses/new/page.tsx`・`slp/expenses/new/page.tsx` の import を更新
6. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP/HOJO/SLP の経費申請ページが開ける・登録できる
- [ ] 経理の経費申請ページが開ける・登録できる
- [ ] 経理用「全プロジェクト定期取引」タブが表示される

#### Phase 6: 権限チェックを新ヘルパーに置換（残り全ファイル）

**目的**: Phase 1-5 で移動したファイル以外にも、accounting 配下の既存 actions.ts で `requireStaffWithProjectPermission([{ project: "accounting", ... }])` を書いている箇所を `requireStaffForAccounting(level)` に一括置換する。意味論は同じだが、ディレクトリ方針に沿ったヘルパー名にすることで可読性と保守性を上げる。

**対象**: `src/app/accounting/` 配下の全actions.ts

**手順**:
1. `grep -rn "requireStaffWithProjectPermission" src/app/accounting/` で全件列挙
2. 各呼び出しについて、配列が `[{ project: "accounting", level: "xxx" }]` のみなら `requireStaffForAccounting("xxx")` に置換
3. 配列に複数要素（例: accounting+stp）がある場合は置換せず手動判断（原則、そういう混在はaccounting配下にはもう無いはず）
4. 型チェック・ビルド・コミット

**検証項目**:
- [ ] accounting配下の全actionsが新ヘルパーを使っている
- [ ] 機能が従来通り動く（Phase 7 のスモークテストで確認）

#### Phase 7: 最終検証＋スモークテスト＋ドキュメント更新

**手順**:
1. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / `docker compose exec app npx next build`
2. §8 のスモークテストチェックリストを**全項目実行**
3. README・CLAUDE.md・docs を更新（ディレクトリ構造・権限ヘルパーの使い分け）
4. コミット: "docs: finance/accounting 分離に伴うドキュメント更新"
5. Codex に最終レビュー依頼

---

## 7. 各Phase終了時の検証手順

### 7.1 必須チェック（全Phase共通）

```bash
# 1. 型チェック（ローカル）
npx tsc --noEmit

# 2. Prisma Client 再生成（Docker内）
docker compose exec app npx prisma generate

# 3. Next.js ビルド（Docker内）
docker compose exec app npx next build

# 4. ESLint 警告確認
npx eslint src/ --max-warnings 0
```

すべてゼロエラー・ゼロ警告を確認してからコミット。

### 7.2 grep による漏れ確認

各Phase終了時に、移動した旧パスが残っていないことを確認：

```bash
# Phase 1 終了後
grep -rn "@/app/accounting/changelog" src/

# Phase 2 終了後
grep -rn "@/app/accounting/comments" src/

# Phase 3 終了後
grep -rn "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions)" src/

# Phase 4 終了後
grep -rn "@/app/accounting/transactions/(transaction-form|transaction-status-badge|allocation-confirmation-panel)" src/

# Phase 5 終了後
grep -rn "@/app/accounting/expenses" src/

# Phase 6 終了後（accounting/ 配下で旧ヘルパーが残っていないこと）
grep -rn "requireStaffWithProjectPermission" src/app/accounting/
```

該当行が0件（または意図した例外のみ）であることを確認。

---

## 8. スモークテストチェックリスト（Phase 7）

実装完了後、ステージングで以下を**全項目**手動確認する。型チェック・ビルドが通っても、機能が壊れていないかは別問題。

### 8.1 STPプロジェクト側（プロジェクトスタッフが担当するフロー）

- [ ] `/stp/finance/billing` が開く
- [ ] 売上トラッカーで「取引化する」ボタンを押すと取引が作成される
- [ ] `/stp/finance/invoices`（請求管理）に移動できる
- [ ] 「未処理の取引」タブに作成した取引が表示される
- [ ] 取引の「詳細」ボタンでプレビューモーダルが開き、**取引データが表示される**（← 今回のきっかけバグ）
- [ ] プレビューモーダルから「詳細ページ」で `/stp/finance/transactions/[id]` に遷移、データ表示
- [ ] 取引編集フォームで値を変更できる
- [ ] 取引を確定できる
- [ ] **コメント欄に既存コメントが表示される・新規投稿できる**（← 今回のバグ）
- [ ] **変更履歴タブに履歴が表示される**（← 今回のバグ）
- [ ] 請求グループ作成モーダルで請求グループを作成できる
- [ ] 請求グループ詳細モーダルを開くと、**按分警告が正しく表示される**（← 今回のバグ）
- [ ] 請求グループに取引を追加・削除できる
- [ ] 請求書PDFをプレビューできる
- [ ] 支払管理（`/stp/finance/payment-groups`）で支払グループを作成できる
- [ ] 支払グループに経費取引を追加できる
- [ ] 支払グループのコメント・変更履歴が見える

### 8.2 STP/HOJO/SLPの経費申請（プロジェクトスタッフが経費を申請するフロー）

- [ ] `/stp/expenses/new` ページが**開ける**（← 今回のバグ）
- [ ] 経費フォームで申請できる
- [ ] 定期取引タブが表示される
- [ ] 月別サマリータブが表示される
- [ ] `/hojo/expenses/new` で同様の確認
- [ ] `/slp/expenses/new` で同様の確認

### 8.3 経理側（経理スタッフが担当するフロー）

- [ ] `/accounting` ダッシュボードが表示される
- [ ] `/accounting/transactions` 一覧が表示される
- [ ] `/accounting/transactions/new` で新規作成できる
- [ ] `/accounting/transactions/[id]/edit` で編集できる
- [ ] `/accounting/journal` 仕訳一覧が表示される
- [ ] 仕訳を作成・編集・確定できる
- [ ] `/accounting/reconciliation` 入出金消込が動く
- [ ] `/accounting/monthly-close` 月次締めが動く
- [ ] `/accounting/cashflow` キャッシュフローが表示される
- [ ] `/accounting/batch-complete` 一括完了が動く
- [ ] `/accounting/workflow` 承認ワークフローが動く
- [ ] `/accounting/bank-transactions` 銀行取引が表示される
- [ ] `/accounting/invoice-check` 請求書チェックが動く
- [ ] `/accounting/masters/*` 各マスタ画面が動く
- [ ] `/accounting/expenses/new` 経理の経費申請ページが開ける

### 8.4 権限境界の確認（可能なら、経理権限なしのSTPスタッフアカウントで検証）

- [ ] 経理専用画面（`/accounting/journal` 等）にアクセスすると権限エラー
- [ ] プロジェクト側画面（`/stp/finance/*`）は全て操作可能
- [ ] `/accounting/transactions/[id]/edit` など経理用URLは権限エラー

### 8.5 共通機能の権限境界

- [ ] 経理スタッフは `/stp/finance/transactions/[id]` にもアクセスできる（取引詳細は共通機能）
- [ ] STPスタッフは `/stp/finance/transactions/[id]` にアクセスできる
- [ ] ファウンダー・システム管理者はすべてアクセスできる

---

## 9. ロールバック手順

### 9.1 Phase実行中の問題発生時

各Phase末でコミットしているので、直前の状態に戻すのは容易：

```bash
# 直前のコミットに戻す
git reset --hard HEAD~1

# 複数Phase前に戻す
git log --oneline -10        # コミット履歴確認
git reset --hard <commit-sha>  # 戻したい時点のshaを指定
```

### 9.2 Phase 7完了後に問題発覚した場合

ブランチごと破棄して main から再開：

```bash
git checkout main
git branch -D refactor/finance-accounting-split
```

mainは一切変更していないので損失ゼロ。

### 9.3 本番反映後に問題発覚した場合

VPS上で前バージョンの Docker イメージに切り戻し：
- stg: `~/deploy-stg.sh --rollback`（要手順確認）
- prod: 既知の復元手順（`docker-compose.prod.yml` の image タグを前バージョンに戻して再起動）
- 最悪DB復元: CLAUDE.md の DB復元手順

---

## 10. リスクと対策

### 10.1 想定リスクと緩和策

| # | リスク | 影響度 | 緩和策 |
|---|--------|--------|--------|
| 1 | Phase 中の import 更新漏れで型エラー | 中 | 各Phaseで `grep -rn` による漏れ確認必須 |
| 2 | 循環 import の発生（`finance/changelog` ← `finance/transactions` ← `finance/changelog`） | 中 | Phase 1で changelog を先に移動することで、transactions 移動時には既に絶対パス import になっている |
| 3 | `"use server"` 指令の消失による実行時エラー | 高 | `git mv` で移動するので内容は変わらない。移動後に各ファイル冒頭を目視確認 |
| 4 | Next.js Server Actions のバンドリングエラー | 中 | 各Phaseで `next build` を実行。エラー時はPhase分解を見直す |
| 5 | Prisma Client の stale cache による実行時エラー | 中 | 各Phaseで `docker compose exec app npx prisma generate` & `docker compose restart app` を実行 |
| 6 | 権限ヘルパー置換で既存の「accounting+stp」の OR 条件を潰してしまう | 高 | §5.4 で「配列に複数要素がある場合は置換しない」と明記。手動判断 |
| 7 | `accounting/transactions/new/page.tsx`（経理用新規作成）が `createAccountingTransaction` を使う → finance/transactions/actions.ts 内の関数だが権限は accounting 必須 → ヘルパーの使い分けで吸収 | 中 | §5.5 の判断困難リストに含め、実装時に明示的に区別 |
| 8 | 他セッションが main に先に push → rebase 発生 | 低 | Phase 間で `git fetch && git rebase origin/main` を実施 |
| 9 | 実装中にユーザーが別の修正を依頼 → 割り込み | 低 | Phase完了までは割り込みを避ける旨を事前合意 |
| 10 | Codex レビューで設計の根本見直しが必要と判断される | 中 | **計画MDの段階でレビューするので、実装前に気づける** |

### 10.2 特に注意すべきポイント

#### (a) `changelog/actions.ts` の `recordChangeLog` 内部関数
- これは多くの actions から同期的に呼ばれる内部関数で、権限チェックを持たない
- 移動後も権限チェック不要（呼び出し元で既にチェック済み）
- 関数シグネチャを絶対に変えないこと

#### (b) `accounting/transactions/actions.ts` の「Accounting」接頭辞関数
- `getAccountingTransactions`・`createAccountingTransaction`・`getAccountingTransactionFormData`
- これらは経理用の特殊バージョン（経理専用フィルタ・経理専用フォームデータ）
- 移動先は同じ `finance/transactions/actions.ts` で良いが、**権限だけ `requireStaffForAccounting` にする**
- あるいは将来的には `accounting/transactions/actions.ts` に分離する選択肢もあり（Codexレビューで相談）

#### (c) 相対 import の罠
- `"./actions"` のような相対 import は git mv では壊れない（同じディレクトリなら）
- ただし `"../changelog/actions"` のような親を跨ぐ相対 import は壊れる
- 移動前に `grep -rn "\.\./changelog\|\.\./comments\|\.\./transactions\|\.\./expenses" src/app/accounting/` で事前確認

#### (d) Next.js 15 / Turbopack のキャッシュ
- ファイル移動後は **必ず** `docker compose restart app` を実行（CLAUDE.mdの運用ルールどおり）

---

## 11. 完了基準（Definition of Done）

以下がすべて✅になった時点で完了とする：

- [ ] `src/app/finance/` が新設され、§5.1 の全ファイルが移動済み
- [ ] `src/app/accounting/` には §5.1 の「accountingに残すもの」のみが残っている
- [ ] `src/lib/auth/staff-action.ts` に `requireStaffForFinance`・`requireStaffForAccounting` が追加されている
- [ ] §5.2 の cross-project import 18箇所が全て新パスに更新されている
- [ ] accounting 内部の相対／絶対 import も全て新パスに更新されている
- [ ] `grep -rn "@/app/accounting/(changelog|comments|transactions/actions|transactions/allocation|transactions/transaction-form|transactions/transaction-status-badge|expenses/new)" src/` が0件
- [ ] `requireStaffWithProjectPermission` の直接呼び出しが `src/app/finance/`・`src/app/accounting/` 配下から消えている（例外は個別判断）
- [ ] `npx tsc --noEmit` エラーゼロ
- [ ] `docker compose exec app npx next build` 成功
- [ ] `npx eslint src/ --max-warnings 0` 警告ゼロ
- [ ] §8 のスモークテスト項目がすべて✅
- [ ] ドキュメント（CLAUDE.md・README等）更新
- [ ] Codex による最終レビューで Critical/Major 指摘が0件、または全て修正済み

---

## 12. 付録

### 12.1 参考: 現状の統計（Codex共有用）

- accounting 配下の全ファイル: **100個**
- actions.ts ファイル数: **27個**
- 権限チェック実装済み actions: **13個**
- cross-project import 数: **18個**（STP: 15, HOJO: 1, SLP: 1）
- 共有UIコンポーネント: **4個**（CommentSection, ChangeLogSection, TransactionForm, TransactionStatusBadge）
- API Routes: **14個**
- `changelog/actions.ts` への依存: accounting内 8個のactionsから参照（中心ハブ）

### 12.2 参考: 既知の引き続き残す設計課題（本計画のスコープ外）

- 各STP finance の `actions.ts` には `requireStaff...` 系の権限チェックが無い（過剰に緩い）。将来のセキュリティレビュー課題として記録
- API Routes の `authorizeApi([{project:"stp"},{project:"accounting"}])` パターンを `authorizeApiForFinance()` 等の共通ヘルパーに統一（優先度低）
- `InvoiceGroup`・`PaymentGroup` のServer Actions は現状 `src/app/stp/finance/invoices/`・`.../payment-groups/` 配下にあるが、HOJO等でも使いたくなったら `src/app/finance/invoice-groups/`・`.../payment-groups/` に移動する（将来課題）

### 12.3 Codex への依頼文テンプレート（参考）

**計画レビュー依頼（Phase 0 開始前）**:

```
以下は、Next.js 15 App Router + Prisma の Stella CRM プロジェクトで、
経理モジュールを「経理専用」と「プロジェクト横断共通」に分離する大規模リファクタリング計画です。

現状、経理モジュールの Server Actions に無差別に「経理権限必須」のチェックが追加された結果、
STP/HOJO/SLP等のプロジェクト側スタッフが共通機能（取引・コメント・変更履歴・経費申請）に
アクセスできなくなるバグが多発しました。

この計画書（添付）をレビューし、以下の観点から問題点・改善案を指摘してください：

1. アーキテクチャの妥当性（§2・§3）
2. 権限ヘルパーの設計（§4）
3. 移動対象ファイルのマッピング（§5）
4. 段階的実装計画の妥当性（§6）
5. 検証手順（§7・§8）のカバレッジ
6. ロールバック手順（§9）
7. リスクと対策（§10）の見落とし

特に、§5.5「判断困難リスト」の各ファイルについて、Codex側の判断を聞きたいです。
```

**最終コードレビュー依頼（Phase 7 完了後）**:

```
上記の計画書（添付）に基づいて実装した変更をレビューしてください。

- 計画書と実装の乖離
- Phase単位での変更の妥当性
- 権限チェックの漏れ・過不足
- 型エラー・ビルドエラーの隠蔽箇所
- スモークテストでカバーされない潜在バグ
- パフォーマンスリグレッションの可能性
```

---

**END OF PLAN**
