# 入出金履歴管理 — 実装計画書

## 1. 現状分析

既存のコードベースには、すでに以下の関連モデルが存在する。

| モデル | 役割 | 状態 |
|--------|------|------|
| `AccountingTransaction` | 外部取込データ（freee/CSV等） | スキーマあり、取込ロジック未実装 |
| `AccountingImportBatch` | 取込バッチ管理（重複カウント等） | スキーマあり、表示のみ実装 |
| `BankTransaction` | 入出金（手動登録中心） | CRUD実装済み |
| `PaymentMethod` | 決済手段（銀行口座等） | 実装済み |
| `Counterparty` | 取引先マスタ | 実装済み |

**結論**: 既存の `AccountingTransaction` + `AccountingImportBatch` をベースに拡張するのが最も合理的。新規モデルの乱立を避け、既存のインポート・消込フローと統合できる。

---

## 2. データモデル変更

### 2-1. `AccountingTransaction` モデルへのフィールド追加

```
追加フィールド:
  balance              Int?           // 残高（銀行明細の残高欄）
  operatingCompanyId   Int?           // 法人ID（FK → OperatingCompany）
  deduplicationHash    String?        // 重複検知用ハッシュ（後述）
```

**マッピング表:**

| ユーザー要件 | 既存フィールド | 備考 |
|-------------|--------------|------|
| 日付 | `transactionDate` | 既存 |
| 内容 | `description` | 既存 |
| 入金金額 | `amount` + `direction="incoming"` | 既存 |
| 出金金額 | `amount` + `direction="outgoing"` | 既存 |
| 残高 | `balance` | **追加** |
| メモ | `memo` | 既存 |
| 法人名 | `operatingCompanyId` → リレーション | **追加** |
| 銀行名 | `bankAccountName` | 既存 |

### 2-2. `AccountingImportBatch` モデルへの変更

```
sourceService の選択肢に追加:
  "moneyforward"  // マネーフォワード連携用
```

既存の `source`/`sourceService`/`totalCount`/`newCount`/`duplicateCount` で十分対応可能。

### 2-3. 重複検知用ハッシュ戦略

```
deduplicationHash = SHA-256(
  transactionDate +
  direction +
  amount +
  description +
  bankAccountName +
  sourceTransactionId（あれば）
)
```

- `@@unique` 制約ではなく、アプリケーション層でチェック
- 理由: 同日・同額・同内容の正当な取引が存在し得るため、完全一致で弾くとfalse positiveが発生する
- MoneyForward経由の場合は `sourceTransactionId`（MoneyForward側のID）を優先的に使用
- CSVの場合はハッシュベースで検知し、**プレビュー画面で重複候補をユーザーに提示**する

---

## 3. 機能1: マネーフォワード自動取得

### 3-1. MoneyForward API連携の概要

```
認証方式: OAuth 2.0（Authorization Code Flow）
主要エンドポイント:
  GET /api/v1/transactions       — 入出金一覧
  GET /api/v1/accounts           — 口座一覧
  GET /api/v1/user/accounts      — 連携口座一覧
```

### 3-2. 必要なファイル（新規作成）

```
src/
  lib/
    moneyforward/
      client.ts            — APIクライアント（認証・リクエスト処理）
      types.ts             — MoneyForward APIの型定義
      sync.ts              — 同期ロジック（差分取得・重複チェック・DB保存）
      transform.ts         — MFレスポンス → AccountingTransaction変換
  app/
    api/
      moneyforward/
        callback/route.ts  — OAuth コールバック
        sync/route.ts      — 手動同期トリガーAPI
    settings/
      moneyforward/
        page.tsx           — MF連携設定画面（OAuth接続・同期設定）
```

### 3-3. DB追加（設定保存用）

```prisma
model MoneyForwardConnection {
  id                 Int       @id @default(autoincrement())
  operatingCompanyId Int       // どの法人の接続か
  accessToken        String    // 暗号化して保存
  refreshToken       String    // 暗号化して保存
  tokenExpiresAt     DateTime
  mfAccountId        String?   // MF側のアカウントID
  lastSyncedAt       DateTime? // 最終同期日時
  syncFromDate       DateTime? // 同期開始日（初回設定時）
  isActive           Boolean   @default(true)
  createdBy          Int
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt
}
```

