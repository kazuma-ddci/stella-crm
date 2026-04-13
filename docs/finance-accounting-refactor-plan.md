# 経理モジュール分離リファクタリング計画書（A案）— v5

**作成日**: 2026-04-13
**改訂日**: 2026-04-14（Codex 4次レビュー反映 — Result<T>規約の徹底）
**対象ブランチ**: `refactor/finance-accounting-split`
**対象コミット起点**: `bd0839a`（main）
**Next.js バージョン**: 16.1.6
**レビュー履歴**:
- v1: 初版 → Codex 1次レビュー（10件指摘）
- v2: Codex 1次指摘を全件反映 → Codex 2次レビュー（Major 6件 + Minor 2件）
- v3: Codex 2次指摘を全件反映 → Codex 3次レビュー（Major 4件 + Minor 1件、全て文書整合性問題）
- v4: Codex 3次指摘を全件反映 → Codex 4次レビュー（P1 2件 + Minor 1件、Result<T>規約の徹底漏れ）
- **v5: Codex 4次指摘を全件反映 ← 現在ここ**
- 次: 実装着手（Phase 0 から）→ 実装完了後 Codex 最終コードレビュー

---

## 📌 v4 → v5 の主な変更点（Codex 4次レビュー反映 — Result<T>規約の徹底）

| # | Codex指摘 | v5での対応 |
|---|----------|-----------|
| P1 | `getComments()` / `getGroupAllocationWarnings()` も client から直接呼ばれているため Result<T> 化が必要だが、Phase 5 にその手順がない | **§6.3 Phase 5 に明示手順追加**：両関数の戻り値を `Result<T>` に変更（破壊的変更だが client 専用なので安全）+ comment-section.tsx・invoice/payment-detail-modal.tsx の呼び出し側修正手順を明記 |
| P1 | §4.3.5 置換マッピングで preview-modal が `getTransactionForDetailPage` に直接マップされているが、(d)規約では wrapper 経由必須 | **§4.3.5 マッピング修正**：preview-modal は `getTransactionForPreview(id)` wrapper 経由に統一 |
| Minor | §10.2(b)・DoD で「page-loader wrapper」旧用語が残存 | **「loader Server Action」に置換** |

---

## 📌 v3 → v4 の主な変更点（Codex 3次レビュー反映 — 完了済）

| # | Codex指摘 | v4での対応 |
|---|----------|-----------|
| Major | §4.3.3 のエラー契約に「client component から呼ぶ server function」パターンが欠落 | **§4.3.3 に (d) パターン追加**：preview modal/comment-section 等のclient-component callerの変換規則を規定 |
| Major | `getTransactionForDetailPage` を「page-loader」と呼びつつ preview modal（client）から使う矛盾 | **§4.3.4 / §4.3.5 / §4.3.6 を整理**：`"use server"` で client-callable server action として再定義、loader の名称を一般化 |
| Major | §6.3 Phase 3 が `allocation-group-item-actions.ts` 全体を移動する旧手順のまま | **§6.3 Phase 3 を v3 分割方針に同期**：分割→2ファイル新規作成→旧削除の手順に書き換え |
| Major | §6.3 Phase 5 が削除済の `getTransactionById()` の書き換えから始まる旧手順のまま | **§6.3 Phase 5 を v3 マッピングに同期**：`getTransactionMinimal` / `getTransactionForDetailPage` の導入 + 3呼び出し元の置換手順に書き換え |
| Minor | §8.4 を6ケースに拡張済だが Phase 5/6/DoD で「4ケース」表記が残存 | **下流文言を全て「6ケース」に統一** |
| Major | §10.2(e) が generic `Error("取引が見つかりません")` のままで §4.3.3 の typed error と矛盾 | **§10.2(e) を `FinanceRecordNotFoundError` に揃える** |

---

## 📌 v2 → v3 の主な変更点（Codex 2次レビュー反映 — 完了済）

| # | Codex指摘 | v3での対応 |
|---|----------|-----------|
| Major | per-record helper の throw と page caller の `null → notFound()` 契約の不整合 | **§4.3.3 で「未存在エラー契約」を明確化**：`FinanceRecordNotFoundError` を専用クラスで定義、page loader / Server Action / API route ごとの変換パターンを規定 |
| Major | helper 戻り値の「最小フィールド」と「追加クエリ不要」が矛盾 | **§4.3 を再設計**：helper は **lean（最小フィールドのみ）** に統一。重い include が必要な箇所は `getTransactionForDetailPage` 等の **page-loader wrapper** を別途用意 |
| Major | Phase 5 経費系適用パターンが実コードのシグネチャと不一致 | **§4.3.4 で `requireFinanceProjectCodeAccess(projectCode: string \| null)` を新設** + §6.3 Phase 5 のマッピングを実シグネチャに合わせて修正。さらに `getAllRecurringTransactions` のような accounting-only 関数は §4.3 で別パターンに整理 |
| Major | 承認系のスコープ未確定 | **§4.3.5 で `requireFinancePaymentGroupApprovalAccess(groupId)` を新設**：実コードと同じ `approverStaffId === user.id` ベースで gate（`canApprove` フラグは現状未使用） |
| Major | `allocation-group-item-actions.ts` を全部 shared 扱いするのは不正確 | **§5.1.1 で分割を明記**：`getRelatedGroupsForTransaction`・`batchUpdateGroupStatus` を `accounting/transactions/allocation-group-item-accounting-actions.ts` に分離 |
| Major | Phase 4 の `rg "@/app/accounting/expenses"` が `accounting-actions` も誤検出する | **§6.3 Phase 4 検証コマンドを `@/app/accounting/expenses/new/` に narrow** |
| Minor | §8.4 が approval 専用権限を守れていない | **§8.4 を6ケースに拡張**：approval-only 同一PJユーザー、非承認者同一PJユーザーを追加 |
| Minor | §3.1 ツリーで `allocation-confirmation-panel.tsx` が二重表記 | **§3.1 ツリー修正**：finance側から削除（accounting残留のみ） |

---

