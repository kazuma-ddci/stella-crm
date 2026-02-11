# トラブルシューティング

このドキュメントは既知の問題と解決方法を記述したものです。

---

## 目次

1. [cmdk（Combobox/Command）でマウスホイールスクロールができない](#cmdkcomboboxcommandでマウスホイールスクロールができない)
2. [Textareaやモーダルで長文編集時にレイアウトが崩れる](#textareaやモーダルで長文編集時にレイアウトが崩れる)
3. [Prismaスキーマ変更後にエラーが発生する](#prismaスキーマ変更後にエラーが発生する)
4. [スタッフがログインできない（isActive問題）](#スタッフがログインできないisactive問題)
5. [インライン編集で毎回リロードされ連続入力できない](#インライン編集で毎回リロードされ連続入力できない)
6. [売上経費の対象年月がタイムゾーンにより1ヶ月ズレる](#売上経費の対象年月がタイムゾーンにより1ヶ月ズレる)
7. [売上経費一括生成の件数が0件と表示される](#売上経費一括生成の件数が0件と表示される)
8. [日本語文字列のlocaleCompareでハイドレーションエラー](#日本語文字列のlocalecompareでハイドレーションエラー)
9. [nullable数値フィールドの||演算子による誤判定](#nullable数値フィールドの演算子による誤判定)
10. [Next.js MiddlewareのEdge RuntimeでPrismaが動作しない](#nextjs-middlewareのedge-runtimeでprismaが動作しない)
11. [SessionProviderのrefetchIntervalとJWT callbackのタイミング競合](#sessionproviderのrefetchintervalとjwt-callbackのタイミング競合)
12. [CrudTableのdynamicOptionsをuseStateで初期化すると選択肢が空になる](#crudtableのdynamicoptionsをusestateで初期化すると選択肢が空になる)
13. [企業コード検索で部分一致が過剰にマッチする](#企業コード検索で部分一致が過剰にマッチする)
14. [企業選択プルダウンのソート順が文字列順になる](#企業選択プルダウンのソート順が文字列順になる)
15. [開発サーバー稼働中に next build を実行するとページが応答しなくなる](#開発サーバー稼働中に-next-build-を実行するとページが応答しなくなる)

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

---

## 売上経費の対象年月がタイムゾーンにより1ヶ月ズレる

> **2026-02-07 修正済み**

### 症状

- 入社日が4/1の求職者の成果報酬で、対象年月が `2025/03` になる（1ヶ月前にズレる）
- 月次一括生成でも対象年月がズレる可能性がある

### 原因

`startOfMonth`/`addMonths`関数がローカルタイムゾーンの`new Date(year, month, 1)`でDateオブジェクトを生成していた。JST(UTC+9)環境ではUTC変換時に日付が前日にズレ、月初の場合は前月として保存される。

```
例: 入社日 4/1
→ startOfMonth: new Date(2025, 3, 1) = 2025-04-01T00:00:00+09:00
→ UTC変換: 2025-03-31T15:00:00.000Z
→ Prisma(@db.Date)が 2025-03-31 として保存 → 3月に！
```

### 解決方法

`src/lib/finance/auto-generate.ts` の日付ユーティリティをUTCメソッドに統一。

```typescript
// ❌ 間違い（修正前）: ローカルタイムゾーンで生成
const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, months: number) =>
  new Date(date.getFullYear(), date.getMonth() + months, 1);

// ✅ 正しい（修正後）: UTCで生成
const startOfMonth = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

const addMonths = (date: Date, months: number) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
```

### 原則

**Prismaの`@db.Date`フィールドに保存するDateオブジェクトは、必ずUTCメソッド(`Date.UTC`, `getUTCFullYear`, `getUTCMonth`)で生成すること。** ローカルタイムゾーンの`new Date(year, month, day)`はUTC変換時にズレる。

### 注意

既存のズレたレコード（修正前に生成されたもの）は自動修正されない。手動で対象年月を修正するか、レコードを削除して再生成が必要。

### 関連ファイル

- `src/lib/finance/auto-generate.ts`

---

## 売上経費一括生成の件数が0件と表示される

> **2026-02-07 修正済み**

### 症状

- 求職者を追加して「売上経費を一括生成」を押すと、「0件生成」と表示される
- しかし実際にはレコードが生成されている（画面に表示される）

### 原因

2つの原因が組み合わさって発生：

1. **`addCandidate`が成果報酬を即座に自動生成するが、financeページをrevalidateしない**
   - 求職者追加時に `autoGeneratePerformanceFeeForCandidate` が呼ばれ、レコードは即座に生成される
   - しかし `revalidatePath` が `/stp/candidates` のみで、`/stp/finance/*` が未指定
   - financeページを開いてもキャッシュが古いままでレコードが表示されない

2. **一括生成ボタンでは既存レコードが見つかるため0件**
   - ボタン押下で `autoGeneratePerformanceFeeForCandidate` が再度呼ばれるが、レコードは既に存在
   - boolean方式のカウントで `revenueCreated = false` → 0件
   - その後の `router.refresh()` でfinanceページが更新され、レコードが表示される

ユーザーから見ると「0件だがレコードが表示された」という矛盾した状態に見える。

### 解決方法

1. `addCandidate` にfinanceページの `revalidatePath` を追加
2. 成果報酬の件数カウントをboolean方式からbefore/after方式に変更

```typescript
// ❌ 修正前: boolean方式（既存レコードがあると常に0）
for (const candidate of candidatesWithJoin) {
  const result = await autoGeneratePerformanceFeeForCandidate(candidate.id);
  if (result.revenueCreated) revenueCreated++;
}

// ✅ 修正後: before/after方式（実際の差分を正確にカウント）
const perfRevBefore = await prisma.stpRevenueRecord.count({
  where: { revenueType: "performance", deletedAt: null },
});
for (const candidate of candidatesWithJoin) {
  await autoGeneratePerformanceFeeForCandidate(candidate.id);
}
const perfRevAfter = await prisma.stpRevenueRecord.count({
  where: { revenueType: "performance", deletedAt: null },
});
revenueCreated += perfRevAfter - perfRevBefore;
```

### 関連ファイル

- `src/app/stp/candidates/actions.ts`（revalidation追加）
- `src/lib/finance/auto-generate.ts`（カウントロジック変更）
- `src/app/stp/finance/generate-monthly-button.tsx`（件数表示UI）

---

## 日本語文字列のlocaleCompareでハイドレーションエラー

> **2026-02-07 修正済み**

### 症状

- ページ読み込み時にReactハイドレーションエラーが発生する
- サーバーとクライアントで要素の順番が異なる（例: `CompanyCodeLabel code="SC-7"` vs `SC-5`）
- エラーメッセージ: `Hydration failed because the server rendered HTML didn't match the client.`

### 原因

`localeCompare` を日本語文字列のソートに使用すると、**Node.js（サーバー）とブラウザ（クライアント）で異なるソート順になる**。

これはNode.jsとブラウザで搭載されているICUデータ（国際化ライブラリ）が異なるため。日本語のような非ASCII文字列では、照合順序の違いが結果に直接影響する。

```typescript
// ❌ 間違い: localeCompare で日本語文字列をソート
// → サーバーとクライアントで順序が異なりハイドレーションエラー
return Array.from(map.values()).sort((a, b) => {
  return a.stpCompanyDisplay.localeCompare(b.stpCompanyDisplay);
});

// ❌ これもNG: 日本語の代理店名でソート
return groups.sort((a, b) => {
  return a.agentDisplay.localeCompare(b.agentDisplay);
});
```

### 解決方法

**日本語文字列ではなく、ASCII文字列または数値でソートする。**

```typescript
// ✅ 正しい: 企業コード（ASCII文字列）で比較
return Array.from(map.values()).sort((a, b) => {
  return a.stpCompanyCode < b.stpCompanyCode ? -1 : a.stpCompanyCode > b.stpCompanyCode ? 1 : 0;
});

// ✅ 正しい: ID（数値）で比較
return groups.sort((a, b) => {
  return Number(a.agentId) - Number(b.agentId);
});
```

### 原則

**クライアントコンポーネントで表示順を決めるソートに `localeCompare` を日本語文字列に使わないこと。** 代わりに以下を使う:

| ソートキー | 方法 | 例 |
|-----------|------|-----|
| 企業コード（SC-1等） | `<` / `>` 演算子 | `a.code < b.code ? -1 : 1` |
| 数値ID | 引き算 | `Number(a.id) - Number(b.id)` |
| 日付文字列（YYYY-MM） | `localeCompare`（OK） | `a.month.localeCompare(b.month)` |
| 英数字のみの文字列 | `localeCompare`（OK） | ASCII範囲なら問題なし |

> **補足:** `localeCompare` はASCII範囲の文字列（英数字、日付文字列など）に対しては問題ない。問題になるのは日本語・中国語などの非ASCII文字列のみ。

### 関連ファイル

- `src/app/stp/finance/revenue/revenue-table.tsx`（2026-02-07修正済み）
- `src/app/stp/finance/expenses/expenses-table.tsx`（2026-02-07修正済み）

---

## nullable数値フィールドの||演算子による誤判定

> **2026-02-07 修正済み**

### 症状

- STP登録済み企業（`[STP登録済]`ラベルあり）を選択しても、STP企業として認識されない
- STP登録済み企業に紐付けた際にフォーム全体が表示される（メッセージのみ表示されるべき）

### 原因

`||` 演算子がnullable数値フィールドで誤った結果を返す。`agentId` が `null`（代理店未設定のSTP企業）の場合、`stpInfo?.agentId || null` は常に `null` を返すため、`stpInfo` オブジェクト自体が存在しても判定が失敗する。

```typescript
// ❌ 間違い: agentId が null や 0 のとき stpAgentId も null になる
stpAgentId: stpInfo?.agentId || null,

// その後の判定: agentId が null のSTP企業で false を返してしまう
const isInStp = company?.stpAgentId != null;  // → false（間違い）
```

### 解決方法

1. **`??`（nullish coalescing）を使う**: `null`/`undefined` のみをフォールバック、`0` は保持
2. **明示的な `isInStp: boolean` フラグを追加**: 関連テーブルの存在自体で判定

```typescript
// ✅ 正しい: ?? で null/undefined のみをフォールバック
stpAgentId: stpInfo?.agentId ?? null,

// ✅ 正しい: 明示的な boolean フラグで判定
isInStp: !!stpInfo,  // stpInfo オブジェクト自体の存在で判定

// 使用側
const isInStp = company?.isInStp === true;  // → true（正しい）
```

### 原則

**nullable な数値フィールドのデフォルト値設定には `||` ではなく `??` を使うこと。** `||` は `0`, `""`, `false` もフォールバックしてしまう。

| 演算子 | `null` | `undefined` | `0` | `""` | `false` |
|--------|--------|-------------|-----|------|---------|
| `||` | フォールバック | フォールバック | フォールバック | フォールバック | フォールバック |
| `??` | フォールバック | フォールバック | **そのまま** | **そのまま** | **そのまま** |

### 関連ファイル

- `src/app/stp/lead-submissions/submissions-table.tsx`（`isInStp`による判定に変更）
- `src/app/stp/lead-submissions/page.tsx`（`||` → `??`、`isInStp`追加）
- `src/app/api/stp/lead-submissions/route.ts`（同上）

---

## Next.js MiddlewareのEdge RuntimeでPrismaが動作しない

> **2026-02-10 確認済み**

### 症状

- Middleware内でPrismaのDB操作（権限チェック等）を行おうとしても、クエリが実行されない
- `try/catch` で囲んでいるため、エラーは発生せず**サイレントに失敗**する
- Layout（Server Component）で `cookies().delete()` を使おうとすると `Cookies can only be modified in a Server Action or Route Handler` エラーが発生

### 原因

Next.jsのMiddleware（`src/middleware.ts`）は**Edge Runtime**で動作する。Edge Runtimeは軽量な環境であり、Node.jsのフルAPIが使えない。Prisma ORMはNode.js固有のAPIに依存しているため、Edge RuntimeではDBクエリが実行できない。

```typescript
// ❌ Middleware内（Edge Runtime）ではPrismaが動作しない
export async function middleware(request: NextRequest) {
  try {
    const staff = await prisma.masterStaff.findUnique({ ... });
    // ↑ このクエリは実行されず、catchブロックに落ちる
  } catch {
    // サイレントに失敗 - ログも出ない
  }
}
```

### 解決方法

DB操作が必要な処理は、**Node.jsランタイムで動作するAPI Route（`/api/auth/session`）やServer Componentで実行**する。

この制約は権限変更検知の自動ログアウト機能で以下のように解決した：

1. **SessionProvider** の `refetchInterval={30}` で30秒ごとに `GET /api/auth/session` を呼ぶ
2. **JWT callback**（Node.jsランタイム）でDB権限チェックを実行
3. **PermissionGuard**（クライアントコンポーネント）で `permissionsExpired` フラグを監視し、`signOut()` を実行

### 原則

**Middleware内でPrisma（DB操作）を使わないこと。** DB操作が必要な認証・認可チェックはAPI RouteやServer Actionで実行する。

### 関連ファイル

- `src/middleware.ts`（Edge Runtime）
- `src/auth.ts`（JWT callback - Node.jsランタイム）
- `src/components/auth/permission-guard.tsx`（クライアントサイド検知）

---

## SessionProviderのrefetchIntervalとJWT callbackのタイミング競合

> **2026-02-10 修正済み**

### 症状

- `refetchInterval={30}` と JWT callbackのチェック間隔 `> 30 * 1000` を同じ値に設定すると、権限変更検知が動作しない
- Docker logsにDB権限チェック（`masterStaff`クエリ）のログが出ない

### 原因

`refetchInterval={30}` により30秒ごとに `/api/auth/session` が呼ばれ、JWT callbackが実行される。しかしJWT callbackのチェック条件が `now - checkedAt > 30 * 1000`（**厳密に大きい**）の場合、ちょうど30秒で呼ばれると `30000 > 30000` → `false` となり、チェックがスキップされる。

```
タイムライン:
  0秒: ログイン（checkedAt = 0）
  30秒: 1回目のrefetch → now - checkedAt = 30000 > 30000 → false（スキップ！）
  60秒: 2回目のrefetch → now - checkedAt = 60000 > 30000 → true（実行）
```

最初のチェックが60秒後になり、その後も2回に1回しかチェックされない可能性がある。

### 解決方法

JWT callbackのチェック間隔をrefetchIntervalより**十分に短く**設定する。

```typescript
// ❌ 間違い: refetchInterval と同じ値（= 競合する）
if (now - checkedAt > 30 * 1000) {

// ✅ 正しい: refetchInterval より十分に短い値
if (now - checkedAt >= 10 * 1000) {
```

### 原則

**JWT callbackのDB権限チェック間隔は、SessionProviderのrefetchIntervalより十分に短くすること。** 現在の設定:

| 設定 | 値 | 場所 |
|------|-----|------|
| refetchInterval | 30秒 | `src/app/layout.tsx` |
| JWT チェック間隔 | 10秒以上 | `src/auth.ts` |

### 関連ファイル

- `src/auth.ts`（JWT callbackのチェック間隔）
- `src/app/layout.tsx`（SessionProviderのrefetchInterval）

---

## CrudTableのdynamicOptionsをuseStateで初期化すると選択肢が空になる

### 症状

`dynamicOptions` を `useState({})` で管理し、ユーザー操作時に `setState` で更新する方式にすると、初期表示やフォールバック時に選択肢が空（「-」のみ）になる。

### 原因

CrudTableの `getInlineEditOptions` は `inlineEditConfig.getOptions` が空配列を返した場合、カラム定義の `dynamicOptionsKey` + `dynamicOptions` propにフォールバックする。`useState({})` で初期化した `dynamicOptions` は空マップなので、フォールバック先も空になる。

### 解決方法

`useState` をやめて `useMemo` で事前に全データ分の選択肢マップを構築する：

```tsx
// ❌ 間違い: stateで管理（初期値が空）
const [dynamicOpts, setDynamicOpts] = useState({
  industryTypeByCompany: {},
  jobMediaByIndustryType: {},
});

// ✅ 正しい: useMemoで事前構築
const dynamicOpts = useMemo(() => {
  const industryTypeByCompany: Record<string, Option[]> = {};
  const jobMediaByIndustryType: Record<string, Option[]> = {};
  // ... contractOptionsByStpCompany からマップを構築 ...
  return { industryTypeByCompany, jobMediaByIndustryType };
}, [contractOptionsByStpCompany]);
```

### 関連ファイル

- `src/components/crud-table.tsx`（`getInlineEditOptions` のフォールバック処理）
- `src/app/stp/candidates/candidates-table.tsx`（修正対象）

---

## 企業コード検索で部分一致が過剰にマッチする

> **2026-02-11 修正済み**

### 症状

- 企業選択プルダウンで「SC-1」と検索すると、SC-1だけでなくSC-10, SC-14, SC-100なども表示される
- 適切なフィルタリングができず、目的の企業を選択しづらい

### 原因

`includes()` による単純な部分一致で検索しているため、「SC-1」が「SC-10」「SC-14」「SC-100」などの部分文字列としてマッチしてしまう。

```typescript
// ❌ 間違い: includes() で部分一致（SC-1 が SC-10 にもマッチ）
options.filter(opt => opt.label.toLowerCase().includes(search.toLowerCase()))

// cmdk のデフォルトフィルターも同様に部分一致
<Command>  // shouldFilter 未指定 = cmdk デフォルト（部分一致）
```

### 解決方法

`matchesWithWordBoundary()` 関数（`src/lib/utils.ts`）を使用する。検索語が数字で終わる場合、マッチ直後の文字も数字ならマッチしない。

```typescript
// ✅ 正しい: matchesWithWordBoundary() で境界考慮フィルタ
import { matchesWithWordBoundary } from "@/lib/utils";

// 手動フィルタの場合（shouldFilter={false}）
options.filter(opt => matchesWithWordBoundary(opt.label, search))

// cmdk の Command コンポーネントの場合
<Command filter={(value, search) => matchesWithWordBoundary(value, search) ? 1 : 0}>
```

**マッチ結果の例:**

| 検索語 | 対象 | マッチ | 理由 |
|--------|------|--------|------|
| SC-1 | SC-1 株式会社テスト | ✅ | 完全一致 |
| SC-1 | SC-10 株式会社ABC | ❌ | 数字の後に数字が続く |
| SC-1 | SC-100 株式会社DEF | ❌ | 数字の後に数字が続く |
| テスト | SC-1 株式会社テスト | ✅ | 日本語は従来通り部分一致 |
| SC | SC-1 株式会社テスト | ✅ | 数字で終わらないのでプレフィックスマッチ |

### 関連ファイル

- `src/lib/utils.ts`（`matchesWithWordBoundary` 関数）
- `src/components/editable-cell.tsx`（Command の filter prop）
- `src/components/crud-table.tsx`（Command の filter prop）
- `src/components/ui/combobox.tsx`（手動フィルタ）
- `src/components/company-search-combobox.tsx`（手動フィルタ）

---

## 企業選択プルダウンのソート順が文字列順になる

> **2026-02-11 修正済み**

### 症状

- 企業選択プルダウンの表示順が SC-1, SC-10, SC-100, SC-2 のような文字列辞書順になる
- 最新の企業を素早く選択できない

### 原因

Prismaクエリの `orderBy` が `{ companyCode: "desc" }` や `{ id: "asc" }` になっており、企業コードの文字列ソートまたはID昇順で取得していた。

```typescript
// ❌ 間違い: 文字列ソート（SC-1, SC-10, SC-100, SC-2 の順になる）
prisma.masterStellaCompany.findMany({
  orderBy: { companyCode: "desc" },
})

// ❌ 間違い: ID昇順（古い企業が上に来る）
prisma.stpCompany.findMany({
  orderBy: { id: "asc" },
})
```

### 解決方法

企業IDの降順（最新が上）でソートする。

```typescript
// ✅ 正しい: masterStellaCompany は ID降順
prisma.masterStellaCompany.findMany({
  orderBy: { id: "desc" },
})

// ✅ 正しい: stpCompany はリレーション先の企業ID降順
prisma.stpCompany.findMany({
  orderBy: { company: { id: "desc" } },
})
```

### 関連ファイル

- `src/app/stp/candidates/page.tsx`
- `src/app/stp/companies/page.tsx`
- `src/app/stp/contracts/page.tsx`
- `src/app/stp/lead-submissions/page.tsx`
- `src/app/stp/records/company-contacts/page.tsx`

---

## 開発サーバー稼働中に next build を実行するとページが応答しなくなる

> **2026-02-11 確認済み**

### 症状

- `docker-compose exec app npx next build` を実行すると、ブラウザで localhost:3000 がずっとローディング中になる
- ページが一切表示されず、リロードしても復帰しない

### 原因

開発サーバー（`next dev`）と本番ビルド（`next build`）は同じ `.next` フォルダに書き込む。両方を同時に実行すると、開発サーバーが使用中のファイルをビルドプロセスが上書きしてしまい、開発サーバーが応答不能になる。

```
next dev  →  .next/ を読み書きして動作中
next build → .next/ を上書き ← 競合発生！
→ 開発サーバーが参照先を失って応答不能に
```

### 解決方法

コンテナを再起動すると、開発サーバーが `.next` フォルダを最初から作り直すため復旧する。

```bash
docker-compose restart app
```

### 予防策：ビルド確認には tsc --noEmit を使う

コードの型チェック・コンパイルエラー確認には `next build` ではなく TypeScript コンパイラを使う。`.next` フォルダに触れないので開発サーバーに影響しない。

```bash
# ✅ 正しい: 型チェックのみ（開発サーバーに影響なし）
docker-compose exec app npx tsc --noEmit

# ❌ 間違い: next build（開発サーバーと競合する）
docker-compose exec app npx next build
```

### 関連ファイル

- `.next/`（開発サーバーとビルドの共有ディレクトリ）