### 3-4. 同期フロー

```
1. ユーザーが設定画面でOAuth認証を実行
2. コールバックでトークンを保存
3. 同期実行（手動 or 定期）:
   a. lastSyncedAt以降の取引を取得
   b. 各取引に対し sourceTransactionId（MFの取引ID）で重複チェック
   c. 新規のみ AccountingTransaction に INSERT
   d. AccountingImportBatch を作成（件数記録）
   e. lastSyncedAt を更新
4. 定期実行: Cron or Next.js Route Handler + 外部スケジューラ
```

### 3-5. 重複防止（MoneyForward）

```
方法: sourceTransactionId ベース（最も確実）
  - MoneyForward APIが返す取引IDを sourceTransactionId に保存
  - INSERT前に SELECT WHERE sourceTransactionId = ? AND source = 'moneyforward'
  - 存在すれば duplicateCount++ でスキップ
  - sourceTransactionId が一意であるため、false positive なし
```

---

## 4. 機能2: CSVインポート

### 4-1. 必要なファイル（新規作成 / 既存拡張）

```
src/
  lib/
    csv/
      parser.ts            — CSV解析（Shift-JIS/UTF-8対応）
      bank-formats.ts      — 銀行別CSVフォーマット定義
      transform.ts         — CSV行 → AccountingTransaction変換
      deduplication.ts     — 重複チェックロジック
  app/
    accounting/
      bank-transactions/
        import/
          page.tsx         — CSVインポート画面
          import-form.tsx  — ファイルアップロード + 設定フォーム
          preview-table.tsx — プレビュー・重複確認テーブル
          actions.ts       — Server Actions（解析・確定）
```

### 4-2. CSVフォーマット対応

```typescript
// 銀行別フォーマット定義の例
type BankCsvFormat = {
  bankName: string
  encoding: 'utf-8' | 'shift-jis'
  headerRows: number          // スキップする行数
  columns: {
    date: number | string     // 列インデックスor列名
    description: number | string
    incoming: number | string
    outgoing: number | string
    balance: number | string
    memo?: number | string
  }
  dateFormat: string          // 'YYYY/MM/DD' | 'YYYY-MM-DD' 等
}

// 初期対応銀行（カスタムフォーマットも追加可能に）
const BANK_FORMATS: Record<string, BankCsvFormat> = {
  generic: { /* 汎用フォーマット */ },
  mufg:    { /* 三菱UFJ */ },
  smbc:    { /* 三井住友 */ },
  mizuho:  { /* みずほ */ },
  custom:  { /* ユーザー定義 */ },
}
```

### 4-3. インポートフロー（UI）

```
Step 1: ファイルアップロード
  - CSV選択
  - 銀行フォーマット選択（プルダウン or 自動検出）
  - 法人選択
  - 銀行名入力/選択

Step 2: プレビュー・確認
  - パース結果をテーブル表示
  - 重複候補を黄色ハイライト表示
  - 各行に [取込] [スキップ] トグル（デフォルト: 重複=スキップ、新規=取込）
  - エラー行は赤色ハイライト（日付不正、金額不正等）

Step 3: 確定・取込
  - 選択行を AccountingTransaction に一括INSERT
  - AccountingImportBatch を作成（結果サマリー記録）
  - 完了画面にサマリー表示（新規○件、スキップ○件、エラー○件）
```

### 4-4. 重複防止（CSV）

```
CSVには外部IDが無いため、ハッシュベースで検知:

1. 各行からハッシュ生成:
   hash = SHA-256(date + direction + amount + description + bankAccountName)

2. DB内の既存ハッシュと照合:
   SELECT deduplicationHash FROM accounting_transactions
   WHERE transactionDate BETWEEN [CSV期間] AND bankAccountName = [銀行名]

3. 一致する行を「重複候補」としてマーク

4. プレビュー画面でユーザーに判断を委ねる:
   - 同日・同額・同内容でも正当な取引は存在し得る
   - 最終判断は人間が行う（false positiveを防ぐ）
   - デフォルトは「スキップ」だがユーザーが「取込」に変更可能
```

