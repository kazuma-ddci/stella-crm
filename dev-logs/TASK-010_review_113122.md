全ての情報が揃いました。レビュー結果をまとめます。

---

## レビュー結果: TASK-010 取引候補検出・生成画面 (attempt 2)

### 対象コミット
`88850ed` feat(TASK-010): 実装 (attempt 2)

### 変更サマリー
前回レビュー(attempt 1)で指摘された5件（MAJOR-1, MAJOR-2, minor-1〜3）に対する修正コミット。

---

### 前回指摘の修正確認

| 指摘 | 内容 | 対応状況 |
|---|---|---|
| MAJOR-1 | ソースデータ変更チェック未実装 | **修正済み** `detectSourceChange`ヘルパーで既存Transaction.amountと現在の契約金額を比較。CRM・定期取引の全候補に適用。UIも「変更あり」バッジ+amber背景+取り消し線で金額差を視覚的に表示 |
| MAJOR-2 | projectId未設定 | **修正済み** `TransactionCandidate`にprojectId追加。`masterProject.findFirst({ code: "stp" })`で取得し、CRM候補全てに`stpProjectId`を設定。`generateTransactions`のcreateにも反映 |
| minor-1 | N+1クエリ問題 | **修正済み** StpCompany, AgentContractHistory, agentCounterparty, CommissionOverrideを一括取得してMap化。ループ内の個別クエリを排除 |
| minor-2 | monthsFromStart計算不正確 | **修正済み** `(year差*12 + month差)`のUTCベース正確な月数差分に修正 |
| minor-3 | commission_performance未生成 | **修正済み** candidatesWithJoinループ内で成果報酬売上に対応する代理店紹介報酬経費候補を生成。源泉徴収計算も含む |

---

### 新規追加機能の確認

**generateTransactionsの更新機能**（`actions.ts:1159-1180`）:
- `alreadyGenerated && sourceDataChanged && existingTransactionId` の場合、既存Transactionをupdateする
- 返り値に `updated` カウント追加
- UIに確認ダイアログ（新規N件、更新N件）と結果表示を追加

**クライアント側UI改善**（`generate-candidates-client.tsx`）:
- 「変更あり」候補は自動選択され、チェックボックスが有効
- 金額列に旧金額（取り消し線）+新金額（amber色）を表示
- バッジ優先順位: 変更あり > 生成済み > 新規

---

### 検出された問題

#### MAJOR-1: generateTransactionsで既存Transactionの更新時にステータスチェックがない

**ファイル**: `src/app/stp/finance/generate/actions.ts:1159-1180`

ソースデータ変更時の既存Transaction更新で、現在のステータスを確認していない。`existingTransactions`クエリにもステータスフィルタがない（`actions.ts:253-262`）。

**問題のシナリオ**:
1. 取引レコードが生成される（status: unconfirmed）
2. 確認・仕訳・入金処理を経て status: "journalized" or "paid" になる
3. ソースの契約金額が変更される
4. 再検出 → 「変更あり」と表示 → ユーザーが選択して更新
5. 仕訳済み/支払完了のTransactionの金額が変更される → 仕訳明細との不整合

**修正案**: `detectSourceChange`または`generateTransactions`で、更新対象のステータスが初期段階（`unconfirmed`, `confirmed`）の場合のみ更新を許可。`journalized`以降は変更をブロックし、UIで「仕訳済みのため自動更新不可。手動で確認してください」等のメッセージを表示する。

```typescript
// detectSourceChange内、または existingTransactions取得時
const UPDATABLE_STATUSES = ["unconfirmed", "confirmed"];

// generateTransactions内
if (
  candidate.alreadyGenerated &&
  candidate.sourceDataChanged &&
  candidate.existingTransactionId
) {
  const existing = await prisma.transaction.findUnique({
    where: { id: candidate.existingTransactionId },
    select: { status: true },
  });
  if (!existing || !UPDATABLE_STATUSES.includes(existing.status)) {
    skipped++;
    continue;
  }
  // ... 更新処理
}
```

