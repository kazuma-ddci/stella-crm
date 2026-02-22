全ての修正が完了しました。

---

### 修正内容まとめ

**Issue 1: `category` サーバーサイドバリデーション追加** (`actions.ts`)
- `createAccount`: 必須チェック後に `VALID_CATEGORIES` リストで検証を追加（22-25行目）
- `updateAccount`: `category` 更新時に同様の検証を追加（76-80行目）
- `"asset" | "liability" | "revenue" | "expense"` 以外の値はエラーで弾く

**Issue 2: サイドバーのサブグループ化** (`sidebar.tsx`)
- 「経理」セクション直下の「勘定科目」を「マスタ管理」サブグループ内にネスト
- 今後マスタページが増えた際にもこのサブグループに追加するだけで対応可能

**コンパイルチェック**: `tsc --noEmit` エラーなし
