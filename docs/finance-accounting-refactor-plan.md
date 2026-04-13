# 経理モジュール分離リファクタリング計画書（A案）— v2

**作成日**: 2026-04-13
**改訂日**: 2026-04-13（Codexレビュー反映）
**対象ブランチ**: `refactor/finance-accounting-split`
**対象コミット起点**: `bd0839a`（main）
**Next.js バージョン**: 16.1.6
**レビュー履歴**:
- v1: 初版 → Codex 1次レビュー（10件指摘）
- **v2: Codex指摘を全件反映 ← 現在ここ**
- 次: Codex 2次レビュー → 実装 → Codex 最終コードレビュー

---

## 📌 v1 → v2 の主な変更点（Codex指摘への対応）

| # | Codex指摘 | v2での対応 |
|---|----------|-----------|
| Critical | 権限チェックが project を跨いでザル（STP staff が HOJO データを ID直叩きで読める） | **§4.3 を新設**：レコード単位の所属PJ検証ヘルパー（`requireFinanceTransactionAccess` 等）を導入。全 finance Server Action がこれを使う |
| Major | 経理スタッフが `/stp/...` URLを開ける想定は middleware で成立しない | **§4.4 で URL 境界を明示**：プロジェクト staff は `/{project}/`、accounting staff は `/accounting/`。**コードのみ共通、URLは分離**。§8.5 のスモーク項目も修正 |
| Major | accounting 専用 actions を `finance/` に同居させると分離意図が崩れる | **§3.1 / §5.1 修正**：`accounting/transactions/accounting-actions.ts` 等に最初から物理分離 |
| Major | Phase 3 (actions) と Phase 4 (UI) を分けると dangling import で壊れる | **§6 で Phase 3+4 を統合**（Phase 6個に削減） |
| Major | `grep -rn "(a\|b\|c)"` は `-E` 無しだと動かず false zero | **§7.2 で `rg -n` に統一** |
| Major | InvoiceGroup/PaymentGroup の扱いが §2.1 と §12.2 で矛盾 | **§2.1 修正**：今回のスコープから明示的に除外 |
| Major | DoD（§11）の文言が §3.1 の目標構造と矛盾 | **§11 文言修正** |
| Minor | Phase 0 受け入れ条件が STP のみ | **HOJO/SLP も追加** |
| Minor | `git reset --hard` ロールバックが危険 | **§9 で SHA記録 + `git revert` ベース**に変更 |
| Minor | マッピング表に `src/lib/attachments/actions.ts`・`src/app/notifications/actions.ts` の漏れ | **§5.3 に追加** |
| 補足 | Next.js バージョンは 15 ではなく 16.1.6 | **本書冒頭 + §10 で修正、Turbopack/`.next` キャッシュ等のリスクを追記** |
| 補足 | 権限回帰テスト4ケース推奨 | **§8.4 に明記** |

---

## 📌 この計画書の読み方（最重要）

この計画書は、**Claude Code が実装する前に** Codex へ2次レビュー依頼するための最終設計図です。以下の観点でレビューしてください：

1. **アーキテクチャの妥当性**（§2・§3）：3層構造の切り分けは正しいか
2. **権限ヘルパーの設計**（§4）：エントリ判定とレコード判定の二段構成は妥当か、抜け道はないか
3. **移動対象ファイルのマッピング**（§5）：共通／経理専用の振り分けに誤りはないか
4. **段階的実装計画の妥当性**（§6）：Phase の順序・依存関係は正しいか
5. **検証手順**（§7・§8）：型チェック・ビルド・スモークテスト・権限回帰テストのカバレッジは十分か
6. **ロールバック手順**（§9）：各Phaseで問題が起きたときの切り戻しが機能するか
7. **リスクと対策**（§10）：Next.js 16.1.6 固有のリスクを含めて見落としはないか

---

## 1. 背景と目的

### 1.1 直接の契機

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

### 1.2 既存のセキュリティホール（v2で新規認識）

Codex 1次レビューで判明した**追加の課題**：
現状の権限チェック（accounting view 必須）でも、**プロジェクト跨ぎ閲覧の防止になっていない**。例えば「accounting view を持つユーザー」は誰でも全プロジェクトの取引を `transactionId` 直叩きで読める。さらに私の前回の暫定修正（`getTransactionById` を stp/hojo/srd/slp も view で通すように拡張）で、**STP staff が HOJO の取引IDを直叩きで読める状態**が生じている。

このため本リファクタリングでは、**ディレクトリ分離と同時にレコード単位の所属PJ検証**も実装する（§4.3）。

### 1.3 根本原因

現状は `src/app/accounting/` 配下に **「経理専用」と「プロジェクト横断で共通利用」の機能が混在**している。このため：

- 関数を書くたびに「誰が使える関数か」を人間が毎回考えて権限チェックを書く必要がある
- 新プロジェクトを追加するたびに権限配列の更新漏れが発生
- 今回のような大規模リファクで機能が全断する事故が起こりやすい
- レコード単位の所属PJ検証も、一貫した実装パターンがなく漏れやすい

### 1.4 目的

この3層構造をディレクトリレベルで物理的に分離し、以下を達成する：

1. **権限ルールの明確化**: ディレクトリ単位で権限境界が定義される
2. **将来の拡張性**: 新プロジェクト追加時は `src/app/{newproject}/` だけ増やせば良い
3. **同種事故の再発防止**: 共通機能を「経理専用の権限チェック」で守る構造を物理的に不可能にする
4. **可読性向上**: ディレクトリ名から誰が使える機能かが一目で分かる
5. **プロジェクト跨ぎ閲覧の防止**: レコード単位の所属PJ検証を共通基盤化（v2追加）

---

## 2. 設計原則

### 2.1 三層の定義（v2: スコープを明確化）

| 層 | 場所 | 誰が使う | 典型的な機能 |
|----|------|----------|--------------|
| **プロジェクト固有** | `src/app/{stp,hojo,slp,srd,...}/finance/` | そのプロジェクトのスタッフ | 自動生成ロジック（契約→売上、応募→報酬、補助金→経費）、トラッカーUI、プロジェクト固有テーブル、**InvoiceGroup/PaymentGroup の CRUD（現状はSTPのみ）** |
| **プロジェクト横断共通** | `src/app/finance/`（★新設） | 全プロジェクト＋経理 | **Transaction の CRUD・確定・差し戻し**、コメント、変更履歴、経費申請フォーム |
| **経理専用** | `src/app/accounting/` | 経理スタッフのみ | 仕訳、入出金消込、月次締め、キャッシュフロー、経理ダッシュボード、承認ワークフロー、各種マスタ、**accounting専用の取引取得・経費取得関数** |

### 2.2 ⚠️ 今回スコープ外（v2明確化）

以下は今回のリファクタリングでは**移動しない**：

- **`src/app/stp/finance/invoices/`（InvoiceGroup CRUD）**: 現状STP専用。HOJO等で必要になった時点で `src/app/finance/invoice-groups/` に移動する（将来課題）
- **`src/app/stp/finance/payment-groups/`（PaymentGroup CRUD）**: 同上
- **API Routes の権限ヘルパー統一**（`authorizeApiForFinance` 等の導入）: 既存の `authorizeApi([...])` 配列形式のまま維持

これらを今回スコープに含めない理由：
- リファクタの目的（共通機能のSTP以外への解放）に対し、現状 STP 専用機能であるInvoiceGroup/PaymentGroupは追加移動価値が小さい
- スコープを最小化して、Phase ごとの検証可能性を高めるため

