# TASKS.md - 経理・財務管理システム 実装タスク一覧
# 
# 設計書 SPEC-ACCOUNTING-001 セクション9「実装優先度」に基づく
# 各タスクはClaude Codeが1回で実装できるサイズに分割
#
# マーク凡例:
#   - [ ] 未着手
#   - [x] 完了
#   - [!] 失敗（スキップ）

---

## Phase 1: 基盤（最優先）

- [x] TASK-001: Prismaスキーマ - 新規30テーブルのマイグレーション作成
  **対象**: 設計書 セクション2 全体
  **作業内容**:
  - schema.prisma に30テーブル全てを追加（設計書のPrismaコードをそのまま使用）
  - 既存テーブル（OperatingCompany, StpInvoiceNumberSequence, StpMonthlyClose）への変更も適用
  - `npx prisma migrate dev --name add_accounting_system` を実行
  - マイグレーションが正常に通ることを確認
  **参照**: 設計書 2.1〜2.5, 3.1〜3.3

- [x] TASK-002: 勘定科目マスタ管理画面
  **対象**: 設計書 ⑬ Account テーブル
  **ページ**: /accounting/masters/accounts
  **作業内容**:
  - 一覧表示（科目コード、科目名、区分、表示順、有効フラグ）
  - 新規作成フォーム（科目コード重複チェック付き）
  - 編集・無効化
  - Server Actions: createAccount, updateAccount
  **参照**: 要望書 3.6

- [x] TASK-003: 費目マスタ管理画面
  **対象**: 設計書 ⑩ ExpenseCategory テーブル
  **ページ**: /accounting/masters/expense-categories
  **作業内容**:
  - 一覧表示（名称、種別[revenue/expense/both]、デフォルト勘定科目、表示順、有効フラグ）
  - 売上用・経費用のフィルタ
  - 新規作成・編集
  - デフォルト勘定科目の選択（Accountテーブルから）
  - Server Actions: createExpenseCategory, updateExpenseCategory
  **参照**: 要望書 2.1.2（費目の説明）, 設計書 3.2.5

- [x] TASK-004: 取引先マスタ管理画面
  **対象**: 設計書 ⑯ Counterparty テーブル
  **ページ**: /accounting/masters/counterparties
  **作業内容**:
  - 一覧表示（名称、種別、CRM紐づき有無、有効フラグ）
  - 新規作成（類似名称チェック付き - 要望書 2.8.2）
  - 編集
  - MasterStellaCompany との同期処理（設計書 8.6）
  - Server Actions: createCounterparty, updateCounterparty, syncCounterparties
  **参照**: 要望書 2.8, 設計書 5.7

- [x] TASK-005: 決済手段マスタ管理画面
  **対象**: 設計書 ⑱ PaymentMethod テーブル
  **ページ**: /accounting/masters/payment-methods
  **作業内容**:
  - 一覧表示（種別、名称、残高情報、有効フラグ）
  - 種別に応じた詳細入力フォーム（銀行口座/クレカ/仮想通貨ウォレット/現金）
  - クレカ用: 締め日、引落日、引落口座の設定
  - 初期残高、残高アラート閾値の設定
  - Server Actions: createPaymentMethod, updatePaymentMethod
  **参照**: 要望書 3.3.2

- [x] TASK-006: コストセンター（按分先）マスタ管理画面
  **対象**: 設計書 ⑤ CostCenter テーブル
  **ページ**: /accounting/masters/cost-centers
  **作業内容**:
  - 一覧表示（名称、CRMプロジェクト紐づき、有効フラグ）
  - 新規作成・編集
  - MasterProject との紐づけ選択
  - Server Actions: createCostCenter, updateCostCenter
  **参照**: 要望書 2.6.1

---

## Phase 2: プロジェクト側コア

- [x] TASK-007: 取引一覧画面
  **対象**: 設計書 ① Transaction テーブル
  **ページ**: /stp/finance/transactions
  **作業内容**:
  - 取引一覧テーブル（種別、取引先、費目、金額、ステータス、期間）
  - フィルタ（種別、ステータス、期間、取引先）
  - ソート機能
  - ステータスバッジ表示
  - Server Actions: listTransactions
  **参照**: 要望書 2.1, 設計書 5.0

