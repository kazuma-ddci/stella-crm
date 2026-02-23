全ての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-010 取引候補検出・生成画面

### 対象コミット
`6dc4314` feat(TASK-010): 実装 (attempt 1)

### 変更ファイル
| ファイル | 行数 | 役割 |
|---|---|---|
| `src/app/stp/finance/generate/page.tsx` | 23行 | ページコンポーネント（Server Component） |
| `src/app/stp/finance/generate/generate-candidates-client.tsx` | 430行 | クライアントUI |
| `src/app/stp/finance/generate/actions.ts` | 996行 | Server Actions (detectTransactionCandidates, generateTransactions) |

---

### チェック項目ごとの確認

#### 1. テーブル定義とPrismaスキーマの整合性
- Transaction の全フィールド（stpContractHistoryId, stpAgentId, stpCandidateId 等のSTP固有フィールド含む）が正しく参照されている
- RecurringTransaction のフィールド（amountType, frequency, executionDay 等）が正しく参照されている
- create時のデータマッピングが Prisma スキーマと型レベルで一致している

#### 2. 要望書のフロー・ステータス遷移
- 要望書 2.2.2「対象月は自分で選択できる（1ヶ月ずつ処理）」→ `<Input type="month">` で実装 ✓
- 要望書 2.2.3「CRMの契約データ」→ `detectCrmCandidates` で実装 ✓
- 要望書 2.2.3「定期取引テーブル」→ `detectRecurringCandidates` で実装 ✓
- 要望書 2.2.3「固定金額はそのまま、変動金額は空欄で表示」→ `amountType === "fixed"` の分岐あり ✓
- 設計書 5.1「取引レコード生成（status: "unconfirmed"）」→ `status: "unconfirmed"` で作成 ✓
- チェックボックスで選択 → 取引レコード一括生成 ✓

#### 3. バリデーションルール（設計書セクション6）
- 6.1「counterpartyIdは必須」→ counterparty が見つからない場合 `continue` でスキップ ✓
- 6.1「expenseCategoryIdは必須」→ カテゴリが見つからない場合スキップ ✓
- 6.1「金額（amount）は0以上」→ 変動金額は0で作成、その他は契約データから取得 ✓

#### 4. ポリモーフィック参照の排他制約（設計書6.7）
- Transaction生成では invoiceGroupId/paymentGroupId は未設定（null）で問題なし ✓

#### 5. 既存コードパターン
- `calcTaxAmount`（auto-generate.tsから再利用）✓
- `calcWithholdingTax` / `isWithholdingTarget`（withholding-tax.tsから再利用）✓
- `getSession()` による認証チェック ✓
- `revalidatePath` によるキャッシュ無効化 ✓

---

### 検出された問題

#### MAJOR-1: ソースデータ変更チェックが未実装

要望書 2.2.3 と設計書 5.1 で明記された機能が完全に未実装。

- 要望書 2.2.3: 「ソースデータ変更チェック: 契約の金額が変更されている場合、「更新しますか？」と表示」
- 設計書 5.1: 「ソースデータ（契約金額等）が変更されている場合は「更新しますか？」と表示」
- Transaction には `sourceDataChangedAt` と `latestCalculatedAmount` フィールドが存在するが、候補検出時に過去の生成済みTransactionの金額と現在の契約金額を比較するロジックがない
- 全候補で `sourceDataChanged: false`, `previousAmount: null`, `latestCalculatedAmount: null` が固定値
- UIには「変更あり」バッジ表示（`actions.ts:57-59`, `generate-candidates-client.tsx:404-409`）が実装されているが、常にfalseのため事実上無意味

**修正案**: `detectCrmCandidates` で既存Transactionの `amount` と現在の契約金額を比較し、差異がある場合に `sourceDataChanged: true`, `previousAmount`, `latestCalculatedAmount` を設定する。

#### MAJOR-2: Transaction生成時に projectId が未設定

`actions.ts:954-987` の `prisma.transaction.create` で `projectId` が設定されていない。設計書の Transaction テーブル定義に `projectId Int? // FK → MasterProject（どのプロジェクトで作成されたか）` があり、STPの生成ページ（`/stp/finance/generate`）から実行されるため、STPプロジェクトのIDを設定すべき。

**修正案**: `generateTransactions` の引数に `projectId` を追加するか、Server Action内でSTPプロジェクトを取得して設定する。`detectCrmCandidates` では既に `stpCostCenter` をSTPプロジェクトから取得しているので、そのプロジェクトIDを候補に含めて渡す。

