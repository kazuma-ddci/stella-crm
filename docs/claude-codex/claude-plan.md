# STP財務フロー 実装プラン（Claude Code版）

## コンテキスト

STP（採用ブースト）側の財務運用を実運用レベルに仕上げるための残課題整理と実装ロードマップ。
Phase 1（土台整備）は完了済み。codex-plan.md をベースに、現在の実装状況を精査し、Claude Code での実装に最適化した計画に再構成する。

## 現状の実装状況（2026-02-24時点）

### 完了済み（Phase 1）

| 機能 | 状態 | 実装場所 |
|------|------|----------|
| STPプロジェクトコンテキスト集約 | ✅ | `src/lib/project-context.ts` |
| STPスコープのサーバー検証 | ✅ | `validateTransactionScope()` |
| 取引フォーム按分UI（RadioGroup） | ✅ | `transaction-form.tsx` |
| 期日/予定日の2フィールド化 | ✅ | `scheduledPaymentDate` カラム追加済 |
| 文言統一（確認→確定、未確認→未確定） | ✅ | 全画面反映済み |
| 未確定に戻す（グループ制約付き） | ✅ | `unconfirmTransaction()` |
| 候補画面の取引化ボタン | ✅ | `generate-candidates-client.tsx` |
| STP按分テンプレート管理 | ✅ | `stp/finance/allocation-templates/` |
| STPメニュー導線 | ✅ | `sidebar.tsx` 11項目配置 |
| 支払グループ管理 | ✅ | `stp/finance/payment-groups/` |
| 請求グループ管理 | ✅ | `stp/finance/invoices/` |
| ダッシュボード（overview） | ✅ | `stp/finance/overview/` |
| CRM契約ベース候補検出 | ✅ | `generate/actions.ts` |
| 定期取引ベース候補検出 | ✅ | `generate/actions.ts` |
| CostCenterProjectAssignment | ✅ | Prismaスキーマ実装済み |

### 未実装

| 機能 | 優先度 | Phase |
|------|--------|-------|
| 候補判定（保留/不要/永続化） | 最優先 | 2 |
| 変動金額候補の入力UI＋0円防止 | 最優先 | 3 |
| SystemProjectBinding本実装 | 中 | 4 |
| プロジェクト管理/権限管理 | 低 | 5 |
| 請求/支払グループUX改善 | 中 | 6 |

---

## Phase 2: 候補判定フロー本実装（最優先）

### 目的

候補画面を「検出して終わり」ではなく「判定して運用する画面」にする。
一度「不要」にした候補が毎回復活する問題、「保留」候補を後から拾えない問題を解決する。

### スコープ制約

**Phase 2 は STP 専用として実装する。** 将来 `/srd` 等の別プロジェクトを導入する際は、`TransactionCandidateDecision` テーブルにスコープ列（`routeKey` or `projectCode`）を追加するマイグレーションで対応する。現時点では候補検出ロジック自体が STP 専用（`stp/finance/generate/`）であり、テーブルレベルでの分離は不要。

### 現状の問題

- 候補ステータスはクライアント側の `useState` のみで管理（DB未保存）
- `alreadyGenerated` / `sourceDataChanged` フラグはあるが、保留/不要の概念なし
- 画面リロードで判定結果が消える

### 実装項目

#### 2-1. TransactionCandidateDecision テーブル追加

**ファイル**: `prisma/schema.prisma`

```prisma
model TransactionCandidateDecision {
  id            Int       @id @default(autoincrement())
  candidateKey  String    // "crm-revenue-initial-123" 等
  targetMonth   String    @db.VarChar(7) // "2026-03" 等（YYYY-MM形式、厳格検証）
  status        String    // pending, converted, held, dismissed
  reasonType    String?   // held_price_undecided, dismissed_duplicate, etc.
  memo          String?
  needsReview   Boolean   @default(false)

  // ソース変更検知用フィンガープリント
  sourceFingerprint String?  // 候補生成時のソースデータハッシュ（金額・契約期間・対象月等の連結）

  // 変動金額候補用（Phase 3で使用）
  overrideAmount    Int?
  overrideTaxAmount Int?
  overrideTaxRate   Int?
  overrideMemo      String?
  overrideScheduledPaymentDate DateTime? @db.Date  // 予定日（Phase 3で使用）

  decidedBy     Int?
  decidedAt     DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  decider       User?     @relation(fields: [decidedBy], references: [id])

  @@unique([candidateKey, targetMonth])
}
```