#### minor-1: Transaction更新時に源泉徴収関連フィールドが再計算されない

**ファイル**: `src/app/stp/finance/generate/actions.ts:1168-1177`

金額変更時、`withholdingTaxAmount`と`netPaymentAmount`が更新されない。源泉徴収対象の代理店報酬経費で、金額が変更された場合に源泉徴収額と差引支払額がstaleになる。

```typescript
// 現在: amountとtaxAmountのみ更新
data: {
  amount,
  taxAmount,
  sourceDataChangedAt: new Date(),
  latestCalculatedAmount: amount,
  updatedBy: staffId,
}

// 修正案: 源泉徴収フィールドも更新
data: {
  amount,
  taxAmount,
  ...(candidate.isWithholdingTarget ? {
    withholdingTaxAmount: candidate.withholdingTaxAmount,
    netPaymentAmount: candidate.netPaymentAmount,
  } : {}),
  sourceDataChangedAt: new Date(),
  latestCalculatedAmount: amount,
  updatedBy: staffId,
}
```

#### minor-2: 生成後のクライアント状態でsourceDataChangedがリセットされない

**ファイル**: `src/app/stp/finance/generate/generate-candidates-client.tsx:176-179`

生成成功後、`alreadyGenerated: true`にはマークされるが`sourceDataChanged`が`false`に戻されない。更新済みの候補が引き続き「変更あり」として表示・選択可能な状態で残る。実運用上は再検出で解消されるが、同一セッション内での挙動が不正確。

```typescript
// 修正案
setCandidates((prev) =>
  prev.map((c) =>
    selectedKeys.has(c.key)
      ? { ...c, alreadyGenerated: true, sourceDataChanged: false }
      : c
  )
);
```

---

### 良い点
- 前回レビューの全5指摘（MAJOR×2, minor×3）を全て正確に修正
- N+1解消のバッチ取得とMap化が丁寧（stpCompanyByCompanyId, overrideMap等）
- `detectSourceChange`ヘルパーで変更検出ロジックを共通化し、全候補タイプで一貫適用
- 成果報酬の代理店紹介報酬（commission_performance）の実装が完全（源泉徴収計算含む）
- UIの変更アラート表示（amber背景、取り消し線+新金額、確認ダイアログの内訳表示）が直感的

---

```json
{
  "verdict": "NG",
  "issues": [
    {
      "severity": "major",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "generateTransactionsで既存Transactionの更新時にステータスチェックがない。journalized/paid等の処理済みTransactionの金額が更新されると、仕訳明細との不整合が発生する。",
      "suggestion": "更新対象のステータスが初期段階（unconfirmed, confirmed）の場合のみ更新を許可。existingTransactionsクエリにstatusフィルタを追加するか、generateTransactions内で個別チェックする。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "Transaction更新時にwithholdingTaxAmountとnetPaymentAmountが再計算されない。源泉徴収対象の代理店報酬で金額変更時にstaleな値が残る。",
      "suggestion": "candidate.isWithholdingTargetの場合、withholdingTaxAmountとnetPaymentAmountもupdateのdataに含める。"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/generate-candidates-client.tsx",
      "description": "生成後のsetCandidatesでsourceDataChangedがリセットされず、更新済み候補が引き続き「変更あり」表示のまま残る。",
      "suggestion": "setCandidatesのmap内でselectedKeys.has(c.key)の場合にsourceDataChanged: falseもセットする。"
    }
  ],
  "summary": "前回レビューの全5指摘を正確に修正。N+1解消・ソースデータ変更検出・projectId設定・commission_performance生成・月数計算修正が全て適切に実装されている。しかし、新たに追加された「既存Transaction更新」機能にステータスガードがなく、仕訳済み/支払完了のTransactionの金額が変更され得る点がmajor。ステータスチェックを追加すればOK判定可能。"
}
```
