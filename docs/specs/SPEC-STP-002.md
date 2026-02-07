# SPEC-STP-002: ヒアリングフォーム職種連動仕様

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-STP-002 |
| ステータス | ✅ confirmed |
| オーナー | - |
| 最終更新 | 2026-02-05 |
| 関連ファイル | `src/app/form/stp-lead/[token]/page.tsx` |

## 背景（なぜこの仕様が必要か）

ヒアリングフォームは「職種ごとに1回答」の構造。ページ1で選択した職種がそのままページ2の採用希望職種となるため、ページ2で別の職種を選択できてしまうとデータの整合性が崩れる。また、複数職種の回答を効率的に行えるよう、送信完了後に基本情報を保持したまま再送信できるフローが必要。

## 決定事項

### 1. ページ1の職種選択は必須

- フィールド: `pastHiringJobType`
- ラベル: 「今後採用を進める予定のある職種で過去にも採用を行っていた職種」
- バリデーション: 会社名・担当者氏名・メールアドレスと合わせて必須チェック

### 2. ページ1→ページ2の職種自動連動

- ページ1で選択した `pastHiringJobType` を、ページ2の `desiredJobType` に自動コピー
- コピーは `handleNextPage` 実行時に行う
- ページ2の職種フィールドは **読み取り専用**（`disabled` Input）で表示
- ラベルは「**採用希望の職種**」（「ご希望の職種」ではない）
- 文字色は `text-gray-900 font-medium`（薄すぎない、はっきり見える表示）

### 3. 再送信フロー

- 送信完了画面に「別の職種で回答する」ボタンを表示
- ボタンクリック時:
  - **保持**: 会社名、担当者氏名、メールアドレス
  - **リセット**: 職種、費用、採用人数、予算、エリア、タイムライン、年齢幅、条件（全てクリア）
  - ページ1に戻る（`currentPage = 1`, `status = "form"`）

### 4. DB設計

- `desiredJobTypes` カラムは**削除しない**（ページ1の値が自動コピーされて保存される）
- 管理画面（`/stp/lead-submissions`）や企業詳細で参照されており、既存データとの互換性も維持

## 禁止事項（forbidden_changes）

- ❌ ページ2で職種を選択可能にする（常に読み取り専用）
- ❌ ページ1の職種選択を任意にする（必須のまま維持）
- ❌ ラベルを「ご希望の職種」に戻す（「採用希望の職種」で統一）
- ❌ 再送信時に基本情報（会社名・担当者・メール）をリセットする
- ❌ `desiredJobTypes` DBカラムを削除する

## 実装例

```tsx
// ✅ 正しい実装: handleNextPageで職種をコピー
const handleNextPage = () => {
  if (!isPage1Valid()) {
    setErrorMessage("会社名、担当者氏名、メールアドレス、職種は必須です");
    return;
  }
  setFormData((prev) => ({ ...prev, desiredJobType: prev.pastHiringJobType }));
  setCurrentPage(2);
};

// ✅ 正しい実装: ページ2の職種は読み取り専用
<Input
  id="desiredJobType"
  value={formData.desiredJobType}
  disabled
  className="bg-gray-50 border-gray-300 text-gray-900 font-medium"
/>

// ❌ 間違い: ページ2で職種をSelectで選択可能にする
<Select value={formData.desiredJobType} onValueChange={...}>
```

## 影響範囲

- 関連ファイル: `src/app/form/stp-lead/[token]/page.tsx`
- API: `src/app/api/public/lead-form/submit/route.ts`（変更なし、互換性維持）
- 管理画面: `src/app/stp/lead-submissions/`（変更なし）

## 検証方法

- 手動確認:
  1. ページ1で職種を選択し「次へ」→ ページ2で同じ職種が読み取り専用で表示されること
  2. ページ1で職種未選択で「次へ」→ バリデーションエラーが表示されること
  3. 送信完了後「別の職種で回答する」→ 基本情報保持、他リセットでページ1に戻ること

## ロールバック手順

この仕様を取り消す場合の手順：

1. ページ2の職種フィールドを `Input disabled` から `Select` コンポーネントに戻す
2. `handleNextPage` から `desiredJobType` のコピー処理を削除
3. `isPage1Valid` から `formData.pastHiringJobType` のチェックを削除
4. 送信完了画面の「別の職種で回答する」ボタンと `handleNewSubmission` 関数を削除

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| 2026-02-05 | 初版作成 | - |