**マイグレーション**: `prisma migrate dev --name add_transaction_candidate_decision`

##### targetMonth の型設計

- `String @db.VarChar(7)` を採用（`"YYYY-MM"` 固定長）
- **サーバー側バリデーション**: Zod スキーマで `z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)` を適用
- 入出力時に `"2026-3"` / `"2026/03"` 等の不正形式を拒否
- 理由: 既存の候補検出ロジックが月文字列ベースで動作しており、Date型変換のオーバーヘッドを避ける

##### status / reasonType の型方針

- **String + Zod** を採用（Prisma enum ではない）
- 理由: 候補判定の運用初期はステータスや理由種別の追加・変更頻度が高いと予想され、String + Zod の方がマイグレーション不要で柔軟
- 安定運用に入った段階で enum 化を検討する余地はあるが、現時点では不要

##### needsReview の判定根拠（ソース変更検知）

- 候補生成時に `sourceFingerprint` を計算・保存する
- フィンガープリントの構成要素（候補タイプ別）:
  - CRM契約候補（売上）: `contractId + counterpartyId + amount + taxType + startDate + endDate + contractStatus`
  - CRM契約候補（経費）: `contractId + counterpartyId + amount + taxType + startDate + endDate + contractStatus`
  - 定期取引候補: `recurringTransactionId + counterpartyId + amount + taxType + nextDate + isActive`
- フィンガープリント生成: 上記属性を `JSON.stringify()` で連結し、SHA-256 ハッシュ化（`crypto.createHash('sha256')`）
- 判定フロー:
  1. 候補検出時に現在のソースデータからフィンガープリントを計算
  2. 既存の `TransactionCandidateDecision.sourceFingerprint` と比較
  3. 不一致なら `needsReview = true` をセット
  4. ユーザーが `acknowledgeReview()` で確認済みにすると、サーバー側でフィンガープリントを再計算し `needsReview = false` + `sourceFingerprint` 更新

#### 2-2. 候補検出ロジックへの判定結果反映

**ファイル**: `src/app/stp/finance/generate/actions.ts`

- `detectTransactionCandidates()` 内で `TransactionCandidateDecision` を参照
- **N+1防止**: 候補一覧生成後に `candidateKey + targetMonth` をまとめて `findMany` → `Map<string, Decision>` に変換して合流
- `status = "dismissed"` の候補はデフォルト非表示（フィルタで表示可能）
- `status = "held"` の候補は保留アイコン付きで表示
- `needsReview = true` の候補は「要再確認」バッジ表示
- ソースデータ変更時にフィンガープリント比較で `needsReview = true` をセット
- 判定保存は `upsert`（candidateKey + targetMonth ユニークキー）を基本とする

#### 2-3. 判定UIの追加

**ファイル**: `src/app/stp/finance/generate/generate-candidates-client.tsx`

- 各候補行に「取引化」「保留」「不要」の3ボタン追加
- 「保留」「不要」選択時にモーダルで理由入力（reasonType + memo）
- reasonType のプリセット:
  - 保留: `price_undecided`（金額未定）, `timing_undecided`（時期未定）, `other`
  - 不要: `duplicate`（重複）, `cancelled`（キャンセル）, `not_applicable`（対象外）, `other`
- **ソート注意**: 日本語文字列の `localeCompare` はクライアントコンポーネントで使用禁止（ハイドレーションエラー回避）。ソート順はサーバー側で確定してからクライアントに渡す

