# 確定仕様一覧（Source of Truth）

このディレクトリは確定仕様の単一情報源（Single Source of Truth）です。

> **⚠️ 重要**
> - 確定仕様を変更する際は、必ずこのディレクトリ内のファイルを更新してください
> - 他のドキュメント（CLAUDE.md等）からは参照のみ行います
> - 変更には必ずユーザー承認が必要です

---

## SPEC一覧

| SPEC ID | ドメイン | タイトル | ステータス | 関連ファイル |
|---------|----------|----------|-----------|--------------|
| [SPEC-STP-001](./SPEC-STP-001.md) | STP | 顧問の区分表示形式 | ✅ confirmed | agents-table.tsx |
| [SPEC-UI-001](./SPEC-UI-001.md) | UI | Textarea/モーダル長文編集レイアウト | ✅ confirmed | textarea.tsx, text-preview-cell.tsx, editable-cell.tsx, change-confirmation-dialog.tsx |

---

## SPEC IDの命名規則

```
SPEC-<DOMAIN>-<NUMBER>
```

| DOMAIN | 説明 |
|--------|------|
| STP | STP（採用ブースト）関連 |
| UI | UI/UXコンポーネント関連 |
| DB | データベース設計関連 |
| AUTH | 認証・認可関連 |
| API | API設計関連 |

---

## ステータス定義

| ステータス | 説明 |
|-----------|------|
| ✅ confirmed | ユーザー承認済み。変更禁止 |
| 🔄 draft | 検討中。変更可能 |
| ⚠️ deprecated | 非推奨。移行先を参照 |

---

## 新規SPECの追加手順

1. 次の番号を確認（例: SPEC-STP-002）
2. `docs/specs/SPEC-<DOMAIN>-<NUMBER>.md` を作成
3. 必須メタ情報を記載（テンプレート参照）
4. この `index.md` の一覧に追加
5. `/record` コマンドで記録

### SPECテンプレート

```markdown
# SPEC-XXX-NNN: タイトル

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-XXX-NNN |
| ステータス | ✅ confirmed |
| オーナー | @username |
| 最終更新 | YYYY-MM-DD |
| 関連ファイル | `path/to/file.tsx` |

## 概要

[仕様の概要を1-2文で]

## 仕様詳細

[詳細な仕様を記述]

## 禁止事項（forbidden_changes）

- ❌ [禁止事項1]
- ❌ [禁止事項2]

## 実装例

\`\`\`tsx
// 正しい実装
\`\`\`

## テスト

関連テスト: `tests/specs/SPEC-XXX-NNN.test.ts`

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| YYYY-MM-DD | 初版作成 | @username |
```
