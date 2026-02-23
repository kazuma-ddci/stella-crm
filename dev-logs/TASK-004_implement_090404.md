TASK-004 の実装が完了しました。作成したファイルの概要です。

## 作成ファイル（3ファイル）

### 1. `src/app/accounting/masters/counterparties/actions.ts`
**Server Actions** - 4つのアクション:
- **`checkSimilarCounterparties`** - 類似名称チェック（前方一致・部分一致で検索、要望書2.8.2対応）
- **`createCounterparty`** - 新規作成（名称重複チェック、companyId重複チェック付き）
- **`updateCounterparty`** - 部分更新対応の編集
- **`syncCounterparties`** - MasterStellaCompanyとの同期処理（設計書8.6対応: 新規→Counterparty自動作成、既存→名称同期更新）

### 2. `src/app/accounting/masters/counterparties/counterparties-table.tsx`
**クライアントコンポーネント** - CrudTableベースの一覧テーブル:
- カラム: 名称、種別（customer/vendor/service/other）、CRM企業（searchableセレクト）、メモ、有効フラグ
- **類似名称確認ダイアログ**: 作成時に類似取引先が見つかった場合、候補一覧を表示して「新規作成する」or「キャンセル」を選択
- **CRM企業同期ボタン**: `customAddButton`で「CRM企業を同期」ボタンを配置

### 3. `src/app/accounting/masters/counterparties/page.tsx`
**サーバーコンポーネント** - データ取得＆ページレンダリング:
- Counterparty一覧（論理削除・統合済み除外）+ MasterStellaCompany選択肢を`Promise.all`で並行取得
- 既存パターン（Card/CardHeader/CardTitle）に準拠