### 2.3 分離の判定基準

あるファイル／関数を **共通（finance）** に置くか **経理専用（accounting）** に置くかは、次のテストで決める：

> **Q**: そのファイル／関数は、STP・HOJO・SLP・SRD等のプロジェクト側スタッフが（経理権限を持たなくても）使う必要があるか？
>
> - **Yes** → `src/app/finance/`
> - **No、経理スタッフだけが使う** → `src/app/accounting/`
> - **判断困難** → §5.5 の Codex 判定済みリストを参照

### 2.4 Next.js App Router 上の扱い

- `src/app/finance/` には **`page.tsx` を置かない**（URLルートにしない）。純粋に Server Actions と共有UIコンポーネントの置き場
- URLルート（ユーザーが画面でアクセスする`/accounting/xxx`・`/stp/xxx`等）はすべて既存位置を維持する → **URLの破壊的変更なし**
- `/stp/finance/transactions/[id]` 等、既存のSTP側ルートはそのままで、内部で `@/app/finance/transactions/actions` を import する形に書き換える

### 2.5 Server Actions の `"use server"` 運用

- 移動後も `"use server"` 指令は各 actions.ts の先頭で維持
- `git mv` を使ってファイル内容そのものは変えない
- ただし Next.js 16.1.6 では Turbopack・`.next` キャッシュの影響を受けやすいため、移動後は **必ず** `docker compose restart app` を実行（CLAUDE.md ルール準拠）

---

## 3. 目標ディレクトリ構造（After）

### 3.1 全体像（v2: 経理専用ファイルの物理分離を反映）

```
src/app/
│
├── finance/                          ★ NEW: プロジェクト横断共通レイヤー（page.tsxなし）
│   ├── transactions/
│   │   ├── actions.ts                ← 共通: 取引CRUD・確定・差し戻し（accountingバージョン除く）
│   │   ├── allocation-actions.ts     ← 按分計算・確定（共通）
│   │   ├── allocation-group-item-actions.ts
│   │   ├── transaction-form.tsx      ← 共有UI
│   │   ├── transaction-status-badge.tsx
│   │   └── allocation-confirmation-panel.tsx (要§5.5判定 → accounting残留)
│   ├── comments/
│   │   ├── actions.ts                ← コメントCRUD
│   │   └── comment-section.tsx       ← コメント表示UI
│   ├── changelog/
│   │   ├── actions.ts                ← 変更履歴CRUD
│   │   ├── changelog-section.tsx     ← 変更履歴表示UI
│   │   └── log-fields.ts             ← ログ対象フィールド定義
│   └── expenses/
│       ├── actions.ts                ← 共通: 経費申請フォーム・承認
│       ├── manual-expense-form.tsx
│       └── expense-page-client.tsx   ← mode="accounting"|"project" 共通
│
├── accounting/                       ★ 経理専用だけを残す（既存大半は不変）
│   ├── page.tsx                      (不変)
│   ├── verification/                 (不変)
│   ├── imports/                      (不変)
│   ├── dashboard/                    ← 経理ダッシュボード
│   ├── journal/                      ← 仕訳
│   ├── reconciliation/               ← 入出金消込
│   ├── monthly-close/                ← 月次締め
│   ├── cashflow/                     ← キャッシュフロー予測
│   ├── batch-complete/               ← 一括完了
│   ├── workflow/                     ← 経理承認ワークフロー
│   ├── invoice-check/                ← 請求書チェック
│   ├── bank-transactions/            ← 銀行取引インポート
│   ├── usdt-rates/                   ← USDTレート管理
│   ├── settings/                     ← 経理設定
│   ├── budget/                       ← 予算管理
│   ├── masters/                      ← 各種マスタ
│   ├── transactions/                 ← 経理用ページのみ残る
│   │   ├── page.tsx                  ← 経理用一覧
│   │   ├── new/page.tsx              ← 経理用新規作成
│   │   ├── [id]/edit/page.tsx        ← 経理用編集
│   │   ├── transactions-table.tsx    ← 経理用テーブル
│   │   ├── transaction-status-actions.tsx
│   │   ├── allocation-confirmation-panel.tsx ← Codex判定で残留
│   │   └── accounting-actions.ts     ★ NEW: 経理専用Server Actions
│   │                                   getAccountingTransactions
│   │                                   createAccountingTransaction
│   │                                   getAccountingTransactionFormData
│   └── expenses/
│       ├── new/page.tsx              ← 経理用エントリ（finance/expensesを利用）
│       └── accounting-actions.ts     ★ NEW: 経理専用
│                                       getAllRecurringTransactions
│
├── stp/finance/                      (不変、importパスのみ更新)
├── stp/expenses/                     (不変、importパスのみ更新)
├── hojo/expenses/                    (不変、importパスのみ更新)
└── slp/expenses/                     (不変、importパスのみ更新)
```

### 3.2 URLルートは変更なし（v2: 中身を明確化）

この構造変更は**ユーザー体験には一切影響しない**（URLは全て既存のまま）。

ただし v2 で重要なのは **URL境界の遵守**：

| 利用者 | 開けるURL | 開けないURL（middlewareで弾かれる） |
|--------|-----------|-----------------------------------|
| 経理スタッフ（accounting view 持ち） | `/accounting/*` | `/stp/*`、`/hojo/*`、`/slp/*` |
| STPスタッフ（stp view 持ち） | `/stp/*` | `/accounting/*`、`/hojo/*`、`/slp/*` |
| HOJOスタッフ | `/hojo/*` | `/accounting/*`、`/stp/*`、`/slp/*` |
| ファウンダー・システム管理者 | 全URL | なし（middlewareで全バイパス） |

**コードは共通でもURLは分離**するのが本リファクタの設計思想。

---

## 4. 権限ヘルパー設計（v2: 二段構成に拡張）

### 4.1 設計方針：エントリ判定 + レコード判定の二段構成

Codex指摘により、権限チェックを **2層** に分ける：

1. **エントリ判定**（既存路線・file単位の粗い境界）
   - その関数を**呼べる立場のユーザーか**を判定（経理 or 任意PJ staff）
   - DBアクセスなし、引数だけで判断

2. **レコード判定**（v2新規・データ単位の細かい境界）
   - **そのユーザーが、その特定レコードにアクセスしてよいか**を判定
   - DB から対象レコードを引き、所属プロジェクトを確認

`src/app/finance/` 配下の Server Actions では、**両方を呼ぶ**または**レコード判定だけを呼ぶ**（レコード判定が内部でstaff判定も行う）。

### 4.2 エントリ判定ヘルパー（`src/lib/auth/staff-action.ts` に追加）

```typescript
/**
 * プロジェクト横断の財務機能を呼ぶための「入口の」権限チェック。
 *
 * 経理プロジェクトの level 以上、または任意の事業プロジェクト
 * （stp/hojo/srd/slp/stella）の level 以上を持っていれば通る。
 *
 * ⚠️ これは "誰でも入れる" レベルの粗い門番です。実際にレコードへ
 * アクセスする時は §4.3 の per-record helper を必ず併用してください。
 *
 * 使用場所: src/app/finance/ 配下の Server Actions の入口（recordIdを取らない関数のみ）
 */
export async function requireStaffForFinance(
  level: PermissionLevel = "view"
): Promise<SessionUser>;

/**
 * 経理専用機能（仕訳・消込・月次締め・キャッシュフロー等）を呼ぶための権限。
 *
 * 経理プロジェクトの指定レベル以上を持っていれば通る。事業プロジェクト側の権限は通らない。
 *
 * 使用場所: src/app/accounting/ 配下の全 Server Actions
 *           （/transactions/accounting-actions.ts, /expenses/accounting-actions.ts 含む）
 */
export async function requireStaffForAccounting(
  level: PermissionLevel = "view"
): Promise<SessionUser>;
```