- [x] TASK-008: 取引新規作成・編集画面
  **対象**: 設計書 ① Transaction + 関連テーブル
  **作業内容**:
  - 新規作成フォーム（設計書 5.0 の全入力項目）
  - 按分ON/OFFトグル（排他的にテンプレート or コストセンター選択）
  - 消費税額の自動計算（税率10%デフォルト、8%/0%への変更可）
  - 源泉徴収トグル（10.21%自動計算）
  - プロジェクトページでの作成ルール（要望書 2.1.4）
  - 契約終了警告ダイアログ（設計書 5.0 契約終了警告）
  - 証憑アップロード（複数可）
  - Server Actions: createTransaction, updateTransaction
  - バリデーション: 設計書 6.1
  **参照**: 要望書 2.1.2, 2.1.4, 設計書 5.0, 6.1

- [x] TASK-009: 取引ステータス管理
  **対象**: Transaction.status の遷移管理
  **作業内容**:
  - ステータス遷移ロジック（要望書 2.1.3 のフロー）
  - 確認ボタン（unconfirmed → confirmed）
  - 再提出ボタン（returned → resubmitted）
  - 非表示（論理削除）
  - 月次クローズチェック（クローズ済み月の取引は編集不可）
  - Server Actions: confirmTransaction, hideTransaction
  **参照**: 要望書 2.1.3, 設計書 6.6

- [x] TASK-010: 取引候補検出・生成画面
  **対象**: 設計書 5.1 ステップ1
  **ページ**: /stp/finance/generate
  **作業内容**:
  - 対象月選択UI（1ヶ月ずつ）
  - CRM契約データから候補を検出（既存auto-generate.tsの改修）
  - 定期取引テーブルから候補を検出
  - ソースデータ変更チェック（金額変更時のアラート）
  - チェックボックスで選択 → 取引レコード一括生成
  - Server Actions: detectTransactionCandidates, generateTransactions
  **参照**: 要望書 2.2, 設計書 5.1 ステップ1

---

## Phase 3: 請求書管理

- [x] TASK-011: 請求グループ管理画面
  **対象**: 設計書 ② InvoiceGroup テーブル
  **ページ**: /stp/finance/invoices
  **作業内容**:
  - 請求グループ一覧（番号、取引先、金額、ステータス）
  - 新規作成フロー（要望書 2.3.1: 取引先選択→確認済み取引選択→情報設定）
  - 請求書番号の自動採番（設計書 8.7, フォーマット: {略称}-INV-{年月}-{連番}）
  - 取引の追加・削除（ステータスごとの制限: 要望書 2.3.4）
  - 訂正請求書の作成（差し替え/追加請求）
  - Server Actions: createInvoiceGroup, updateInvoiceGroup, addTransactionToGroup, removeTransactionFromGroup
  **参照**: 要望書 2.3, 設計書 6.8

- [x] TASK-012: 請求書PDF生成・プレビュー
  **対象**: 設計書 8.1
  **作業内容**:
  - InvoicePdfTemplate コンポーネント（@react-pdf/renderer + Noto Sans JP）
  - 運営法人ロゴ、請求番号、明細、振込先、合計の表示
  - 税額は小計から一括計算（要望書 9.1）
  - PDFプレビュー機能（BlobProvider使用）
  - PDF保存（public/uploads/invoices/{year}/{month}/{fileName}）
  - PDF無効化ロジック（明細変更時: 要望書 2.3.5）
  - Server Actions: generateInvoicePdf
  **参照**: 要望書 2.5.1, 9.1, 設計書 8.1

- [x] TASK-013: 請求書メール送付機能
  **対象**: 設計書 ㉖ InvoiceMail + ㉗ InvoiceMailRecipient
  **作業内容**:
  - 送信先選択（StellaCompanyContactから + 手動入力）
  - TO/CC/BCC設定
  - テンプレートから件名・本文自動生成
  - 送信確認画面
  - nodemailerでメール送信（PDF添付）
  - 送信成功/失敗のハンドリング（要望書 2.5.2）
  - 送付記録（メール以外: LINE/郵送/その他）
  - Server Actions: sendInvoiceMail, recordManualSend
  **参照**: 要望書 2.5.2, 2.5.3, 設計書 8.2

