全6件の指摘事項を修正し、`tsc --noEmit` でコンパイルエラーがないことを確認しました。修正内容のまとめです。

---

## 修正サマリ

### Issue 1: 設計書8.6との方式乖離（同期処理）→ 自動フック追加
**変更ファイル**: `src/app/companies/actions.ts`, `src/app/companies/[id]/actions.ts`

- `addCompany` / `createCompany` に **企業新規作成時のCounterparty自動作成フック**を追加
- 両ファイルの `updateCompany` に **企業名称変更時のCounterparty名称同期フック**を追加
- 既存の `syncCounterparties` はバッチ同期（初期データ投入用）として維持
- フック失敗時は try/catch で無視（企業操作をブロックしない）

### Issue 2: 「既存を選択」オプション追加
**変更ファイル**: `counterparties-table.tsx`

- 候補リスト各項目に「選択」ボタンを追加
- `handleSelectExisting(candidate)` コールバック実装
- ダイアログの説明文を「既存の取引先を選択するか、新規作成してください」に更新

### Issue 3: handleAddのCrudTable連携フロー修正
**変更ファイル**: `counterparties-table.tsx`

- **Promise保留方式**に変更: 類似候補発見時にPromiseをpending状態にし、ユーザーの判断（新規作成 / 既存選択 / キャンセル）後にresolve/reject
- `resolve()` → CrudTableがフォームを閉じて成功トースト
- `reject(error)` → CrudTableがフォームを維持してエラーメッセージ表示
- `isCreating` stateで二重クリック防止

### Issue 4: OR条件の冗長削除
**変更ファイル**: `counterparties/actions.ts`

- `startsWith` + `contains` の冗長なOR条件を削除（Issue 6の正規化比較に統合）

### Issue 5: 未使用リレーションinclude削除
**変更ファイル**: `counterparties/page.tsx`

- `include: { company: { select: ... } }` を削除し、不要なJOINクエリを解消

### Issue 6: 正規化比較の実装
**変更ファイル**: `counterparties/actions.ts`

- `normalizeCounterpartyName()` 関数を追加（全角→半角英数字、カタカナ→ひらがな、スペース除去、小文字化）
- 全取引先をメモリ上で正規化比較する方式に変更（`searchSimilarCompanies` と同パターン）