### 4.3 レコード判定ヘルパー（`src/lib/auth/finance-access.ts` に新設）★v2 NEW

```typescript
import { prisma } from "@/lib/prisma";
import { hasPermission, isFounder, isSystemAdmin } from "@/lib/auth";
import { requireStaff } from "./staff-action";
import type { SessionUser, PermissionLevel, ProjectCode } from "@/types/auth";

type ProjectScopedRecord = {
  id: number;
  projectId: number | null;
  project: { code: string } | null;
};

/**
 * Transaction レコードへのアクセス可否を判定する。
 *
 * 通すケース:
 * - ファウンダー / システム管理者
 * - 経理プロジェクトで指定 level 以上
 * - レコードの projectId に対応する事業プロジェクトで指定 level 以上
 *
 * 弾くケース:
 * - 上記いずれにも該当しない（例: STP staff が HOJO の取引IDを叩いた）
 * - レコード自体が存在しない（404相当）
 *
 * 戻り値: { user, transaction } — 後続処理で再フェッチを省くため
 */
export async function requireFinanceTransactionAccess(
  transactionId: number,
  level: PermissionLevel = "view"
): Promise<{
  user: SessionUser;
  transaction: ProjectScopedRecord & { /* 必要に応じて他フィールド */ };
}>;

/**
 * InvoiceGroup レコードへのアクセス可否を判定する。
 * Transaction と同じロジックで、対象テーブルが InvoiceGroup。
 */
export async function requireFinanceInvoiceGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; invoiceGroup: ProjectScopedRecord }>;

/**
 * PaymentGroup レコードへのアクセス可否を判定する。
 */
export async function requireFinancePaymentGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; paymentGroup: ProjectScopedRecord }>;

/**
 * プロジェクトIDへのアクセス可否を判定する（recordIdを取らない経費系で使う）。
 *
 * 通すケース:
 * - ファウンダー / システム管理者
 * - 経理プロジェクトで指定 level 以上
 * - 指定 projectId に対応する事業プロジェクトで指定 level 以上
 */
export async function requireFinanceProjectAccess(
  projectId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; projectCode: string }>;
```

#### 4.3.1 内部ロジック（共通）

```typescript
// 擬似コード
async function checkProjectScopedAccess(record, level, user) {
  if (isSystemAdmin(user) || isFounder(user)) return true;
  if (hasPermission(user.permissions, "accounting", level)) return true;
  const projectCode = record.project?.code;
  if (projectCode && hasPermission(user.permissions, projectCode, level)) return true;
  // projectIdが null のレガシーレコード → accounting 権限のみで判定
  if (record.projectId === null && hasPermission(user.permissions, "accounting", level)) return true;
  return false;
}
```

#### 4.3.2 適用パターン例

```typescript
// 取引取得
export async function getTransactionById(id: number) {
  const { transaction } = await requireFinanceTransactionAccess(id, "view");
  return transaction;
  // ↑ 既に必要なフィールドはhelperが返しているので追加クエリ不要
  // 必要に応じて include を増やすなら、helperが返す ID をキーに別途fetch
}

// 取引更新
export async function updateTransaction(id: number, data) {
  const { user, transaction } = await requireFinanceTransactionAccess(id, "edit");
  // ... 編集処理
}

// 取引作成（recordIdを持たない → projectIdで判定）
export async function createTransaction(data: { projectId: number, ... }) {
  await requireFinanceProjectAccess(data.projectId, "edit");
  // ... 作成処理
}

// コメント取得（params.transactionId | invoiceGroupId | paymentGroupId のいずれか）
export async function getComments(params) {
  if (params.transactionId) {
    await requireFinanceTransactionAccess(params.transactionId, "view");
  } else if (params.invoiceGroupId) {
    await requireFinanceInvoiceGroupAccess(params.invoiceGroupId, "view");
  } else if (params.paymentGroupId) {
    await requireFinancePaymentGroupAccess(params.paymentGroupId, "view");
  } else {
    return [];
  }
  // ... fetch
}

// 変更履歴取得（tableName + recordId）
export async function getChangeLogs(tableName, recordId) {
  if (tableName === "Transaction") {
    await requireFinanceTransactionAccess(recordId, "view");
  } else if (tableName === "InvoiceGroup") {
    await requireFinanceInvoiceGroupAccess(recordId, "view");
  } else if (tableName === "PaymentGroup") {
    await requireFinancePaymentGroupAccess(recordId, "view");
  } else {
    // その他のテーブル（Counterparty, ExpenseCategory 等）→ 経理専用
    await requireStaffForAccounting("view");
  }
  // ... fetch
}

// 経費申請（projectIdベース）
export async function getProjectRecurringTransactions(projectId: number) {
  await requireFinanceProjectAccess(projectId, "view");
  // ... fetch
}
```

### 4.4 URL境界の方針（v2明確化）

Codex指摘どおり、middleware は URL → project マッピングを強制している（`/stp/*` には stp 権限が必要）。本リファクタでは、この境界を**変更しない**：

- **プロジェクトスタッフ（STP・HOJO・SLP・SRD）は `/{project}/...` のURLだけ使う**
- **経理スタッフは `/accounting/...` のURLだけ使う**
- **コードレベルでは Server Actions・UIコンポーネントを共有**するが、URLは共有しない

つまり：
- `/accounting/transactions/[id]/edit` → 経理用編集ページ（accounting view 必須・middleware で守られる）
- `/stp/finance/transactions/[id]` → STP用詳細ページ（stp view 必須・middleware で守られる）

両者は内部で同じ `@/app/finance/transactions/actions` を使うが、URLの権限境界はそのまま。

⚠️ **本リファクタでは middleware を一切変更しない**。

### 4.5 既存ヘルパーとの関係

| ヘルパー | 動作 | 移行方針 |
|---------|------|---------|
| `requireStaff()` | staffであることだけ確認 | 残す |
| `requireStaffWithAnyEditPermission()` | いずれかのPJで edit 以上 | 残す |
| `requireStaffWithProjectPermission([...])` | 指定配列の OR で評価 | **v2 以降、accounting/finance 配下では原則使わない** |
| **`requireStaffForFinance()`** ★新設 | 経理 OR 事業PJ の view 以上 | `src/app/finance/` の入口で限定的に使用 |
| **`requireStaffForAccounting()`** ★新設 | 経理のみ | `src/app/accounting/` 配下で使用 |
| **`requireFinance{Transaction\|InvoiceGroup\|PaymentGroup\|Project}Access()`** ★新設 | レコード単位の所属PJ検証 | `src/app/finance/` の actions で **必須**使用 |

### 4.6 API Routes の扱い（v2: スコープ外確認）

`src/app/api/finance/*` 配下のAPI Routes は、`authorizeApi([{ project: "stp", level: "edit" }, { project: "accounting", level: "edit" }])` のような既存パターンを **変更しない**。

理由：
- 既に「STP edit OR accounting edit」のOR条件で動作している
- 今回のディレクトリ分離スコープ外（§2.2）
- 将来的に `authorizeApiForFinance("edit")` のような共通ヘルパーに統一する可能性はあるが、別タスク

ただし、**API Route内でprisma直接アクセスする際もレコード単位の所属PJ検証が望ましい**（既存のセキュリティホールの一つ）→ これも別タスク。

