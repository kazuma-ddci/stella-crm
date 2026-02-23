全体像を把握しました。レビュー結果をまとめます。

---

## レビュー結果

### コミット: `150e5fa` feat(TASK-010): 実装 (attempt 3)

### 変更概要
3点の修正が含まれています:

1. **`actions.ts`**: `generateTransactions`でソースデータ変更時の既存取引更新に**ステータスチェック**を追加（`unconfirmed`/`confirmed` のみ更新可）
2. **`actions.ts`**: ソースデータ変更時の更新に**源泉徴収フィールド**（`withholdingTaxAmount`, `netPaymentAmount`）を含めるよう修正
3. **`generate-candidates-client.tsx`**: 生成後に `sourceDataChanged: false` もリセットするよう修正

---

### チェック結果

#### 1. 仕様との整合性

| 仕様項目 | 状態 | 備考 |
|---|---|---|
| 要望書 2.2.2: 対象月選択（1ヶ月ずつ）| OK | `<Input type="month">` で実装済み |
| 要望書 2.2.3: CRM契約からの候補検出 | OK | `detectCrmCandidates` で実装済み |
| 要望書 2.2.3: 定期取引からの候補検出 | OK | `detectRecurringCandidates` で実装済み |
| 要望書 2.2.3: ソースデータ変更チェック | OK | `detectSourceChange` + 金額比較で実装。今回のコミットで更新時ステータスガードも追加 |
| 設計書 5.1 ステップ1: 候補一覧 → 選択 → 生成 | OK | チェックボックス選択 + `generateTransactions` で実装済み |
| 設計書 5.1: 生成時status="unconfirmed" | OK | `actions.ts:1241` で明示的に設定 |
| 設計書 6.1: バリデーション（金額>=0, periodFrom<=periodTo, 按分排他） | OK | 候補生成ロジック内で保証 |
| 設計書 6.7: ポリモーフィック排他制約 | OK | 新規生成時は `invoiceGroupId`/`paymentGroupId` が null（デフォルト） |

#### 2. 今回のコミットの評価

**ステータスチェック追加（`UPDATABLE_STATUSES`）**: 要望書 2.1.3 のステータスフロー（未確認→確認済み→経理処理待ち→...→仕訳済み→完了）に対し、`unconfirmed`と`confirmed`のみ更新可とするのは合理的。仕訳済み以降のレコードを自動更新で上書きしない安全措置として正しい。

**源泉徴収フィールドの更新追加**: 金額変更時に `withholdingTaxAmount`/`netPaymentAmount` も連動更新するのは必要な修正。前のコミットでは金額だけ更新して源泉徴収額が古いまま残るバグがあった。

**sourceDataChanged リセット**: 生成後にUIが「変更あり」状態のままになる問題を修正。UX改善として妥当。

#### 3. 指摘事項

**Minor-1**: クライアント側の状態更新で、サーバーがステータスチェックでスキップした候補も区別なく `alreadyGenerated: true, sourceDataChanged: false` にマークされる。結果メッセージにスキップ数は表示されるが、**どの候補がスキップされたか**はユーザーに伝わらない。

- `actions.ts:175-180` — `selectedKeys.has(c.key)` で全選択候補を一律更新
- 影響: 仕訳済み以降の取引で金額変更が検出された場合、スキップされても「生成済み」表示になり、再検出しないと気付けない

**Minor-2**: `generateTransactions` の更新パス（`actions.ts:1169`）で `findUnique` に `deletedAt: null` の条件がない。検出時は `deletedAt: null` でフィルタしているため通常は問題にならないが、検出〜生成の間に論理削除された場合、削除済みレコードを更新する可能性がある（極めてまれなエッジケース）。

---

```json
{
  "verdict": "OK",
  "issues": [
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/generate-candidates-client.tsx",
      "description": "サーバーでステータスチェックによりスキップされた候補も、クライアント側で alreadyGenerated=true, sourceDataChanged=false にマークされる。ユーザーはどの候補がスキップされたか判別できない",
      "suggestion": "generateTransactions の戻り値にスキップされた候補のキー一覧を含め、クライアント側でスキップ候補のみ sourceDataChanged を維持する。または結果表示で「ステータスが進行済みのためN件の更新をスキップしました」と明示する"
    },
    {
      "severity": "minor",
      "file": "src/app/stp/finance/generate/actions.ts",
      "description": "generateTransactions の更新パスで findUnique に deletedAt: null の条件がなく、検出〜生成間に論理削除されたレコードを更新する可能性がある（極めてまれなエッジケース）",
      "suggestion": "findUnique を findFirst に変更し、where に deletedAt: null を追加する。または更新前に deletedAt をチェックする"
    }
  ],
  "summary": "今回のコミットは3つの的確な改善（ステータスガード、源泉徴収フィールド連動更新、UI状態リセット）を含む。設計書・要望書の仕様に忠実で、セキュリティ上の問題もない。指摘はいずれもminorで、実運用上の影響は限定的。"
}
```