---

## 5. 入出金履歴 一覧画面

### 5-1. 既存画面の拡張 or 新規画面

**推奨: 既存の `/accounting/bank-transactions/` を拡張**

現在の `BankTransaction` ベースの画面は手動登録中心だが、`AccountingTransaction` ベースの入出金一覧ビューを追加する。

```
/accounting/bank-transactions/         — 既存（手動管理用、そのまま維持）
/accounting/bank-transactions/history/  — 新規（入出金履歴ビュー）
```

### 5-2. 一覧画面の機能

```
表示カラム: 日付 | 内容 | 入金金額 | 出金金額 | 残高 | メモ | 法人名 | 銀行名 | ソース

フィルタ:
  - 期間（年月 / 日付範囲）
  - 法人
  - 銀行名
  - 入金/出金
  - ソース（MoneyForward / CSV / 手動）
  - フリーテキスト検索

ソート: 日付降順（デフォルト）

アクション:
  - CSVインポートボタン → /accounting/bank-transactions/import
  - MF同期ボタン（接続済みの場合）
  - エクスポート（CSV出力）
  - 行クリック → 詳細/編集
```

---

## 6. 実装順序（推奨）

```
Phase 1: 基盤（データモデル + 一覧画面）
  1-1. Prismaスキーマ変更（フィールド追加 + マイグレーション）
  1-2. 入出金履歴 一覧画面（Server Actions + テーブルUI）
  1-3. 手動登録フォーム（既存BankTransactionModalを参考に）

Phase 2: CSVインポート
  2-1. CSVパーサー（Shift-JIS対応）
  2-2. 銀行フォーマット定義
  2-3. 重複検知ロジック
  2-4. インポートUI（3ステップ: アップロード → プレビュー → 確定）
  2-5. AccountingImportBatch連携

Phase 3: マネーフォワード連携
  3-1. MoneyForwardConnection モデル + マイグレーション
  3-2. OAuth認証フロー
  3-3. APIクライアント実装
  3-4. 同期ロジック（差分取得 + 重複チェック）
  3-5. 設定画面UI
  3-6. 定期同期の仕組み（Cron / スケジューラ）
```

---

## 7. 重複防止の全体設計まとめ

```
                    ┌─────────────────────────┐
                    │     データソース          │
                    └─────┬───────────┬────────┘
                          │           │
                 MoneyForward        CSV
                          │           │
                          ▼           ▼
              ┌──────────────┐ ┌──────────────┐
              │sourceTransaction│ │deduplication │
              │Id ベースで     │ │Hash ベースで  │
              │完全一致チェック │ │候補検出       │
              └──────┬───────┘ └──────┬───────┘
                     │                │
                     │    重複?       │    重複候補?
                     │                │
                  自動スキップ    プレビューで
                  (確実)         ユーザー判断
                     │                │
                     ▼                ▼
              ┌──────────────────────────────┐
              │    AccountingTransaction     │
              │    AccountingImportBatch      │
              └──────────────────────────────┘
```

---

## 8. 技術的注意事項

| 項目 | 対応方針 |
|------|---------|
| CSV文字コード | `iconv-lite` で Shift-JIS → UTF-8 変換 |
| MFトークン管理 | `refreshToken` で自動更新、DB暗号化保存 |
| 大量データ | バッチ処理（1000件単位で `createMany`） |
| 月次締め | 締め済み期間へのインポートは警告表示 |
| 権限 | `accounting` プロジェクトの `edit` 以上 |
| エラーハンドリング | バッチ単位でロールバック（`$transaction`） |
| ログ | `AccountingImportBatch` にエラー詳細を記録 |

---

## 9. 必要な新規パッケージ

```json
{
  "iconv-lite": "^0.6.3",    // Shift-JIS CSV対応
  "papaparse": "^5.4.1"      // CSV解析
}
```

※ ハッシュ生成には Node.js 組み込みの `crypto` モジュールを使用
