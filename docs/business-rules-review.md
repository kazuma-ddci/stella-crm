# ビジネスルール レビュー報告書

このドキュメントはstella-crmのビジネスルールにおけるギャップ、矛盾、改善提案を整理したものです。

**最終更新日**: 2026-02-07

---

## 目次

1. [カスケード削除の危険性](#1-カスケード削除の危険性)
2. [FK制約エラーのリスク（Cascadeなし）](#2-fk制約エラーのリスクcascadeなし)
3. [未使用・未呼び出しの疑いがあるコード](#3-未使用未呼び出しの疑いがあるコード)
4. [データ整合性の懸念](#4-データ整合性の懸念)
5. [ロジックの重複・分散](#5-ロジックの重複分散)
6. [エッジケース・境界条件](#6-エッジケース境界条件)
7. [権限・セキュリティ](#7-権限セキュリティ)
8. [論理削除と物理削除の混在](#8-論理削除と物理削除の混在)
9. [画面間整合性](#9-画面間整合性)
10. [改善提案サマリー](#10-改善提案サマリー)

---

## 1. カスケード削除の危険性

### 1-1. Stella企業削除の波及範囲が極大

| 重要度 | 高（データ消失リスク） |
|-------|---------------------|
| **問題** | `MasterStellaCompany` 削除時、onDelete: Cascadeにより `StpCompany` → `StpRevenueRecord`/`StpExpenseRecord`/`StpInvoice`/`StpStageHistory` 等が全て連鎖削除される |
| **影響** | 財務データ（売上・経費・請求書）、ステージ履歴、KPIデータが全て消失 |
| **現状** | UI側で削除確認ダイアログがあるかは未確認 |
| **提案** | (A) Stella企業の物理削除を禁止し論理削除のみにする、または (B) 削除前にSTP企業・財務データの存在チェックを実装し、紐づきがある場合は削除をブロックする |

### 1-2. STP企業削除で財務データが消失

| 重要度 | 高 |
|-------|-----|
| **問題** | `StpCompany` 削除時、`StpRevenueRecord`/`StpExpenseRecord`/`StpInvoice` がカスケード削除される |
| **影響** | 月次締め済みの売上・経費も含めて消失。消込済みの `StpPaymentAllocation` が孤立する可能性 |
| **提案** | 月次締め済み月のデータがある場合は削除をブロックする処理の追加 |

### 1-3. 代理店削除で経費データが消失

| 重要度 | 高 |
|-------|-----|
| **問題** | `StpAgent` 削除時、`StpExpenseRecord`/`StpInvoice` がカスケード削除される |
| **影響** | 代理店への支払い記録が全て消失。会計上の記録が失われる |
| **提案** | 代理店にも論理削除を導入、または経費レコード存在時の削除ブロック |

---

## 2. FK制約エラーのリスク（Cascadeなし）

### 2-1. StpRevenueRecord/StpExpenseRecord → StpPaymentAllocation

| 重要度 | 中〜高 |
|-------|--------|
| **問題** | `StpPaymentAllocation` の `revenueRecordId`/`expenseRecordId` にはonDelete: Cascadeが設定されていない |
| **影響** | 売上/経費レコード削除（論理削除ではなく物理削除の場合）時にFK制約エラー。現在は論理削除なのでリスクは低いが、カスケード経由（STP企業削除→売上削除）では物理削除されるため発生する |
| **提案** | (A) `StpPaymentAllocation` にonDelete: Cascadeを追加、または (B) STP企業削除前にPaymentAllocationの存在チェック |

### 2-2. StpRevenueRecord/StpExpenseRecord → StpFinanceEditLog

| 重要度 | 中 |
|-------|-----|
| **問題** | `StpFinanceEditLog` の `revenueRecordId`/`expenseRecordId` にonDelete: Cascadeが未設定 |
| **影響** | 売上/経費レコードがカスケード削除された場合、編集ログが孤立またはFK制約エラー |
| **提案** | onDelete: Cascadeの追加（編集ログは親レコードと一緒に削除で問題ない） |

### 2-3. StpRevenueRecord/StpExpenseRecord → AccountingReconciliation

| 重要度 | 中 |
|-------|-----|
| **問題** | `AccountingReconciliation` の `revenueRecordId`/`expenseRecordId` にonDelete: Cascadeが未設定 |
| **影響** | 売上/経費レコードがカスケード削除された場合、会計照合レコードが孤立 |
| **提案** | onDelete: SetNullにする（照合データは残しつつ参照をクリア）か、削除前チェックを追加 |

### 2-4. StpRevenueRecord/StpExpenseRecord → StpInvoiceLineItem

| 重要度 | 中 |
|-------|-----|
| **問題** | `StpInvoiceLineItem` の `revenueRecordId`/`expenseRecordId` にonDelete: Cascadeが未設定 |
| **影響** | 売上/経費レコード削除時に請求書明細行が孤立 |
| **提案** | onDelete: SetNull（明細行は残すが紐付けをクリア） |

### 2-5. StpContractHistory → StpRevenueRecord/StpExpenseRecord

| 重要度 | 中 |
|-------|-----|
| **問題** | `StpRevenueRecord.contractHistoryId` / `StpExpenseRecord.contractHistoryId` にonDelete: Cascadeが未設定 |
| **影響** | 契約履歴が（論理削除ではなく）カスケードで物理削除された場合、売上/経費レコードのcontractHistoryIdが無効な参照になる |
| **現状** | StpContractHistoryは論理削除（deletedAt）のため、直接の物理削除はないが、MasterStellaCompany→StpContractHistoryのCascadeパスが存在 |
| **提案** | StpContractHistoryからのCascadeをMasterStellaCompanyレベルでブロックするか、onDelete: SetNullを追加 |

---

## 3. 未使用・未呼び出しの疑いがあるコード

### 3-1. アカウントロックアウト機能

| 重要度 | 中 |
|-------|-----|
| **場所** | `src/lib/auth/login-history.ts:27-86` の `isAccountLocked()` |
| **問題** | 30分以内に5回失敗でロックする機能が実装されているが、実際のログイン処理（`src/auth.ts`）でこの関数を呼び出している箇所が確認できない |
| **影響** | セキュリティ機能として設計されたが、未使用の可能性がある。外部ユーザーのブルートフォース攻撃に対する防御が機能していない恐れ |
| **提案** | (A) `src/auth.ts` のauthorize関数内で `isAccountLocked()` を呼び出すように修正、または (B) 使用しないなら削除して混乱を避ける |

### 3-2. 会計連携フィールド（freee連携準備）

| 重要度 | 低 |
|-------|-----|
| **場所** | `StpRevenueRecord.accountingStatus/accountingService/accountingExternalId/accountingSyncedAt`、`StpExpenseRecord` の同等フィールド |
| **問題** | freee連携の準備としてカラムが用意されているが、対応するビジネスロジックが未実装 |
| **影響** | 現時点では影響なし。将来実装時の参考情報として記録 |
| **提案** | 現状維持。将来のfreee連携実装時に活用 |

---

## 4. データ整合性の懸念

### 4-1. StpCompanyとStpContractHistoryの情報重複

| 重要度 | 中 |
|-------|-----|
| **問題** | `StpCompany` に `contractPlan`, `initialFee`, `monthlyFee`, `performanceFee`, `contractStartDate`, `contractEndDate` 等の契約情報フィールドがあるが、`StpContractHistory` にも同様のフィールドが存在する |
| **影響** | どちらがSource of Truthか不明確。契約履歴を更新してもStpCompanyの契約情報が同期されない可能性、またはその逆 |
| **現状** | StpCompanyの契約フィールドは「後でロジック構築・自動入力」とコメントされており、手動入力の過渡期の可能性 |
| **提案** | (A) StpCompanyの契約情報フィールドを非推奨にし、最新のStpContractHistoryから取得するビューを実装、または (B) 契約履歴作成時にStpCompanyの契約情報を自動同期する仕組みを追加 |

### 4-2. STP企業のステータスフィールドとステージの重複

| 重要度 | 低 |
|-------|-----|
| **問題** | `StpCompany.operationStatus` とステージ管理が別々に存在し、独立して変更可能 |
| **影響** | ステージが「受注」なのにoperationStatusが「テスト1」のまま等の不整合が起こりうる |
| **提案** | ステージ遷移時にoperationStatusの妥当性チェックを追加、または運用ステータスをステージと連動させる |

### 4-3. 請求書削除時のRevenueRecord/ExpenseRecord紐付け解除のみ

| 重要度 | 低〜中 |
|-------|--------|
| **問題** | 請求書削除時（ルール5-07）、紐づくRevenueRecord/ExpenseRecordの `invoiceId` をnullにクリアするが、対応する `StpInvoiceLineItem` は請求書のCascade削除で物理削除される |
| **影響** | 請求書明細行が消えた後、売上/経費レコードから「どの明細行と紐づいていたか」の履歴が失われる |
| **提案** | 影響は限定的だが、必要に応じて明細行にも論理削除を導入 |

### 4-4. 消込ステータスと実態のずれリスク

| 重要度 | 中 |
|-------|-----|
| **問題** | `StpPaymentTransaction.status`（unmatched/partial/matched）と `StpRevenueRecord.paymentStatus`（null/partial/paid/completed_different）は配分操作ごとに再計算されるが、配分を介さず直接レコードを更新した場合にステータスがずれる |
| **影響** | 手動でpaidDate/paidAmountを直接編集した場合、消込ステータスとの不整合 |
| **提案** | paidDate/paidAmountの手動編集を制限するか、編集時にpaymentStatusの再計算を強制する |

---

## 5. ロジックの重複・分散

### 5-1. 税計算ロジック

| 重要度 | 低 |
|-------|-----|
| **場所** | `src/lib/finance/auto-generate.ts:38-64` (calcTaxAmount/calcTotalWithTax) と `src/lib/finance/invoice-tax.ts` |
| **状況** | 売上/経費の税計算と請求書の税率別集計が別ファイルに分散 |
| **影響** | 税率や計算方式の変更時に複数箇所を修正する必要がある |
| **提案** | 税計算を1つのモジュールに統合（例: `src/lib/finance/tax.ts`） |

### 5-2. 月次締めチェック

| 重要度 | 低 |
|-------|-----|
| **場所** | `src/lib/finance/monthly-close.ts` (STP月次締め) と `src/app/accounting/monthly-close/page.tsx` (会計月次締め) |
| **状況** | STP月次締め（StpMonthlyClose）と会計月次締め（AccountingMonthlyClose）は独立した仕組み |
| **影響** | STPが月次締めしても会計がオープン、またはその逆が発生しうる。2つの締めの関係が不明確 |
| **提案** | (A) STP月次締め→会計月次締めの連携を明確にするか、(B) STP月次締めが会計月次締めの前提条件であることを強制するガード追加 |

### 5-3. 契約番号の採番ロジック

| 重要度 | 低 |
|-------|-----|
| **場所** | `src/lib/contracts/generate-number.ts` (STP-YYYYMM-XXX形式) と `src/lib/finance/invoice-number.ts` (INV-YYYYMM-NNNN形式) |
| **状況** | 2つの採番ロジックが別々のファイルに存在。パターンは類似（年月ベース+連番） |
| **影響** | 重大な問題ではないが、パターンが類似しているため共通化の余地がある |
| **提案** | 現状維持でも可。共通の採番ヘルパーを作成すればメンテナンス性向上 |

---

## 6. エッジケース・境界条件

### 6-1. 月額売上の自動生成期間（3ヶ月先）の端数処理

| 重要度 | 中 |
|-------|-----|
| **問題** | `AUTO_GENERATE_MONTHS = 3` で最大3ヶ月先まで月額売上を自動生成するが、契約終了日が月途中の場合の按分計算がない |
| **影響** | 契約終了月でも満額の売上レコードが生成される可能性 |
| **提案** | 契約終了月の按分ロジック追加、または仕様として「契約終了月も満額」を明文化 |

### 6-2. 成果報酬と求職者のマッチング

| 重要度 | 中 |
|-------|-----|
| **問題** | `autoGeneratePerformanceFeeForCandidate()` で、求職者の入社日に基づいてアクティブ契約を検索するが、0件やの場合はエラー、複数件の場合もエラー |
| **影響** | 1企業に複数のアクティブ契約がある場合（例: 一般+派遣、異なる媒体）、成果報酬の自動生成がブロックされる |
| **提案** | 求職者のindustryType/jobMediaで契約をフィルタリングしてマッチング精度を向上させる |

### 6-3. 源泉徴収の閾値（100万円）の適用単位

| 重要度 | 低 |
|-------|-----|
| **問題** | 源泉徴収は1回の支払いごとに100万円の閾値で税率が変わるが、月間の合計支払額で判定すべきか、1レコードごとか |
| **現状** | 経費レコードの `expectedAmount` 単位で計算（1レコードごと） |
| **提案** | 税務上の正確性を確認し、必要に応じて月間合計での再計算を検討 |

### 6-4. 赤伝（クレジットノート）と消込の整合性

| 重要度 | 中 |
|-------|-----|
| **問題** | 赤伝はマイナス金額の請求書として作成されるが、消込（StpPaymentAllocation）でマイナス金額の配分がどう処理されるか不明確 |
| **影響** | recalcTransactionStatus/recalcRecordPaymentStatusがマイナス金額を正しく処理できない可能性 |
| **提案** | 赤伝に対する消込のテストケース追加と、マイナス金額の処理フローの明文化 |

### 6-5. 同時編集によるステージ履歴の競合

| 重要度 | 低 |
|-------|-----|
| **問題** | 2人のユーザーが同時にステージ管理モーダルを開いて変更した場合、楽観的ロックの仕組みがない |
| **影響** | 後から保存した変更が先の変更を上書きする可能性（ステージ変更自体はトランザクション内だが、fromStageIdの整合性が崩れうる） |
| **提案** | updatedAtベースの楽観的ロックの追加を検討 |

---

## 7. 権限・セキュリティ

### 7-1. 外部ユーザーの却下処理が物理削除

| 重要度 | 中 |
|-------|-----|
| **問題** | 外部ユーザー登録の却下時（ルール9-06）、`ExternalUser` を物理削除している |
| **影響** | 不正登録の試行履歴が残らない。同じメールアドレスで再登録が可能になる（意図的かもしれないが） |
| **提案** | (A) 論理削除（status="rejected"）に変更し、却下理由も記録する、または (B) 物理削除が意図的なら「同じメールで再登録可能」を仕様として明文化 |

### 7-2. DisplayView権限変更のリアルタイム反映

| 重要度 | 低 |
|-------|-----|
| **問題** | `ExternalUserDisplayPermission` を変更してもセッションが更新されない可能性がある |
| **影響** | 権限を剥奪してもログイン中のユーザーはセッション有効期限まで閲覧可能 |
| **提案** | ミドルウェアで毎回DB確認するか、権限変更時にセッションを無効化する仕組み |

### 7-3. 管理画面アクセスの権限チェック

| 重要度 | 低 |
|-------|-----|
| **問題** | `/admin/*` はAPI側（`src/app/api/admin/users/route.ts`）でadmin権限チェックを行っているが、ミドルウェアレベルでの一括チェックが確認できない |
| **影響** | 新しいadmin APIエンドポイントを追加する際に権限チェック漏れのリスク |
| **提案** | ミドルウェアで `/admin/*` パスにadmin権限チェックを追加 |

---

## 8. 論理削除と物理削除の混在

### 8-1. 削除方式の一貫性

現在のシステムでは、テーブルによって削除方式が異なります：

| テーブル | 削除方式 | 備考 |
|---------|---------|------|
| StellaCompanyLocation | 論理削除（deletedAt） | |
| StellaCompanyContact | 論理削除（deletedAt） | |
| StellaCompanyBankAccount | 論理削除（deletedAt） | |
| ContactHistory | 論理削除（deletedAt） | |
| StpContractHistory | 論理削除（deletedAt） | |
| StpStageHistory | 論理削除的（isVoided） | 独自の取り消し方式 |
| StpRevenueRecord | 論理削除（deletedAt） | |
| StpExpenseRecord | 論理削除（deletedAt） | |
| StpInvoice | 論理削除（deletedAt） | |
| StpPaymentTransaction | 論理削除（deletedAt） | |
| StpAgentContractHistory | 論理削除（deletedAt） | |
| ExternalUser（却下時） | **物理削除** | 7-1参照 |
| StpPaymentAllocation | **物理削除** | 消込解除で物理削除 |
| MasterStellaCompany | **Cascade物理削除** | 1-1参照 |
| StpCompany | **Cascade物理削除** | 1-2参照 |
| StpAgent | **Cascade物理削除** | 1-3参照 |

| 重要度 | 中 |
|-------|-----|
| **問題** | 論理削除と物理削除が混在しており、一貫性がない |
| **影響** | 開発者が新機能追加時にどちらの方式を使うべきか判断に迷う。Cascade物理削除が論理削除レコードの子テーブルを消す場合、想定外のデータ消失が起こりうる |
| **提案** | 削除方式のポリシーを策定し、ドキュメント化する。特にCascade物理削除の対象テーブルは慎重にレビュー |

---

## 9. 画面間整合性

### 9-1. STP企業テーブルのインライン編集と契約履歴の不一致

| 重要度 | 中 |
|-------|-----|
| **問題** | STP企業テーブル（`stp-companies-table.tsx`）でインライン編集された `monthlyFee`/`performanceFee`/`contractPlan` は `StpCompany` に保存されるが、`StpContractHistory` は更新されない |
| **影響** | テーブル上の表示と契約履歴モーダルの表示が不一致になる可能性 |
| **提案** | 4-1と同様、StpCompanyの契約情報フィールドの役割を明確化 |

### 9-2. 代理店契約変更と既存経費レコードの差異通知

| 重要度 | 低 |
|-------|-----|
| **問題** | 代理店契約の報酬率を変更すると `markExpenseRecordsForAgentChange()` で差異がマークされるが、ユーザーへの通知・ダッシュボード表示がない可能性 |
| **影響** | 差異がマークされても気づかれず放置される恐れ |
| **提案** | 財務ダッシュボードに「元データ変更あり」のフィルタ/通知を追加 |

### 9-3. revalidatePathの網羅性

| 重要度 | 低 |
|-------|-----|
| **問題** | データ更新後に `revalidatePath` を呼んでいるが、影響する全パスを網羅しているか未確認 |
| **影響** | 特に他画面に影響するデータ更新（例：企業名変更→STP企業テーブルにも反映すべき）で、キャッシュが古いままになる可能性 |
| **提案** | 横断的なデータ変更（企業情報、スタッフ情報など）時のrevalidatePathを監査 |

---

## 10. 改善提案サマリー

### 優先度: 高（データ消失・整合性リスク）

| # | 課題 | 提案 | 対象 |
|---|------|------|------|
| H-1 | Stella企業削除の波及範囲 (1-1) | 論理削除への変更、または子データ存在時の削除ブロック | `MasterStellaCompany` |
| H-2 | STP企業削除で財務データ消失 (1-2) | 月次締め済みデータがある場合の削除ブロック | `StpCompany` |
| H-3 | 代理店削除で経費データ消失 (1-3) | 論理削除への変更、または経費データ存在時の削除ブロック | `StpAgent` |
| H-4 | PaymentAllocationのFK制約エラー (2-1) | onDelete: Cascade追加、またはSTP企業削除前チェック | `StpPaymentAllocation` |
| H-5 | FinanceEditLogのFK制約エラー (2-2) | onDelete: Cascade追加 | `StpFinanceEditLog` |

### 優先度: 中（機能不全・仕様不明確）

| # | 課題 | 提案 | 対象 |
|---|------|------|------|
| M-1 | アカウントロックアウト未使用 (3-1) | ログイン処理への組み込み、または削除 | `isAccountLocked()` |
| M-2 | StpCompanyとStpContractHistoryの情報重複 (4-1) | Source of Truthの明確化 | スキーマ設計 |
| M-3 | 消込ステータスと手動編集の不整合 (4-4) | 手動編集時のステータス再計算 | 消込ロジック |
| M-4 | 月額売上の端数処理 (6-1) | 契約終了月の按分ロジック追加 | 自動生成ロジック |
| M-5 | 成果報酬の複数契約マッチング (6-2) | 業種/媒体でのフィルタリング | 自動生成ロジック |
| M-6 | 赤伝と消込の整合性 (6-4) | マイナス金額の処理フロー明文化 | 消込ロジック |
| M-7 | 外部ユーザー却下の物理削除 (7-1) | 論理削除(status=rejected)への変更 | 外部ユーザー管理 |
| M-8 | AccountingReconciliationのFK (2-3) | onDelete: SetNull追加 | `AccountingReconciliation` |
| M-9 | InvoiceLineItemのFK (2-4) | onDelete: SetNull追加 | `StpInvoiceLineItem` |

### 優先度: 低（改善余地あり）

| # | 課題 | 提案 | 対象 |
|---|------|------|------|
| L-1 | 税計算ロジックの分散 (5-1) | 1モジュールへの統合 | 財務ロジック |
| L-2 | STP/会計月次締めの関係不明確 (5-2) | 連携・前提条件の明確化 | 月次締めロジック |
| L-3 | DisplayView権限のリアルタイム反映 (7-2) | ミドルウェアでのDB確認 | 認証ロジック |
| L-4 | admin APIの権限チェック一元化 (7-3) | ミドルウェアでの一括チェック | ミドルウェア |
| L-5 | 論理/物理削除ポリシーの策定 (8-1) | ドキュメント化 | 全体 |
| L-6 | revalidatePathの網羅性監査 (9-3) | 横断データ変更の影響パス確認 | 全actions.ts |
| L-7 | ステージ同時編集の楽観ロック (6-5) | updatedAtベースの競合検出 | ステージ管理 |

---

## 付録: 全Cascadeパス一覧

削除時に連鎖が発生するパスの完全な一覧：

```
MasterStellaCompany
├── → StellaCompanyLocation (Cascade)
├── → StellaCompanyContact (Cascade)
├── → StellaCompanyBankAccount (Cascade)
├── → ContactHistory (Cascade)
│   ├── → ContactHistoryFile (Cascade)
│   └── → ContactHistoryRole (Cascade)
├── → StpCompany (Cascade)
│   ├── → StpStageHistory (Cascade)
│   ├── → StpCompanyContract (Cascade)
│   ├── → StpProposal (Cascade)
│   ├── → StpKpiSheet (Cascade)
│   │   ├── → StpKpiWeeklyData (Cascade)
│   │   └── → StpKpiShareLink (Cascade)
│   ├── → StpRevenueRecord (Cascade) ⚠️
│   │   ├── → StpPaymentAllocation (Cascadeなし!) ❌
│   │   ├── → StpFinanceEditLog (Cascadeなし!) ❌
│   │   ├── → StpInvoiceLineItem (Cascadeなし!) ❌
│   │   └── → AccountingReconciliation (Cascadeなし!) ❌
│   ├── → StpExpenseRecord (Cascade) ⚠️
│   │   ├── → StpPaymentAllocation (Cascadeなし!) ❌
│   │   ├── → StpFinanceEditLog (Cascadeなし!) ❌
│   │   ├── → StpInvoiceLineItem (Cascadeなし!) ❌
│   │   └── → AccountingReconciliation (Cascadeなし!) ❌
│   ├── → StpAgentCommissionOverride (Cascade)
│   ├── → StpInvoice (Cascade)
│   │   └── → StpInvoiceLineItem (Cascade)
│   └── → StpCandidate (Cascadeなし、SetNull相当)
├── → StpContractHistory (Cascade) ⚠️
│   ├── → StpRevenueRecord (Cascadeなし!) ❌
│   └── → StpExpenseRecord (Cascadeなし!) ❌
└── → (ExternalUser, RegistrationToken は参照のみ、Cascadeなし)

StpAgent
├── → StpAgentContract (Cascade)
├── → StpAgentStaff (Cascade)
├── → StpAgentContractHistory (Cascade)
│   ├── → StpAgentCommissionOverride (Cascade)
│   └── → StpExpenseRecord (Cascadeなし!) ❌
├── → StpLeadFormToken (Cascade)
│   └── → StpLeadFormSubmission (Cascade)
├── → StpExpenseRecord (Cascade)
│   ├── → StpPaymentAllocation (Cascadeなし!) ❌
│   ├── → StpFinanceEditLog (Cascadeなし!) ❌
│   └── → StpInvoiceLineItem (Cascadeなし!) ❌
└── → StpInvoice (Cascade)
    └── → StpInvoiceLineItem (Cascade)

AccountingTransaction
├── → AccountingReconciliation (Cascade)
└── → AccountingVerification (Cascade)

ExternalUser
├── → ExternalUserDisplayPermission (Cascade)
├── → LoginHistory (Cascade)
├── → EmailVerificationToken (Cascade)
└── → PasswordResetToken (Cascade)

MasterStaff
├── → StaffPermission (Cascade)
├── → StaffRoleAssignment (Cascade)
├── → StaffProjectAssignment (Cascade)
└── → StpAgentStaff (Cascade)

StpPaymentTransaction
└── → StpPaymentAllocation (Cascade)
```

**凡例**:
- ⚠️ = 財務データを含むため注意
- ❌ = Cascadeが設定されていないためFK制約エラーのリスクあり
