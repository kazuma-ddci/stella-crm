# /git-iphone コマンド

以下のgitコマンドを順番に実行してください。確認は不要です。

```bash
git checkout iphone
git add .
git commit -m "最新の状態"
git push origin iphone
git checkout -
```

- コミットするファイルがない場合でも、pushまで進めてください（既にpush済みならスキップ可）
- 最後の `git checkout -` で元のブランチに戻ります
- エラーが発生した場合のみ報告してください