## 📌 v1 → v2 の主な変更点（Codex 1次レビュー反映 — 完了済）

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
│   │   ├── allocation-group-item-actions.ts ← 共通サブセット（§5.1.1 で分割）
│   │   ├── transaction-form.tsx      ← 共有UI
│   │   └── transaction-status-badge.tsx
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
│   ├── transactions/                 ← 経理用ページ + 経理専用 actions
│   │   ├── page.tsx                  ← 経理用一覧
│   │   ├── new/page.tsx              ← 経理用新規作成
│   │   ├── [id]/edit/page.tsx        ← 経理用編集
│   │   ├── transactions-table.tsx    ← 経理用テーブル
│   │   ├── transaction-status-actions.tsx
│   │   ├── allocation-confirmation-panel.tsx ← Codex判定で残留
│   │   ├── accounting-actions.ts     ★ NEW: 経理専用Server Actions
│   │   │                               getAccountingTransactions
│   │   │                               createAccountingTransaction
│   │   │                               getAccountingTransactionFormData
│   │   └── allocation-group-item-accounting-actions.ts ★ NEW: 経理専用按分操作
│   │                                   getRelatedGroupsForTransaction
│   │                                   batchUpdateGroupStatus
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
 * Transaction レコードへのアクセス可否を判定する（lean版）。
 *
 * 通すケース:
 * - ファウンダー / システム管理者
 * - 経理プロジェクトで指定 level 以上
 * - レコードの projectId に対応する事業プロジェクトで指定 level 以上
 *
 * 弾くケース:
 * - 上記いずれにも該当しない（例: STP staff が HOJO の取引IDを叩いた）
 *   → throw new FinanceForbiddenError()
 * - レコード自体が存在しない / deletedAt セット済み
 *   → throw new FinanceRecordNotFoundError("Transaction", id)
 *
 * 戻り値: { user, transaction } — transaction は最小フィールドのみ
 *   { id, projectId, project: { code } | null }
 *
 * ⚠️ 重い include が必要な場合は §4.3.6 の loader Server Action を使う
 */
export async function requireFinanceTransactionAccess(
  transactionId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; transaction: ProjectScopedRecord }>;

/**
 * InvoiceGroup レコードへのアクセス可否を判定する（lean版）。
 */
export async function requireFinanceInvoiceGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; invoiceGroup: ProjectScopedRecord }>;

/**
 * PaymentGroup レコードへのアクセス可否を判定する（lean版）。
 */
export async function requireFinancePaymentGroupAccess(
  groupId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; paymentGroup: ProjectScopedRecord }>;

/**
 * プロジェクトIDへのアクセス可否を判定する。
 */
export async function requireFinanceProjectAccess(
  projectId: number,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser; projectCode: string }>;

/**
 * プロジェクトコードへのアクセス可否を判定する（projectCode が引数の場合）。
 *
 * - projectCode === null → accounting 権限が必要（accounting エントリ専用フォーム等）
 * - projectCode 指定 → accounting OR 該当プロジェクトの権限
 *
 * ⚠️ getExpenseFormData 等、現状のシグネチャ（projectCode: string | null）に合わせるための専用helper
 */
export async function requireFinanceProjectCodeAccess(
  projectCode: string | null,
  level: PermissionLevel = "view"
): Promise<{ user: SessionUser }>;

/**
 * PaymentGroup の「プロジェクト承認」権限を判定する（v3新設）。
 *
 * 通すケース:
 * - ファウンダー / システム管理者
 * - そのグループの approverStaffId === user.id（指名された承認者）
 *
 * 弾くケース:
 * - グループが存在しない → FinanceRecordNotFoundError
 * - 上記いずれにも該当しない → FinanceForbiddenError
 *
 * ⚠️ 現状の auth モデルでは UserPermission に canApprove フラグが存在するが、
 *    実コードの approveByProjectApprover では使われておらず、approverStaffId のみで判定。
 *    本helper もそれに合わせる（canApprove は将来的な拡張用）
 */
export async function requireFinancePaymentGroupApprovalAccess(
  groupId: number
): Promise<{ user: SessionUser; paymentGroup: ProjectScopedRecord & { approverStaffId: number | null } }>;
```

#### 4.3.1 内部ロジック（共通）

```typescript
// 擬似コード（requireFinance{Transaction|InvoiceGroup|PaymentGroup}Access の共通基盤）
async function checkProjectScopedAccess(record, level, user): Promise<boolean> {
  if (isSystemAdmin(user) || isFounder(user)) return true;
  if (hasPermission(user.permissions, "accounting", level)) return true;
  const projectCode = record.project?.code;
  if (projectCode && hasPermission(user.permissions, projectCode, level)) return true;
  // projectIdが null のレガシーレコード → accounting 権限のみで判定
  if (record.projectId === null && hasPermission(user.permissions, "accounting", level)) return true;
  return false;
}

// 承認helper の判定ロジック（v3新設）
async function checkApprovalAccess(group, user): Promise<boolean> {
  if (isSystemAdmin(user) || isFounder(user)) return true;
  if (group.approverStaffId === user.id) return true;
  return false;
}
```

#### 4.3.2 適用パターン例

```typescript
// 取引取得（lean helper の戻り値で十分なケース）
export async function getTransactionMinimal(id: number) {
  const { transaction } = await requireFinanceTransactionAccess(id, "view");
  return transaction;  // 最小フィールドのみ
}

// 取引取得（重いincludeが必要なケース）→ loader Server Action を使う（§4.3.6）
// この関数は server action ではなく page loader 用ヘルパーとして実装
export async function getTransactionForDetailPage(id: number) {
  await requireFinanceTransactionAccess(id, "view");  // 認可
  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: { /* 重いinclude */ }
  });
  if (!transaction) throw new FinanceRecordNotFoundError("Transaction", id);
  return transaction;
}