#### minor-1: N+1クエリ問題（パフォーマンス）

`detectCrmCandidates` のループ内（`actions.ts:421-466`）で契約ごとに以下の個別クエリを発行している:
- `prisma.stpCompany.findFirst` (L421)
- `prisma.stpAgentContractHistory.findFirst` (L426)
- `prisma.counterparty.findFirst` (L444) - agentCounterpartyがマップにない場合
- `prisma.stpAgentCommissionOverride.findFirst` (L455)

契約数が多い場合にパフォーマンス問題になり得る。

**修正案**: ループ前に一括で取得してマップ化する（stpCompanyByCompanyId, agentContractHistoryByAgentId 等）。

#### minor-2: monthsFromStart の計算が不正確

`actions.ts:644-647`:
```typescript
const monthsFromStart = Math.floor(
  (monthStart.getTime() - contractStart.getTime()) /
    (1000 * 60 * 60 * 24 * 30)
);
```

30日固定除算による月数計算は、31日の月や28日の2月で誤差が生じ、紹介報酬の支払期間判定（`monthsFromStart < duration`）で off-by-one が発生する可能性がある。

**修正案**: `(monthStart.getUTCFullYear() - contractStart.getUTCFullYear()) * 12 + (monthStart.getUTCMonth() - contractStart.getUTCMonth())` で正確な月数差分を計算する。

#### minor-3: 成果報酬契約に対する代理店紹介報酬（commission_performance）未生成

成果報酬型契約（`contractPlan === "performance"`）で求職者が入社した場合、売上（revenue-performance）は候補に生成されるが、それに対応する代理店への紹介報酬（経費）候補が生成されていない。`buildCommissionConfig` で `perfRate/perfFixed` は取得済みだが、使用箇所がない。

---

### 良い点
- 既存の `calcTaxAmount`, `calcWithholdingTax` を正しく再利用
- `TransactionCandidate` 型が丁寧に定義されており、クライアントとサーバー間のデータ受け渡しが型安全
- UI のフィルタ（種別/ソース）や全選択/個別選択のUXが適切
- `alreadyGenerated` による重複防止が機能
- 生成前の `confirm()` ダイアログで誤操作防止

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "ソースデータ変更チェックが未実装。要望書2.2.3と設計書5.1で「契約の金額が変更されている場合、更新しますか？と表示」と明記されているが、全候補でsourceDataChanged=falseが固定値。UIの「変更あり」バッジも無意味になっている。",
      "suggestion": "detectCrmCandidatesで既存Transactionのamountと現在の契約金額を比較し、差異がある場合にsourceDataChanged=true、previousAmount、latestCalculatedAmountを設定する。"
    },
    {
      "severity": "major",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "Transaction生成時にprojectIdが未設定。STPの生成ページ(/stp/finance/generate)から実行されるため、STPプロジェクトのIDを設定すべき。",
      "suggestion": "TransactionCandidate型にprojectIdを追加し、detectCrmCandidatesでSTPプロジェクトIDを設定。generateTransactionsのcreateDataにprojectIdを含める。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "detectCrmCandidatesのループ内で契約ごとに個別クエリ（stpCompany, agentContractHistory, commissionOverride等）を発行しており、N+1問題がある。",
      "suggestion": "ループ前に一括取得してMap化する（stpCompanyByCompanyId等）。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "monthsFromStartの月数計算が30日固定除算で不正確。紹介報酬の支払期間判定でoff-by-oneが発生し得る。",
      "suggestion": "(monthStart.getUTCFullYear() - contractStart.getUTCFullYear()) * 12 + (monthStart.getUTCMonth() - contractStart.getUTCMonth()) で正確な月数差分を計算する。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "成果報酬契約(performance plan)で求職者入社時に代理店紹介報酬(commission_performance)の経費候補が生成されない。buildCommissionConfigでperfRate/perfFixedは取得済みだが未使用。",
      "suggestion": "candidatesWithJoinループ内で、成果報酬売上の候補生成後に、対応する代理店紹介報酬の経費候補も生成する。"
    }
  ],
  "summary": "基本的なフロー（対象月選択→CRM契約/定期取引からの候補検出→チェックボックス選択→一括生成）は正しく実装されている。ただし、仕様で明記されたソースデータ変更チェック機能が未実装（major）、projectIdの未設定（major）がある。これらを修正すればOK判定可能。"
}
```