#### 2-4. サーバーアクション追加

**ファイル**: `src/app/stp/finance/generate/actions.ts`

```typescript
// 候補判定を保存（pending/held → held/dismissed への変更）
// ※ override値の保存は Phase 3 の saveOverrideValues() が担当
export async function decideCandidateAction(
  candidateKey: string,
  targetMonth: string,
  status: "held" | "dismissed",
  reasonType?: string,
  memo?: string
): Promise<ActionResult>

// 保留→取引化（判定を converted に更新してから取引作成）
// ※ 既存の generateTransactions() 内の STP 固定化ロジックを必ず通す
export async function convertHeldCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult>

// 不要→保留に戻す
export async function reviveDismissedCandidate(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult>

// needsReview を確認済みにする
// ※ フィンガープリントはサーバー側で現行ソースから再計算して保存（クライアント入力値は受け取らない）
export async function acknowledgeReview(
  candidateKey: string,
  targetMonth: string
): Promise<ActionResult>
```

##### Phase 3 `saveOverrideValues()` との責務境界

- `decideCandidateAction()`: ステータス・理由の変更のみ。override値には触れない
- `saveOverrideValues()`（Phase 3）: override値（金額・税・予定日・メモ）の保存のみ。ステータスには触れない
- **実行順の制約**:
  - `saveOverrideValues()` は `status` が `pending` または `held` の場合のみ実行可能
  - `status = "converted"` の候補に対する override 保存は拒否（取引化済みの金額変更は取引管理画面で行う）
  - `status = "dismissed"` の候補に対する override 保存も拒否（不要判定後に金額入力する意味がない）
- **依存関係**: Phase 3 は Phase 2 の `TransactionCandidateDecision` テーブルに依存

##### サーバー側STP文脈検証（全アクション共通）

Phase 1 で導入済みの STP スコープ検証を、Phase 2 の新規アクションにも適用する:

1. **candidateKey フォーマット検証**: `candidateKey` が STP 候補形式（`crm-revenue-*`, `crm-expense-*`, `recurring-*` 等）であること
2. **targetMonth バリデーション**: Zod スキーマで `YYYY-MM` 形式を厳格検証
3. **取引化時の STP 固定化**: `convertHeldCandidate()` は既存の `generateTransactions()` 内の STP 固定化ロジック（projectId/costCenterId 強制セット）を必ず通す
4. **認証チェック**: `getAuthUser()` による認証確認

##### 排他・競合の扱い

- **converted 済み候補の再取引化**: サーバー側で `status === "converted"` チェック → エラー返却（「既に取引化済みです」）
- **同時更新**: 楽観的ロック（最後の更新勝ち）。`upsert` のユニークキー制約で整合性を担保
- 理由: 候補判定は経理担当1〜2名の運用であり、厳密な排他制御のコストに見合わない

#### 2-5. フィルタUI

**ファイル**: `src/app/stp/finance/generate/generate-candidates-client.tsx`

- タブまたはフィルタドロップダウンで表示切り替え:
  - すべて（デフォルト: pending + held + needsReview）
  - 保留のみ
  - 不要（非表示）を表示
  - 要再確認のみ
- **ソート順はサーバー側で確定**（日本語ラベルのクライアント側ソートを避ける）

### テスト観点（最低限）

- `upsert` のユニークキー（candidateKey + targetMonth）挙動
- `dismissed` 候補の再検出時非表示制御
- `converted` 済み候補の再取引化拒否
- STP候補取引化のサーバー側固定化（projectId/costCenterId 強制セット）
- `targetMonth` の Zod バリデーション（不正形式拒否）
- `acknowledgeReview()` でフィンガープリントがサーバー側で再計算されること

### 監査・履歴

- `decidedBy` + `decidedAt` で判定者・判定時刻を記録
- `updatedAt` で最終変更時刻を追跡
- 取引化時: 生成された取引の ChangeLog に `candidateKey` を記録（トレーサビリティ）

### 受け入れ条件