// 取引更新
export async function updateTransaction(id: number, data) {
  const { user } = await requireFinanceTransactionAccess(id, "edit");
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

// 経費申請フォームデータ取得（projectCodeベース・null=accounting）
export async function getExpenseFormData(projectCode: string | null) {
  await requireFinanceProjectCodeAccess(projectCode, "view");
  // ... fetch
}

// 経費申請（projectIdベース）
export async function getProjectRecurringTransactions(projectId: number) {
  await requireFinanceProjectAccess(projectId, "view");
  // ... fetch
}

// プロジェクト承認
export async function approveByProjectApprover(groupId: number) {
  const { user, paymentGroup } = await requireFinancePaymentGroupApprovalAccess(groupId);
  // status遷移チェック等...
  await prisma.paymentGroup.update({ where: { id: groupId }, data: { ... } });
}
```

#### 4.3.3 「未存在エラー」契約（v3新設）★最重要

helper が record 未存在で throw する仕様と、現行の page caller の `null → notFound()` 契約の整合を取る。

```typescript
// src/lib/auth/finance-access.ts に定義
export class FinanceRecordNotFoundError extends Error {
  constructor(public readonly recordType: string, public readonly recordId: number) {
    super(`${recordType} (id=${recordId}) が見つかりません`);
    this.name = "FinanceRecordNotFoundError";
  }
}

export class FinanceForbiddenError extends Error {
  constructor(message = "このレコードへのアクセス権限がありません") {
    super(message);
    this.name = "FinanceForbiddenError";
  }
}
```

**呼び出し元での変換パターン（必須遵守）**:

```typescript
// (a) Page Loader（Server Component）
import { notFound } from "next/navigation";
import { FinanceRecordNotFoundError, FinanceForbiddenError } from "@/lib/auth/finance-access";

export default async function TransactionDetailPage({ params }: Props) {
  const { id } = await params;
  try {
    const transaction = await getTransactionForDetailPage(Number(id));
    return <TransactionDetailView transaction={transaction} />;
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) notFound();
    if (e instanceof FinanceForbiddenError) {
      // middleware 通過後にヒットした場合のみ → 403相当
      throw e;  // または専用エラーUI
    }
    throw e;
  }
}

// (b) Server Action（ActionResult パターン）
export async function updateTransaction(id: number, data): Promise<ActionResult> {
  try {
    const { user } = await requireFinanceTransactionAccess(id, "edit");
    // ... 更新処理
    return ok();
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) return err("取引が見つかりません");
    if (e instanceof FinanceForbiddenError) return err("この操作を行う権限がありません");
    console.error("[updateTransaction] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラー");
  }
}

// (c) API Route（NextResponse パターン）
export async function GET(req: NextRequest, ctx) {
  try {
    const { transaction } = await requireFinanceTransactionAccess(id, "view");
    return NextResponse.json(transaction);
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (e instanceof FinanceForbiddenError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
}

// (d) Client Component から直接呼ぶ Server Action（v4新設）
//
// 該当箇所:
// - src/app/stp/finance/transactions/transaction-preview-modal.tsx (取引プレビューモーダル)
// - src/app/finance/comments/comment-section.tsx (コメントセクション)
// - src/app/stp/finance/invoices/invoice-group-detail-modal.tsx (請求グループ詳細モーダル)
// - src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx (支払グループ詳細モーダル)
//
// これらは "use client" コンポーネント内で `await getTransactionForDetailPage(id)` 等を直接呼ぶ。
// 現状は try/catch で握りつぶして空表示にしているが、これだと「データなし」と「権限なし」「未存在」が
// ユーザーから見分けられない。
//
// 【v4 規約】Server Action を client から呼ぶ場合、Server Action 側で typed error を捕捉して
// ActionResult パターンで返却する。client は result.ok を見て分岐する。

// 共通パターン: 取得系 Server Action は Result<T> 形式に統一
export async function getTransactionForPreview(id: number): Promise<
  | { ok: true; data: TransactionFull }
  | { ok: false; reason: "not_found" | "forbidden" | "internal"; message: string }
> {
  try {
    const transaction = await getTransactionForDetailPage(id);
    return { ok: true, data: transaction };
  } catch (e) {
    if (e instanceof FinanceRecordNotFoundError) {
      return { ok: false, reason: "not_found", message: "取引が見つかりません" };
    }
    if (e instanceof FinanceForbiddenError) {
      return { ok: false, reason: "forbidden", message: "この取引にアクセスする権限がありません" };
    }
    console.error("[getTransactionForPreview] error:", e);
    return { ok: false, reason: "internal", message: "予期しないエラーが発生しました" };
  }
}

// Client Component 側の受け取りパターン
"use client";
function TransactionPreviewModal({ transactionId }) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "loaded"; transaction: TransactionFull }
    | { status: "not_found" }
    | { status: "forbidden" }
    | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    getTransactionForPreview(transactionId).then((result) => {
      if (result.ok) {
        setState({ status: "loaded", transaction: result.data });
      } else if (result.reason === "not_found") {
        setState({ status: "not_found" });
      } else if (result.reason === "forbidden") {
        setState({ status: "forbidden" });
      } else {
        setState({ status: "error", message: result.message });
      }
    });
  }, [transactionId]);

  if (state.status === "loading") return <Spinner />;
  if (state.status === "not_found") return <div>取引が見つかりません</div>;
  if (state.status === "forbidden") return <div>この取引にアクセスする権限がありません</div>;
  if (state.status === "error") return <div>{state.message}</div>;
  return <TransactionDetailView transaction={state.transaction} />;
}
```

⚠️ **client-callable な Server Action は、必ず `Result<T>` 形式で返す**。typed error を素で投げると client 側で `e instanceof FinanceRecordNotFoundError` の判定ができない（class が serialize されないため）。

#### 4.3.4 helper は lean、重い include は loader server action（v4再整理）

設計原則：

- `requireFinance*Access` 系 helper は **認可 + 最小レコード取得** に限定（戻り値: `{ id, projectId, project: { code } }` のみ）
- 重い `include`（attachments、allocationGroupItems、invoiceGroup.attachments 等）が必要な箇所は、**loader 型の Server Action** を別途用意

**用語の整理（v4）**:
- 「page-loader wrapper」という呼称は v3 では誤解を招いた（実際は client component からも呼ぶ）
- v4 では **「loader Server Action」** と呼ぶ。実体は `"use server"` ファイルに置く Server Action
- Page（Server Component）からも、Client Component からも呼べる
- 命名規則: `getXxxForDetail`, `getXxxFull`（"page" を名前に含めない）
- ファイル位置: `finance/transactions/loaders.ts` 等（既存の actions.ts と分離）
- typed error は throw する。Server Component から呼ぶときは §4.3.3(a)で `notFound()` に変換、Client Component から呼ぶときは §4.3.3(d) の wrapper Server Action 経由で `Result<T>` に変換

**新設する loader Server Actions（`finance/{module}/loaders.ts` に集約）**:

```typescript
// src/app/finance/transactions/loaders.ts （新設）
"use server";

