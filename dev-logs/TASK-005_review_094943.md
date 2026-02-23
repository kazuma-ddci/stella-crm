全ファイルの確認が完了しました。レビュー結果をまとめます。

---

## コードレビュー: TASK-005 決済手段マスタ管理画面（attempt 2）

### 確認対象
- コミット: `27584d8` feat(TASK-005): 実装 (attempt 2)
- 変更ファイル: `actions.ts` のみ（前回レビューの minor 2件の修正）

---

### 前回レビュー指摘への対応確認

| 前回指摘 | 対応状況 | 確認箇所 |
|---|---|---|
| Minor 1: 種別変更時のクレカ専用フィールドクリア不足 | **修正済み** | `actions.ts:174-179` — `effectiveMethodType !== "credit_card"` の場合に `closingDay`/`paymentDay`/`settlementAccountId` を null に設定 |
| Minor 2: settlementAccountId の参照整合性チェック不足 | **修正済み** | `actions.ts:113-119`（create）, `actions.ts:231-237`（update）— `findFirst` で `methodType: "bank_account"`, `isActive: true`, `deletedAt: null` を確認 |

両修正とも前回レビューの提案どおりに正確に実装されています。

---

### 全体実装の再確認（3ファイル全体）

#### 1. テーブル定義: Prismaスキーマ vs 設計書⑱

Prismaスキーマ `schema.prisma:2773-2808` と設計書⑱ `SPEC-ACCOUNTING-001-design.md:670-708` は完全一致。

| フィールド | スキーマ | 設計書 | 実装 |
|---|---|---|---|
| methodType | `String` | `String` | create/update/一覧/フォーム |
| name | `String` | `String` | create/update/一覧/フォーム |
| details | `Json?` | `Json?` | create/update/フォーム（種別別） |
| initialBalance | `Int?` | `Int?` | create/update/一覧/フォーム |
| initialBalanceDate | `DateTime?` | `DateTime?` | create/update/フォーム |
| balanceAlertThreshold | `Int?` | `Int?` | create/update/フォーム |
| closingDay | `Int?` | `Int?` | create/update/フォーム（クレカのみ） |
| paymentDay | `Int?` | `Int?` | create/update/フォーム（クレカのみ） |
| settlementAccountId | `Int?` | `Int?` | create/update/フォーム（クレカのみ）+ 参照整合性チェック |
| isActive | `Boolean @default(true)` | `Boolean @default(true)` | create/update/一覧/フォーム |
| createdBy / updatedBy | `Int?` | `Int?` | create時 createdBy、update時 updatedBy |
| deletedAt | `DateTime?` | `DateTime?` | クエリフィルタで使用 |

#### 2. 要望書 3.3.2 との整合性

| 要件 | 実装 |
|---|---|
| 種別: 現金、銀行口座、クレジットカード、仮想通貨ウォレット | `VALID_METHOD_TYPES` 4種 |
| 名称 | `name` フィールド |
| 種別ごとの詳細情報（JSON） | `buildDetails()` で種別別に構築 |
| 初期残高、初期残高日 | `initialBalance`, `initialBalanceDate` |
| 残高アラート閾値 | `balanceAlertThreshold` |
| クレカ用: 締め日、引落日、引落口座ID | `closingDay`, `paymentDay`, `settlementAccountId` + `visibleWhen` |

#### 3. 設計書セクション6 バリデーションルール

PaymentMethod固有のバリデーションは設計書6に定義なし。実装済みのバリデーション:

| ルール | 実装 |
|---|---|
| methodType 列挙値チェック | `VALID_METHOD_TYPES` |
| 名称必須 + 重複チェック（論理削除考慮） | `deletedAt: null` フィルタ |
| closingDay/paymentDay 範囲 (1-31) | 数値範囲チェック |
| settlementAccountId 参照整合性 | 銀行口座・有効・未削除を確認 **(今回修正)** |
| 種別変更時のクレカフィールドクリア | non-credit_card へ変更時に null 化 **(今回修正)** |

#### 4. 設計書 6.7 ポリモーフィック排他制約

PaymentMethod は排他制約対象テーブルに**含まれない**。該当なし。

#### 5. 型安全性・エラーハンドリング

- `throw new Error()` による統一的なエラー通知
- `getSession()` によるセッション認証
- `"key" in data` パターンによる部分更新
- `Prisma.DbNull` による Json? フィールドの null 処理

#### 6. 既存パターン準拠

- `"use server"` + `getSession()` パターン
- CrudTable + ColumnDef + `visibleWhen` + `customRenderers`
- Card/CardHeader/CardContent レイアウト
- `revalidatePath()` によるキャッシュ更新
- `deletedAt: null` フィルタによる論理削除対応
- `orderBy: [{ id: "asc" }]` による安定ソート（localeCompare 回避）

---

### 検出された問題

なし。前回レビューの minor 2件がすべて適切に修正されました。

---

```json
{
  "verdict": "OK",
  "issues": [],
  "summary": "前回レビュー（attempt 1）で検出されたminor 2件（種別変更時のクレカフィールドクリア、settlementAccountIdの参照整合性チェック）が正確に修正されている。設計書⑱・要望書3.3.2の全要件を満たし、Prismaスキーマとの完全一致、バリデーションルールの実装、既存コードパターンとの一貫性を確認。問題なし。"
}
```