- [ ] 一度「不要」にした候補が次回検出時に復活しない
- [ ] 「保留」候補を一覧からフィルタで確認できる
- [ ] 「要再確認」バッジが見える（ソース変更時にフィンガープリント比較で自動セット）
- [ ] 判定理由が追跡できる（reasonType + memo）
- [ ] 保留→取引化、不要→保留への復帰が可能
- [ ] converted 済み候補の再取引化がエラーになる
- [ ] 全アクションでサーバー側 STP 文脈検証が通る
- [ ] `npx tsc --noEmit` パス

---

## Phase 3: 変動金額候補の本格対応（最優先級）

### 目的

`amount=null` 候補の0円取引化事故を防ぎ、候補画面で最低限の入力を完了させる。

### 現状の問題

- 変動金額候補は「（変動）」と表示されるだけで入力UIなし
- `amount ?? 0` で0円取引が作成されるリスクあり
- 取引化後に取引管理画面で金額を編集する運用は煩雑

### 画面責務の境界

| 責務 | 候補画面（generate） | 取引管理（transactions） |
|------|---------------------|------------------------|
| 金額入力 | ✅ 変動候補の金額・税率（最小セット） | ✅ 全項目の詳細編集 |
| 予定日入力 | ✅ 入金/支払予定日（任意） | ✅ 期日・予定日の詳細編集 |
| 期日入力 | ❌（期日の正式設定は取引管理で） | ✅ |
| 按分設定 | ❌ | ✅ テンプレート適用・手動按分 |
| 証憑添付 | ❌ | ✅ |
| 状態操作（確定/取消） | ❌ | ✅ |
| メモ | ✅ 簡易メモ | ✅ 詳細メモ |

候補画面は「候補判定 + 最低限入力」に徹し、詳細編集は取引管理画面の責務とする。
`codex-plan.md` の「期日/予定日の一部」要件は、候補画面では **予定日（`scheduledPaymentDate`）のみ** を入力可能とし、期日（`paymentDueDate`）は取引管理画面の責務とする。予定日は「いつ頃の入出金を見込むか」の目安であり、候補段階での入力に適している。

### 実装項目

#### 3-1. 候補画面での簡易入力UI

**ファイル**: `src/app/stp/finance/generate/generate-candidates-client.tsx`

- 変動金額候補（`amount === null`）の行に入力フィールドを追加:
  - 金額（必須、`> 0`）
  - 税率（任意、プリセット: 10% / 8% / 0%、デフォルト: 10%）
  - 税額（税率から自動計算、手動上書き可能）
  - 予定日（任意、DatePicker）
  - メモ（任意）
- 入力値は `TransactionCandidateDecision.override*` フィールドに保存

##### 入力バリデーションルール

- **金額**: `> 0` 必須。マイナス金額は不可（返金・相殺は別途取引として手動作成）
- **税率**: 10 / 8 / 0 のみ許可（プルダウン選択）
- **税額**: 既存の会計ロジック（`transaction-form.tsx` / 会計側の税計算）と同じ丸め方法を適用する。実装時に既存コードの丸め方法（`Math.floor` / `Math.round` 等）を確認し、それに合わせる
- **税額と税率の整合**: 両方入力された場合は税額を優先（税率は参考値扱い）
- **予定日**: 任意。未入力の場合、取引化時に `scheduledPaymentDate = null` で作成（取引管理画面で後から設定可能）
- Zod スキーマでサーバー側バリデーション

#### 3-2. 取引化時のバリデーション強化

**ファイル**: `src/app/stp/finance/generate/actions.ts`

- `generateTransactions()` で `amount=null` 候補の取引化時:
  - `overrideAmount` が存在すれば使用
  - `overrideAmount` が未入力なら取引化を拒否（エラーメッセージ表示）
  - `amount ?? 0` のフォールバックを削除
  - `overrideScheduledPaymentDate` が存在すれば `scheduledPaymentDate` に適用
