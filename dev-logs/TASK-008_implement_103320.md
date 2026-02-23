TASK-008の実装が完了しました。`npx tsc --noEmit` でコンパイルエラーなしです。

## 作成したファイル一覧

### Server Actions
- **`src/app/accounting/transactions/actions.ts`** — `createTransaction`, `updateTransaction`, `getTransactionById`, `getTransactionFormData` の4関数

### 取引フォーム（Client Component）
- **`src/app/accounting/transactions/transaction-form.tsx`** — 全入力項目を備えた取引作成・編集フォーム

### ページ（Server Components）
- **`src/app/accounting/transactions/new/page.tsx`** — 新規作成ページ
- **`src/app/accounting/transactions/[id]/edit/page.tsx`** — 編集ページ

### 証憑アップロードAPI
- **`src/app/api/transactions/upload/route.ts`** — 複数ファイルアップロード対応

## 実装した機能

| 機能 | 実装内容 |
|------|----------|
| **種別切替** | ラジオボタン（売上/経費）、費目リストが種別に連動 |
| **消費税自動計算** | 税率10%（デフォルト）/8%/0%、手修正可 |
| **源泉徴収** | トグルONで10.21%自動計算、税率・税額の手修正可、差引支払額表示 |
| **按分ON/OFF** | 排他的にテンプレート or コストセンター選択、テンプレート按分明細プレビュー |
| **プロジェクト作成ルール** | `projectContext` 指定時にcostCenterId自動設定、他PJ変更を警告で阻止 |
| **契約終了警告** | 契約終了日 < periodFrom の場合に確認ダイアログ（続行/契約確認/キャンセル） |
| **証憑アップロード** | 複数ファイル対応、ドラッグ&ドロップ、削除、10MB制限 |
| **バリデーション** | 設計書6.1準拠（必須項目、periodFrom≤periodTo、按分排他チェック） |