---

## 5. 移動対象ファイル マッピング表

### 5.1 `src/app/finance/` へ移動するファイル

#### 5.1.1 `finance/transactions/` 配下

| Before | After | 備考 |
|--------|-------|------|
| `src/app/accounting/transactions/actions.ts` | `src/app/finance/transactions/actions.ts` | **共通関数のみ移動**（`getAccountingTransactions`・`createAccountingTransaction`・`getAccountingTransactionFormData` は除く） |
| `src/app/accounting/transactions/allocation-actions.ts` | `src/app/finance/transactions/allocation-actions.ts` | 按分計算・確定（共通） |
| `src/app/accounting/transactions/allocation-group-item-actions.ts` | `src/app/finance/transactions/allocation-group-item-actions.ts` | 按分グループ操作（共通） |
| `src/app/accounting/transactions/transaction-form.tsx` | `src/app/finance/transactions/transaction-form.tsx` | STPも使う共有UI |
| `src/app/accounting/transactions/transaction-status-badge.tsx` | `src/app/finance/transactions/transaction-status-badge.tsx` | STPも使う共有UI |

**accountingに残すもの（v2修正：Codex判定反映）**:

| ファイル | 理由 |
|---------|------|
| `src/app/accounting/transactions/page.tsx` | 経理用取引一覧のURLルート |
| `src/app/accounting/transactions/new/page.tsx` | 経理用新規作成のURLルート |
| `src/app/accounting/transactions/[id]/edit/page.tsx` | 経理用編集のURLルート |
| `src/app/accounting/transactions/transactions-table.tsx` | 経理用テーブル（Codex判定でaccounting残留） |
| `src/app/accounting/transactions/transaction-status-actions.tsx` | 経理用ステータス操作UI（Codex判定でaccounting残留） |
| `src/app/accounting/transactions/allocation-confirmation-panel.tsx` | 経理用按分確定パネル（Codex判定でaccounting残留） |
| **`src/app/accounting/transactions/accounting-actions.ts`** ★NEW | `actions.ts` から経理専用関数3つを抽出した新ファイル |

**`accounting-actions.ts` に分離する関数**:
- `getAccountingTransactions`
- `createAccountingTransaction`
- `getAccountingTransactionFormData`

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
| `src/app/accounting/expenses/new/actions.ts` | `src/app/finance/expenses/actions.ts` | **共通関数のみ移動**（`getAllRecurringTransactions` は除く）。`new/` 階層を廃して直下に |
| `src/app/accounting/expenses/new/expense-page-client.tsx` | `src/app/finance/expenses/expense-page-client.tsx` | mode=accounting/project 両対応 |
| `src/app/accounting/expenses/new/manual-expense-form.tsx` | `src/app/finance/expenses/manual-expense-form.tsx` | Codex判定で共通化OK |

**accountingに残すもの**:

| ファイル | 理由 |
|---------|------|
| `src/app/accounting/expenses/new/page.tsx` | 経理用経費申請エントリのURLルート（`/accounting/expenses/new`）。中身は `finance/expenses` を import |
| **`src/app/accounting/expenses/accounting-actions.ts`** ★NEW | `getAllRecurringTransactions` を分離 |

### 5.2 各プロジェクト側 import パス更新一覧（19箇所、v2増加）

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
| 18 | `src/app/accounting/transactions/new/page.tsx` | `../actions` (= `accounting/transactions/actions`) | 分離後の参照に応じて修正 |
| 19 | `src/app/accounting/transactions/[id]/edit/page.tsx` | `../../actions` etc. | 分離後の参照に応じて修正 |

### 5.3 v2 で追加発見した import 箇所（Codex指摘の漏れ補完）

| # | ファイル | 現在のimport | 更新後 |
|---|----------|-------------|--------|
| 20 | `src/lib/attachments/actions.ts:5` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |
| 21 | `src/app/notifications/actions.ts:6` | `@/app/accounting/changelog/actions` | `@/app/finance/changelog/actions` |

### 5.4 accounting 内部の import パス更新

`src/app/accounting/` 内から、移動したファイルを参照している箇所も全て更新が必要。`changelog/actions.ts` は中心ハブなので特に注意。

**accounting内で import 更新が必要と想定される主要ファイル**:
- `accounting/transactions/transactions-table.tsx` → `transaction-status-badge.tsx` を参照（移動先 `finance/transactions/...` へ）
- `accounting/transactions/[id]/edit/page.tsx` → 旧 `accounting/transactions/actions` のうち、共通関数は `finance/transactions/actions`、accounting系は `accounting/transactions/accounting-actions` へ
- `accounting/transactions/new/page.tsx` → 同上
- `accounting/transactions/page.tsx` → `accounting-actions` 経由で `getAccountingTransactions` を呼ぶ
- `accounting/journal/actions.ts` → `@/app/finance/changelog/actions`
- `accounting/reconciliation/actions.ts` → 同上
- `accounting/batch-complete/actions.ts` → 同上
- `accounting/masters/counterparties/actions.ts` → 同上
- `accounting/masters/allocation-templates/actions.ts` → 同上
- `accounting/workflow/actions.ts` → 取引関連の actions を参照している可能性
- `accounting/expenses/new/page.tsx` → `@/app/finance/expenses/...` および `@/app/accounting/expenses/accounting-actions` 両方を参照
- `accounting/comments/comment-section.tsx` 内部の `./actions` → 移動後は `./actions` のまま（同ディレクトリ内）
- `accounting/changelog/changelog-section.tsx` 内部の `./actions` → 同様

**重要**: Phase 実行時には `rg -n "@/app/accounting/(transactions|comments|changelog|expenses)" src/` を実行して**漏れゼロ**を確認（v1 の plain grep は `-E` 無しで動かないため `rg` を使う）。

### 5.5 「判断困難リスト」のCodex判定（v2追記）

v1 §5.5 で挙げた6ファイルについて、Codex の判定結果：

| ファイル | Codex判定 | 理由 | v2での扱い |
|---------|----------|------|-----------|
| `accounting/transactions/allocation-confirmation-panel.tsx` | **accounting残留** | 現状 `transactions-table.tsx` からしか使われず、依存先も accounting 寄り | accountingに残す |
| `accounting/transactions/transaction-status-actions.tsx` | **accounting残留** | accounting一覧専用UI | accountingに残す |
| `accounting/transactions/transactions-table.tsx` | **accounting残留** | URL・列・操作が完全に経理一覧向け | accountingに残す |
| `src/components/finance-edit-dialog.tsx` | **今回スコープ外** | 現状未参照、判断材料なし | 触らない |
| `accounting/expenses/new/manual-expense-form.tsx` | **finance移動** | mode="accounting"|"project" を持つ共有フォーム | financeへ移動 |
| `accounting/transactions/actions.ts` 内の `getAccountingTransactions` 等 | **accounting分離** | finance に残すと設計意図が崩れる | `accounting-actions.ts` に分離 |

---

## 6. 段階的実装計画（Phase 分割）— v2: 6 Phase に削減

### 6.1 全体戦略

- **戦略**: モジュール単位で atomic に移動。**actionsとUIは同Phase内で一括**処理（Codex指摘によるPhase 3+4統合）
- **ブランチ**: `refactor/finance-accounting-split`（既に作成済み）
- **コミット粒度**: Phase ごとに 1〜2 コミット。各Phase終了時に必ず `tsc --noEmit` と `next build` を通す
- **チェックポイント**: 各Phase開始前に `git tag refactor-checkpoint-phase-N-start` でSHAを記録（ロールバック用）
- **並行作業**: 他セッションが main に push する可能性があるので、各Phase開始時に rebase を検討