- **サーバー側バリデーション**: DevTools 等で override 未入力候補を無理に送信しても、server action 側で拒否する

##### 一括取引化フローとの整合

- **固定金額候補**: 従来どおり一括取引化可能（変更なし）
- **変動金額候補（override入力済み）**: 一括取引化対象に含む
- **変動金額候補（override未入力）**: 一括対象から自動除外 + 警告表示
- **一括実行時の結果メッセージ**: 「N件成功 / M件スキップ（金額未入力）」形式で表示

#### 3-3. override値の永続化

**ファイル**: `src/app/stp/finance/generate/actions.ts`

```typescript
// override値の保存（金額・税・予定日・メモ）
// ※ status が pending/held の場合のみ実行可能。converted/dismissed は拒否
export async function saveOverrideValues(
  candidateKey: string,
  targetMonth: string,
  values: {
    amount: number;                   // > 0 必須
    taxAmount?: number;
    taxRate?: number;                 // 10 | 8 | 0
    scheduledPaymentDate?: string;    // ISO 8601 日付文字列（任意）
    memo?: string;
  }
): Promise<ActionResult>
```

### テスト観点（最低限）

- `amount=null` + `override未入力` の取引化拒否（UI経由 + DevTools直送り両方）
- `amount=null` + `override入力済み` の取引化成功
- 一括取引化で変動候補（未入力）が自動除外される
- override金額のバリデーション（0以下拒否、税率制限）
- `saveOverrideValues()` が `converted` / `dismissed` 状態の候補に対して拒否されること
- 予定日の override が取引の `scheduledPaymentDate` に反映されること

### 受け入れ条件

- [ ] `amount=null` 候補を未入力のまま取引化できない
- [ ] 候補画面から金額・予定日を入力できる
- [ ] 入力値がDBに保存され、リロード後も維持される
- [ ] 一括取引化で固定金額候補は従来どおり動作する
- [ ] 一括取引化で変動候補（未入力）はスキップされ、結果メッセージに件数表示
- [ ] 取引化後に取引管理画面で詳細編集可能
- [ ] サーバー側バリデーションで override 未入力の取引化が拒否される（DevTools 直送り対策）
- [ ] `saveOverrideValues()` が `converted` / `dismissed` 状態の候補を拒否する
- [ ] `npx tsc --noEmit` パス

---

## Phase 4: SystemProjectBinding 本実装

### 目的

`/stp` の文脈をハードコードではなく、DB管理可能な設定構造にする。

### 現状

- `project-context.ts` は `MasterProject.code === "stp"` でハードコード検索
- `CostCenterProjectAssignment` で CostCenter 紐付けは実装済み
- TODO コメントで将来の `SystemProjectBinding` 導入を予告

### 実装項目

#### 4-1. SystemProjectBinding テーブル追加

**ファイル**: `prisma/schema.prisma`

```prisma
model SystemProjectBinding {
  id                    Int       @id @default(autoincrement())
  routeKey              String    @unique  // "stp" 等（immutable、admin UIでは編集不可）
  projectId             Int
  defaultCostCenterId   Int?
  operatingCompanyId    Int?
  isActive              Boolean   @default(true)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  project               MasterProject    @relation(fields: [projectId], references: [id])
  defaultCostCenter     CostCenter?      @relation(fields: [defaultCostCenterId], references: [id])
  operatingCompany      OperatingCompany? @relation(fields: [operatingCompanyId], references: [id])
}
```

##### routeKey の不変性担保

- **admin UI**: `routeKey` は表示のみ（編集フォームに含めない）
- **追加/削除**: シードデータまたはマイグレーション経由のみ（UIからの追加・削除は不可）
- **サーバー側**: `routeKey` を含む更新リクエストは拒否（update アクションで `routeKey` フィールドを除外）

##### defaultCostCenter の整合性検証

- `defaultCostCenterId` を設定する場合、その CostCenter が `projectId` に紐づく `CostCenterProjectAssignment` を持つことをサーバー側で検証
- 不整合な組み合わせはバリデーションエラー

