# 経理・共通 finance モジュールの構造

**2026-04-14 のリファクタで3層に物理分離された**（計画書: `docs/plans/archive/finance-accounting-refactor-plan.md`）。
新しい Server Action や UI コンポーネントを追加する際は、以下の層に正しく配置すること。

## 3層構造

```
src/app/
├── finance/                  ★ プロジェクト横断共通レイヤー（経理 + 各PJ 両方が使う）
│   ├── transactions/         取引CRUD・確定・差し戻し・按分・共有UI・loaders
│   ├── comments/             コメント機能
│   ├── changelog/            変更履歴機能
│   └── expenses/             経費申請フォーム（mode="accounting"|"project" 共通）
│
├── accounting/               ★ 経理専用（経理スタッフだけが使う）
│   ├── transactions/         経理用一覧・新規・編集ページ、accounting-actions.ts
│   ├── expenses/             経理用エントリページ、accounting-actions.ts
│   ├── journal/ reconciliation/ monthly-close/ cashflow/ batch-complete/
│   └── workflow/ invoice-check/ bank-transactions/ usdt-rates/ masters/
│
└── {stp,hojo,slp,srd}/       ★ プロジェクト固有（そのPJのスタッフが使う）
    └── finance/              自動生成ロジック、トラッカーUI
```

## 権限ヘルパーの使い分け

- **`src/app/finance/` 配下** の Server Action では、レコード操作系は `requireFinance*Access`（`src/lib/auth/finance-access.ts`）で per-record 認可する。フォームメタデータ取得など非レコード系は `requireStaffForFinance()`（`src/lib/auth/staff-action.ts`）を使う。
- **`src/app/accounting/` 配下** の Server Action では `requireStaffForAccounting(level)` を使う。
- **client から直接呼ばれる取得系** は `Result<T>` 形式（`{ ok: true, data } | { ok: false, reason, message }`）で返し、client 側は `result.ok` で分岐する（§4.3.3(d) 規約）。
- **重い include を含む取得系** は `src/app/finance/{module}/loaders.ts` に loader Server Action として分離する（`getTransactionForDetailPage` 参照）。
- **typed error**: 未存在は `FinanceRecordNotFoundError`、権限不足は `FinanceForbiddenError`。呼び出し側で `notFound()` / `ActionResult.err()` / `Result<T>` に変換する。

## 新機能追加の判定

> Q: 新しい関数・コンポーネントを追加するとき、`finance/` と `accounting/` のどちらに置くか？
> - STP・HOJO・SLP・SRD 等のプロジェクトスタッフが（経理権限なしで）使う必要があるか？
>   - **Yes** → `src/app/finance/`
>   - **No、経理スタッフだけ** → `src/app/accounting/`
