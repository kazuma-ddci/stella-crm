## TASK-006 完了

コストセンター（按分先）マスタ管理画面の実装が完了しました。

### 実装状況

既存ファイル（作成済み）:
- **`actions.ts`** - `createCostCenter`, `updateCostCenter` Server Actions（名称重複チェック、MasterProject存在チェック、論理削除対応済み）
- **`cost-centers-table.tsx`** - CrudTable使用のクライアントコンポーネント（名称、CRMプロジェクト選択、有効フラグ）

今回作成:
- **`page.tsx`** - サーバーコンポーネント。CostCenter一覧（`deletedAt: null`フィルタ）とMasterProject選択肢を並列取得し、既存パターンに準拠した`Card`レイアウトで表示

### ファイル構成
```
src/app/accounting/masters/cost-centers/
├── page.tsx              ← 新規作成
├── actions.ts            ← 既存（createCostCenter, updateCostCenter）
└── cost-centers-table.tsx ← 既存（CrudTable + customRenderers）
```

`npx tsc --noEmit` でコンパイルエラーなしを確認済みです。
