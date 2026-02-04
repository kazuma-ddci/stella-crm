# トラブルシューティング

このドキュメントは既知の問題と解決方法を記述したものです。

---

## 目次

1. [cmdk（Combobox/Command）でマウスホイールスクロールができない](#cmdkcomboboxcommandでマウスホイールスクロールができない)
2. [Textareaやモーダルで長文編集時にレイアウトが崩れる](#textareaやモーダルで長文編集時にレイアウトが崩れる)
3. [Prismaスキーマ変更後にエラーが発生する](#prismaスキーマ変更後にエラーが発生する)
4. [スタッフがログインできない（isActive問題）](#スタッフがログインできないisactive問題)
5. [インライン編集で毎回リロードされ連続入力できない](#インライン編集で毎回リロードされ連続入力できない)

---

## cmdk（Combobox/Command）でマウスホイールスクロールができない

### 症状

- shadcn/uiのComboboxやCommandコンポーネントで、ドロップダウンリストがマウスホイールでスクロールできない
- キーボードの上下キーでは選択できるが、ホイールが効かない

### 原因

- cmdkライブラリでマウスホイールイベントが親要素に伝播してしまい、リスト自体がスクロールしない

### 解決方法

`src/components/ui/command.tsx`の`CommandList`コンポーネントで、ホイールイベントを手動で処理する：

```tsx
const CommandList = React.forwardRef<
  React.ComponentRef<typeof CommandPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof CommandPrimitive.List> & { maxHeight?: number }
>(({ className, maxHeight = 300, style, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement>(null)

  // マウスホイールイベントを手動で処理
  React.useEffect(() => {
    const el = listRef.current
    if (!el) return

    const handleWheel = (e: WheelEvent) => {
      e.stopPropagation()
      el.scrollTop += e.deltaY
    }

    el.addEventListener("wheel", handleWheel, { passive: true })
    return () => el.removeEventListener("wheel", handleWheel)
  }, [])

  // refを結合
  const combinedRef = (node: HTMLDivElement) => {
    listRef.current = node
    if (typeof ref === "function") {
      ref(node)
    } else if (ref) {
      ref.current = node
    }
  }

  return (
    <CommandPrimitive.List
      ref={combinedRef}
      className={cn("overflow-y-auto overflow-x-hidden", className)}
      style={{
        maxHeight: `${maxHeight}px`,
        overflowY: "auto",
        overscrollBehavior: "contain",
        ...style,
      }}
      {...props}
    />
  )
})
```

### ポイント

- `e.stopPropagation()`でイベント伝播を止める
- `el.scrollTop += e.deltaY`で手動スクロール
- `overscrollBehavior: "contain"`でスクロールの伝播を防止
- `passive: true`でパフォーマンス最適化

### 関連ファイル

- `src/components/ui/command.tsx`
- `src/app/globals.css`（CSSでの対応も可能だが、JSでの対応が確実）

---

## Textareaやモーダルで長文編集時にレイアウトが崩れる

> **⚠️ 確定仕様（変更禁止）**
> 以下の実装パターンはユーザー承認済みの確定仕様です。
> **ユーザーから明示的な変更要望がない限り、この形を維持してください。**
>
> **📎 詳細仕様: [SPEC-UI-001](specs/SPEC-UI-001.md)**

### 症状

- 長文入力時にTextareaが無限に伸び、保存ボタンが画面外に逃げる
- モーダル内でスクロールができない
- 全文が確認しづらい

### 原因と対処

| ファイル | 問題 | 対処 |
|---------|------|------|
| `src/components/ui/textarea.tsx` | `field-sizing-content`クラスで高さが内容に合わせて伸び続ける | `field-sizing-content`を削除 |
| `src/components/text-preview-cell.tsx` | `overflow-hidden`でモーダル全体のスクロールが封じられる | `flex flex-col`レイアウトに変更、Textareaに`max-h-[50vh]`を設定 |
| `src/components/editable-cell.tsx` | Popover内textareaに`max-height`制御がない | `max-h-[300px] overflow-y-auto`を追加 |
| `src/components/change-confirmation-dialog.tsx` | 変更前/変更後ボックスが小さすぎる | `min-h-[100px] max-h-[200px] sm:max-h-[250px]`でレスポンシブ対応 |

### TextPreviewCell（モーダル編集）の実装パターン

```tsx
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

### ポイント

- `flex flex-col` + `flex-shrink-0`でHeader/Footerを固定
- `flex-1 min-h-0`でコンテンツエリアを可変に
- `min-h-[200px]`でモバイルでも十分な入力エリアを確保
- `max-h-[50vh]`で画面の半分を超えないように制限
- レスポンシブ対応：`sm:min-h-[250px] md:min-h-[300px]`

### EditableCell（インライン編集Popover）の実装パターン

```tsx
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

### ChangeConfirmationDialog（変更確認ダイアログ）の実装パターン

```tsx
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

### 関連ファイル

- `src/components/ui/textarea.tsx`
- `src/components/text-preview-cell.tsx`
- `src/components/editable-cell.tsx`
- `src/components/change-confirmation-dialog.tsx`

---

## Prismaスキーマ変更後にエラーが発生する

### 症状

- `prisma/schema.prisma` にカラムを追加・変更した後、以下のエラーが発生：
  - `Unknown argument 'xxx'. Available options are marked with ?.`
  - `The column 'xxx' does not exist in the current database.`

### 原因

1. **Prisma Clientが古い**: スキーマ変更後に `prisma generate` を実行していない
2. **DBに反映されていない**: マイグレーションまたは `db push` を実行していない

### 解決方法

```bash
# 1. DBにスキーマを反映
docker-compose exec app npx prisma db push

# 2. Prisma Clientを再生成（必須）
docker-compose exec app npx prisma generate

# 3. アプリを再起動
docker-compose restart app
```

### ポイント

- **`prisma generate` は必須**: `db push` だけでは不十分。Prisma Clientのコードが更新されない
- **アプリ再起動**: キャッシュされたClientを使っている場合があるため再起動推奨
- **docker-compose down/up**: 完全にリセットする場合は `docker-compose down && docker-compose up -d`

### 関連ファイル

- `prisma/schema.prisma`

---

## スタッフがログインできない（isActive問題）

### 症状

- パスワードを正しく設定したのに「メールアドレスまたはパスワードが正しくありません」と表示される

### 原因

- `MasterStaff.isActive` が `false` になっている
- 認証ロジック（`src/auth.ts`）は `isActive` が `true` でないとログインを許可しない

```typescript
if (staff && staff.passwordHash && staff.isActive) {
  // 認証処理
}
```

### 解決方法

**DBで直接有効化:**

```bash
docker-compose exec db psql -U postgres -d crm_db -c 'UPDATE master_staff SET "isActive" = true WHERE email = '"'"'user@example.com'"'"';'
```

**または、スタッフ一覧画面で「有効」を選択して更新**

### 予防策

- スタッフ追加時に「有効」を選択する
- または、デフォルトで有効になるよう `actions.ts` を修正済み（2026-02-04）

```typescript
// src/app/staff/actions.ts
isActive: data.isActive !== false && data.isActive !== "false", // デフォルトで有効
```

### 関連ファイル

- `src/auth.ts`
- `src/app/staff/actions.ts`

---

## インライン編集で毎回リロードされ連続入力できない

### 症状

- セルに値を入力してEnterを押すと、画面全体がリロードされる
- 次のセルをすぐにクリックできず、連続入力ができない
- 入力のたびに待たされる

### 原因

セル更新後に `fetchData()` や `router.refresh()` を呼んでいる場合、サーバーから全データを再取得するため画面がリロードされる。

```typescript
// ❌ 悪い例：毎回リロードが発生
const handleCellUpdate = useCallback(
  async (id: number, field: string, value: number | null) => {
    await updateCell(id, field, value);
    await fetchData();  // ← 全データ再取得でリロード
  },
  [fetchData]
);
```

### 解決方法：楽観的更新（Optimistic Update）

サーバーへの保存を待たずに、ローカルステートを即座に更新する。

```typescript
// ✅ 良い例：楽観的更新で即座に反映
const handleCellUpdate = useCallback(
  async (id: number, field: string, value: number | null) => {
    // 1. 即座にローカルステートを更新（UIが即反映）
    setData((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );

    // 2. サーバーに保存（バックグラウンド）
    try {
      await updateCell(id, field, value);
    } catch (error) {
      console.error("Failed to update:", error);
      // エラー時のみ再取得して整合性を回復
      await fetchData();
    }
  },
  [fetchData]
);
```

### ポイント

- **`setData()` を先に呼ぶ**: サーバー応答を待たずにUIを更新
- **エラー時のみ再取得**: 整合性が崩れた場合のみ `fetchData()` を呼ぶ
- **計算項目も即反映**: Reactの再レンダリングで計算項目も自動更新される

### ネストしたデータの場合

```typescript
// シート > 週次データ のようなネスト構造
setSheets((prev) =>
  prev.map((sheet) => ({
    ...sheet,
    weeklyData: sheet.weeklyData.map((week) =>
      week.id === weeklyDataId ? { ...week, [field]: value } : week
    ),
  }))
);
```

### 関連ファイル

- `src/app/stp/companies/[id]/kpi/page.tsx`（KPIシート - 2026-02-04修正済み）
