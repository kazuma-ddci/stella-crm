TASK-019 の実装が完了しました。以下が作成・変更したファイルの概要です。

## 実装サマリー

### 作成したファイル

| ファイル | 内容 |
|---------|------|
| `src/app/accounting/bank-transactions/actions.ts` | Server Actions（CRUD + バリデーション） |
| `src/app/accounting/bank-transactions/page.tsx` | 入出金一覧ページ（Server Component） |
| `src/app/accounting/bank-transactions/bank-transactions-table.tsx` | 一覧テーブル（フィルタ・検索・消込状態表示） |
| `src/app/accounting/bank-transactions/bank-transaction-modal.tsx` | 新規登録・編集フォーム（仮想通貨対応・証憑アップロード） |
| `src/app/api/bank-transactions/upload/route.ts` | 証憑アップロードAPI |

### 変更したファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/components/layout/sidebar.tsx` | サイドバーに「入出金管理」リンクを追加 |

### 実装内容

**Server Actions** (`actions.ts`):
- `getBankTransactions` - 一覧取得（決済手段・区分フィルタ、検索対応）
- `getBankTransaction` - 単一取得
- `getBankTransactionFormData` - フォーム用マスタデータ取得
- `createBankTransaction` - 新規登録（仮想通貨詳細・証憑含む）
- `updateBankTransaction` - 更新（差分管理・消込チェック）
- `deleteBankTransaction` - 論理削除（消込チェック）
- バリデーション関数（必須チェック・型チェック・仮想通貨詳細チェック）

**一覧テーブル**:
- 日付、区分（入金/出金）、決済手段、取引先、金額、摘要、消込状態、証憑表示
- 区分フィルタ、決済手段フィルタ、テキスト検索
- 消込済みの場合は編集・削除ボタンを非表示
- 削除時の確認ダイアログ

**登録・編集フォーム（モーダル）**:
- 基本情報：日付、区分（ラジオ）、決済手段、取引先（Combobox検索）、金額、摘要
- 仮想通貨詳細：決済手段が`crypto_wallet`の場合のみ表示。銘柄・ネットワーク・Walletアドレス・外貨金額・外貨単位・レート
- 外貨金額 × レート → 日本円金額の自動計算
- 証憑アップロード（複数ファイル対応）
- 設計書のPrismaスキーマ（BankTransaction, CryptoTransactionDetail, Attachment）に完全準拠