- [x] TASK-014: 請求書テンプレート管理画面
  **対象**: 設計書 ㉕ InvoiceTemplate
  **ページ**: /accounting/masters/invoice-templates
  **作業内容**:
  - テンプレート一覧（法人別、送付用/発行依頼用）
  - 新規作成・編集フォーム
  - テンプレート変数のプレビュー
  - Server Actions: createInvoiceTemplate, updateInvoiceTemplate
  **参照**: 要望書 4.2

- [x] TASK-015: 支払グループ管理画面
  **対象**: 設計書 ③ PaymentGroup テーブル
  **ページ**: /stp/finance/payment-groups
  **作業内容**:
  - 支払グループ一覧
  - 新規作成フロー（要望書 2.4.2）
  - 請求書発行依頼メール送信（要望書 2.4.3）
  - 請求書受領の紐づけ・確認フロー
  - 却下・再依頼フロー（要望書 2.4.4）
  - ステータス遷移（設計書 6.9）
  - Server Actions: createPaymentGroup, requestInvoice, confirmReceivedInvoice, rejectInvoice
  **参照**: 要望書 2.4, 設計書 6.9

---

## Phase 4: 経理側コア

- [x] TASK-016: 経理ダッシュボード
  **対象**: 設計書 1.2 経理側ページ構成
  **ページ**: /accounting/dashboard
  **作業内容**:
  - 未処理件数カード（未仕訳取引、未消込入出金、按分未確定）
  - アラート一覧（取引未申請、契約矛盾、残高アラート、入金期限超過）
  - 今月サマリー（売上、経費、入金、出金、未入金）
  - 各項目からの画面遷移リンク
  - Server Actions: getDashboardData
  **参照**: 要望書 3.1, 設計書 1.2

- [x] TASK-017: 仕訳処理画面
  **対象**: 設計書 ⑪ JournalEntry + ⑫ JournalEntryLine
  **ページ**: /accounting/journal
  **作業内容**:
  - 仕訳一覧（日付、摘要、ステータス、紐づき先）
  - 新規仕訳作成（手動仕訳）
  - 借方/貸方の明細入力（合計一致バリデーション: 設計書 6.2）
  - 仕訳の確認・確定フロー
  - 紐づき先の表示（InvoiceGroup/PaymentGroup/Transaction）
  - Server Actions: createJournalEntry, confirmJournalEntry
  **参照**: 要望書 3.2, 設計書 6.2

- [x] TASK-018: 自動仕訳ルール管理・実行
  **対象**: 設計書 ⑰ AutoJournalRule + 設計書 5.5
  **ページ**: /accounting/masters/auto-journal
  **作業内容**:
  - ルール一覧（取引先、種別、費目、借方科目、貸方科目、優先度）
  - 新規作成・編集（競合警告: 設計書 5.6）
  - 優先度の並び替え（ドラッグ or 上下移動）
  - 自動仕訳実行ロジック（設計書 5.5 のフロー）
  - 手動仕訳からルール追加提案（設計書 5.6）
  - Server Actions: createAutoJournalRule, updateAutoJournalRule, executeAutoJournal
  **参照**: 要望書 3.2.3, 3.2.4, 設計書 5.5, 5.6

- [x] TASK-019: 入出金管理画面
  **対象**: 設計書 ⑭ BankTransaction
  **ページ**: /accounting/bank-transactions
  **作業内容**:
  - 入出金一覧（日付、区分、決済手段、取引先、金額、消込状態）
  - 新規登録フォーム
  - 仮想通貨取引の追加入力（CryptoTransactionDetail: 設計書 ⑳）
  - 証憑アップロード
  - Server Actions: createBankTransaction, updateBankTransaction
  **参照**: 要望書 3.3

- [x] TASK-020: 消込処理画面
  **対象**: 設計書 ⑮ Reconciliation + 設計書 5.3
  **ページ**: /accounting/reconciliation
  **作業内容**:
  - 未消込の入出金・仕訳の表示
  - 消込操作（入出金と仕訳の紐づけ）
  - 金額不一致時の処理（要望書 3.4.3: 一部入金/振込手数料/値引き/手動）
  - 差額仕訳のプレビュー・修正
  - 消込取り消し（要望書 3.4.4）
  - 「ルールに追加しますか？」提案
  - Server Actions: createReconciliation, cancelReconciliation
  **参照**: 要望書 3.4, 設計書 5.3