### 6.2 Phase 全体像（v2: 7→6 Phaseに削減）

| Phase | 内容 | 想定コミット数 | 所要時間目安 |
|-------|------|---------------|-------------|
| **Phase 0** | 準備（権限ヘルパー2種＋per-record helpers追加、既知バグ5件先行修正） | 2 | 60分 |
| **Phase 1** | `finance/changelog/` 移動（最も多く依存される基盤） | 1 | 30分 |
| **Phase 2** | `finance/comments/` 移動 | 1 | 30分 |
| **Phase 3** | `finance/transactions/` 移動（actions + UI 一括） | 1 | 90分 |
| **Phase 4** | `finance/expenses/` 移動 | 1 | 30分 |
| **Phase 5** | per-recordチェック適用 + 旧ヘルパー置換（全ファイル一括） | 1 | 90分 |
| **Phase 6** | 最終検証＋スモークテスト＋権限回帰テスト＋ドキュメント更新 | 1 | 90分 |
| **合計** | | 8 | 約7時間 |

### 6.3 各Phaseの詳細

#### Phase 0: 準備

**目的**: 実装基盤を整える + 業務をすぐ復旧させる。

**手順**:
1. `git checkout refactor/finance-accounting-split && git pull`
2. `git tag refactor-checkpoint-phase-0-start`
3. `src/lib/auth/staff-action.ts` に新ヘルパー2つを追加（`requireStaffForFinance`・`requireStaffForAccounting`）
4. `src/lib/auth/finance-access.ts` を新設し、per-record helpers 4つを追加（`requireFinance{Transaction|InvoiceGroup|PaymentGroup|Project}Access`）
5. **既知バグの先行修正**: §1.1 の5箇所の権限チェックを暫定的に広げる（前回 `getTransactionById`・`getTransactionFormData` と同パターン）
6. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / ビルドOK確認
7. コミット 1: "feat: 権限ヘルパー新設（エントリ判定2種＋レコード判定4種）"
8. コミット 2: "fix: 既知5件の権限バグを暫定修正（STP/HOJO/SLP経費・コメント・変更履歴・按分警告）"

**受け入れ条件（v2: HOJO/SLPも追加）**:
- [ ] 新ヘルパー6つが存在し、型エラーなし
- [ ] Dockerでビルド成功
- [ ] STPで取引詳細・請求管理・コメント・変更履歴・経費申請ページが開ける
- [ ] **HOJOで経費申請ページが開ける**
- [ ] **SLPで経費申請ページが開ける**

**Note**: Phase 0 終了時点で「業務は回る」状態が達成される。以降の Phase 1-6 はゆっくり進めても業務影響なし。

#### Phase 1: `finance/changelog/` 移動

**なぜ最初か**: `changelog/actions.ts` は10個以上のactionsから依存される中心ハブ。最初に移動することで、以降のPhaseでは「changelogはもう新しい場所にある」前提で進められる。

**手順**:
1. `git tag refactor-checkpoint-phase-1-start`
2. ファイルロック取得（`accounting/changelog/*` + `finance/changelog/*`）
3. `git mv src/app/accounting/changelog src/app/finance/changelog`
4. `rg -n "@/app/accounting/changelog" src/` で呼び出し元を全列挙
5. 全呼び出し元の import パスを `@/app/finance/changelog/...` に書き換え
   - cross-project: §5.2 の #3, #7, #10, #14, #15
   - lib/notifications追加: §5.3 の #20, #21
   - accounting内部: journal, reconciliation, batch-complete, masters/counterparties, masters/allocation-templates, transactions/actions, transactions/allocation-actions, transactions/allocation-group-item-actions
6. `rg -n "from \"\.\./changelog\|from \"\.\.\/\.\.\/changelog" src/app/accounting/` で相対 importもチェック
7. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / `docker compose exec app npx next build`
8. コミット: "refactor: changelog を src/app/finance/ へ移動"

**検証項目**:
- [ ] 型エラーゼロ
- [ ] ビルド成功
- [ ] STP取引詳細画面で変更履歴セクションが表示される
- [ ] 経理取引編集画面で変更履歴セクションが表示される
- [ ] `rg -n "@/app/accounting/changelog" src/` が0件

**ロールバック**: §9 参照

#### Phase 2: `finance/comments/` 移動

**手順**:
1. `git tag refactor-checkpoint-phase-2-start`
2. ファイルロック取得
3. `git mv src/app/accounting/comments src/app/finance/comments`
4. `rg -n "@/app/accounting/comments" src/` で呼び出し元全列挙
5. 全呼び出し元のimportパスを `@/app/finance/comments/...` に書き換え
   - cross-project: §5.2 の #4, #5, #12
6. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP取引詳細のコメント欄が表示・投稿できる
- [ ] STP請求グループ・支払グループ詳細モーダルのコメント欄が表示・投稿できる
- [ ] 経理取引編集画面のコメント欄が表示・投稿できる
- [ ] `rg -n "@/app/accounting/comments" src/` が0件

#### Phase 3: `finance/transactions/` 移動（actions + UI 一括）★v2: 旧Phase 3+4 統合

**理由**: actionsだけ移動するとUIから dangling import が発生してビルドが壊れる（Codex指摘）。

**対象ファイル（一括移動）**:
- `accounting/transactions/actions.ts` → 分割：
  - `finance/transactions/actions.ts`（共通関数のみ）
  - `accounting/transactions/accounting-actions.ts`（accounting系3関数を抽出）
- `accounting/transactions/allocation-actions.ts` → `finance/transactions/allocation-actions.ts`
- `accounting/transactions/allocation-group-item-actions.ts` → `finance/transactions/allocation-group-item-actions.ts`
- `accounting/transactions/transaction-form.tsx` → `finance/transactions/transaction-form.tsx`
- `accounting/transactions/transaction-status-badge.tsx` → `finance/transactions/transaction-status-badge.tsx`

**手順**:
1. `git tag refactor-checkpoint-phase-3-start`
2. ファイルロック取得（上記5ファイル + 新規 `accounting-actions.ts`）
3. **actions.ts の分割作業**:
   - `accounting/transactions/actions.ts` の内容を読み、共通関数と accounting系関数を分離
   - 共通部分を `finance/transactions/actions.ts` として新規作成
   - accounting系3関数（`getAccountingTransactions`・`createAccountingTransaction`・`getAccountingTransactionFormData`）を `accounting/transactions/accounting-actions.ts` として新規作成
   - 旧 `accounting/transactions/actions.ts` を削除
4. `git mv` で残り4ファイルを移動
5. UIファイル内の相対import を確認・更新
6. `rg -n "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)" src/` で呼び出し元全列挙
7. 全呼び出し元のimportパスを更新（cross-project: §5.2 の #2, #4, #6, #8, #9, #11, #13）
8. accounting内の `transactions-table.tsx`, `[id]/edit/page.tsx`, `new/page.tsx` の import 更新（共通系は finance、accounting系は `./accounting-actions`）
9. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP取引化→請求管理 の一連フローが動く
- [ ] STP取引確定・確定取消・削除が動く
- [ ] 経理取引一覧（`getAccountingTransactions` 経由）が動く
- [ ] 経理取引新規作成（`createAccountingTransaction` 経由）が動く
- [ ] 経理取引編集が動く（`getAccountingTransactionFormData` 経由）
- [ ] 按分テンプレート操作が動く
- [ ] STP取引詳細画面で編集フォーム・ステータスバッジが正しく表示
- [ ] `rg -n "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)" src/` が0件