##### isActive=false 時の挙動

- `/stp` アクセス時に `isActive` チェック → `false` の場合は「このプロジェクトは現在利用停止中です」のメッセージを表示（エラーページ）
- 既存取引やグループの参照（閲覧）は可能。新規作成・編集のみブロック

##### キャッシュ戦略

- `project-context.ts` のキャッシュは「アプリ再起動まで保持」を明記
- `SystemProjectBinding` の変更は再起動後に反映される（頻繁な変更は想定しない設定データのため許容）
- 将来的に revalidate が必要になった場合は `revalidateTag` での無効化を検討

#### 4-2. project-context.ts の内部実装差し替え

**ファイル**: `src/lib/project-context.ts`

- `getSystemProjectContext()` の内部を `SystemProjectBinding` ベースに変更
- インターフェース（`ProjectContext` 型）は変更なし
- キャッシュ機構も維持

#### 4-3. シードデータ

**ファイル**: `prisma/seed.ts`

- STP用の `SystemProjectBinding` レコードをシードに追加
- `routeKey: "stp"`, 既存の MasterProject/CostCenter を参照

### 受け入れ条件

- [ ] `/stp` の動作が `MasterProject.code` ベタ依存でなくなる
- [ ] STPの紐付け先をDBで安全に管理できる
- [ ] `routeKey` がUI経由で変更できない
- [ ] `defaultCostCenterId` の整合性がサーバー側で検証される
- [ ] `isActive=false` 時に適切なエラー表示がされる
- [ ] 既存STP画面の挙動が維持される
- [ ] `npx tsc --noEmit` パス

---

## Phase 5: プロジェクト管理・権限管理の整理

### 目的

将来の複数プロジェクト展開に耐える管理構造にする。

### サブフェーズ分割

#### 5-1. 権限モデルの棚卸し（現状把握）
- 現在の認証・認可の実装状況を調査
- 画面ごとのアクセス制御の現状を一覧化
- サーバー側とクライアント側の権限チェックの差分を洗い出し

**受け入れ条件（5-1）**:
- [ ] 全画面のアクセス制御状況が一覧化されている
- [ ] サーバー側 vs クライアント側の権限チェック差分が特定されている

#### 5-2. プロジェクト管理UIの責務設計
- プロジェクト一覧・詳細画面の設計
- プロジェクトに紐づく各種設定の管理画面設計
- SystemProjectBinding との連携

**受け入れ条件（5-2）**:
- [ ] プロジェクト一覧・詳細画面の画面設計が完了している
- [ ] SystemProjectBinding との連携方針が決まっている

#### 5-3. CostCenter紐付け管理UI
- CostCenterProjectAssignment の管理画面
- プロジェクト詳細画面からのCostCenter割当・解除

**受け入れ条件（5-3）**:
- [ ] プロジェクト詳細画面から CostCenter の割当・解除ができる
- [ ] 割当変更がサーバー側で検証される

#### 5-4. 法人紐付け管理UI
- OperatingCompany とプロジェクトの紐付け管理
- SystemProjectBinding.operatingCompanyId の設定画面

**受け入れ条件（5-4）**:
- [ ] 法人紐付けの設定・変更ができる
- [ ] 紐付け変更が既存取引に影響しないことが確認されている

### 全体受け入れ条件

- [ ] スタッフが自分のプロジェクト配下だけで必要操作に到達できる
- [ ] 権限境界が画面とサーバーで一致している
- [ ] プロジェクト追加時の運用がコード改修依存になりすぎない

---

## Phase 6: 請求/支払グループ UX改善

### 目的

グループ作成を現場運用しやすいUXに改善する。

### 現状

- 支払グループ・請求グループとも基本機能は完全実装済み
- 作成起点が「先に取引先選択」のみ

### サブフェーズ分割

#### 6-1. 未グループ化取引からの複数選択→グループ作成（MVP）