/**
 * 取引詳細用のローダー。認可 + 重いinclude を含む。
 * Server Component（page.tsx）からも、Client Component（preview-modal等）からも呼ばれる。
 *
 * Server Component から呼ぶ場合: 直接呼んでOK、typed error は呼び出し側で notFound() 等に変換
 * Client Component から呼ぶ場合: §4.3.3(d) の wrapper（getTransactionForPreview 等）経由で呼ぶ
 */
export async function getTransactionForDetailPage(id: number) {
  await requireFinanceTransactionAccess(id, "view");
  const transaction = await prisma.transaction.findFirst({
    where: { id, deletedAt: null },
    include: {
      counterparty: { select: { id: true, name: true, counterpartyType: true } },
      allocationTemplate: { include: { lines: { include: { costCenter: true } } } },
      allocationGroupItems: { include: { /* ... */ } },
      costCenter: true,
      expenseCategory: true,
      project: true,
      paymentMethod: true,
      attachments: { where: { deletedAt: null } },
      invoiceGroup: { select: { id: true, invoiceNumber: true, attachments: true } },
      paymentGroup: { select: { id: true, targetMonth: true, attachments: true } },
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
      confirmer: { select: { id: true, name: true } },
      expenseOwners: { include: { staff: true } },
    },
  });
  if (!transaction) throw new FinanceRecordNotFoundError("Transaction", id);
  return transaction;
}
```

このようにして：
- helper は軽い（毎回呼ばれても DBコスト最小）
- 重いクエリは「必要な画面でだけ」発生
- N+1 やパフォーマンス問題の発生箇所が明確化される

#### 4.3.5 既存 `getTransactionById` の扱い

現行コードの `getTransactionById(id)` は、`null` を返す契約 + 重い include を含む。これは v3 では：

- **削除し、用途別に2つに分割**:
  - `getTransactionMinimal(id)` — lean（helperの戻り値そのまま、軽量取得用）
  - `getTransactionForDetailPage(id)` — heavy（detail page専用 wrapper）
- 既存の呼び出し元（`stp/finance/transactions/[id]/page.tsx`、`stp/finance/transactions/transaction-preview-modal.tsx` 等）は、用途に応じてどちらかに書き換える

**呼び出し元の置換マッピング（v5: client/server で正しく分岐）**:

| 呼び出し元 | コンポーネント種別 | 用途 | v5での置換 |
|-----------|-------------------|------|-----------|
| `stp/finance/transactions/[id]/page.tsx` | **Server** Component | 取引詳細表示（重いinclude必要） | `getTransactionForDetailPage(id)` を直接呼ぶ + try/catch で `notFound()` 変換（§4.3.3(a)） |
| `accounting/transactions/[id]/edit/page.tsx` | **Server** Component | 経理用編集（重いinclude必要） | 同上 |
| `stp/finance/transactions/transaction-preview-modal.tsx` | **Client** Component | 取引プレビュー（中量のinclude） | **`getTransactionForPreview(id)` wrapper 経由**（§4.3.3(d) 必須）。直接 loader を呼んではいけない |

#### 4.3.6 loader Server Action の配置と命名（v4整理）

**配置**:
- `src/app/finance/transactions/loaders.ts` — 重い include を持つ取引取得系
- `src/app/finance/comments/loaders.ts` — （必要に応じて）
- `src/app/finance/changelog/loaders.ts` — （必要に応じて）
- `src/app/finance/expenses/loaders.ts` — （必要に応じて）

これらは全て `"use server"` 指令を持つ通常の Server Action ファイル。`page.tsx` を持たないので URL にはならない。

**命名規則**:
- ❌ `loadTransaction`、`loadXxxForPage`（page限定の誤解を招く）
- ✅ `getTransactionForDetailPage`、`getTransactionFull`、`getInvoiceGroupWithItems`（用途を表す名前）
- 「page」を名前に含めても良いが、それは「Detail Page相当のデータ量」という意味であり「Server Componentからのみ」という意味ではない

**actions.ts と loaders.ts の使い分け**:
| 種類 | 配置 | 戻り値 | 呼ぶ側 |
|------|------|--------|--------|
| CRUD系（更新・削除・確定） | `actions.ts` | `ActionResult<T>` | Client Component から（フォーム送信等） |
| 軽量取得（lean helper の戻り値で十分） | `actions.ts` の中で完結 | レコード or null | Server Component / Client Component |
| 重量取得（heavy include 必要） | `loaders.ts` | レコード（throw on error） | Server Component から直接、Client Component からは§4.3.3(d) wrapper経由 |
| Client から呼ぶ重量取得 wrapper | `actions.ts` または `client-loaders.ts` | `Result<T>` | Client Component から |

ただしすべて必須ではなく、**重いincludeが必要な箇所だけ loader を作る**。シンプルなケース（コメント取得、変更履歴取得等）は actions.ts 内で完結させる。

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
| **`requireFinanceProjectCodeAccess(projectCode)`** ★v3新設 | projectCode（string \| null）ベースの判定。null=accounting | `getExpenseFormData` 等の現行シグネチャ維持用 |
| **`requireFinancePaymentGroupApprovalAccess(groupId)`** ★v3新設 | PaymentGroupのプロジェクト承認者判定（approverStaffId === user.id） | `approveByProjectApprover`・`rejectByProjectApprover` で使用 |

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
| `src/app/accounting/transactions/allocation-group-item-actions.ts` | **分割**: `src/app/finance/transactions/allocation-group-item-actions.ts`（共通サブセット）+ `src/app/accounting/transactions/allocation-group-item-accounting-actions.ts`（経理専用サブセット） | §5.1.1.1 で詳細 |
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

##### 5.1.1.1 `allocation-group-item-actions.ts` の分割（v3新設）

現行 `accounting/transactions/allocation-group-item-actions.ts` を、**用途別に2ファイルに分割**：

**SHARED → `src/app/finance/transactions/allocation-group-item-actions.ts`**（プロジェクトスタッフも使う）

| 関数 | 用途 | 呼び出し元 |
|------|------|-----------|
| `getGroupAllocationWarnings(groupType, groupId)` | 按分警告取得 | STP invoice/payment group detail modal |
| `addAllocationItemToGroup(...)` | 按分項目をグループに追加 | 内部・両方が使う可能性 |
| `removeAllocationItemFromGroup(...)` | 按分項目をグループから削除 | 内部・両方が使う可能性 |
| `getAllocationGroupStatus(transactionId)` | 按分グループ所属状況取得 | 内部 |
| `getUnprocessedAllocations(projectId?)` | 未処理按分一覧 | 内部 |
| `getUnprocessedAllocationCount(projectId?)` | 未処理按分カウント | 内部 |
| `AllocationWarning` 型 | 警告データ型 | STP 共有 |

**ACCOUNTING-ONLY → `src/app/accounting/transactions/allocation-group-item-accounting-actions.ts`**（経理スタッフのみ）

| 関数 | 用途 | 呼び出し元 |
|------|------|-----------|
| `getRelatedGroupsForTransaction(transactionId)` | 取引に紐づく全グループ取得 | `accounting/batch-complete/batch-complete-client.tsx` のみ |
| `batchUpdateGroupStatus(items, status)` | 経理一括完了用ステータス更新 | 同上 |
| `BatchUpdateResult` 型 | 一括結果型 | 経理専用 |

**Phase 3 での実施手順**:
1. 現行 `allocation-group-item-actions.ts` を読み、上記マッピングに従って2ファイルに分割
2. 共通サブセットを `finance/transactions/allocation-group-item-actions.ts` に新規作成
3. 経理サブセットを `accounting/transactions/allocation-group-item-accounting-actions.ts` に新規作成
4. 旧ファイルを削除
5. import 元（STP 2ファイル + accounting/batch-complete 1ファイル）を更新

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
4. `src/lib/auth/finance-access.ts` を新設し、以下を追加（v3拡張）:
   - エラークラス2種（`FinanceRecordNotFoundError`・`FinanceForbiddenError`）
   - per-record helpers 6種:
     - `requireFinanceTransactionAccess`
     - `requireFinanceInvoiceGroupAccess`
     - `requireFinancePaymentGroupAccess`
     - `requireFinanceProjectAccess`
     - `requireFinanceProjectCodeAccess` ★v3新設
     - `requireFinancePaymentGroupApprovalAccess` ★v3新設
5. **既知バグの先行修正**: §1.1 の5箇所の権限チェックを暫定的に広げる（前回 `getTransactionById`・`getTransactionFormData` と同パターン）
6. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / ビルドOK確認
7. コミット 1: "feat: 権限ヘルパー新設（エントリ判定2種＋レコード判定4種）"
8. コミット 2: "fix: 既知5件の権限バグを暫定修正（STP/HOJO/SLP経費・コメント・変更履歴・按分警告）"

**受け入れ条件（v3: 8ヘルパー + 2エラークラス）**:
- [ ] 新ヘルパー8つ + エラークラス2つが存在し、型エラーなし
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

**対象ファイル（v4: 分割対象明記）**:
- `accounting/transactions/actions.ts` → **分割**:
  - `finance/transactions/actions.ts`（共通関数のみ）
  - `accounting/transactions/accounting-actions.ts`（accounting系3関数を抽出）
- `accounting/transactions/allocation-actions.ts` → `finance/transactions/allocation-actions.ts`（全体移動・分割なし）
- `accounting/transactions/allocation-group-item-actions.ts` → **分割（§5.1.1.1準拠）**:
  - `finance/transactions/allocation-group-item-actions.ts`（共通サブセット: getGroupAllocationWarnings, addAllocationItemToGroup, removeAllocationItemFromGroup, getAllocationGroupStatus, getUnprocessedAllocations, getUnprocessedAllocationCount, AllocationWarning型）
  - `accounting/transactions/allocation-group-item-accounting-actions.ts`（経理専用サブセット: getRelatedGroupsForTransaction, batchUpdateGroupStatus, BatchUpdateResult型）
- `accounting/transactions/transaction-form.tsx` → `finance/transactions/transaction-form.tsx`
- `accounting/transactions/transaction-status-badge.tsx` → `finance/transactions/transaction-status-badge.tsx`
- **★v4追加: loader Server Action ファイルを新設**:
  - `finance/transactions/loaders.ts`（`getTransactionForDetailPage` を実装、§4.3.4参照）

**手順（v4: allocation-group-item-actions の分割を反映）**:
1. `git tag refactor-checkpoint-phase-3-start`
2. ファイルロック取得（対象ファイル + 新規 `accounting-actions.ts` + 新規 `allocation-group-item-accounting-actions.ts` + 新規 `loaders.ts`）
3. **`accounting/transactions/actions.ts` の分割作業**:
   - 内容を読み、共通関数と accounting系関数を分離
   - 共通部分を `finance/transactions/actions.ts` として新規作成
   - accounting系3関数（`getAccountingTransactions`・`createAccountingTransaction`・`getAccountingTransactionFormData`）を `accounting/transactions/accounting-actions.ts` として新規作成
   - 旧 `accounting/transactions/actions.ts` を削除
4. **`accounting/transactions/allocation-group-item-actions.ts` の分割作業（v4新）**:
   - 内容を読み、§5.1.1.1 のマッピング表に従って2ファイルに分割
   - 共通サブセットを `finance/transactions/allocation-group-item-actions.ts` として新規作成
   - 経理専用サブセットを `accounting/transactions/allocation-group-item-accounting-actions.ts` として新規作成
   - 旧 `accounting/transactions/allocation-group-item-actions.ts` を削除
5. `git mv` で残りファイルを移動:
   - `allocation-actions.ts` → finance/
   - `transaction-form.tsx` → finance/
   - `transaction-status-badge.tsx` → finance/
6. **`finance/transactions/loaders.ts` を新規作成（v4新）**:
   - `getTransactionForDetailPage(id)` を実装（§4.3.4のサンプルコード参照）
   - `requireFinanceTransactionAccess` で認可、その後重い include で取引取得
   - 取引未存在なら `FinanceRecordNotFoundError` を throw
7. UIファイル内の相対import を確認・更新
8. `rg -n "@/app/accounting/transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)" src/` で呼び出し元全列挙
9. 全呼び出し元のimportパスを更新:
   - cross-project: §5.2 の #2, #4, #6, #8, #9, #11, #13
   - `accounting/batch-complete/batch-complete-client.tsx` → `@/app/accounting/transactions/allocation-group-item-accounting-actions`（v4新）
10. accounting内の `transactions-table.tsx`, `[id]/edit/page.tsx`, `new/page.tsx` の import 更新（共通系は finance、accounting系は `./accounting-actions`）
11. 型チェック・ビルド・コミット

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
- [ ] `rg -n "@/app/accounting/expenses/new/" src/` が0件 ★v3修正: narrow して `accounting-actions` を誤検出しないように

#### Phase 5: per-recordチェック適用 + 旧ヘルパー置換（全ファイル一括）★v2: 大幅拡張

**目的**:
1. `finance/` 配下の全 Server Action に **per-record アクセスチェック** を適用（Critical指摘対応）
2. `accounting/` 配下の全 actions.ts で `requireStaffWithProjectPermission([{ project: "accounting", ... }])` を `requireStaffForAccounting(level)` に置換
3. Phase 0 で施した「既知バグ5件の暫定修正」を、本格的な per-record チェックで置き換え

**手順**:
1. `git tag refactor-checkpoint-phase-5-start`
2. **finance/transactions/actions.ts の権限チェック書き換え（v4: getTransactionById廃止）**:
   - **`getTransactionById(id)` を削除し、用途別2関数に分割（§4.3.5準拠）**:
     - `getTransactionMinimal(id)` を新設 — `requireFinanceTransactionAccess(id, "view")` の戻り値そのまま返す（軽量取得用）
     - `getTransactionForDetailPage(id)` は Phase 3 で `finance/transactions/loaders.ts` に新設済 — 重いinclude含む
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

2b. **既存3呼び出し元の置換（v4新）**:
   - `src/app/stp/finance/transactions/[id]/page.tsx` (Server Component): `getTransactionById(id)` → `getTransactionForDetailPage(id)` + try/catch で `notFound()` 変換（§4.3.3(a)）
   - `src/app/accounting/transactions/[id]/edit/page.tsx` (Server Component): 同上
   - `src/app/stp/finance/transactions/transaction-preview-modal.tsx` (Client Component):
     - 新設する wrapper `getTransactionForPreview(id)` を `finance/transactions/actions.ts` に追加（§4.3.3(d) のパターン）
     - 中身は `try { getTransactionForDetailPage(id) } catch (e) { Result変換 }`
     - modal側は `result.ok` で分岐表示（loaded / not_found / forbidden / error）
3. **finance/transactions/allocation-actions.ts の権限チェック書き換え**:
   - 取引ID/グループIDを取る関数 → 該当の per-record helper
   - 引数なしの helper関数 → `requireStaffForFinance("view")`
4. **finance/transactions/allocation-group-item-actions.ts の権限チェック書き換え + Result<T>化（v5: client直呼びのため戻り値も変更）**:
   - `getGroupAllocationWarnings(groupType, groupId)` の改修:
     - 内部で `requireFinance{Invoice|Payment}GroupAccess(groupId, "view")` を呼ぶ
     - **戻り値型を `Promise<AllocationWarning[]>` から `Promise<Result<AllocationWarning[]>>` に変更**（§4.3.3(d) Result<T>規約）
     - `try { ... return ok(warnings) } catch (e) { /* typed error → reason変換 */ }`
   - **呼び出し側修正**: `src/app/stp/finance/invoices/invoice-group-detail-modal.tsx` および `src/app/stp/finance/payment-groups/payment-group-detail-modal.tsx`
     - `getGroupAllocationWarnings(...)` の戻り値受け取りを `result.ok` 分岐に書き換え
     - エラー時は警告領域に「警告取得に失敗しました」等を表示（無音失敗を避ける）
   - 他の `addAllocationItemToGroup` / `removeAllocationItemFromGroup` 等は既に `ActionResult` を返すので per-record helper 適用のみ
   - `getAllocationGroupStatus` / `getUnprocessedAllocations` / `getUnprocessedAllocationCount` は内部利用のみのため per-record helper 適用のみ（戻り値型変更不要）
5. **finance/comments/actions.ts の権限チェック書き換え + Result<T>化（v5: client直呼びのため戻り値も変更）**:
   - `getComments(params)` の改修:
     - 内部で per-record helper を呼ぶ（params.transactionId/invoiceGroupId/paymentGroupId に応じて）
     - **戻り値型を `Promise<CommentWithReplies[]>` から `Promise<Result<CommentWithReplies[]>>` に変更**（§4.3.3(d) Result<T>規約）
     - `try { ... return ok(comments) } catch (e) { /* typed error → reason変換 */ }`
   - `createComment(input)` → 同様に per-record helper を呼ぶ。戻り値は既に `ActionResult` なのでそのまま
   - **呼び出し側修正**: `src/app/finance/comments/comment-section.tsx` (Phase 2で移動済)
     - `useEffect` 内の `const data = await getComments(...)` → `const result = await getComments(...)`
     - `if (result.ok) setComments(result.data) else { /* not_found/forbidden/error 表示 */ }`
     - 既存の try/catch 握りつぶしを削除（Result経由で適切に表示分岐）
6. **finance/changelog/actions.ts の権限チェック書き換え**:
   - `getChangeLogs(tableName, recordId)` → tableName に応じて per-record helper
   - `getChangeLogsForTransaction(transactionId)` → `requireFinanceTransactionAccess(transactionId, "view")`
   - `recordChangeLog` は内部関数なので権限チェックなし（既存通り）
7. **finance/expenses/actions.ts の権限チェック書き換え（v3: 実シグネチャに合わせて修正）**:
   - `getExpenseFormData(projectCode: string \| null)` → `requireFinanceProjectCodeAccess(projectCode, "view")` ★projectCode版を使う
   - `submitExpenseRequest(...)` → 入力データの projectId に基づき `requireFinanceProjectAccess(data.projectId, "edit")`（projectId が確定しているケース）
   - `getMyExpenses(projectId: number)` → `requireFinanceProjectAccess(projectId, "view")`
   - `getPendingApprovals(projectId: number)` → 同上
   - `getProjectRecurringTransactions(projectId: number)` → 同上
   - `getMonthlyExpenseSummary(projectId: number)` → 同上
   - `approveByProjectApprover(groupId: number)` → **`requireFinancePaymentGroupApprovalAccess(groupId)`** ★v3新ヘルパー（approverStaffId === user.id で gate）
   - `rejectByProjectApprover(groupId: number, ...)` → 同上

**accounting/expenses/accounting-actions.ts の権限チェック書き換え**:
   - `getAllRecurringTransactions()` → `requireStaffForAccounting("view")`（経理の全PJ横断ビュー）
8. **accounting/ 配下の全 actions.ts** で `requireStaffWithProjectPermission([{ project: "accounting", level: "xxx" }])` を `requireStaffForAccounting("xxx")` に一括置換
   - 配列に複数要素がある場合は手動判断（残す）
9. 型チェック・ビルド・コミット

**検証項目**:
- [ ] §8 のスモークテスト全項目
- [ ] §8.4 の権限回帰テスト6ケース全パス

#### Phase 6: 最終検証＋スモークテスト＋ドキュメント更新

**手順**:
1. `git tag refactor-checkpoint-phase-6-start`
2. `npx tsc --noEmit` / `docker compose exec app npx prisma generate` / `docker compose exec app npx next build`
3. `npx eslint src/ --max-warnings 0`
4. §8 のスモークテストチェックリストを**全項目実行**
5. §8.4 の権限回帰テスト6ケースを実行
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

# Phase 4 終了後（v3修正: narrow した path で false-positive を防ぐ）
rg -n "@/app/accounting/expenses/new/" src/

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

### 8.4 権限回帰テスト（v3拡張：6ケース）★最重要

別アカウントを用意して以下6ケースを確認：

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

5. **同一PJの承認者（v3追加）**:
   - 例: STPスタッフで `approverStaffId` に指名されている特定の支払グループに対し
   - [ ] **当該グループは承認できる**（`approveByProjectApprover` 成功）
   - [ ] **同じPJの別の支払グループ（自分が承認者でない）は承認できない**（403相当）
   - [ ] 取引閲覧等の通常動作は通常通り

6. **同一PJの非承認者（v3追加）**:
   - 例: STPスタッフだが `approverStaffId` に指名されていないアカウント
   - [ ] **どの支払グループも承認できない**（`approveByProjectApprover` 拒否）
   - [ ] 取引閲覧等の通常動作は通常通り
   - [ ] 別の経路（直接DB更新等）で status を遷移させようとしても helper で弾かれる

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

#### (b) per-record helper の戻り値設計（v5: lean に統一・loader Server Action と分離）
- helper は **lean に統一**（`{ id, projectId, project: { code } }` のみ）
- 重い `include` が必要な箇所は **loader Server Action を別途用意**（§4.3.4・§4.3.6）
- 「helperの戻り値だけで済むケース」と「loader が必要なケース」を §4.3.5 のマッピング表で明示
- **絶対にやらないこと**: helperに「ある時は最小、ある時は重い」の二面性を持たせる（v2の曖昧さ）

#### (c) Server Action の `"use server"` ファイル単位制約
- Next.js では `"use server"` がファイル先頭にあれば、そのファイルの全 export 関数が Server Action 扱い
- accounting-actions.ts 新設時に `"use server"` を忘れずに先頭に付ける

#### (d) Next.js 16.1.6 / Turbopack のキャッシュ
- ファイル移動後は **必ず** `docker compose exec app rm -rf .next && docker compose restart app`（CLAUDE.mdの運用ルールどおり）
- Turbopack は import path の変更を見逃すケースがある

#### (e) per-record helper の「レコード未存在」ハンドリング（v4: typed error に統一）
- `prisma.transaction.findFirst({ id, deletedAt: null })` が null の場合、helperは **`throw new FinanceRecordNotFoundError("Transaction", id)`**（generic `Error` ではなく専用クラス）
- 同様に権限不足の場合は **`throw new FinanceForbiddenError(...)`**
- 呼び出し元での変換規則は §4.3.3 参照:
  - (a) Page Loader（Server Component）→ `notFound()` または専用エラーUI
  - (b) Server Action → `ActionResult.err()`
  - (c) API Route → `NextResponse.json({error}, {status: 404|403})`
  - (d) Client Component から呼ぶ Server Action → `Result<T>` 形式に変換

---

## 11. 完了基準（Definition of Done）— v2: 文言修正

以下がすべて✅になった時点で完了とする：

- [ ] `src/app/finance/` が新設され、§5.1 の「finance移動対象」全ファイルが移動済み
- [ ] §5.1 の「accountingに残すもの」が引き続き `src/app/accounting/` 内にある
- [ ] `src/app/accounting/transactions/accounting-actions.ts` が新設され、accounting系3関数が分離されている
- [ ] `src/app/accounting/transactions/allocation-group-item-accounting-actions.ts` が新設され、`getRelatedGroupsForTransaction`・`batchUpdateGroupStatus` が分離されている（v3追加）
- [ ] `src/app/accounting/expenses/accounting-actions.ts` が新設され、`getAllRecurringTransactions` が分離されている
- [ ] `src/lib/auth/staff-action.ts` に `requireStaffForFinance`・`requireStaffForAccounting` が追加されている
- [ ] `src/lib/auth/finance-access.ts` が新設され、per-record helpers 6種（v3拡張）+ エラークラス2種が追加されている
  - `requireFinanceTransactionAccess`
  - `requireFinanceInvoiceGroupAccess`
  - `requireFinancePaymentGroupAccess`
  - `requireFinanceProjectAccess`
  - `requireFinanceProjectCodeAccess` ★v3新設
  - `requireFinancePaymentGroupApprovalAccess` ★v3新設
  - `FinanceRecordNotFoundError` クラス ★v3新設
  - `FinanceForbiddenError` クラス ★v3新設
- [ ] `src/app/finance/transactions/loaders.ts` 等の loader Server Action が必要箇所に新設されている（§4.3.6）
- [ ] **client から呼ばれる取得系（`getComments`・`getGroupAllocationWarnings`・`getTransactionForPreview` 等）が `Result<T>` 形式で返している**（v5新規DoD・§4.3.3(d)）
- [ ] **対応する client component（`comment-section.tsx`・`invoice-group-detail-modal.tsx`・`payment-group-detail-modal.tsx`・`transaction-preview-modal.tsx`）が `result.ok` 分岐で「未存在/権限なし/その他エラー」を区別して表示している**（v5新規DoD）
- [ ] §5.2 + §5.3 の cross-project import 21箇所が全て新パスに更新されている
- [ ] accounting 内部の相対／絶対 import も全て新パスに更新されている
- [ ] `rg -n "@/app/accounting/(changelog|comments|transactions/(actions|allocation-actions|allocation-group-item-actions|transaction-form|transaction-status-badge)|expenses/new)" src/` が0件
- [ ] `src/app/finance/` 配下の全 Server Action が per-record helper を使っている（または `requireStaffForFinance` を使っている、引数による）
- [ ] `src/app/accounting/` 配下で `requireStaffWithProjectPermission([{ project: "accounting", ... }])` の直接呼び出しが消えている（例外は個別判断）
- [ ] `npx tsc --noEmit` エラーゼロ
- [ ] `docker compose exec app npx next build` 成功
- [ ] `npx eslint src/ --max-warnings 0` 警告ゼロ
- [ ] §8 のスモークテスト項目がすべて✅
- [ ] §8.4 の権限回帰テスト6ケースがすべて✅
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

#### 計画v5の最終確認依頼（着手前最終チェック）

```
v4 計画書に対するCodexレビュー（P1 2件 + Minor 1件）を全件反映した
v5 計画書をレビューしてください。

