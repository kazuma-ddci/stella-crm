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
16. [パスワードリセットで「The string did not match the expected pattern.」エラー](#パスワードリセットでthe-string-did-not-match-the-expected-patternエラー)
17. [update関数の部分更新未対応でフィールドがnull/falseに上書きされる](#update関数の部分更新未対応でフィールドがnullfalseに上書きされる)
18. [VPSでdocker-compose(v1)を使うとContainerConfigエラーになる](#vpsでdocker-composev1を使うとcontainerconfigエラーになる)
19. [CrudTableのselectで「-」(null)オプションが「なし」(none)と重複し意図しない変更が発生する](#crudtableのselectでnullオプションがなしnoneと重複し意図しない変更が発生する)
20. [Google Drive APIでサービスアカウントのストレージクォータ超過](#google-drive-apiでサービスアカウントのストレージクォータ超過)
21. [Clipboard API の NotAllowedError（HTTP環境・iframe内）](#clipboard-api-の-notallowederrorhttp環境iframe内)
22. [getOrCreateCompanyFolder で driveId に通常フォルダIDを渡すとAPIエラー](#getorcreatecompanyfolder-で-driveid-に通常フォルダidを渡すとapiエラー)
23. [PrismaClientがブラウザでロードされる（"use client" × サーバー専用モジュール）](#prismaclientがブラウザでロードされるuse-client--サーバー専用モジュール)

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

> **関連**: isActiveがfalseになる根本原因の一つが「update関数の部分更新未対応」。詳細は [#17](#update関数の部分更新未対応でフィールドがnullfalseに上書きされる) を参照。

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

---

## パスワードリセットで「The string did not match the expected pattern.」エラー

> **2026-02-12 修正済み**

### 症状

- パスワードリセットページ（`/forgot-password`）でメールアドレスやログインIDを入力して送信しようとすると、ブラウザが「The string did not match the expected pattern.」エラーを表示する
- 特にSafariで発生しやすい（Chromeでは別のバリデーションメッセージになる場合がある）

### 原因

3つの問題が重なっていた：

**1. `type="email"` によるブラウザバリデーション**

forgot-passwordページの入力フィールドが `type="email"` だったため、ログインID（例: `stella001`）を入力するとブラウザのHTML5バリデーションで拒否された。ログインページは `type="text"` でメールアドレス・ログインID両方を受け付けるが、forgot-passwordページはメールアドレスのみ対応だった。

```tsx
// ❌ 間違い: type="email" だとログインIDが入力できない
<Input type="email" />

// ✅ 正しい: type="text" でメールアドレスとログインIDの両方を受け付ける
<Input type="text" />
```

**2. パスワードリセットAPIがミドルウェアで保護されていた**

`/api/forgot-password` と `/api/reset-password` がミドルウェアの `PUBLIC_PATHS` に含まれていなかったため、未ログインユーザーからのAPIリクエストがログインページにリダイレクトされていた。

```typescript
// ❌ 修正前: APIパスが未登録
const PUBLIC_PATHS = [
  "/forgot-password",
  "/reset-password",
  // /api/forgot-password が無い！
];

// ✅ 修正後: ページとAPIの両方を登録
const PUBLIC_PATHS = [
  "/forgot-password",
  "/api/forgot-password",
  "/reset-password",
  "/api/reset-password",
];
```

**3. Prismaクライアント未再生成**

`staffId` フィールドが Prisma Client に認識されず、`updateMany` でエラーが発生していた。`prisma generate` で解決。

### 解決方法

1. `src/app/forgot-password/page.tsx`: `type="email"` → `type="text"` に変更
2. `src/app/api/forgot-password/route.ts`: ログインIDでもスタッフ検索できるよう対応（`@` を含むかで分岐）
3. `src/middleware.ts`: `/api/forgot-password` と `/api/reset-password` を `PUBLIC_PATHS` に追加
4. `prisma generate` でクライアント再生成

### 原則

- **公開ページのAPIルートも `PUBLIC_PATHS` に含めること。** ページ（`/forgot-password`）だけ登録しても、そのページが呼ぶAPI（`/api/forgot-password`）が未登録だと未ログインユーザーがAPIを利用できない
- **ログインページと同じ認証方式（メールアドレス/ログインID両方）をパスワードリセットページでもサポートすること**

### 関連ファイル

- `src/app/forgot-password/page.tsx`（入力フィールドの `type` 変更）
- `src/app/api/forgot-password/route.ts`（ログインID検索対応）
- `src/middleware.ts`（PUBLIC_PATHS にAPI追加）

---

## update関数の部分更新未対応でフィールドがnull/falseに上書きされる

> **2026-02-12 修正済み**

### 症状

- スタッフ追加後にインライン編集（名前だけ変更等）すると、メールアドレスが消失してログインできなくなる
- `isActive` が `false` に上書きされ、認証拒否される
- 役割・プロジェクト割当・権限が全削除される
- 設定画面のマスタデータ編集でも `isActive` が `false` に上書きされる

### 原因

CrudTableのインライン編集は、変更されたフィールドのみを `changedData` として送信する。しかしserver actionのupdate関数が全フィールドを無条件に書き込むため、未送信フィールドが `undefined` になり、`null` / `false` / 空配列に変換されて保存される。

```typescript
// ❌ 間違い: 全フィールドを無条件に書き込む
await prisma.masterStaff.update({
  where: { id },
  data: {
    name: data.name as string,           // undefined → "undefined" (文字列化)
    email: (data.email as string) || null, // undefined || null → null (消える！)
    isActive: data.isActive === true,      // undefined === true → false (無効化！)
  },
});

// 役割も無条件に全削除→再作成
await prisma.staffRoleAssignment.deleteMany({ where: { staffId: id } });
// data.roleTypeIds が undefined → [] → 0件作成 (全削除のみ！)
```

### 解決方法

`"field" in data` チェックで動的に `updateData` を構築し、送信されたフィールドのみ更新する。既存の正しい実装（`src/app/companies/actions.ts:updateCompany`）に倣う。

```typescript
// ✅ 正しい: 渡されたフィールドのみ更新
const updateData: Record<string, unknown> = {};
if ("name" in data) updateData.name = data.name as string;
if ("email" in data) updateData.email = (data.email as string) || null;
if ("isActive" in data) updateData.isActive = data.isActive === true || data.isActive === "true";

if (Object.keys(updateData).length > 0) {
  await prisma.masterStaff.update({ where: { id }, data: updateData });
}

// 役割も "roleTypeIds" が渡された場合のみ更新
if ("roleTypeIds" in data) {
  const roleTypeIds = (data.roleTypeIds as string[]) || [];
  await prisma.staffRoleAssignment.deleteMany({ where: { staffId: id } });
  if (roleTypeIds.length > 0) {
    await prisma.staffRoleAssignment.createMany({
      data: roleTypeIds.map((roleTypeId) => ({ staffId: id, roleTypeId: Number(roleTypeId) })),
    });
  }
}
```

### 原則

**CrudTableから呼ばれるupdate関数は、必ず `"field" in data` チェックで部分更新に対応すること。** CrudTableのインライン編集は変更フィールドのみを送信するため、全フィールド書き込み型の実装では未送信フィールドが消失する。

特に注意すべきフィールド:

| フィールド | 未送信時の挙動（修正前） | 影響 |
|-----------|------------------------|------|
| `email` | `undefined \|\| null` → `null` | メールアドレス消失→ログイン不可 |
| `isActive` | `undefined === true` → `false` | 認証拒否 |
| `roleTypeIds` | `undefined \|\| []` → `[]` | 全役割削除 |
| `projectIds` | `undefined \|\| []` → `[]` | 全PJ割当削除 |
| 権限関連（`perm_*`） | 空データで上書き | 全権限削除 |

### 修正対象ファイル（13ファイル）

| ファイル | 関数 |
|---------|------|
| `src/app/staff/actions.ts` | `updateStaff` |
| `src/app/settings/contact-methods/actions.ts` | `updateContactMethod` |
| `src/app/settings/contract-statuses/actions.ts` | `updateContractStatus` |
| `src/app/settings/customer-types/actions.ts` | `updateCustomerType` |
| `src/app/settings/lead-sources/actions.ts` | `updateLeadSource` |
| `src/app/settings/operating-companies/actions.ts` | `updateOperatingCompany` |
| `src/app/staff/role-types/actions.ts` | `updateRoleType` |
| `src/app/stp/settings/stages/actions.ts` | `updateStage` |
| `src/app/settings/display-views/actions.ts` | `updateDisplayView` |
| `src/app/settings/projects/actions.ts` | `updateProject` |
| `src/app/stp/records/stage-histories/actions.ts` | `updateStageHistory` |
| `src/app/stp/contracts/actions.ts` | `updateContract`（2026-02-12追加修正） |
| `src/app/companies/[id]/actions.ts` | `updateCompany` |

### 検証方法

1. スタッフ管理画面でスタッフの名前のみをモーダル編集
2. 更新後、メールアドレス・有効状態・権限が保持されていることを確認
3. 設定画面でマスタデータの名前のみを編集し、isActiveが保持されていることを確認

### ロールバック手順

各ファイルの `updateStaff` 等を修正前のコード（全フィールド直接書き込み）に戻す。ただし部分更新に戻すと同じバグが再発する。

### 関連ファイル

- `src/components/crud-table.tsx`（`changedData` のみ送信する箇所）
- 上記12ファイルのupdate関数
- `src/app/companies/actions.ts`（参照実装 - 修正前から正しいパターンだった）

---

## VPSでdocker-compose(v1)を使うとContainerConfigエラーになる

### 症状

VPS（ステージング・本番）で `docker-compose`（ハイフンあり、v1）を使ってデプロイすると、以下のようなエラーが発生する:

```
ERROR: for stella-prod-app  ContainerConfig
```

### 原因

VPSにインストールされている `docker-compose` v1（1.29.2）が、現在のDockerエンジンとの互換性問題を持っている。Docker Compose v1はPython製の別ツールで、新しいDocker Engineの一部機能に対応していない。

### 解決方法

**`docker-compose`（ハイフンあり、v1）ではなく、`docker compose`（スペース区切り、v2）を使用する。**

v2はDocker CLIのサブコマンドとして組み込まれており、互換性問題がない。

```bash
# ✅ 正しい（v2）
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.stg.yml up -d --build

# ❌ エラーになる（v1）
docker-compose -f docker-compose.prod.yml up -d --build
docker-compose -f docker-compose.stg.yml up -d --build
```

### バージョン確認方法

```bash
# v1（非推奨）
docker-compose --version
# docker-compose version 1.29.2, build ...

# v2（推奨）
docker compose version
# Docker Compose version v2.x.x
```

### 影響範囲

- VPS上でのデプロイコマンド全般
- CLAUDE.mdのデプロイ手順にも記載済み

### 関連ファイル

- `docker-compose.prod.yml`
- `docker-compose.stg.yml`
- `CLAUDE.md`（VPSデプロイ手順セクション）

---

## CrudTableのselectで「-」(null)オプションが「なし」(none)と重複し意図しない変更が発生する

> **2026-02-16 修正済み**

### 症状

- スタッフ管理の権限selectで「なし」（値=`"none"`）と「-」（値=`null`）の2つの「未選択」系オプションが表示される
- ユーザーが「-」を選択すると、権限が `"none"` → `null` に変わる
- 権限に触れていないつもりでも、差分チェックで「変更あり」と判定され、保存時に意図しない権限変更が発生する

### 原因

CrudTableのselect/comboboxは、先頭に自動的に「-」オプション（値=`__empty__` → `null`に変換）を挿入する。これはoptionsに「未選択」相当がない場合のためのフォールバックだが、権限selectのように `{ value: "none", label: "なし" }` が既にoptionsに含まれている場合は、意味が重複する。

ユーザーが「-」と「なし」を混同して「-」を選ぶと、`"none"` → `null` に値が変わり、保存時に差分が検出されてしまう。

```
options: [
  { value: "none", label: "なし" },    // ← これが本来の「未選択」
  { value: "view", label: "閲覧" },
  { value: "edit", label: "編集" },
  { value: "admin", label: "管理者" },
]

CrudTableが自動追加:
  { value: "__empty__" (→null), label: "-" }  // ← 重複！混乱の元
```

### 解決方法

optionsに `value="none"` のオプションが含まれている場合は、「-」（`__empty__`）オプションを表示しない。

```tsx
// ✅ 通常のSelect（crud-table.tsx 951行付近）
<SelectContent>
  {!options.some((opt) => opt.value === "none") && (
    <SelectItem value="__empty__">-</SelectItem>
  )}
  {options.map(...)}
</SelectContent>

// ✅ searchable Combobox（crud-table.tsx 910行付近）
<CommandGroup>
  {!options.some((opt) => opt.value === "none") && (
    <CommandItem value="__empty__" onSelect={() => { ... }}>
      -
    </CommandItem>
  )}
  {options.map(...)}
</CommandGroup>
```

### 原則

**selectのoptionsに `"none"` 値を持つ「なし」オプションが含まれている場合、CrudTableの自動「-」オプションは非表示にすること。** 「なし」と「-」の両方を表示すると、ユーザーが混同して意図しないnull変更が発生する。

### 検証方法

1. スタッフ管理で編集ダイアログを開く
2. 権限セレクトのドロップダウンに「-」が表示されないことを確認（「なし」「閲覧」「編集」「管理者」のみ）
3. 権限に触らず名前だけ変更して保存 → 権限が変わらないことを確認

### ロールバック手順

`src/components/crud-table.tsx` の条件分岐（`!options.some((opt) => opt.value === "none")`）を削除し、`<SelectItem value="__empty__">-</SelectItem>` と `<CommandItem value="__empty__">` を無条件表示に戻す。

### 関連ファイル

- `src/components/crud-table.tsx`（select/comboboxの「-」オプション表示条件）

---

## Google Drive APIでサービスアカウントのストレージクォータ超過

> **2026-02-19 解決済み**

### 症状

- Google Drive APIの `drive.files.copy`（テンプレートコピー）が `403 storageQuotaExceeded` エラーで失敗する
- エラーメッセージ: `The user's Drive storage quota has been exceeded.`
- サービスアカウントのストレージ使用量は `0`、上限も `0`

### 原因

GCPサービスアカウントはGoogle Driveのストレージ枠を持たない（`limit: "0"`）。`drive.files.copy` で作成されるファイルはサービスアカウントが所有者（owner）となるため、ストレージ枠がゼロのサービスアカウントではファイルコピーができない。

通常の「共有フォルダ」にコピーしても、ファイルの所有者はサービスアカウントのままなので解決しない。`supportsAllDrives: true` パラメータを追加しても、通常フォルダでは効果なし。

```javascript
// ❌ 通常の共有フォルダ → storageQuotaExceeded
await drive.files.copy({
  fileId: TEMPLATE_ID,
  requestBody: { name: fileName, parents: [SHARED_FOLDER_ID] },
});

// ❌ supportsAllDrives を追加しても通常フォルダでは解決しない
await drive.files.copy({
  fileId: TEMPLATE_ID,
  requestBody: { name: fileName, parents: [SHARED_FOLDER_ID] },
  supportsAllDrives: true,  // 通常フォルダには効果なし
});
```

### 解決方法

**共有ドライブ（Shared Drive / Team Drive）**を使用する。共有ドライブ内のファイルはドライブ自体が所有するため、サービスアカウントのストレージ制限を受けない。

```javascript
// ✅ 共有ドライブに出力 → 成功
await drive.files.copy({
  fileId: TEMPLATE_ID,
  requestBody: { name: fileName, parents: [SHARED_DRIVE_ID] },
  supportsAllDrives: true,  // 共有ドライブには必須
});
```

#### 設定手順

1. Google Driveで「共有ドライブ」を作成（左メニュー →「共有ドライブ」→「+ 新規」）
2. サービスアカウントを「コンテンツ管理者」として追加
3. テンプレートファイルを共有ドライブにコピー
4. `.env` の `GOOGLE_SLIDE_TEMPLATE_ID`（テンプレートID）と `GOOGLE_DRIVE_OUTPUT_FOLDER_ID`（共有ドライブID）を更新

#### 確認スクリプト

```bash
# サービスアカウントがアクセスできる共有ドライブを一覧
node scripts/list-shared-drives.mjs

# サービスアカウントのストレージ使用状況確認
node scripts/cleanup-drive.mjs
```

### 原則

**サービスアカウントでGoogle Driveにファイルを作成する場合は、必ず共有ドライブ（Shared Drive）を使用すること。** 通常の共有フォルダではサービスアカウントのストレージクォータ（0 bytes）を超過する。

### 関連ファイル

- `src/lib/proposals/slide-generator.ts`（`supportsAllDrives: true` パラメータ）
- `src/lib/google-slides.ts`（Google API認証）
- `.env`（`GOOGLE_DRIVE_OUTPUT_FOLDER_ID`）
- `scripts/list-shared-drives.mjs`（共有ドライブ一覧確認）
- `scripts/cleanup-drive.mjs`（ストレージ確認）

---

## Clipboard API の NotAllowedError（HTTP環境・iframe内）

### 症状

- `navigator.clipboard.writeText()` が `NotAllowedError: The request is not allowed by the user agent or the platform in the current context` で失敗する
- HTTP（非HTTPS）環境や、セキュリティポリシーで Clipboard API が制限されている環境で発生

### 原因

`navigator.clipboard` API は Secure Context（HTTPS）が必須。HTTP環境やiframe内では `navigator.clipboard` オブジェクトは存在するが、`writeText()` 呼び出し時に権限エラーが発生する。

### 解決方法

`document.execCommand("copy")` によるレガシーフォールバックを実装する。

```typescript
// ✅ 正しい実装: Clipboard API + execCommand フォールバック
const copyToClipboard = async (text: string): Promise<boolean> => {
  // 方法1: Clipboard API（モダンブラウザ・HTTPS環境）
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Clipboard APIが失敗した場合はフォールバックへ
    }
  }
  // 方法2: execCommand（レガシーフォールバック）
  return new Promise((resolve) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    requestAnimationFrame(() => {
      try {
        const result = document.execCommand("copy");
        document.body.removeChild(textarea);
        resolve(result);
      } catch {
        document.body.removeChild(textarea);
        resolve(false);
      }
    });
  });
};

// ❌ 間違い: Clipboard API のみ（HTTP環境で失敗する）
await navigator.clipboard.writeText(text);
```

### 注意事項

- このパターンは `agents-table.tsx` と `submissions-table.tsx` で使用中
- 新たにクリップボードコピー機能を追加する場合は同じパターンを使うこと
- `execCommand("copy")` は非推奨だが、HTTP環境のフォールバックとしてまだ必要

### 関連ファイル

- `src/app/stp/agents/agents-table.tsx`（元のパターン実装）
- `src/app/stp/lead-submissions/submissions-table.tsx`（2026-02-19 追加）

---

## getOrCreateCompanyFolder で driveId に通常フォルダIDを渡すとAPIエラー

> **2026-02-19 修正済み**

### 症状

- `getOrCreateCompanyFolder()` で企業フォルダを検索する際に Google Drive API エラーが発生する
- `drive.files.list` の `driveId` パラメータに通常のフォルダID（`1...`で始まる）を渡している

### 原因

`drive.files.list` の `corpora: "drive"` + `driveId` パラメータは、**共有ドライブID**（`0A...`で始まる）のみを受け付ける。環境別フォルダ構成に変更した際、`GOOGLE_DRIVE_OUTPUT_FOLDER_ID` が共有ドライブのルートID → 共有ドライブ内のサブフォルダIDに変わったため、`driveId` として無効なIDが渡されるようになった。

```typescript
// ❌ 間違い: driveId に通常フォルダIDを渡す
const searchResult = await drive.files.list({
  corpora: "drive",
  driveId: OUTPUT_FOLDER_ID,  // ← 共有ドライブIDのみ受付
});
```

### 解決方法

`corpora: "drive"` + `driveId` を削除し、代わりにクエリ内で `'${OUTPUT_FOLDER_ID}' in parents` を使って親フォルダを指定する。この方法は共有ドライブID・通常フォルダIDの両方で動作する。

```typescript
// ✅ 正しい: 親フォルダ指定で検索（共有ドライブID/通常フォルダIDの両方で動作）
const searchResult = await drive.files.list({
  q: `name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and '${OUTPUT_FOLDER_ID}' in parents and trashed = false`,
  supportsAllDrives: true,
  includeItemsFromAllDrives: true,
  fields: "files(id,name)",
});
```

### 原則

**Google Drive API で特定フォルダ内のファイルを検索する場合は、`driveId` ではなく `'${folderId}' in parents` クエリを使うこと。** `driveId` は共有ドライブのルートIDにしか対応しないが、`in parents` はどんなフォルダIDでも動作する。

### 関連ファイル

- `src/lib/proposals/slide-generator.ts`（`getOrCreateCompanyFolder` 関数）

---

## PrismaClientがブラウザでロードされる（"use client" × サーバー専用モジュール）

### 症状

ブラウザのコンソールまたはNext.js dev overlayに以下のエラーが表示され、画面全体が操作不能になる：

```
PrismaClient is unable to run in this browser environment
```

### 原因

`"use client"` コンポーネントが、Prisma依存のモジュールからserver actionを直接インポートしていた。

```typescript
// ❌ 間違い: field-change-log-modal.tsx（"use client"）
import { getFieldChangeLogs } from "@/lib/field-change-log.server";
// field-change-log.server.ts のモジュールレベルに import { prisma } がある
// → Next.jsがクライアントバンドルにPrismaを含めてしまう
```

たとえ `getFieldChangeLogs` 関数内にインライン `"use server"` を書いても、**モジュールレベルの `import { prisma }` はクライアントバンドルに含まれる**。ファイルレベル `"use server"` にすると全エクスポートがasync必須になり、内部ユーティリティ関数（非async）がエラーになる。

### 解決方法

Prisma依存ファイルを**3ファイルに分離**する：

```
field-change-log.shared.ts   ← 純粋関数（型定義、バリデーション、集合比較）
                                 クライアント/サーバー両方からimport可能

field-change-log.server.ts   ← Prisma依存の内部関数（createFieldChangeLogEntries）
                                 import "server-only" でガード
                                 actions.ts からのみimport

field-change-log.actions.ts  ← "use server" ファイルレベル
                                 server action のみエクスポート（getFieldChangeLogs）
                                 "use client" コンポーネントからはこちらをimport
```

```typescript
// ✅ 正しい: field-change-log-modal.tsx（"use client"）
import { getFieldChangeLogs } from "@/lib/field-change-log.actions";
// field-change-log.actions.ts はファイルレベル "use server" なので
// クライアントにはRPCスタブのみバンドルされ、Prismaは含まれない
```

### 再発防止

1. **`server-only` パッケージ**: `npm install server-only` してサーバー専用ファイルに `import "server-only"` を追加。クライアントから誤インポートするとビルド時エラーになる
2. **Vitest対応**: `vitest.config.ts` の `resolve.alias` に `'server-only'` のモックを追加（Next.js専用パッケージはVitestで解決できないため）

```typescript
// vitest.config.ts
resolve: {
  alias: {
    'server-only': path.resolve(__dirname, './src/__tests__/mocks/server-only.ts'),
  },
},
```

### 原則

**`"use client"` コンポーネントからPrisma依存モジュールを直接importしない。** server actionは必ず `"use server"` ファイルレベルの専用ファイルに切り出し、そこからのみimportする。混在ファイル（server action + 内部ユーティリティ）は分離すること。

### 関連ファイル

- `src/lib/field-change-log.shared.ts`（純粋関数）
- `src/lib/field-change-log.server.ts`（Prisma依存 + `import "server-only"`）
- `src/lib/field-change-log.actions.ts`（server action）
- `src/components/field-change-log-modal.tsx`（`"use client"`、actions.tsからimport）
- `src/__tests__/mocks/server-only.ts`（Vitest用モック）
- `vitest.config.ts`（server-onlyエイリアス設定）