#### Phase 4: `finance/expenses/` 移動

**対象ファイル**:
- `accounting/expenses/new/actions.ts` → 分割：
  - `finance/expenses/actions.ts`（共通関数のみ）
  - `accounting/expenses/accounting-actions.ts`（`getAllRecurringTransactions` を抽出）
- `accounting/expenses/new/expense-page-client.tsx` → `finance/expenses/expense-page-client.tsx`
- `accounting/expenses/new/manual-expense-form.tsx` → `finance/expenses/manual-expense-form.tsx`

**注意**: `accounting/expenses/new/page.tsx` は**移動しない**（URL `/accounting/expenses/new` 維持）。importを書き換えるのみ。

**手順**:
1. `git tag refactor-checkpoint-phase-4-start`
2. ファイルロック取得
3. `actions.ts` の分割作業（Phase 3 と同じパターン）
4. `git mv` で残り2ファイルを移動
5. `accounting/expenses/new/page.tsx` の import を更新（共通系は `@/app/finance/expenses/`、`getAllRecurringTransactions` は `@/app/accounting/expenses/accounting-actions`）
6. `stp/expenses/new/page.tsx`・`hojo/expenses/new/page.tsx`・`slp/expenses/new/page.tsx` の import を更新（§5.2 の #1, #16, #17）
7. 型チェック・ビルド・コミット

**検証項目**:
- [ ] STP/HOJO/SLP の経費申請ページが開ける・登録できる
- [ ] 経理の経費申請ページが開ける・登録できる
- [ ] 経理用「全プロジェクト定期取引」タブが表示される（`getAllRecurringTransactions`）
- [ ] `rg -n "@/app/accounting/expenses" src/` が0件

#### Phase 5: per-recordチェック適用 + 旧ヘルパー置換（全ファイル一括）★v2: 大幅拡張

**目的**:
1. `finance/` 配下の全 Server Action に **per-record アクセスチェック** を適用（Critical指摘対応）
2. `accounting/` 配下の全 actions.ts で `requireStaffWithProjectPermission([{ project: "accounting", ... }])` を `requireStaffForAccounting(level)` に置換
3. Phase 0 で施した「既知バグ5件の暫定修正」を、本格的な per-record チェックで置き換え

**手順**:
1. `git tag refactor-checkpoint-phase-5-start`
2. **finance/transactions/actions.ts の権限チェック書き換え**:
   - `getTransactionById(id)` → `requireFinanceTransactionAccess(id, "view")`
   - `updateTransaction(id, ...)` → `requireFinanceTransactionAccess(id, "edit")`
   - `confirmTransaction(id)` → `requireFinanceTransactionAccess(id, "edit")`
   - `unconfirmTransaction(id)` → 同上
   - `returnTransaction(id, ...)` → 同上
   - `resubmitTransaction(id, ...)` → 同上
   - `submitToAccountingTransaction(id)` → 同上
   - `deleteTransaction(id)` → 同上
   - `hideTransaction(id)` → `requireStaffForAccounting("edit")` （経理操作なので例外）
   - `createTransaction(data)` → `requireFinanceProjectAccess(data.projectId, "edit")`
   - `getTransactionFormData()` → `requireStaffForFinance("view")` （フォームメタデータ取得、project縛りなし）
   - `isMonthClosed(...)` → `requireFinanceProjectAccess(projectId, "view")`
3. **finance/transactions/allocation-actions.ts の権限チェック書き換え**:
   - 取引ID/グループIDを取る関数 → 該当の per-record helper
   - 引数なしの helper関数 → `requireStaffForFinance("view")`
4. **finance/transactions/allocation-group-item-actions.ts の権限チェック書き換え**:
   - `getGroupAllocationWarnings(groupType, groupId)` → groupType に応じて `requireFinance{Invoice|Payment}GroupAccess(groupId, "view")`
   - 同様に他の関数も per-record チェック適用
5. **finance/comments/actions.ts の権限チェック書き換え**:
   - `getComments(params)` → params.transactionId/invoiceGroupId/paymentGroupId に応じて per-record helper
   - `createComment(input)` → 同様にエンティティに応じて per-record helper
6. **finance/changelog/actions.ts の権限チェック書き換え**:
   - `getChangeLogs(tableName, recordId)` → tableName に応じて per-record helper
   - `getChangeLogsForTransaction(transactionId)` → `requireFinanceTransactionAccess(transactionId, "view")`
   - `recordChangeLog` は内部関数なので権限チェックなし（既存通り）
7. **finance/expenses/actions.ts の権限チェック書き換え**:
   - `getExpenseFormData(projectId)` → `requireFinanceProjectAccess(projectId, "view")`
   - `submitExpenseRequest(...)` → `requireFinanceProjectAccess(data.projectId, "edit")`
   - `getMyExpenses(projectId)` → `requireFinanceProjectAccess(projectId, "view")`
   - `getPendingApprovals(projectId)` → 同上
   - `getProjectRecurringTransactions(projectId)` → 同上
   - `getMonthlyExpenseSummary(projectId)` → 同上
   - `approveByProjectApprover(groupId)` → `requireFinancePaymentGroupAccess(groupId, "edit")` (or approval-specific scope)
   - `rejectByProjectApprover(groupId, ...)` → 同上
8. **accounting/ 配下の全 actions.ts** で `requireStaffWithProjectPermission([{ project: "accounting", level: "xxx" }])` を `requireStaffForAccounting("xxx")` に一括置換
   - 配列に複数要素がある場合は手動判断（残す）
9. 型チェック・ビルド・コミット

**検証項目**:
- [ ] §8 のスモークテスト全項目
- [ ] §8.4 の権限回帰テスト4ケース全パス

#### Phase 6: 最終検証＋スモークテスト＋ドキュメント更新

**手順**:
1. `git tag refactor-checkpoint-phase-6-start`
2. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / `docker compose exec app npx next build`
3. `npx eslint src/ --max-warnings 0`
4. §8 のスモークテストチェックリストを**全項目実行**
5. §8.4 の権限回帰テスト4ケースを実行
6. README・CLAUDE.md・docs を更新（ディレクトリ構造・権限ヘルパーの使い分け）
7. コミット: "docs: finance/accounting 分離に伴うドキュメント更新"
8. Codex に最終コードレビュー依頼

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

### 7.2 grep による漏れ確認（v2: rg に統一）

各Phase終了時に、移動した旧パスが残っていないことを確認。**`rg -n` を使う**（plain grep の `-E` 漏れによる false zero を防ぐ）：

```bash
# Phase 1 終了後
rg -n "@/app/accounting/changelog" src/

# Phase 2 終了後
rg -n "@/app/accounting/comments" src/

# Phase 3 終了後
rg -n "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)" src/

# Phase 4 終了後
rg -n "@/app/accounting/expenses" src/

# Phase 5 終了後（accounting/ 配下で旧ヘルパーが残っていないこと）
rg -n "requireStaffWithProjectPermission" src/app/accounting/
rg -n "requireStaffWithProjectPermission" src/app/finance/
```

該当行が0件（または意図した例外のみ）であることを確認。

### 7.3 開発サーバー再起動（Phase終了ごと）

CLAUDE.md ルール準拠。Next.js 16.1.6 / Turbopack キャッシュをクリアするため：

```bash
docker compose restart app
# 必要に応じて .next ディレクトリも削除
docker compose exec app rm -rf .next
docker compose restart app
```

