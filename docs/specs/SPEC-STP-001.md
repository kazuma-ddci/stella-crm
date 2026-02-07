# SPEC-STP-001: 顧問の区分表示形式

## メタ情報

| 項目 | 値 |
|------|-----|
| SPEC ID | SPEC-STP-001 |
| ステータス | ✅ confirmed |
| オーナー | - |
| 最終更新 | 2026-02-04 |
| 関連ファイル | `src/app/stp/agents/agents-table.tsx` |

## 概要

代理店一覧における顧問の区分表示は、常に `顧問（件数 / 金額）` の形式で統一する。未入力の項目は `-` で表示する。

## 仕様詳細

### 表示形式

| 条件 | 表示例 |
|------|--------|
| 両方入力済み | `顧問（10件 / ¥100,000）` |
| 件数のみ入力 | `顧問（10件 / -）` |
| 金額のみ入力 | `顧問（- / ¥100,000）` |
| 両方未入力 | `顧問（- / -）` |

### フォーマット詳細

- 区分名: `顧問`
- 括弧: 全角 `（` `）`
- 区切り: ` / `（半角スペース + スラッシュ + 半角スペース）
- 件数: `N件` または `-`
- 金額: `¥N,NNN` または `-`（カンマ区切り）

## 禁止事項（forbidden_changes）

- ❌ 未入力時に括弧を省略する（例: `顧問` → 禁止）
- ❌ スラッシュ区切りをスペース区切りに変更する
- ❌ 片方のみ入力時に `-` を省略する

## 実装例

```tsx
// ✅ 正しい実装
const formatAdvisorDisplay = (count: number | null, amount: number | null): string => {
  const countStr = count !== null ? `${count}件` : '-';
  const amountStr = amount !== null ? `¥${amount.toLocaleString()}` : '-';
  return `顧問（${countStr} / ${amountStr}）`;
};

// 使用例
formatAdvisorDisplay(10, 100000);  // => "顧問（10件 / ¥100,000）"
formatAdvisorDisplay(10, null);    // => "顧問（10件 / -）"
formatAdvisorDisplay(null, 100000); // => "顧問（- / ¥100,000）"
formatAdvisorDisplay(null, null);  // => "顧問（- / -）"
```

```tsx
// ❌ 間違った実装
const formatAdvisorDisplay = (count: number | null, amount: number | null): string => {
  // ❌ 両方nullの時に括弧を省略している
  if (count === null && amount === null) return '顧問';

  // ❌ スペース区切りになっている
  return `顧問（${count ?? '-'} ${amount ?? '-'}）`;
};
```

## テスト

関連テスト: `src/__tests__/specs/SPEC-STP-001.test.ts`

```bash
# テスト実行
docker-compose exec app npm test -- SPEC-STP-001
```

## 変更履歴

| 日付 | 変更内容 | 承認者 |
|------|---------|--------|
| 2026-02-04 | CLAUDE.mdから移行、SPEC形式化 | - |
| - | 初版作成（CLAUDE.md内） | ユーザー承認済み |