@docs/finance-accounting-refactor-plan.md

v4 → v5 の主な変更点（全て Result<T> 規約の徹底）:
1. §6.3 Phase 5: getComments() の戻り値型を Promise<CommentWithReplies[]> から Promise<Result<CommentWithReplies[]>> に変更
   + comment-section.tsx の呼び出し側修正手順を明記
2. §6.3 Phase 5: getGroupAllocationWarnings() も同様に Result<T> 化
   + invoice-group-detail-modal.tsx / payment-group-detail-modal.tsx の修正手順を明記
3. §4.3.5 マッピング: preview-modal は getTransactionForPreview(id) wrapper 経由に統一
4. §10.2(b)・DoD 等の旧用語「page-loader wrapper」を「loader Server Action」に置換
5. DoD に v5 新規項目追加（client取得系の Result<T> 化、UI 分岐表示）

このv5で実装に入って大丈夫か、最終確認お願いします。
特にこれまでの指摘で未対応・未反映のものがないかチェックしてください。
問題なければ Phase 0 から実装着手します。
```

#### 計画v4の再レビュー依頼（履歴・短時間で完了想定）

```
v3 計画書に対するCodexレビュー（Major 4件 + Minor 1件、全て文書整合性問題）を全件反映した
v4 計画書をレビューしてください。

