TASK-005 の実装が完了しました。

## 実装サマリ

### 作成ファイル（3ファイル）

| ファイル | 役割 |
|---|---|
| `src/app/accounting/masters/payment-methods/page.tsx` | サーバーコンポーネント。PaymentMethodデータ取得、JSON details展開、引落口座選択肢生成 |
| `src/app/accounting/masters/payment-methods/payment-methods-table.tsx` | クライアントコンポーネント。CrudTableベースの一覧・CRUD UI |
| `src/app/accounting/masters/payment-methods/actions.ts` | Server Actions（createPaymentMethod / updatePaymentMethod） |

### 機能

**一覧表示**: 種別（ラベル表示）、名称、初期残高（通貨フォーマット）、有効フラグ

**種別に応じたフォーム** (`visibleWhen`で動的表示):
- **銀行口座**: 銀行名、支店名、口座種別（普通/当座/貯蓄）、口座番号、口座名義
- **クレジットカード**: カードブランド、末尾4桁、締め日、引落日、引落口座（銀行口座から選択）
- **仮想通貨ウォレット**: 通貨、ネットワーク、ウォレットアドレス
- **現金**: 追加フィールドなし

**共通フィールド**: 初期残高、初期残高日、残高アラート閾値、有効フラグ

**バリデーション**: 名称重複チェック、種別妥当性チェック、締め日/引落日の範囲チェック（1-31）

**データ構造**: 種別固有の情報はPrismaの `details` (Json?)カラムにJSON形式で保存し、フォームでは個別フィールドとして展開
