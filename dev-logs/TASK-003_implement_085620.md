全ての修正が完了しました。

## 修正内容まとめ

### Minor #1 & #2 を同時に解消

**`page.tsx`**: `include` で取得した `defaultAccount` データを `defaultAccountLabel` として `data` マッピングに追加。これにより不要だった `include` が有効活用されるようになった。

**`expense-categories-table.tsx`**: `customRenderers.defaultAccountId` を改善:
1. まず `accountOptions`（アクティブな勘定科目）から検索
2. 見つからない場合、`item.defaultAccountLabel`（`include` データ由来）をフォールバックとして使用し、`「（無効）」`を付与して表示
3. どちらもない場合のみ「（なし）」を表示

これにより、非アクティブ化された勘定科目が `defaultAccountId` に設定されている費目でも、`1000 - 売上高（無効）` のように正しく表示されます。