@docs/finance-accounting-refactor-plan.md

v3 → v4 の主な変更点（全て文書整合性修正・アーキテクチャ変更なし）:
1. §4.3.3 に (d) パターン追加: client component から呼ぶ server function を Result<T> 形式で返す規約を明示
2. §4.3.4/§4.3.6: 「page-loader」を「loader Server Action」に呼称変更、配置・命名・client/server両対応を整理
3. §6.3 Phase 3: allocation-group-item-actions 分割を手順に反映、loaders.ts 新設手順を追加
4. §6.3 Phase 5: getTransactionById 廃止 → getTransactionMinimal/getTransactionForDetailPage 導入と3呼び出し元置換に書き換え
5. §10.2(e): generic Error → FinanceRecordNotFoundError / FinanceForbiddenError に統一
6. 下流文言（Phase 5/6/DoD）の「4ケース」を「6ケース」に統一

このv4で実装に入って大丈夫か、特に以下を確認してください:
- §4.3.3(d) Client から呼ぶ Server Action の Result<T> 規約に漏れはないか
- §4.3.4/§4.3.6 loader Server Action の説明と Phase 3/5 の手順が一致しているか
- v3→v4 の文言整合修正で新たに生まれた矛盾はないか
- アーキテクチャ的に実装着手OKか
```

#### 計画v3の再レビュー依頼（履歴）

```
v2 計画書に対するCodexレビュー（Major 6件 + Minor 2件）を全件反映した
v3 計画書をレビューしてください。

