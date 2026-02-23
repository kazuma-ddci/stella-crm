---

## コードレビュー: TASK-005 決済手段マスタ管理画面

### レビュー対象
- コミット範囲: `4227c27..e75ceb4`（attempt 1〜3）
- 最終状態のコミット: `e75ceb4` feat(TASK-005): 実装 (attempt 3)
- 変更ファイル（実装）:
  - `src/app/accounting/masters/payment-methods/actions.ts`（271行）
  - `src/app/accounting/masters/payment-methods/page.tsx`（73行）
  - `src/app/accounting/masters/payment-methods/payment-methods-table.tsx`（202行）

---

### 1. テーブル定義: Prismaスキーマ vs 設計書⑱

`prisma/schema.prisma:2773-2808` と設計書 `SPEC-ACCOUNTING-001-design.md:670-708` は**完全一致**。

| フィールド | スキーマ | 設計書 | 実装（create） | 実装（update） | 一覧/フォーム |
|---|---|---|---|---|---|
| methodType | `String` | `String` | ✅ | ✅ | ✅ |
| name | `String` | `String` | ✅ | ✅ | ✅ |
| details | `Json?` | `Json?` | ✅ `buildDetails()` | ✅ | ✅ 種別別フォーム |
| initialBalance | `Int?` | `Int?` | ✅ | ✅ | ✅ |
| initialBalanceDate | `DateTime?` | `DateTime?` | ✅ | ✅ | ✅ |
| balanceAlertThreshold | `Int?` | `Int?` | ✅ | ✅ | ✅ |
| closingDay | `Int?` | `Int?` | ✅ クレカのみ | ✅ | ✅ `visibleWhen` |
| paymentDay | `Int?` | `Int?` | ✅ クレカのみ | ✅ | ✅ `visibleWhen` |
| settlementAccountId | `Int?` | `Int?` | ✅ 参照整合性チェックあり | ✅ 同上 | ✅ `visibleWhen` |
| isActive | `Boolean @default(true)` | 同左 | ✅ | ✅ | ✅ |
| createdBy | `Int?` | `Int?` | ✅ `session.id` | - | - |
| updatedBy | `Int?` | `Int?` | - | ✅ `session.id` | - |
| deletedAt | `DateTime?` | `DateTime?` | - | - | ✅ クエリフィルタ |

### 2. 要望書3.3.2との整合性

| 要件 | 実装 |
|---|---|
| 種別: 現金、銀行口座、クレジットカード、仮想通貨ウォレット | ✅ `VALID_METHOD_TYPES` 4種 |
| 名称（例: 三菱UFJ普通、会社用VISA、Trust USDT TRC） | ✅ `name` フィールド |
| 種別ごとの詳細情報（JSON）: 銀行口座情報、カード情報、ウォレット情報 | ✅ `buildDetails()` で種別別JSON構築 |
| 初期残高、初期残高日（キャッシュフロー計算の起点） | ✅ `initialBalance`, `initialBalanceDate` |
| 残高アラート閾値 | ✅ `balanceAlertThreshold` |
| クレカ用: 締め日、引落日、引落口座ID | ✅ `closingDay`, `paymentDay`, `settlementAccountId` + `visibleWhen` 条件表示 |

### 3. 設計書セクション6 バリデーションルール

PaymentMethod固有のバリデーションは設計書6に明示定義なし。実装済みバリデーション:

| ルール | create | update |
|---|---|---|
| methodType列挙値チェック | ✅ `VALID_METHOD_TYPES` | ✅ |
| 名称必須 | ✅ | ✅ |
| 名称重複チェック（deletedAt: null考慮、自身除外） | ✅ | ✅ |
| closingDay/paymentDay 1〜31範囲チェック | ✅ | ✅ |
| settlementAccountId参照整合性（bank_account, isActive, deletedAt:null） | ✅ | ✅ |
| 種別変更時のクレカ専用フィールド自動クリア | - | ✅ `actions.ts:174-179` |

### 4. 設計書6.7 ポリモーフィック排他制約

PaymentMethodは排他制約対象テーブル（Attachment, InvoiceMail, TransactionComment, CryptoTransactionDetail, JournalEntry）に**含まれない**。該当なし。

### 5. TypeScript型安全性・エラーハンドリング

- `getSession()` による認証 ✅
- `throw new Error()` による統一的なエラー通知 ✅
- `"key" in data` パターンによる部分更新（既存パターン準拠） ✅
- `Prisma.DbNull` による `Json?` フィールドのnull処理 ✅
- `Prisma.InputJsonValue` による型キャスト ✅
- `Number()` 変換時の falsy チェック（`data.xxx ? Number(data.xxx) : null`） ✅

### 6. 既存コードパターンとの整合性

accounts, expense-categories, counterparties の既存マスタ画面と比較:

| 観点 | 状態 |
|---|---|
| `"use server"` + `getSession()` | ✅ 同一パターン |
| `Record<string, unknown>` パラメータ型 | ✅ |
| `revalidatePath()` キャッシュ更新 | ✅ |
| `deletedAt: null` フィルタ | ✅ |
| Card/CardHeader/CardContent レイアウト | ✅ |
| CrudTable + ColumnDef + customRenderers | ✅ |
| `visibleWhen` による条件付きフォーム表示 | ✅ CrudTable機能を適切に活用 |
| `orderBy: [{ id: "asc" }]` 安定ソート（localeCompare回避） | ✅ |
| details JSONキーマッピングの一貫性（page.tsx ↔ actions.ts） | ✅ `cryptoCurrency` ↔ `currency` 等 |
| 無効化された引落口座の表示処理 | ✅ `customRenderers` で `（無効）` 表示 |

---

### 検出された問題

なし。attempt 1で検出された minor 2件（種別変更時のクレカフィールドクリア、settlementAccountIdの参照整合性チェック）はattempt 2で修正済みであり、最終状態に正しく反映されています。

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "設計書⑱・要望書3.3.2の全要件を忠実に実装。Prismaスキーマとの完全一致を確認。バリデーション（methodType列挙値、名称重複、closingDay/paymentDay範囲、settlementAccountId参照整合性、種別変更時のクレカフィールドクリア）が適切に実装されている。既存マスタ画面（accounts, expense-categories, counterparties）との一貫性も高く、CrudTableのvisibleWhen/customRenderersを活用した種別別フォーム表示も正しく機能する。問題なし。"
}
```