---

## Phase 5: 高度な機能

- [x] TASK-021: 按分テンプレート管理画面
  **対象**: 設計書 ⑥ AllocationTemplate + ⑦ AllocationTemplateLine
  **ページ**: /accounting/masters/allocation-templates
  **作業内容**:
  - テンプレート一覧
  - 新規作成（明細: 按分先 + 按分率、合計100%バリデーション）
  - +ボタンで行追加UI
  - 未確定枠の選択可能
  - 明細変更時の影響確認（設計書 5.4.1）
  - クローズ済み月関与時の権限チェック
  - AllocationTemplateOverrideの管理
  - Server Actions: createAllocationTemplate, updateAllocationTemplate
  **参照**: 要望書 2.6, 設計書 5.4, 5.4.1, 6.3

- [x] TASK-022: 按分確定フロー
  **対象**: 設計書 ⑧ AllocationConfirmation + 設計書 5.4
  **作業内容**:
  - 按分確定の自動確定（作成者プロジェクト）
  - 他プロジェクトへの通知
  - 確認・確定画面
  - 全プロジェクト確定後の経理引き渡し
  - PL計算での按分金額の動的計算
  - 端数処理（1円未満切り捨て、最後に寄せる: 設計書 6.3）
  - Server Actions: confirmAllocation, getAllocationStatus
  **参照**: 要望書 2.6.4, 2.6.5, 設計書 5.4

- [x] TASK-023: 予実管理画面
  **対象**: 設計書 ㉒ Budget
  **ページ**: /accounting/budget
  **作業内容**:
  - 予算入力画面（コストセンター別×勘定科目×年月）
  - 月コピー機能
  - 定期取引から固定経費の下書き埋めボタン
  - 予実比較画面（予算 vs 仕訳実績）
  - 差異・達成率の表示
  - プロジェクト別表示
  - Server Actions: createBudget, updateBudget, getBudgetVsActual
  **参照**: 要望書 3.7

- [!] TASK-024: キャッシュフロー予測画面
  **対象**: 設計書 1.2 /accounting/cashflow
  **ページ**: /accounting/cashflow
  **作業内容**:
  - 入金予定（請求グループの支払期限から）
  - 出金予定（取引の支払予定日、定期取引、クレカ引落日）
  - 口座別残高予測（初期残高起点の積み上げ計算）
  - 日別残高推移グラフ
  - 残高アラート閾値の警告
  - Server Actions: getCashflowForecast
  **参照**: 要望書 3.8

- [x] TASK-025: コメント・差し戻し機能
  **対象**: 設計書 ㉘ TransactionComment + 設計書 5.8
  **作業内容**:
  - コメント投稿（取引/請求グループ/支払グループに対して）
  - コメント種別（通常/差し戻し/承認/質問）
  - 差し戻し時の種別入力（質問/修正依頼/承認確認/その他）
  - スレッド表示（parentIdによる返信ツリー）
  - ファイル添付（Attachment.commentId）
  - 再提出フロー
  - Server Actions: createComment, returnTransaction, resubmitTransaction
  **参照**: 要望書 3.5, 設計書 5.8

- [x] TASK-026: 通知機能
  **対象**: 設計書 ㉙ Notification + 設計書 5.9
  **ページ**: /notifications
  **作業内容**:
  - 通知一覧ページ
  - フィルタ（ステータス、カテゴリ）
  - ステータス変更（未読→既読→確認中→完了）
  - ヘッダーのベルアイコン + 未読件数バッジ
  - 通知発行ヘルパー関数（設計書 8.5）
  - 各業務アクションからの通知発行連携
  - Server Actions: listNotifications, updateNotificationStatus, createNotification
  **参照**: 要望書 5, 設計書 5.9, 8.5

- [x] TASK-027: 変更履歴機能
  **対象**: 設計書 ㉚ ChangeLog + 設計書 8.4
  **作業内容**:
  - 変更履歴の自動記録（Server Actionで明示的に記録）
  - 必須対象: Transaction, JournalEntry, AllocationTemplateLine
  - 取引詳細画面での履歴表示
  - JSON差分の見やすい表示
  - Server Actions: recordChangeLog, getChangeLogs
  **参照**: 要望書 6, 設計書 8.4