@docs/finance-accounting-refactor-plan.md

v2 → v3 の主な変更点（Codex 2次レビュー反映）:
1. helper 戻り値の不整合解消: lean に統一 + 重い include は page-loader wrapper に分離（§4.3.4・§4.3.6）
2. 「未存在エラー」契約を明確化: FinanceRecordNotFoundError / FinanceForbiddenError クラス + 呼び出し元での変換パターン規定（§4.3.3）
3. 経費系の実シグネチャ対応: requireFinanceProjectCodeAccess(projectCode: string|null) を新設（§4.3）
4. 承認系を明確化: requireFinancePaymentGroupApprovalAccess(groupId) を新設、approverStaffId === user.id ベースで gate（§4.3）
5. allocation-group-item-actions.ts の分割明記: shared サブセット + accounting 専用サブセットに分離（§5.1.1.1）
6. Phase 4 検証コマンドの narrow: @/app/accounting/expenses/new/ に修正（§7.2・Phase 4検証項目）
7. 権限回帰テストに承認系2ケース追加: 6ケースに拡張（§8.4）
8. ディレクトリツリーの allocation-confirmation-panel 二重表記を修正（§3.1）

このv3で実装に入って大丈夫か、特に以下を重点レビューしてください:
- §4.3.3 未存在エラー契約：page loader / Server Action / API route の3パターンに漏れはないか
- §4.3.4 / §4.3.6 page-loader wrapper の責務分離は妥当か
- §4.3.5 既存 getTransactionById の置換マッピングに漏れはないか
- §5.1.1.1 allocation-group-item-actions の分割粒度は妥当か（特に addAllocationItemToGroup / removeAllocationItemFromGroup を shared に置く判断）
- §6.3 Phase 5 の経費・承認系適用パターンに残存する誤適用はないか
- §8.4 権限回帰テスト6ケースで approval semantics が守られているか
- v2 から v3 への変更で新たに生まれた矛盾や見落とし
```

#### 計画v2の再レビュー依頼（履歴）

```
※ v2 → v3 で対応済。記録のため残置。
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
