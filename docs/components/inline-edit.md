# インライン編集

このドキュメントはCrudTableのインライン編集機能の詳細を記述したものです。
**⚠️ インライン編集を実装する前に必ず一読すること。**

---

## 目次

1. [概要](#概要)
2. [関連ファイル](#関連ファイル)
3. [InlineEditConfig型](#inlineeditconfig型)
4. [displayToEditMapping](#displaytoeditmapping)
5. [EditableCellの型と表示](#editablecellの型と表示)
6. [ChangeConfirmationDialog](#changeconfirmationdialog)
7. [Server Action実装（部分更新）](#server-action実装部分更新)
8. [過去に発生した問題パターン](#過去に発生した問題パターン)
9. [実装チェックリスト](#実装チェックリスト)
10. [よくあるミスと対処法](#よくあるミスと対処法)

---

## 概要

CrudTableでセルをクリックして直接編集できるインライン編集機能。

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/components/crud-table.tsx` | インライン編集のロジック、InlineEditConfig |
| `src/components/editable-cell.tsx` | 編集UIコンポーネント（Input, Select, DatePicker等） |
| `src/components/change-confirmation-dialog.tsx` | 変更確認ダイアログ |

---

## InlineEditConfig型

```typescript
export type InlineEditConfig = {
  // インライン編集可能なカラムのキー配列
  columns?: string[];

  // セルクリック時のカスタムハンドラ（trueを返すとデフォルト動作をスキップ）
  onCellClick?: (row: Record<string, unknown>, columnKey: string) => boolean | void;

  // カラムごとの選択肢を動的に取得
  getOptions?: (row: Record<string, unknown>, columnKey: string) => EditableCellOption[];

  // カラムが編集可能かどうかを動的に判定
  isEditable?: (row: Record<string, unknown>, columnKey: string) => boolean;

  // 【重要】表示用カラム → 編集用カラムのマッピング
  displayToEditMapping?: Record<string, string>;
};
```

---

## displayToEditMapping

### 背景

- DBには`leadSourceId`（外部キー）を保存するが、テーブルには`leadSourceName`（名前）を表示したい
- `leadSourceName`をクリックしたら`leadSourceId`の編集UIを表示したい
- このような「表示用カラム」と「編集用カラム」が異なるケースに対応

### 実装例（stp-companies-table.tsx）

```typescript
const inlineEditConfig: InlineEditConfig = {
  // 編集可能なカラム（編集用カラムのキーを指定）
  columns: [
    "leadSourceId",       // 流入経路
    "forecast",           // ヨミ
    "salesStaffId",       // 担当営業
    "plannedHires",       // 採用予定人数
    "billingAddress",     // 請求先住所
    "billingContactIds",  // 請求先担当者
  ],

  // 表示用カラム → 編集用カラムのマッピング
  displayToEditMapping: {
    "leadSourceName": "leadSourceId",        // 流入経路名 → 流入経路ID
    "salesStaffName": "salesStaffId",        // 担当営業名 → 担当営業ID
    "billingContacts": "billingContactIds",  // 請求先担当者 → 請求先担当者IDs
  },

  // カラムごとの選択肢を動的に取得
  getOptions: (row, columnKey) => {
    if (columnKey === "leadSourceId") {
      return leadSources.map((s) => ({
        value: String(s.id),
        label: s.name,
      }));
    }
    // ...
  },
};
```

### CrudTable側の実装ポイント

**1. isColumnInlineEditable関数**: マッピングを考慮して編集可能かを判定

```typescript
const isColumnInlineEditable = useCallback(
  (columnKey: string, row: Record<string, unknown>) => {
    // 表示用→編集用のマッピングがある場合、編集用カラムで判定
    const mappedEditKey = inlineEditConfig?.displayToEditMapping?.[columnKey];
    if (mappedEditKey) {
      if (inlineEditConfig?.columns) {
        if (!inlineEditConfig.columns.includes(mappedEditKey)) {
          return false;
        }
      }
      // ...
      return true;
    }
    // 通常のカラムの判定...
  },
  [enableInlineEdit, inlineEditConfig, columns]
);
```

**2. セル描画時**: 表示用カラムでも編集状態を正しく判定

```typescript
// 編集用カラムキーを取得
const editColumnKey = inlineEditConfig?.displayToEditMapping?.[col.key] || col.key;

// 編集中かどうかを判定（表示用カラムと編集用カラムの両方をチェック）
const isEditing =
  editingCell?.rowId === (item.id as number) &&
  (editingCell?.columnKey === col.key || editingCell?.columnKey === editColumnKey);

// 編集UIに渡すカラム定義（マッピングがある場合は編集用カラムの定義を使用）
const editCol = editColumnKey !== col.key
  ? columns.find((c) => c.key === editColumnKey)
  : col;
```

**3. handleInlineSave関数**: displayFieldNameを受け取って確認ダイアログに正しいフィールド名を表示

```typescript
const handleInlineSave = useCallback(
  async (
    row: Record<string, unknown>,
    columnKey: string,
    newValue: unknown,
    displayFieldName?: string  // 表示用フィールド名（オプション）
  ) => {
    // 確認ダイアログに表示するフィールド名
    const fieldName = displayFieldName || col?.header || columnKey;
    // ...
  },
  []
);
```

---

## EditableCellの型と表示

### 対応する入力タイプ

| type | 用途 | UI |
|------|------|-----|
| `text` | テキスト入力 | Input |
| `number` | 数値入力 | Input (type="number") |
| `date` | 日付選択 | DatePicker (Popover) |
| `datetime` | 日時選択 | DatePicker with time (Popover) |
| `select` | 単一選択 | Select or Combobox (searchable時) |
| `multiselect` | 複数選択 | Combobox with checkboxes |
| `textarea` | 複数行テキスト | Textarea (Popover) |

### タイプ別の保存方法の違い（重要）

| タイプ | 保存トリガー | UI構造 |
|--------|-------------|--------|
| `text`, `number` | blur（フォーカスを外す）またはEnterキー | 直接Inputを表示 |
| `textarea`, `date`, `datetime` | 「確定」ボタンクリック | Popover内に入力UI + ボタン |
| `select`, `multiselect` | 選択肢クリック（select）/ 「確定」ボタン（multiselect） | Popover内にリスト |

### textarea/date/datetimeの特殊な編集UI

これらのタイプはPopoverを使った特殊な編集方法になっています：

```typescript
// textarea の実装例（editable-cell.tsx）
if (type === "textarea") {
  return (
    <Popover open={true} onOpenChange={(open) => !open && onCancel()}>
      <PopoverTrigger asChild>
        <div className="w-full h-8" />  {/* 透明なトリガー */}
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-2" align="start">
        {/* 入力エリア */}
        <Textarea
          ref={textareaRef}
          value={String(editValue ?? "")}
          onChange={(e) => setEditValue(e.target.value || null)}
          rows={4}
          className="resize-none"
        />
        {/* 明示的なボタン（blurでは保存されない） */}
        <div className="flex justify-end gap-2 mt-2">
          <Button size="sm" variant="outline" onClick={onCancel}>
            キャンセル
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (editValue !== value) {
                onSave(editValue);
              } else {
                onCancel();
              }
            }}
          >
            確定
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

**ポイント：**
- **Popoverで開く**: セルをクリックするとPopoverが表示される
- **明示的な「確定」ボタン**: blur（フォーカスを外す）では保存されない
- **「キャンセル」ボタン**: Escキーでもキャンセル可能
- **Popover外クリック**: `onOpenChange`で`onCancel()`が呼ばれる

**なぜこの実装が必要か：**
- textareaは改行を含む長いテキストを入力するため、誤ってフォーカスを外しても保存されないようにする
- date/datetimeはカレンダーUIで複数回クリックするため、blur保存だと途中で保存されてしまう
- ユーザーが明示的に「確定」を押すまで保存しないことで、誤操作を防ぐ

### 選択肢の表示ルール（重要）

- **select（単一選択）**: 選択された値のラベルを表示
  ```typescript
  // ボタンに表示するテキスト
  {selectedOption?.label || "選択..."}
  ```

- **multiselect（複数選択）**: 選択された値のラベルをカンマ区切りで表示
  ```typescript
  // ボタンに表示するテキスト
  const getSelectedLabels = () => {
    if (selectedValues.length === 0) return "選択...";
    return selectedValues
      .map((v) => options.find((o) => o.value === v)?.label || v)
      .join(", ");
  };
  ```

**❌ 実際に起きたミス例：**
```typescript
// ❌ 間違い: 件数のみを表示してしまっていた
<Button>
  {selectedValues.length === 0 ? "選択..." : `${selectedValues.length}件選択`}
</Button>
// → 「3件選択」と表示され、何が選ばれているか分からない
```

**✅ 正しい実装：**
```typescript
// ✅ 正しい: 選択された値のラベルを表示
const getSelectedLabels = () => {
  if (selectedValues.length === 0) return "選択...";
  return selectedValues
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");
};

<Button>
  <span className="truncate max-w-[200px]">
    {getSelectedLabels()}
  </span>
</Button>
// → 「田中太郎, 山田花子, 佐藤一郎」と表示される
```

### チェックマークの表示（select/multiselect）

選択肢リストでどれが選択されているかを示すチェックマーク表示が必須。

**単一選択（select）のチェックマーク：**
```typescript
<CommandItem
  key={opt.value}
  value={opt.label}
  onSelect={() => {
    if (opt.value !== String(value)) {
      onSave(opt.value);
    } else {
      onCancel();
    }
    setPopoverOpen(false);
  }}
>
  {/* チェックマーク: 現在の値と一致する場合のみ表示 */}
  <Check
    className={cn(
      "mr-2 h-4 w-4",
      String(editValue) === opt.value ? "opacity-100" : "opacity-0"
    )}
  />
  {opt.label}
</CommandItem>
```

**複数選択（multiselect）のチェックマーク：**
```typescript
{options.map((opt) => {
  // 選択済みかどうかを判定
  const isSelected = selectedValues.includes(opt.value);
  return (
    <CommandItem
      key={opt.value}
      value={opt.label}
      onSelect={() => toggleValue(opt.value)}
    >
      {/* チェックマーク: selectedValuesに含まれる場合のみ表示 */}
      <Check
        className={cn(
          "mr-2 h-4 w-4",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
      {opt.label}
    </CommandItem>
  );
})}
```

**❌ 実際に起きたミス例：**
```typescript
// ❌ 間違い: isSelectedの判定が間違っていた
const isSelected = editValue === opt.value;  // multiselectなのに単一値で比較
// → チェックマークが正しく表示されない
```

**✅ 正しい判定：**
```typescript
// ✅ 正しい: 配列に含まれるかどうかで判定
const isSelected = selectedValues.includes(opt.value);
```

---

## ChangeConfirmationDialog

### 用途

インライン編集で値を変更した際、変更前/変更後を表示して確認を促す

### デザイン仕様

```typescript
<Dialog>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>変更内容の確認</DialogTitle>
    </DialogHeader>
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        以下の内容で更新します。よろしいですか？
      </p>
      {/* 変更項目リスト（スクロール可能） */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {changes.map((change, index) => (
          <div key={index} className="border rounded-md p-3 space-y-2">
            <div className="font-medium text-sm">{change.fieldName}</div>
            <div className="grid grid-cols-2 gap-4">
              {/* 変更前（赤背景、取り消し線） */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">変更前</div>
                <div className="max-h-[120px] overflow-y-auto p-2 bg-red-50 rounded border border-red-200">
                  <span className="text-red-600 line-through whitespace-pre-wrap break-words text-sm">
                    {change.oldValue || "-"}
                  </span>
                </div>
              </div>
              {/* 変更後（緑背景、太字） */}
              <div>
                <div className="text-xs text-muted-foreground mb-1">変更後</div>
                <div className="max-h-[120px] overflow-y-auto p-2 bg-green-50 rounded border border-green-200">
                  <span className="text-green-700 font-semibold whitespace-pre-wrap break-words text-sm">
                    {change.newValue || "-"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>キャンセル</Button>
      <Button onClick={onConfirm}>{loading ? "保存中..." : "保存する"}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**ポイント：**
- `max-h-[60vh]` と `overflow-y-auto` で長いリストもスクロール可能
- 各変更項目の変更前/変更後も `max-h-[120px]` と `overflow-y-auto` でスクロール可能
- `whitespace-pre-wrap` と `break-words` で長いテキストを折り返し表示

---

## Server Action実装（部分更新）

**重要：** インライン編集では1フィールドのみ更新するため、Server Actionは**渡されたフィールドのみ**を更新すること。

**❌ 間違い例（全フィールドを更新してしまう）：**
```typescript
export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  await prisma.stpCompany.update({
    where: { id },
    data: {
      companyId: Number(data.companyId),  // 渡されてないのに更新してしまう
      leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
      // ... 全フィールドを列挙
    },
  });
}
```

**✅ 正しい例（渡されたフィールドのみ更新）：**
```typescript
export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  // 更新データを動的に構築
  const updateData: Record<string, any> = {};

  // 渡されたフィールドのみを更新データに追加
  if ("companyId" in data) {
    updateData.companyId = Number(data.companyId);
  }
  if ("leadSourceId" in data) {
    updateData.leadSourceId = data.leadSourceId ? Number(data.leadSourceId) : null;
  }
  if ("billingContactIds" in data) {
    // 担当者IDのみ保存（メールや名前は表示時に導出）
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);
    updateData.billingRepresentative = billingContactIds;
  }
  // ... 他のフィールドも同様

  await prisma.stpCompany.update({
    where: { id },
    data: updateData,
  });

  revalidatePath("/stp/companies");
}
```

**ポイント：**
- `"fieldName" in data` で渡されたかどうかを判定
- 渡されていないフィールドは `updateData` に追加しない
- 担当者IDのみ保存し、名前・メールは表示時に導出（冗長な保存を避ける）

---

## 過去に発生した問題パターン

以下は実際に複数回の修正依頼が必要になった問題です。**実装前に必ず確認すること。**

### パターン1: 「クリックしても編集できない」問題

**修正依頼の流れ：**
1. 「流入経路が編集できない」→ displayToEditMappingを追加
2. 「まだ編集できない」→ isColumnInlineEditableがマッピングを見ていなかった
3. 「クリックしても何も起きない」→ isEditing判定がマッピングを考慮していなかった
4. 「cursor-pointerも出ない」→ セルのclassName判定も修正が必要だった

**根本原因：** 表示用カラム（例：`leadSourceName`）と編集用カラム（例：`leadSourceId`）が異なる場合、**4箇所すべて**を修正する必要があるのに、1箇所ずつ修正していた。

**防止策：** displayToEditMappingを使う場合、以下の4箇所を**同時に**確認・修正すること：
1. `isColumnInlineEditable` - マッピング後のキーでcolumns配列をチェック
2. `handleCellClick` - マッピング後のキーでeditingCellを設定
3. `isEditing判定` - 表示用キーと編集用キーの両方でチェック
4. `cursor-pointer判定` - isColumnInlineEditableが正しく動作すること

### パターン2: 「保存しても反映されない/エラーになる」問題

**修正依頼の流れ：**
1. 「保存を押しても保存されない」→ Server Actionが500エラーを返していた
2. 「500エラーが出る」→ Prismaエラー「Unknown argument 'companyId'」
3. 「他のフィールドがnullになった」→ 全フィールドを更新していた

**根本原因：** インライン編集は**1フィールドのみ**更新するのに、Server Actionが**全フィールド**を更新しようとしていた。

**防止策：** Server Actionは必ず `"fieldName" in data` で判定し、渡されたフィールドのみを更新すること。**絶対に全フィールドを列挙しない。**

### パターン3: 「選択肢の表示がおかしい」問題

**修正依頼の流れ：**
1. 「選択肢が表示されない」→ getOptionsが未実装
2. 「選択しても何が選ばれたか分からない」→ 「3件選択」と件数表示していた
3. 「チェックマークがつかない」→ isSelectedの判定が間違っていた

**根本原因：** select/multiselectの実装を段階的に行い、表示・選択状態・チェックマークをそれぞれ別々に実装していた。

**防止策：** select/multiselectを実装する際は、以下を**セットで**実装すること：
1. `getOptions` - 選択肢の配列を返す
2. ボタン表示 - 選択された**ラベル**を表示（件数ではなく）
3. チェックマーク - `selectedValues.includes(opt.value)` で判定
4. 選択/解除の挙動 - onSelectで正しく値を更新

### パターン4: 「長いテキストでUIが崩れる」問題

**修正依頼の流れ：**
1. 「確認ダイアログが崩れる」→ max-heightを設定
2. 「保存ボタンが見えない」→ overflow-y-autoを設定
3. 「変更前/変更後の全文が見たい」→ 各項目もスクロール可能に

**根本原因：** 短いテキストでしかテストしていなかった。

**防止策：**
- 確認ダイアログ全体: `max-h-[60vh] overflow-y-auto`
- 各変更項目の変更前/変更後: `max-h-[120px] overflow-y-auto`
- テキスト: `whitespace-pre-wrap break-words`
- **実装後は必ず長いテキスト（100文字以上）でテストすること**

---

## 実装チェックリスト

新しいテーブルにインライン編集を追加する際のチェックリスト：

### 1. 基本設定
- [ ] **ColumnDef**: 編集したいカラムに `inlineEditable: true` または `type` を設定
- [ ] **InlineEditConfig.columns**: 編集可能なカラムを列挙（**編集用カラムのキー**を指定）

### 2. 表示用/編集用カラムが異なる場合（例：leadSourceName → leadSourceId）
- [ ] **displayToEditMapping**: マッピングを設定
- [ ] **crud-table.tsx**: isColumnInlineEditable, handleCellClick, isEditing判定が全て対応しているか確認

### 3. select/multiselect の場合
- [ ] **getOptions**: 選択肢を返す関数を実装
- [ ] **ボタン表示**: 選択されたラベルを表示（**件数ではなく**）
- [ ] **チェックマーク**: `selectedValues.includes(opt.value)` で判定

### 4. Server Action
- [ ] **部分更新**: `"fieldName" in data` で判定し、渡されたフィールドのみ更新
- [ ] **関連フィールド**: 担当者ID変更時にメールも更新するなど、連動するフィールドを考慮

### 5. テスト（Playwrightまたは手動）
- [ ] クリック → 編集UI表示 → 値変更 → 確認ダイアログ → 保存 → 反映確認
- [ ] **長いテキスト**（100文字以上）で確認ダイアログが崩れないか
- [ ] **複数選択**でチェックマークが正しく表示されるか
- [ ] **保存後**にページ再読み込みしても値が保持されているか

---

## よくあるミスと対処法

### ミス1: isEditing判定で表示用カラムを考慮していない

**症状：** 表示用カラム（leadSourceName）をクリックしても、編集UIが表示されない

**原因：** `editingCell.columnKey`が編集用カラム（leadSourceId）なのに、描画時に`col.key`（leadSourceName）としか比較していなかった

```typescript
// ❌ 間違い: 表示用カラムのキーだけで判定
const isEditing =
  editingCell?.rowId === (item.id as number) &&
  editingCell?.columnKey === col.key;  // col.key = "leadSourceName"だが、editingCell.columnKey = "leadSourceId"
```

```typescript
// ✅ 正しい: 表示用と編集用の両方で判定
const editColumnKey = inlineEditConfig?.displayToEditMapping?.[col.key] || col.key;
const isEditing =
  editingCell?.rowId === (item.id as number) &&
  (editingCell?.columnKey === col.key || editingCell?.columnKey === editColumnKey);
```

### ミス2: isColumnInlineEditableでマッピングを考慮していない

**症状：** 表示用カラムにカーソルを合わせても`cursor-pointer`が出ない

**原因：** `isColumnInlineEditable`が表示用カラムのキーで`columns`配列をチェックしていた

```typescript
// ❌ 間違い: マッピングを考慮していない
const isColumnInlineEditable = (columnKey: string) => {
  if (inlineEditConfig?.columns) {
    return inlineEditConfig.columns.includes(columnKey);  // "leadSourceName"はcolumnsに含まれない
  }
  return false;
};
```

```typescript
// ✅ 正しい: マッピングがある場合は編集用カラムでチェック
const isColumnInlineEditable = (columnKey: string, row: Record<string, unknown>) => {
  const mappedEditKey = inlineEditConfig?.displayToEditMapping?.[columnKey];
  if (mappedEditKey) {
    if (inlineEditConfig?.columns) {
      return inlineEditConfig.columns.includes(mappedEditKey);  // "leadSourceId"でチェック
    }
    return true;
  }
  // 通常のカラムの判定...
};
```

### ミス3: Server Actionで全フィールドを更新してしまう

**症状：** 1フィールドだけ更新したのに、他のフィールドがnullになる（500エラーになることも）

**エラー例：**
```
Error: Unknown argument 'companyId'. Did you mean 'company'?
```

**原因：** Server Actionが渡されていないフィールドも含めて全てを更新しようとしていた

```typescript
// ❌ 間違い: 全フィールドを常に更新
export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  await prisma.stpCompany.update({
    where: { id },
    data: {
      companyId: Number(data.companyId),  // dataにcompanyIdがないとNaNになる
      leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
      forecast: (data.forecast as string) || null,
      // ... 全フィールド
    },
  });
}
```

```typescript
// ✅ 正しい: 渡されたフィールドのみ更新
export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  const updateData: Record<string, any> = {};

  if ("leadSourceId" in data) {
    updateData.leadSourceId = data.leadSourceId ? Number(data.leadSourceId) : null;
  }
  if ("forecast" in data) {
    updateData.forecast = (data.forecast as string) || null;
  }
  // ... 渡されたフィールドのみ

  await prisma.stpCompany.update({
    where: { id },
    data: updateData,
  });
}
```

### ミス4: multiselectの表示が件数のみ

**症状：** 「3件選択」と表示され、何が選択されているか分からない

```typescript
// ❌ 間違い: 件数のみ表示
<Button>
  {selectedValues.length > 0 ? `${selectedValues.length}件選択` : "選択..."}
</Button>
```

```typescript
// ✅ 正しい: ラベルをカンマ区切りで表示
const getSelectedLabels = () => {
  if (selectedValues.length === 0) return "選択...";
  return selectedValues
    .map((v) => options.find((o) => o.value === v)?.label || v)
    .join(", ");
};

<Button>
  <span className="truncate max-w-[200px]">{getSelectedLabels()}</span>
</Button>
```

### ミス5: multiselectのチェックマークが正しく表示されない

**症状：** 選択しても選択肢にチェックマークがつかない、または全てにチェックがつく

```typescript
// ❌ 間違い: 単一値として比較
const isSelected = editValue === opt.value;  // editValueが配列なのに直接比較
```

```typescript
// ✅ 正しい: 配列に含まれるかで判定
const isSelected = selectedValues.includes(opt.value);

<Check
  className={cn(
    "mr-2 h-4 w-4",
    isSelected ? "opacity-100" : "opacity-0"
  )}
/>
```

### ミス6: 確認ダイアログで長いテキストが崩れる

**症状：** 企業メモなど長いテキストを編集すると、ダイアログが画面外にはみ出て「保存する」ボタンが押せない

```typescript
// ❌ 間違い: 固定高さでスクロールなし
<div className="p-2 bg-red-50">
  <span className="text-red-600">{change.oldValue}</span>
</div>
```

```typescript
// ✅ 正しい: 最大高さ + スクロール可能
<div className="max-h-[120px] overflow-y-auto p-2 bg-red-50 rounded border border-red-200">
  <span className="text-red-600 line-through whitespace-pre-wrap break-words text-sm">
    {change.oldValue || "-"}
  </span>
</div>
```

**重要なCSSクラス：**
- `max-h-[120px]`: 最大高さを制限
- `overflow-y-auto`: 縦スクロールを有効化
- `whitespace-pre-wrap`: 改行を保持
- `break-words`: 長い単語を折り返し
