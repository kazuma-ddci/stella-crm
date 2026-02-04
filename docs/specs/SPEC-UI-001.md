# SPEC-UI-001: Textarea/モーダル長文編集レイアウト

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-UI-001 |
| ステータス | ✅ confirmed |
| オーナー | - |
| 最終更新 | 2026-02-04 |
| 関連ファイル | `src/components/ui/textarea.tsx`, `src/components/text-preview-cell.tsx`, `src/components/editable-cell.tsx`, `src/components/change-confirmation-dialog.tsx` |

## 概要

長文入力時にTextareaが無限に伸びてボタンが画面外に逃げる問題を防ぐため、各コンポーネントに適切な高さ制限とスクロール設定を適用する。

## 仕様詳細

### 対象ファイルと対処

| ファイル | 問題 | 対処 |
|---------|------|------|
| `textarea.tsx` | `field-sizing-content`で高さが伸び続ける | `field-sizing-content`を削除 |
| `text-preview-cell.tsx` | `overflow-hidden`でスクロール不可 | `flex flex-col`レイアウト + `max-h-[50vh]` |
| `editable-cell.tsx` | Popover内に`max-height`制御がない | `max-h-[300px] overflow-y-auto` |
| `change-confirmation-dialog.tsx` | 変更前/後ボックスが小さすぎる | `min-h-[100px] max-h-[200px] sm:max-h-[250px]` |

## 禁止事項（forbidden_changes）

- ❌ `textarea.tsx` に `field-sizing-content` を追加する
- ❌ モーダルから `max-h-[80vh]` や `flex flex-col` を削除する
- ❌ Textareaの `max-h-[50vh]` 制限を削除する
- ❌ DialogFooterから `flex-shrink-0` を削除する

## 実装例

### TextPreviewCell（モーダル編集）

```tsx
// ✅ 正しい実装
<DialogContent className="max-h-[80vh] flex flex-col">
  <DialogHeader className="flex-shrink-0">
    <DialogTitle>タイトル</DialogTitle>
  </DialogHeader>

  {/* 編集モード */}
  <div className="flex-1 min-h-0 overflow-hidden">
    <Textarea
      className="resize-none w-full min-h-[200px] sm:min-h-[250px] md:min-h-[300px] max-h-[50vh] overflow-y-auto"
      placeholder="テキストを入力..."
    />
  </div>

  <DialogFooter className="flex-shrink-0">
    {/* ボタンは常に見える位置に固定 */}
  </DialogFooter>
</DialogContent>
```

**ポイント:**
- `flex flex-col` + `flex-shrink-0` でHeader/Footerを固定
- `flex-1 min-h-0` でコンテンツエリアを可変に
- `min-h-[200px]` でモバイルでも十分な入力エリアを確保
- `max-h-[50vh]` で画面の半分を超えないように制限
- レスポンシブ対応: `sm:min-h-[250px] md:min-h-[300px]`

### EditableCell（インライン編集Popover）

```tsx
// ✅ 正しい実装
<PopoverContent className="w-[90vw] sm:w-[400px] max-w-[400px] p-2">
  <Textarea
    rows={8}
    className="resize-none min-h-[180px] max-h-[300px] overflow-y-auto"
  />
  <div className="flex justify-end gap-2 mt-2">
    <Button size="sm" variant="outline">キャンセル</Button>
    <Button size="sm">確定</Button>
  </div>
</PopoverContent>
```

### ChangeConfirmationDialog（変更確認ダイアログ）

```tsx
// ✅ 正しい実装
<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
  <div>
    <div className="text-xs text-muted-foreground mb-1">変更前</div>
    <ScrollableBox className="min-h-[100px] max-h-[200px] sm:max-h-[250px] p-3 bg-red-50 rounded border border-red-200">
      <span className="text-red-600 line-through whitespace-pre-wrap break-words text-sm">
        {oldValue}
      </span>
    </ScrollableBox>
  </div>
  <div>
    <div className="text-xs text-muted-foreground mb-1">変更後</div>
    <ScrollableBox className="min-h-[100px] max-h-[200px] sm:max-h-[250px] p-3 bg-green-50 rounded border border-green-200">
      <span className="text-green-700 font-semibold whitespace-pre-wrap break-words text-sm">
        {newValue}
      </span>
    </ScrollableBox>
  </div>
</div>
```

## テスト

関連テスト: `tests/specs/SPEC-UI-001.test.ts`（視覚的テストのため、手動確認を推奨）

### 手動テスト手順

1. 長文（500文字以上）をTextareaに入力
2. 保存ボタンが常に画面内に表示されていることを確認
3. Textareaがスクロール可能であることを確認
4. モバイル表示でも同様に動作することを確認

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| 2026-02-04 | docs/troubleshooting.mdから移行、SPEC形式化 | - |
| - | 初版作成（docs/troubleshooting.md内） | ユーザー承認済み |