---

## 8. スモークテストチェックリスト（Phase 6）

実装完了後、ステージングで以下を**全項目**手動確認する。

### 8.1 STPプロジェクト側（プロジェクトスタッフが担当するフロー）

- [ ] `/stp/finance/billing` が開く
- [ ] 売上トラッカーで「取引化する」ボタンを押すと取引が作成される
- [ ] `/stp/finance/invoices`（請求管理）に移動できる
- [ ] 「未処理の取引」タブに作成した取引が表示される
- [ ] 取引の「詳細」ボタンでプレビューモーダルが開き、取引データが表示される
- [ ] プレビューモーダルから「詳細ページ」で `/stp/finance/transactions/[id]` に遷移、データ表示
- [ ] 取引編集フォームで値を変更できる
- [ ] 取引を確定できる
- [ ] コメント欄に既存コメントが表示される・新規投稿できる
- [ ] 変更履歴タブに履歴が表示される
- [ ] 請求グループ作成モーダルで請求グループを作成できる
- [ ] 請求グループ詳細モーダルを開くと、按分警告が正しく表示される
- [ ] 請求グループに取引を追加・削除できる
- [ ] 請求書PDFをプレビューできる
- [ ] 支払管理（`/stp/finance/payment-groups`）で支払グループを作成できる
- [ ] 支払グループに経費取引を追加できる
- [ ] 支払グループのコメント・変更履歴が見える

### 8.2 STP/HOJO/SLPの経費申請

- [ ] `/stp/expenses/new` ページが開ける
- [ ] 経費フォームで申請できる
- [ ] 定期取引タブが表示される
- [ ] 月別サマリータブが表示される
- [ ] `/hojo/expenses/new` で同様の確認
- [ ] `/slp/expenses/new` で同様の確認

### 8.3 経理側

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

### 8.4 権限回帰テスト（v2追加・Codex推奨）★最重要

別アカウントを用意して以下4ケースを確認：

1. **HOJO staff（hojo view のみ持つアカウント）**:
   - [ ] STP の取引IDを直叩きしたAPI呼び出しが拒否される（403相当）
   - [ ] HOJO の自プロジェクト経費申請は通常通り操作できる
   - [ ] `/stp/finance/transactions/[id]` への直接URL アクセスが middleware で弾かれる

2. **STP staff（stp view のみ持つアカウント）**:
   - [ ] STPの取引IDを叩いた操作は通常通り動く
   - [ ] HOJO の取引IDを直叩きすると拒否される
   - [ ] `/accounting/transactions` URL 直叩きが middleware で弾かれる

3. **accounting staff（accounting view のみ持つアカウント）**:
   - [ ] `/accounting/transactions/[id]/edit` で取引詳細を編集できる
   - [ ] STP/HOJO の取引でも経理権限で読める（クロスPJの取引も accounting view で通る設計のため）
   - [ ] `/stp/finance/transactions/[id]` URL 直叩きは middleware で弾かれる（コードは共通でもURLは分離）

4. **founder/admin**:
   - [ ] 全プロジェクト・全URL・全レコードにアクセスできる

### 8.5 URL境界の確認（v2: 表現修正）

- [ ] 経理スタッフは `/accounting/*` で全機能が使える
- [ ] 経理スタッフは `/stp/*`・`/hojo/*`・`/slp/*` URL アクセス時は middleware で `/` にリダイレクトされる
- [ ] STPスタッフは `/stp/*` で全機能が使える
- [ ] STPスタッフは `/accounting/*` URL アクセス時は middleware で `/` にリダイレクトされる
- [ ] ファウンダー・システム管理者はすべてアクセスできる

---

## 9. ロールバック手順（v2: SHA記録ベースに変更）

### 9.1 各Phase開始時にチェックポイントを記録

各Phase開始時に必ずタグを打つ：

```bash
git tag refactor-checkpoint-phase-N-start
```

### 9.2 Phase実行中の問題発生時

未コミット差分を消したくない場合：

```bash
# 差分を一旦stashに退避
git stash push -m "phase-N-wip"

# 直前のチェックポイントに戻る（force checkout、HEADは動く）
git checkout refactor-checkpoint-phase-N-start

# 必要なら再開時に stash を戻す
# git stash pop
```

完全に未コミット分も含めて捨てる場合：

```bash
# 警告: 未コミット分も全て消える。事前に commit or stash 必須
git reset --hard refactor-checkpoint-phase-N-start
```

### 9.3 既にコミット済みの問題発覚時

`git revert` を使う（履歴を残しながら戻せる、安全）：

```bash
# 直前1コミットを打ち消す revert コミットを作成
git revert HEAD

# 複数コミットを順に打ち消す
git revert HEAD~2..HEAD

# Phase全体を打ち消す（チェックポイントタグを使う）
git revert refactor-checkpoint-phase-N-start..HEAD
```

### 9.4 Phase 6 完了後に問題発覚した場合

ブランチごと破棄して main から再開：

```bash
git checkout main
git branch -D refactor/finance-accounting-split
# リモートも消す場合
git push origin --delete refactor/finance-accounting-split
```

mainは一切変更していないので損失ゼロ。

### 9.5 本番反映後に問題発覚した場合

VPS上で前バージョンの Docker イメージに切り戻し（CLAUDE.md記載の手順）：
- stg: 前バージョンの commit SHA に戻して `~/deploy-stg.sh`
- prod: `docker-compose.prod.yml` の image タグを前バージョンに戻して再起動
- 最悪DB復元: CLAUDE.md の DB復元手順

---

## 10. リスクと対策（v2: Next.js 16.1.6 リスク追加）

### 10.1 想定リスクと緩和策

| # | リスク | 影響度 | 緩和策 |
|---|--------|--------|--------|
| 1 | Phase 中の import 更新漏れで型エラー | 中 | 各Phaseで `rg -n` による漏れ確認必須（v2: plain grep 廃止） |
| 2 | 循環 import の発生 | 中 | Phase 1 で changelog を先に移動することで、後続 Phase では絶対パス import になっている |
| 3 | `"use server"` 指令の消失による実行時エラー | 高 | `git mv` で内容そのまま移動。移動後に各ファイル冒頭を目視確認 |
| 4 | Next.js 16.1.6 Server Actions のバンドリングエラー | 中 | 各Phaseで `next build` を実行。エラー時は Phase 分解を見直す |
| 5 | Prisma Client の stale cache による実行時エラー | 中 | 各Phaseで `docker compose exec app npx prisma generate` & `docker compose restart app` を実行 |
| 6 | **Next.js 16.1.6 / Turbopack の `.next` キャッシュが古いモジュールパスを保持** ★v2追加 | 中 | 各Phaseで `docker compose exec app rm -rf .next && docker compose restart app` を実行 |
| 7 | 権限ヘルパー置換で既存の「accounting+stp」OR条件を潰してしまう | 高 | §6.3 Phase 5 で「配列に複数要素がある場合は手動判断」と明記 |
| 8 | per-record helper のパフォーマンス劣化（毎回DBに record をロード） | 中 | helper が引いた record を戻り値で返却 → 呼び出し元で再フェッチ不要に |
| 9 | per-record helper のクエリで N+1 発生 | 中 | `include` を最小限に。必要なら呼び出し元で個別にfetch |
| 10 | 他セッションが main に先に push → rebase 発生 | 低 | Phase 間で `git fetch && git rebase origin/main` を実施 |
| 11 | 実装中にユーザーが別の修正を依頼 → 割り込み | 低 | Phase完了までは割り込みを避ける旨を事前合意 |
| 12 | **本番反映時に stale なブラウザタブが古いコードで動作** ★v2追加 | 中 | デプロイアナウンスで「画面リロードしてください」と通知。あるいは Service Worker による自動リロード実装は別タスク |
| 13 | per-record helper の戻り値型と既存コードの期待型がズレる | 中 | helper の include を、最も多くの呼び出し元が期待するフィールドに合わせる |
| 14 | Codex 2次レビューで設計の根本見直しが必要と判断される | 中 | **計画MD v2 の段階で再レビューするので、実装前に気づける** |

