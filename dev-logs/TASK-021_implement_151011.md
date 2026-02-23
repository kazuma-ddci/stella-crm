TASK-021 の実装が完了しました。以下が作成したファイルの概要です。

## 作成ファイル

### 1. `src/app/accounting/masters/allocation-templates/actions.ts`
Server Actions:
- **`createAllocationTemplate`** - テンプレート＋明細を一括作成。名称重複チェック、合計100%バリデーション付き
- **`updateAllocationTemplate`** - テンプレート更新。明細変更時は全削除→再作成のリプレース戦略
- **`deleteAllocationTemplate`** - 論理削除（`deletedAt`）
- **`getAffectedTransactions`** - テンプレート変更時の影響取引を取得。月次クローズ状態も判定
- **`createTemplateOverrides`** - 「変更前維持」を選択した取引に`AllocationTemplateOverride`レコードを作成（upsert）
- **`checkClosedMonthInvolvement`** - クローズ済み月に関与する取引があるか判定
- **`validateLines`** - 按分率合計=100%のバリデーション（`Prisma.Decimal`で精度保証）

### 2. `src/app/accounting/masters/allocation-templates/page.tsx`
Server Component:
- テンプレート一覧（明細含む）と按分先マスタを`Promise.all`で並列取得
- `deletedAt: null`フィルタ、明細のcostCenterリレーションをinclude

### 3. `src/app/accounting/masters/allocation-templates/allocation-templates-table.tsx`
Client Component:
- **CrudTable** で一覧表示（テンプレート名、明細数、合計率、有効フラグ）
- **customFormFields** で明細行管理UIを埋め込み（`LinesEditor`コンポーネント）
  - +ボタンで行追加、各行に按分先セレクト・按分率入力・ラベル・削除ボタン
  - 未確定枠（costCenterId = null）選択可能
  - リアルタイム合計率表示（100%で緑色、不一致で赤色）
- **影響確認ダイアログ** - Promise保留パターンで実装
  - 影響する取引一覧（日付、取引先、金額、クローズ状態）
  - チェックボックスで「変更前維持」「変更後適用」を個別選択
  - 一括選択も対応
  - クローズ済み月関与時の警告表示