- [x] TASK-028: 月次クローズ機能
  **対象**: 設計書 ㉓ MonthlyCloseLog
  **ページ**: /accounting/monthly-close + /stp/finance/monthly-close
  **作業内容**:
  - 経理側: クローズ・再オープン操作（経理管理者のみ）
  - 再オープン時の理由入力（必須）
  - クローズ時のPLスナップショット保存（JSON）
  - クローズ済み月の編集禁止チェック（全画面共通）
  - プロジェクト側: 月次クローズ状況の閲覧のみ
  - クローズ・再オープン履歴一覧
  - Server Actions: closeMonth, reopenMonth, getCloseStatus
  **参照**: 要望書 3.9, 設計書 6.6

---

## Phase 6: 移行・仕上げ

- [x] TASK-029: 運営法人マスタ拡張 + メールアドレステーブル
  **対象**: 設計書 3.1 OperatingCompany変更 + ㉔ OperatingCompanyEmail
  **作業内容**:
  - OperatingCompanyへのカラム追加（logoPath, abbreviation, invoicePrefix, defaultPaymentTermDays）
  - ロゴアップロード機能
  - 運営法人メールアドレス管理画面
  - SMTP設定の管理
  - Server Actions: updateOperatingCompany, createOperatingCompanyEmail
  **参照**: 要望書 4.1, 設計書 3.1

- [x] TASK-030: 定期取引管理画面
  **対象**: 設計書 ④ RecurringTransaction
  **作業内容**:
  - 定期取引一覧
  - 新規作成・編集フォーム（要望書 2.7.2 の全設定項目）
  - 金額タイプ（固定/変動）
  - 頻度設定（毎月/毎年/毎週）
  - 取引候補検出との連携
  - Server Actions: createRecurringTransaction, updateRecurringTransaction
  **参照**: 要望書 2.7

- [x] TASK-031: 取引先重複チェック・統合機能
  **対象**: 設計書 5.7
  **作業内容**:
  - 重複候補検出（類似名称チェック）
  - 定期重複チェック画面
  - 統合前の影響範囲確認画面
  - 統合実行（FK付け替え + 論理削除 + ChangeLog記録）
  - Server Actions: detectDuplicates, mergeCounterparties
  **参照**: 要望書 2.8.2, 設計書 5.7

- [x] TASK-032: 既存STPデータの移行スクリプト
  **対象**: 設計書 7.4
  **作業内容**:
  - StpRevenueRecord → Transaction 移行
  - StpExpenseRecord → Transaction 移行
  - StpInvoice → InvoiceGroup 移行
  - StpPaymentTransaction → BankTransaction 移行
  - StpPaymentAllocation → Reconciliation 移行
  - StpFinanceEditLog → ChangeLog 移行
  - AccountingTransaction → BankTransaction 移行（source="legacy"）
  - マイグレーションスクリプト作成（ドライラン対応）
  **参照**: 設計書 7.4

- [x] TASK-033: 旧ページの削除・リダイレクト
  **対象**: 設計書 7.5
  **作業内容**:
  - /stp/finance/revenue/ → /stp/finance/transactions/ へリダイレクト
  - /stp/finance/expenses/ → /stp/finance/transactions/ へリダイレクト
  - /stp/finance/company-summary/ → /stp/finance/overview/ へリダイレクト
  - /accounting/ → /accounting/dashboard/ へリダイレクト
  - 旧コンポーネントの削除（参照がないことを確認後）
  **参照**: 設計書 7.5

- [ ] TASK-034: STPプロジェクトダッシュボード
  **対象**: 設計書 1.2
  **ページ**: /stp/finance/overview
  **作業内容**:
  - STPプロジェクト用のダッシュボード
  - 取引サマリー（売上/経費の合計、ステータス別件数）
  - 請求状況（請求グループのステータス別）
  - 支払状況（支払グループのステータス別）
  - 直近のアクティビティ
  - Server Actions: getProjectDashboard
  **参照**: 要望書 8.1, 設計書 1.2