**ファイル**: `src/app/stp/finance/transactions/transactions-table.tsx`

- 未グループ化取引（`invoiceGroupId = null` or `paymentGroupId = null`）にチェックボックス追加
- 選択した取引から「請求グループ作成」「支払グループ作成」ボタン
- 複数取引先が混在する場合はエラー表示
- **ソート注意**: 日本語文字列のクライアント側ソートが必要な場合はサーバー側で順序を確定する

#### 6-2. エラーUX改善

- 複数取引先混在時の明確なエラーメッセージ（「選択された取引に複数の取引先が含まれています。同一取引先の取引のみ選択してください」）
- グループ作成後の自動遷移（詳細モーダル表示）

#### 6-3. おすすめグループ案（後段）

**ファイル**: `src/app/stp/finance/invoices/actions.ts`, `payment-groups/actions.ts`

- 取引先×月で未グループ化取引を集計
- 「おすすめ」として表示（ワンクリックでグループ作成）
- **着手条件**: 6-1 / 6-2 の運用実績（グループ作成回数・エラー発生率）を見てから着手を判断する。運用データなしでの先行実装は行わない

### 受け入れ条件

- [ ] 取引一覧から複数選択してグループ作成できる
- [ ] 取引先混在時に明確なエラーメッセージが表示される
- [ ] グループ作成後に詳細が表示される
- [ ] `npx tsc --noEmit` パス

---

## 実行優先順位

1. **Phase 2**（候補判定: 保留/不要/永続化）← 最優先
2. **Phase 3**（変動金額候補の簡易入力 + 0円防止）← 最優先級
3. **Phase 4**（SystemProjectBinding 本実装）
4. **Phase 6**（請求/支払グループUX改善）← 6-1/6-2 を先行、6-3 は運用実績を見てから
5. **Phase 5**（プロジェクト管理/権限管理）← 5-1 の棚卸しから段階的に

## 横断タスク（各Phaseで必須）

- 型チェック: `npx tsc --noEmit`
- マイグレーション: `prisma migrate dev --name <変更内容>`（`db push` 禁止）
- マイグレーション後: `npx prisma generate` + `docker compose restart app`
- STPスコープのサーバー検証維持
- 経理側フローの回帰確認
- ChangeLog 記録
- テスト: Phase 2/3 は不具合が入りやすいため、最低限のテスト観点を実装時に確認
- ドキュメント更新: 変更点のSTP向け操作フロー更新（各Phase完了時）
- クライアント側ソート注意: 日本語文字列の `localeCompare` はクライアントコンポーネントで使用禁止。ソート順はサーバー側で確定する

## 主要ファイルパス

| ファイル | 役割 |
|---------|------|
| `prisma/schema.prisma` | データベーススキーマ |
| `src/lib/project-context.ts` | STPプロジェクトコンテキスト |
| `src/app/stp/finance/generate/actions.ts` | 候補検出ロジック（1,253行） |
| `src/app/stp/finance/generate/generate-candidates-client.tsx` | 候補画面クライアント（460行） |
| `src/app/stp/finance/generate/page.tsx` | 候補画面ページ |
| `src/app/stp/finance/transactions/actions.ts` | STP取引アクション |
| `src/app/stp/finance/transactions/transactions-table.tsx` | STP取引テーブル |
| `src/app/accounting/transactions/actions.ts` | 経理側取引ロジック（850行+） |
| `src/app/stp/finance/invoices/actions.ts` | 請求グループ（746行） |
| `src/app/stp/finance/payment-groups/actions.ts` | 支払グループ（632行） |
| `src/components/layout/sidebar.tsx` | サイドバーメニュー |

## 検証方法

各Phase完了後:
1. `npx tsc --noEmit` で型チェック
2. `docker compose exec app npx prisma migrate dev` でマイグレーション適用
3. `npx prisma generate && docker compose restart app` でクライアント再生成
4. ブラウザで該当画面の動作確認
5. 経理側画面（`/accounting/transactions`）の回帰確認
