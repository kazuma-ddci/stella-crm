# ビジネスルール一覧表

このドキュメントはstella-crmに存在する全てのビジネスルールを体系的に整理したものです。

**最終更新日**: 2026-02-07

---

## 目次

1. [ステージ管理](#1-ステージ管理)
2. [企業管理（Stella/STP）](#2-企業管理stellastp)
3. [契約管理](#3-契約管理)
4. [財務（売上・経費）](#4-財務売上経費)
5. [請求書管理](#5-請求書管理)
6. [入出金・消込](#6-入出金消込)
7. [月次締め](#7-月次締め)
8. [認証・権限](#8-認証権限)
9. [外部ユーザー管理](#9-外部ユーザー管理)
10. [リード獲得フォーム](#10-リード獲得フォーム)
11. [代理店管理](#11-代理店管理)
12. [会計（横断）](#12-会計横断)
13. [共通ロジック](#13-共通ロジック)

---

## 1. ステージ管理

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 1-01 | ロジック | ステージ変更 | currentStageId !== newStageId | イベント検出（12種類: progress/back/achieved/commit/recommit/cancel/won/lost/suspended/resumed/revived/reason_updated） | StpStageHistory | `src/lib/stage-transition/event-detector.ts:16-408` | stageTypeとdisplayOrderで判定 |
| 1-02 | ロジック | ステージ変更（進行→進行） | displayOrder増加 | progressイベント検出 | StpStageHistory | `src/lib/stage-transition/event-detector.ts:128-145` | |
| 1-03 | ロジック | ステージ変更（進行→進行） | displayOrder減少 | backイベント検出 | StpStageHistory | `src/lib/stage-transition/event-detector.ts:146-155` | |
| 1-04 | ロジック | ステージ変更 | newStageId === currentTargetStageId | achievedイベント検出（目標達成） | StpStageHistory | `src/lib/stage-transition/event-detector.ts:48-60` | |
| 1-05 | ロジック | 目標達成と同時に新目標設定 | achieved + newTargetStageId !== null | achieved + commitの2イベントを同時作成 | StpStageHistory（2レコード） | `src/lib/stage-transition/event-detector.ts:62-69` | |
| 1-06 | ロジック | 受注/失注/検討中ステージへ遷移 | stageType = closed_won/closed_lost/pending かつ新目標未設定 | nextTargetStageId/nextTargetDateを自動null化 | StpCompany | `src/app/stp/companies/stage-management/actions.ts:245-249` | |
| 1-07 | ロジック | 検討中ステージへ遷移 | stageType = pending | pendingReason/pendingResponseDateをStpCompanyに保存 | StpCompany | `src/app/stp/companies/stage-management/actions.ts:263-270` | |
| 1-08 | ロジック | 検討中から別ステージへ遷移 | 旧stageType=pending → 新stageType≠pending | pendingResponseDateを自動null化 | StpCompany | `src/app/stp/companies/stage-management/actions.ts:272-276` | |
| 1-09 | ロジック | recommitイベント検出 | 目標ステージまたは目標日の変更 | subType判定（positive/negative/neutral）：ステージ引き上げ+前倒し=positive、引き下げ+延期=negative | StpStageHistory | `src/lib/stage-transition/event-detector.ts:295-359` | |
| 1-10 | ロジック | ステージ変更時 | イベント検出あり | 全イベントをStpStageHistoryに記録（トランザクション内） | StpStageHistory | `src/app/stp/companies/stage-management/actions.ts:213-233` | changedBy, note, alertAcknowledged等を含む |
| 1-11 | ロジック | アラートバリデーション（ERROR） | L-001: 現在より前を目標に / L-002: 同じステージを目標に / L-004: 目標なしで日付のみ / L-006: 検討中を目標に / D-001: ステージNULL / D-003: 目標なしで日付あり / G-005: 達成ステージを次の目標に / T-001: 過去日付 | 保存をブロック | UI（エラー表示） | `src/lib/stage-transition/alert-validator.ts` | ERROR = 保存不可 |
| 1-12 | ロジック | アラートバリデーション（WARNING） | S-001: 3段階以上飛び級 / S-002: 受注から変更 / S-003: 失注から復活 / G-001: 達成前に目標削除 / G-003: 3回以上延期 / D-004: 後退時理由未入力 等 | 確認画面表示、note入力で保存可能 | UI（警告表示） | `src/lib/stage-transition/alert-validator.ts` | WARNING = 確認後保存可 |
| 1-13 | ロジック | 統計計算 | モーダル表示時 | achievedCount/cancelCount/achievementRate/backCount/currentStageDays算出 | UI表示 | `src/app/stp/companies/stage-management/actions.ts:295-324` | isVoidedとreason_updatedは除外 |
| 1-14 | ロジック | 履歴取り消し | isVoided=true設定 | 該当履歴を統計・表示から除外、voidedAt/voidedBy/voidReasonを記録 | StpStageHistory | `src/app/stp/records/stage-histories/actions.ts` | 論理削除方式 |

---

## 2. 企業管理（Stella/STP）

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 2-01 | ロジック | Stella企業新規作成 | 常時 | 企業コード自動採番（SC-N形式、既存最大値+1） | MasterStellaCompany.companyCode | `src/app/companies/actions.ts` | @unique制約 |
| 2-02 | ロジック | STP企業新規作成 | companyIdが既にSTPに存在 | エラー「この企業はすでにSTPプロジェクトに登録されています」 | UI（エラー表示） | `src/app/stp/companies/actions.ts:55-66` | 重複登録防止 |
| 2-03 | ロジック | STP企業新規作成 | currentStageId指定時 | validateInitialStage()でステージバリデーション実行 | StpCompany, StpStageHistory | `src/app/stp/companies/actions.ts:39-53` | 初期ステージ設定 |
| 2-04 | リレーション | Stella企業削除 | onDelete: Cascade | StellaCompanyLocation/Contact/BankAccount/StpCompany/StpContractHistory/ContactHistory/MasterContract/ExternalUser/RegistrationTokenが連鎖削除 | 複数テーブル | `prisma/schema.prisma` | Cascadeの波及範囲に注意 |
| 2-05 | リレーション | StpCompany削除 | onDelete: Cascade | StpStageHistory/StpCompanyContract/StpProposal/StpKpiSheet/StpCandidate/StpRevenueRecord/StpExpenseRecord/StpAgentCommissionOverride/StpInvoiceが連鎖削除 | 複数テーブル | `prisma/schema.prisma` | 財務データも含まれる |
| 2-06 | 画面連携 | STP企業のインライン編集 | セルクリック | leadSourceId/forecast/salesStaffId/plannedHires等をインライン更新 | StpCompany | `src/app/stp/companies/stp-companies-table.tsx:717-769` | displayToEditMapping使用 |
| 2-07 | ロジック | 拠点の論理削除 | deletedAt設定 | 一覧表示から除外（WHERE deletedAt IS NULL） | StellaCompanyLocation | `src/app/companies/[id]/actions.ts` | |
| 2-08 | ロジック | 担当者の論理削除 | deletedAt設定 | 一覧表示から除外（WHERE deletedAt IS NULL） | StellaCompanyContact | `src/app/companies/[id]/actions.ts` | |

---

## 3. 契約管理

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 3-01 | ロジック | STP契約履歴作成 | 業種区分+プラン選択 | monthlyFee/performanceFeeを自動計算（一般+月額=15万、派遣+月額=30万、成果報酬=15万） | StpContractHistory | `src/app/stp/companies/contract-history-modal.tsx:102-122` | 手動入力切り替え可 |
| 3-02 | ロジック | STP契約履歴更新 | 金額変更あり | markFinanceRecordsForContractChange()で売上/経費レコードに差異をマーク | StpRevenueRecord/StpExpenseRecord | `src/app/stp/companies/contract-history-actions.ts:100-137` | スナップショット方式 |
| 3-03 | ロジック | STP契約履歴削除 | 削除操作 | 論理削除（deletedAt設定）、物理削除ではない | StpContractHistory | `src/app/stp/companies/contract-history-actions.ts:140-155` | |
| 3-04 | ロジック | 全社契約書作成 | STPプロジェクト | 契約番号自動採番（STP-YYYYMM-XXX形式） | MasterContract.contractNumber | `src/lib/contracts/generate-number.ts:10-27` | 月ごとの連番 |
| 3-05 | ロジック | 契約書ステータス変更 | ステータス遷移 | MasterContractStatusHistoryに履歴記録 | MasterContractStatusHistory | `src/app/stp/contracts/status-management/actions.ts` | |
| 3-06 | リレーション | MasterContract | parentContractId | 契約書の親子関係（自己参照リレーション） | MasterContract | `prisma/schema.prisma:773-799` | |

---

## 4. 財務（売上・経費）

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 4-01 | ロジック | 企業契約作成 | initialFee > 0 | 初期費用の売上レコードを自動生成（revenueType="initial"） | StpRevenueRecord | `src/lib/finance/auto-generate.ts:170-185` | isAutoGenerated=true |
| 4-02 | ロジック | 企業契約作成 | monthlyFee > 0 | 月額売上レコードを自動生成（revenueType="monthly"、最大3ヶ月先まで） | StpRevenueRecord | `src/lib/finance/auto-generate.ts:187-202` | AUTO_GENERATE_MONTHS=3 |
| 4-03 | ロジック | 求職者入社日設定 | joinDate設定 + アクティブ契約あり + performanceFee > 0 | 成果報酬の売上レコード自動生成（revenueType="performance"） | StpRevenueRecord | `src/lib/finance/auto-generate.ts:653-899` | 契約マッチング: 0件=エラー、複数=エラー |
| 4-04 | ロジック | 売上自動生成（冪等性） | 同一キー既存チェック | (stpCompanyId, contractHistoryId, revenueType, targetMonth, candidateId)が既存ならスキップ | StpRevenueRecord | `src/lib/finance/auto-generate.ts:215-275` | |
| 4-05 | ロジック | 経費自動生成（代理店直接費用） | StpCompany.agentId存在 | agent_initial/agent_monthlyの経費レコード生成 | StpExpenseRecord | `src/lib/finance/auto-generate.ts:288-340` | 代理店契約がマッチする場合のみ |
| 4-06 | ロジック | 経費自動生成（紹介報酬） | 代理店契約+報酬率設定あり | commission_initial/commission_monthly/commission_performanceの経費レコード生成 | StpExpenseRecord | `src/lib/finance/auto-generate.ts:367-416` | |
| 4-07 | ロジック | 報酬率の適用 | 経費計算時 | StpAgentCommissionOverride（企業別例外）を優先、なければStpAgentContractHistoryのデフォルト値 | StpExpenseRecord | `src/lib/finance/auto-generate.ts:905-984` | buildCommissionConfig() |
| 4-08 | ロジック | 報酬計算（月額プラン） | contractPlan="monthly" | 初期費用報酬=initialFee×initialRate/100、月額報酬=type="rate"なら月額×rate/100, "fixed"なら固定額 | StpExpenseRecord | `src/lib/finance/auto-generate.ts` | mpMonthlyDurationで期間制限 |
| 4-09 | ロジック | 報酬計算（成果報酬プラン） | contractPlan="performance" | 成果報酬=type="rate"ならperformanceFee×rate/100, "fixed"なら固定額 | StpExpenseRecord | `src/lib/finance/auto-generate.ts` | ppPerfDurationで期間制限 |
| 4-10 | ロジック | 源泉徴収計算 | agent.isIndividualBusiness=true | 100万以下: 10.21%、100万超: 102,100+超過分×20.42% | StpExpenseRecord | `src/lib/finance/withholding-tax.ts:4-11` | withholdingTaxAmount/netPaymentAmount自動算出 |
| 4-11 | ロジック | 税計算（内税） | taxType="tax_included" | taxAmount = floor(amount × rate / (100 + rate)) | StpRevenueRecord/StpExpenseRecord | `src/lib/finance/auto-generate.ts:38-52` | |
| 4-12 | ロジック | 税計算（外税） | taxType="tax_excluded" | taxAmount = floor(amount × rate / 100)、total = amount + taxAmount | StpRevenueRecord/StpExpenseRecord | `src/lib/finance/auto-generate.ts:53-64` | |
| 4-13 | ロジック | 元データ変更追跡 | 契約金額変更時 | latestCalculatedAmount/sourceDataChangedAtをマーク | StpRevenueRecord/StpExpenseRecord | `src/lib/finance/auto-generate.ts:994-1235` | スナップショット方式 |
| 4-14 | ロジック | 差異解消操作 | ユーザーが「最新値反映」選択 | expectedAmountをlatestCalculatedAmountで上書き、税額再計算 | StpRevenueRecord/StpExpenseRecord | `src/app/stp/finance/revenue/actions.ts:275-295` | applyLatestRevenueAmount() |
| 4-15 | ロジック | 差異無視操作 | ユーザーが「現在値維持」選択 | latestCalculatedAmount/sourceDataChangedAtをクリアのみ | StpRevenueRecord/StpExpenseRecord | `src/app/stp/finance/revenue/actions.ts:297-312` | dismissRevenueSourceChange() |
| 4-16 | ロジック | 編集ログ記録 | 自動生成レコードの重要フィールド変更 | StpFinanceEditLogに変更前後値・理由を記録 | StpFinanceEditLog | `src/lib/finance/edit-log.ts` | editType: field_change/amount_mismatch |
| 4-17 | ロジック | 売上/経費レコード削除 | 削除操作 | 論理削除（deletedAt=now()）、月次締めチェックあり | StpRevenueRecord/StpExpenseRecord | `src/app/stp/finance/revenue/actions.ts:262-273` | |

---

## 5. 請求書管理

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 5-01 | ロジック | 請求書作成（自社発行） | direction="outgoing" | 請求書番号自動採番（INV-YYYYMM-NNNN形式）、トランザクションで排他制御 | StpInvoice, StpInvoiceNumberSequence | `src/lib/finance/invoice-number.ts:6-20` | upsertで安全に採番 |
| 5-02 | ロジック | 請求書ステータス遷移（outgoing） | ステータス変更 | draft → issued → sent → paid | StpInvoice | `src/app/stp/finance/invoices/actions.ts` | |
| 5-03 | ロジック | 請求書ステータス遷移（incoming） | ステータス変更 | received → approved → paid | StpInvoice | `src/app/stp/finance/invoices/actions.ts` | |
| 5-04 | ロジック | 赤伝（クレジットノート）生成 | 元請求書から作成 | 金額をマイナス値で複製、明細行も複製（unitPrice/amountをマイナス化） | StpInvoice, StpInvoiceLineItem | `src/app/stp/finance/invoices/actions.ts:104-148` | originalInvoiceIdで紐付け |
| 5-05 | ロジック | 売上から請求書生成 | invoiceId=null | 売上レコードから請求書を新規作成、invoiceIdをリンク | StpInvoice, StpRevenueRecord | `src/app/stp/finance/revenue/actions.ts:135-170` | |
| 5-06 | ロジック | 一括請求書生成 | 同一企業×同一月 | 対象売上レコードをまとめて1請求書に紐付け | StpInvoice, StpRevenueRecord[] | `src/app/stp/finance/revenue/actions.ts:173-220` | |
| 5-07 | ロジック | 請求書削除 | 削除操作 | 紐づくRevenueRecord/ExpenseRecordのinvoiceIdをクリア後、論理削除 | StpInvoice, StpRevenueRecord, StpExpenseRecord | `src/app/stp/finance/invoices/actions.ts:84-101` | |
| 5-08 | ロジック | 税率別集計（インボイス制度） | 請求書作成/更新時 | 税率ごとにsubtotalByTaxRateを計算、端数は税率グループ単位でfloor | StpInvoice.subtotalByTaxRate | `src/lib/finance/invoice-tax.ts:9-27` | JSON形式 |

---

## 6. 入出金・消込

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 6-01 | ロジック | 消込操作 | 入出金に配分作成 | StpPaymentAllocation作成（revenueRecordIdまたはexpenseRecordIdのいずれか） | StpPaymentAllocation | `src/app/stp/finance/payments/actions.ts:82-118` | トランザクション内 |
| 6-02 | ロジック | 消込ステータス再計算（取引側） | 配分作成/削除後 | totalAllocated=0→unmatched、<amount→partial、>=amount→matched | StpPaymentTransaction | `src/lib/finance/payment-matching.ts:7-34` | recalcTransactionStatus() |
| 6-03 | ロジック | 消込ステータス再計算（レコード側） | 配分作成/削除後 | 0=null、<expected=partial、==expected=paid+paidDate設定、>expected=completed_different | StpRevenueRecord/StpExpenseRecord | `src/lib/finance/payment-matching.ts:37-118` | recalcRecordPaymentStatus() |
| 6-04 | ロジック | 消込解除 | 配分レコード削除 | 物理削除後、関連取引・レコードのステータス再計算 | StpPaymentAllocation, StpPaymentTransaction, StpRevenueRecord/StpExpenseRecord | `src/app/stp/finance/payments/actions.ts:120-138` | |

---

## 7. 月次締め

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 7-01 | ロジック | STP月次締め実行 | 「締める」ボタン | StpMonthlyCloseにupsert（closedAt=now()、reopenedAt/By/Reason=null） | StpMonthlyClose | `src/lib/finance/monthly-close.ts:21-41` | |
| 7-02 | ロジック | STP月次再オープン | 「再オープン」ボタン + 理由入力 | reopenedAt/reopenedBy/reopenReasonを更新 | StpMonthlyClose | `src/lib/finance/monthly-close.ts:44-58` | |
| 7-03 | ロジック | 締め済み月の編集制限 | reopenedAt===null | 売上/経費レコードの更新・削除をブロック（エラー: "YYYY年MM月は月次締め済み"） | UI（エラー表示） | `src/lib/finance/monthly-close.ts:6-68` | ensureMonthNotClosed() |
| 7-04 | ロジック | 会計月次締め（プロジェクト側） | プロジェクト担当が締め | AccountingMonthlyClose.status: open → project_closed | AccountingMonthlyClose | `src/app/accounting/monthly-close/page.tsx` | |
| 7-05 | ロジック | 会計月次締め（経理側最終） | 経理が最終確認 | status: project_closed → accounting_closed | AccountingMonthlyClose | `src/app/accounting/monthly-close/page.tsx` | 2段階承認 |
| 7-06 | ロジック | 会計月次再オープン | 問題発見時 | status: accounting_closed → open（再オープン理由必須） | AccountingMonthlyClose | `src/app/accounting/monthly-close/page.tsx` | |

---

## 8. 認証・権限

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 8-01 | ロジック | 社内スタッフログイン | メール/ログインID + パスワード | MasterStaffから検索、bcrypt検証、isActive=true確認、権限情報取得 | セッション | `src/auth.ts:72-106` | ログインID: @stella-crm.localメールのみ |
| 8-02 | ロジック | 外部ユーザーログイン | メール + パスワード | スタッフ認証失敗後に試行、status="active"確認、bcrypt検証、lastLoginAt更新 | ExternalUser, セッション | `src/lib/auth/external-user.ts:17-83` | |
| 8-03 | ロジック | 権限チェック | パスアクセス時 | permissionLevel(none=0/view=1/edit=2/admin=3)で数値比較 | UI（リダイレクト） | `src/lib/auth/permissions.ts` | |
| 8-04 | ロジック | ミドルウェアルーティング | 全リクエスト | userType="staff"→/companies等許可、/portal拒否。userType="external"→/portal許可、他拒否 | リダイレクト | `src/middleware.ts:102-169` | |
| 8-05 | ロジック | プロジェクト権限チェック | /stp/*アクセス | projectCode="stp"の権限確認、なければ/へリダイレクト | リダイレクト | `src/middleware.ts:159-165` | |
| 8-06 | ロジック | DisplayView権限チェック | /portal/stp/*アクセス | /portal/stp/client→stp_client必須、/portal/stp/agent→stp_agent必須 | リダイレクト | `src/middleware.ts:133-147` | |
| 8-07 | ロジック | 管理画面アクセス | /admin/*アクセス | permissionLevel="admin"（いずれかのプロジェクト）が必須 | リダイレクト | `src/app/api/admin/users/route.ts:16-23` | |
| 8-08 | ロジック | スタッフ招待 | 招待送信ボタン | inviteToken生成（64文字）、有効期限24時間、招待メール送信 | MasterStaff | `src/app/staff/actions.ts` | |
| 8-09 | ロジック | スタッフセットアップ完了 | パスワード設定 | passwordHash設定、inviteToken=nullにクリア | MasterStaff | `src/app/api/staff/setup/route.ts` | 承認不要でログイン可能に |

---

## 9. 外部ユーザー管理

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 9-01 | ロジック | 登録トークン発行 | 管理者がadmin権限で発行 | crypto.randomBytes(32)でトークン生成、RegistrationToken+DefaultViewsを作成 | RegistrationToken, RegistrationTokenDefaultView | `src/app/api/registration/generate-token/route.ts` | maxUses/expiresAt設定 |
| 9-02 | ロジック | トークンバリデーション | /register/[token]アクセス | ステータス・有効期限・使用回数を確認、期限切れ→status="expired"に自動更新 | RegistrationToken | `src/app/api/registration/validate/[token]/route.ts` | |
| 9-03 | ロジック | 外部ユーザー登録 | フォーム送信 | ExternalUser作成(status="pending_email")、EmailVerificationToken作成(24時間有効)、useCount++ | ExternalUser, EmailVerificationToken, RegistrationToken | `src/app/api/registration/submit/route.ts` | DEV環境ではメール認証スキップ |
| 9-04 | ロジック | メール認証 | 認証リンククリック | EmailVerificationToken.isUsed=true、ExternalUser.status="pending_approval"、emailVerifiedAt設定 | EmailVerificationToken, ExternalUser | `src/app/api/verify-email/[token]/route.ts` | |
| 9-05 | ロジック | 管理者承認 | 承認ボタン + viewIds選択 | status="active"、approvedAt/approvedBy設定、DisplayPermission複数作成 | ExternalUser, ExternalUserDisplayPermission | `src/app/api/admin/users/[id]/approve/route.ts` | |
| 9-06 | ロジック | 管理者却下 | 却下ボタン | ExternalUserを物理削除（論理削除ではない） | ExternalUser | `src/app/api/admin/users/[id]/reject/route.ts` | |
| 9-07 | ロジック | トークン使用回数上限 | useCount >= maxUses | status="exhausted"に自動更新 | RegistrationToken | `src/app/api/registration/submit/route.ts:106-116` | |
| 9-08 | ロジック | パスワードリセット | /forgot-password | 既存未使用トークン全無効化、新規トークン作成(1時間有効)、メール送信 | PasswordResetToken | `src/app/api/forgot-password/route.ts` | ユーザー列挙攻撃対策あり |
| 9-09 | ロジック | ログイン履歴記録 | ログイン試行時 | LoginHistoryにIPアドレス・UserAgent・結果を記録 | LoginHistory | `src/lib/auth/login-history.ts:9-25` | |
| 9-10 | ロジック | アカウントロックアウト | 30分以内に5回失敗 | isAccountLocked()=true | LoginHistory | `src/lib/auth/login-history.ts:27-86` | 注意: 呼び出し箇所未確認（未使用の可能性） |

---

## 10. リード獲得フォーム

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 10-01 | ロジック | フォーム回答送信 | /form/stp-lead/[token]から送信 | StpLeadFormSubmission作成(status="pending")、StpProposal自動生成(status="draft") | StpLeadFormSubmission, StpProposal | `src/app/api/public/lead-form/submit/route.ts:29-93` | |
| 10-02 | ロジック | リード処理（新規企業） | 「新規企業として登録」選択 | MasterStellaCompany作成(コード自動採番) + StellaCompanyLocation作成 + StellaCompanyContact作成 + StpCompany作成(currentStageId=1) | 複数テーブル | `src/app/stp/lead-submissions/actions.ts` | トランザクション内、leadSource="代理店" |
| 10-03 | ロジック | リード処理（既存企業・STP未登録） | 既存Stella企業選択、STP未登録 | Stella企業情報更新 + StpCompany新規作成 + 担当者追加 | MasterStellaCompany, StpCompany, StellaCompanyContact | `src/app/stp/lead-submissions/actions.ts` | |
| 10-04 | ロジック | リード処理（既存企業・STP登録済み） | 既存Stella企業選択、STP登録済み | 情報更新なし、紐付けのみ（stpCompanyInfo=undefined） | StpLeadFormSubmission | `src/app/stp/lead-submissions/actions.ts` | |
| 10-05 | ロジック | 職種連動（SPEC-STP-002） | ページ1の職種選択 | ページ2の「採用希望の職種」に自動反映（読み取り専用） | UI | `src/app/form/stp-lead/[token]/page.tsx` | 確定仕様 |

---

## 11. 代理店管理

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 11-01 | リレーション | 代理店とStella企業 | companyId @unique | 1代理店=1Stella企業（1:1リレーション） | StpAgent, MasterStellaCompany | `prisma/schema.prisma:128` | |
| 11-02 | ロジック | 代理店契約履歴作成 | 契約条件入力 | デフォルト報酬率（月額/成果報酬）を設定、企業別オーバーライドの基準値に | StpAgentContractHistory | `src/app/stp/agents/agent-contract-history-actions.ts` | |
| 11-03 | ロジック | 代理店契約変更 | 報酬率変更 | markExpenseRecordsForAgentChange()で経費レコードに差異マーク | StpExpenseRecord | `src/lib/finance/auto-generate.ts:1143-1235` | |
| 11-04 | ロジック | リードフォームトークン | 1代理店1トークン | StpLeadFormToken（agentId @unique）、status: active/paused/revoked | StpLeadFormToken | `prisma/schema.prisma:1030` | |
| 11-05 | リレーション | 代理店削除 | onDelete: Cascade | StpAgentContract/StpAgentStaff/StpLeadFormToken/StpAgentContractHistory/StpExpenseRecord/StpInvoiceが連鎖削除 | 複数テーブル | `prisma/schema.prisma` | |

---

## 12. 会計（横断）

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 12-01 | ロジック | CSVインポート | freee/銀行CSV取込 | AccountingImportBatch作成 + AccountingTransaction複数作成 | AccountingImportBatch, AccountingTransaction | `src/app/accounting/imports/page.tsx` | 重複スキップ機能あり |
| 12-02 | ロジック | 消込・照合 | 手動/自動照合 | AccountingReconciliation作成（revenueRecordIdまたはexpenseRecordIdにリンク） | AccountingReconciliation | `src/app/accounting/reconciliation/page.tsx` | matchMethod: auto/manual |
| 12-03 | ロジック | 取引消込ステータス | 配分額計算 | unmatched→partial→matched（配分合計と取引額の比較） | AccountingTransaction | 会計ロジック | |
| 12-04 | ロジック | ダブルチェック | 取引確認時 | AccountingVerification（project確認+accounting確認の2レコード）、status: pending/verified/flagged | AccountingVerification | `src/app/accounting/verification/page.tsx` | @@unique制約で重複防止 |
| 12-05 | リレーション | AccountingTransaction削除 | onDelete: Cascade | AccountingReconciliation/AccountingVerificationが自動削除 | AccountingReconciliation, AccountingVerification | `prisma/schema.prisma:1880-1910` | |

---

## 13. 共通ロジック

| No. | カテゴリ | トリガー | 条件 | アクション | 影響先 | 実装場所 | 備考 |
|-----|---------|---------|------|-----------|--------|---------|------|
| 13-01 | ロジック | 日付変換 | フォーム送信時 | toLocalDateString()でJST日付文字列生成（toISOString()はUTC変換で1日ずれるため禁止） | 全日付フィールド | `src/lib/utils.ts` | CLAUDE.mdで明示的に禁止 |
| 13-02 | ロジック | 接触履歴のロール管理 | 接触履歴作成/更新 | ContactHistoryRole中間テーブルでCustomerTypeとN:N紐付け | ContactHistoryRole | `src/app/stp/records/company-contacts/actions.ts` | |
| 13-03 | ロジック | 接触履歴のプロジェクトフィルタ | STP画面表示時 | roles内にcustomerType.projectId=STP_PROJECT_IDかつname="企業"を含む履歴のみ表示 | UI（フィルタ） | `src/app/stp/companies/page.tsx:79-100` | |
| 13-04 | ロジック | ファイルアップロード | 請求書/接触履歴 | 最大10MB、PDF/PNG/JPEGのみ許可 | ファイルシステム | `src/app/api/stp/invoices/upload/route.ts:16-37` | |
| 13-05 | ロジック | URL短縮 | リードフォームURL短縮 | ShortUrl.shortCode（6文字英数字）を生成、originalUrlと紐付け | ShortUrl | `src/app/api/internal/shorten-url/route.ts` | |
| 13-06 | ロジック | KPI共有リンク | トークン生成 | StpKpiShareLink（token=64文字、expiresAt指定） | StpKpiShareLink | `src/app/s/kpi/[token]/page.tsx` | 有効期限チェックあり |
| 13-07 | 画面連携 | revalidatePath | データ変更後 | 関連パスのキャッシュを無効化してUI再描画 | Next.jsキャッシュ | 全actions.tsファイル | 複数パスを同時にrevalidate |
| 13-08 | ロジック | 公開パス定義 | ミドルウェア | /login, /api/auth, /register, /verify-email, /forgot-password, /reset-password, /form, /api/public, /s, /staff/setup 等 | ルーティング | `src/middleware.ts` | 認証不要のパス |