### 10.2 特に注意すべきポイント

#### (a) `changelog/actions.ts` の `recordChangeLog` 内部関数
- これは多くの actions から同期的に呼ばれる内部関数で、権限チェックを持たない
- 移動後も権限チェック不要（呼び出し元で既にチェック済み）
- 関数シグネチャを絶対に変えないこと

#### (b) per-record helper の戻り値設計
- helper 内で record をロードするので、呼び出し元での再フェッチを防ぐため戻り値で返却
- ただし `include` を多くしすぎると helper 自体が重くなる
- バランス：最小限のフィールド（`id`, `projectId`, `project: { code }`）+ 各helperごとに頻出フィールドを少数追加
- 呼び出し元で追加データが必要な場合は、helper の戻り値の id をキーに別途fetch

#### (c) Server Action の `"use server"` ファイル単位制約
- Next.js では `"use server"` がファイル先頭にあれば、そのファイルの全 export 関数が Server Action 扱い
- accounting-actions.ts 新設時に `"use server"` を忘れずに先頭に付ける

#### (d) Next.js 16.1.6 / Turbopack のキャッシュ
- ファイル移動後は **必ず** `docker compose exec app rm -rf .next && docker compose restart app`（CLAUDE.mdの運用ルールどおり）
- Turbopack は import path の変更を見逃すケースがある

#### (e) per-record helper の「レコード未存在」ハンドリング
- `prisma.transaction.findFirst({ id, deletedAt: null })` が null の場合、helperは `throw new Error("取引が見つかりません")` で 404 相当を表現
- 呼び出し元（特に Server Action）は try/catch で受けて `ActionResult.err()` に変換

---

## 11. 完了基準（Definition of Done）— v2: 文言修正

以下がすべて✅になった時点で完了とする：

- [ ] `src/app/finance/` が新設され、§5.1 の「finance移動対象」全ファイルが移動済み
- [ ] §5.1 の「accountingに残すもの」が引き続き `src/app/accounting/` 内にある
- [ ] `src/app/accounting/transactions/accounting-actions.ts` が新設され、accounting系3関数が分離されている
- [ ] `src/app/accounting/expenses/accounting-actions.ts` が新設され、`getAllRecurringTransactions` が分離されている
- [ ] `src/lib/auth/staff-action.ts` に `requireStaffForFinance`・`requireStaffForAccounting` が追加されている
- [ ] `src/lib/auth/finance-access.ts` が新設され、per-record helpers 4種が追加されている
- [ ] §5.2 + §5.3 の cross-project import 21箇所が全て新パスに更新されている
- [ ] accounting 内部の相対／絶対 import も全て新パスに更新されている
- [ ] `rg -n "@/app/accounting/(changelog|comments|transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)|expenses/new)" src/` が0件
- [ ] `src/app/finance/` 配下の全 Server Action が per-record helper を使っている（または `requireStaffForFinance` を使っている、引数による）
- [ ] `src/app/accounting/` 配下で `requireStaffWithProjectPermission([{ project: "accounting", ... }])` の直接呼び出しが消えている（例外は個別判断）
- [ ] `npx tsc --noEmit` エラーゼロ
- [ ] `docker compose exec app npx next build` 成功
- [ ] `npx eslint src/ --max-warnings 0` 警告ゼロ
- [ ] §8 のスモークテスト項目がすべて✅
- [ ] §8.4 の権限回帰テスト4ケースがすべて✅
- [ ] ドキュメント（CLAUDE.md・README等）更新
- [ ] Codex による最終レビューで Critical/Major 指摘が0件、または全て修正済み

---

## 12. 付録

### 12.1 参考: 現状の統計（v2: 数値再確認済み）

- accounting 配下の全ファイル: **100個**
- actions.ts ファイル数: **27個**
- 権限チェック実装済み actions: **13個**
- cross-project import 数: **21個**（v1: 18箇所 + v2追加: 2箇所 + 元々の見落とし1箇所）
- 共有UIコンポーネント: **4個**（CommentSection, ChangeLogSection, TransactionForm, TransactionStatusBadge）
- API Routes: **14個**
- `changelog/actions.ts` への依存: **16ファイル**（accounting内: 8, STP内: 5, src/lib: 1, src/app/notifications: 1, finance(移動先): 1）

### 12.2 参考: 引き続き残す設計課題（本計画のスコープ外）

- 各STP finance の `actions.ts` には `requireStaff...` 系の権限チェックが無い（過剰に緩い）→ 別タスク
- API Routes の `authorizeApi([...])` パターンを `authorizeApiForFinance()` 等の共通ヘルパーに統一 → 別タスク
- API Routes 内部でのレコード単位の所属PJ検証 → 別タスク
- `InvoiceGroup`・`PaymentGroup` の Server Actions の `src/app/finance/invoice-groups/`・`.../payment-groups/` への移動 → 別タスク（HOJO等で必要になった時点で）
- 本番デプロイ時の stale tab 自動リロード（Service Worker）→ 別タスク

### 12.3 Codex への依頼文テンプレート

#### 計画v2の再レビュー依頼

```
v1 計画書に対するCodexレビュー（Critical 1件 + Major 6件 + Minor 3件 + 補足）を全件反映した
v2 計画書をレビューしてください。

@docs/finance-accounting-refactor-plan.md

主な反映ポイント:
1. Critical対応: per-record helpers 新設（§4.3）→ プロジェクト跨ぎ閲覧防止
2. URL境界明確化（§4.4）→ middleware は変更しない
3. accounting専用関数の物理分離（accounting-actions.ts 新設・§3.1, §5.1）
4. Phase 3+4 統合（§6.3）→ dangling import 防止
5. grep → rg 統一（§7.2）
6. InvoiceGroup/PaymentGroup を明示的にスコープ外（§2.2）
7. ロールバック手順を SHA + revert ベースに変更（§9）
8. Next.js 16.1.6 リスク追加（§10.1 #6, #12）
9. 権限回帰テスト4ケース追加（§8.4）

このv2で実装に入って大丈夫か、特に以下を重点レビューしてください:
- §4.3 per-record helpers の設計（戻り値・例外・パフォーマンス）
- §6.3 Phase 5 の per-record チェック適用パターン（漏れ・誤適用）
- §8.4 権限回帰テストのカバレッジ
- v1 から v2 への変更で新たに生まれた矛盾や見落とし
```

#### 最終コードレビュー依頼（Phase 6 完了後）

```
v2 計画書（添付）に基づいて実装した変更をレビューしてください。

@docs/finance-accounting-refactor-plan.md

- 計画書と実装の乖離
- Phase単位での変更の妥当性
- per-record helper の適用漏れ・誤適用
- 型エラー・ビルドエラーの隠蔽箇所
- スモークテスト・権限回帰テストでカバーされない潜在バグ
- パフォーマンスリグレッションの可能性（per-record helperによるDB追加クエリ）
```

---

**END OF PLAN v2**
