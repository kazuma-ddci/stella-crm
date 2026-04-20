# ファイルロック プロトコル

複数のClaude Codeセッションが同時実行される。ファイル編集の競合を防ぐため、**Edit/Writeツールを使う前に必ず以下を実行すること。**

## ツール

```bash
python3 .claude/lock.py <command> [args]
```

| コマンド | 用途 |
|---------|------|
| `check file1,file2` | 競合確認（exit 0=OK, exit 1=CONFLICT） |
| `check file1,file2 --queue-id=xxx` | キュー登録済みの場合の競合確認（順番も考慮） |
| `acquire file1,file2 "タスク説明"` | ロック取得（ACQUIRED\|<lock-id> を出力） |
| `acquire file1,file2 "タスク説明" --queue-id=xxx` | キューからロック取得 |
| `release <lock-id>` | ロック解放 |
| `update <lock-id> file3,file4` | ロックにファイル追加 |
| `enqueue file1,file2 "タスク説明"` | 順番待ちキューに登録（ENQUEUED\|<queue-id>） |
| `dequeue <queue-id>` | キューから離脱 |
| `status` | 全ロック＆キュー一覧表示 |

## 手順（ファイル編集するタスク全てで必須）

### Step 1: 計画 — 修正対象ファイルを特定する
Read/Grep/Globで調査。ここはロック不要。

### Step 2: ロック確認＆取得
```bash
python3 .claude/lock.py check src/app/foo.tsx,src/lib/bar.ts
```

- **出力が `OK`** → すぐにロック取得:
  ```bash
  python3 .claude/lock.py acquire src/app/foo.tsx,src/lib/bar.ts "機能Xの実装"
  ```
  出力される `ACQUIRED|<lock-id>` の lock-id を覚えておく。

- **出力が `CONFLICT|...`** → 順番待ちキューに登録して待機:
  ```bash
  python3 .claude/lock.py enqueue src/app/foo.tsx,src/lib/bar.ts "機能Xの実装"
  ```
  出力される `ENQUEUED|<queue-id>` の queue-id を覚えておく。その後、待機ループ:
  ```bash
  echo "⏳ ロック競合を検出。順番待ち中..." && while ! python3 .claude/lock.py check src/app/foo.tsx,src/lib/bar.ts --queue-id=<queue-id> 2>/dev/null; do sleep 15 && echo "⏳ 待機中..."; done && echo "✅ 順番が来ました"
  ```
  ループ終了後、キューIDを渡して `acquire`:
  ```bash
  python3 .claude/lock.py acquire src/app/foo.tsx,src/lib/bar.ts "機能Xの実装" --queue-id=<queue-id>
  ```
  **重要: 待機解除後、競合していたファイルをReadで再読み込みしてから実装すること。** 他セッションが内容を変更している可能性がある。

- **出力が `WAIT_YOUR_TURN|...`** → 先に待機しているセッションがいる。同様にキュー登録して待機。

- **出力が `STALE_LOCK|...`** → 30分以上前のロック。**自動削除せず、ユーザーに確認すること。**
  「別のセッションのロック（タスク: ○○、△分前）が残っていますが、強制解除してよいですか？」と聞く。

### Step 2b: 競合ファイルがある場合 — 非競合ファイルを先に実装

修正対象ファイルの**一部だけ**が競合している場合、非競合ファイルを先に実装してよい:

1. 非競合ファイルだけで `acquire` → 先にそちらを実装
2. 競合ファイルは `enqueue` でキュー登録 → 待機
3. 順番が来たら競合ファイルのロック取得 → 実装

例: `A.tsx, B.tsx, C.tsx` を修正予定で `B.tsx` だけ競合中
- `acquire A.tsx,C.tsx "機能X（非競合部分）"` → A, Cを先に実装
- `enqueue B.tsx "機能X（B.tsx待ち）"` → Bの順番待ち
- Bが空いたら `acquire B.tsx "機能X（B.tsx）" --queue-id=xxx` → B実装
- 全部終わったら両方のロックを `release`

### Step 3: 実装
ロック取得後、Edit/Writeでファイルを編集する。

途中で追加ファイルの編集が必要になった場合:
1. `check` で追加ファイルの競合を確認
2. 競合なければ `update <lock-id> 追加ファイル` でロックに追加

### Step 4: ロック解放（最重要）
作業完了後、**ユーザーへの最終回答の前に必ず**:
```bash
python3 .claude/lock.py release <lock-id>
```

## ルール

1. **Read/Grep/Globはロック不要** — 読み取り専用操作は自由
2. **Edit/Writeの前にロック必須** — 1ファイルでも編集するなら必ず
3. **最小範囲でロック** — 実際に修正するファイルだけ。ディレクトリ単位やプロジェクト全体は禁止
4. **回答前に必ず解放** — ロック持ったままユーザーに返答しない
5. **古いロックは自動削除しない** — 30分超のロックはユーザーに確認を取る
6. **prisma/schema.prisma は特別扱い** — このファイルをロックする場合、他の全セッションの完了を待つこと（スキーマ変更は全体に影響する）
7. **外部変更の検知** — 実装中に「Note: ○○ was modified」という通知が来たら、そのファイルが自分のロック対象と重複する場合、**即座に作業を中断**し、`check` で競合を再確認すること。競合があれば自分のロックを `release` し、相手の完了を待ってから再度 `acquire` → 変更ファイルをReadで再読み込み → 実装再開
