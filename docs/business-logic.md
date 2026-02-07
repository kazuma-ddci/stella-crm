# ビジネスロジック

このドキュメントはstella-crmの重要なビジネスロジックを記述したものです。

---

## 目次

1. [ステージ遷移ロジック](#ステージ遷移ロジック)
2. [アラート機能](#アラート機能)
3. [ステージ管理モーダル](#ステージ管理モーダル)
4. [外部ユーザー認証](#外部ユーザー認証)
5. [社内スタッフ認証](#社内スタッフ認証)
6. [リード獲得フォーム](#リード獲得フォーム)
7. [請求先担当者の設計パターン](#請求先担当者の設計パターン)
8. [接触履歴管理](#接触履歴管理)
9. [運用KPIシート](#運用kpiシート)
10. [代理店契約履歴・報酬管理](#代理店契約履歴報酬管理)
11. [代理店契約ステータスの自動計算](#代理店契約ステータスの自動計算)
12. [売上・経費グルーピングと請求書生成](#売上経費グルーピングと請求書生成)

---

## ステージ遷移ロジック

`src/lib/stage-transition/` にステージ遷移の判定・検証ロジックを実装。

### イベント種別（event_type）

| 値 | 意味 | 発生タイミング |
|----|------|---------------|
| commit | 新規目標設定 | 目標がない状態から新しく目標を設定 |
| achieved | 目標達成 | 現在のステージが目標ステージに到達 |
| recommit | 目標変更 | 目標ステージまたは目標日を変更 |
| progress | 前進 | 目標とは関係なくステージが前に進んだ |
| back | 後退 | 現在のステージが前のステージに戻った |
| cancel | 目標取消 | 目標を達成せずに削除した |

### イベント検出フローチャート

```
保存ボタンが押された
        │
        ▼
current_stage_idは変更された？
        │
   ┌────┴────┐
   YES       NO
   │         │
   ▼         ▼
目標と一致？ 目標関連は変更された？
   │              │
 ┌─┴─┐       ┌────┴────┐
YES  NO     YES        NO
 │   │       │         │
 ▼   ▼       ▼         ▼
achieved  順番を比較  以前目標あり？  何もしない
 │         │           │
 │    ┌────┴────┐   ┌──┴──┐
 │   上がった  下がった  YES    NO
 │    │         │      │     │
 │    ▼         ▼      ▼     ▼
 │  progress   back  目標残った？ commit
 │                      │
 │                 ┌────┴────┐
 │                YES       NO
 │                 │         │
 │                 ▼         ▼
 │              recommit   cancel
 │
 ▼
次の目標も同時に設定された？ → YES → +commit
```

---

## アラート機能

ステージ変更時に18種類のアラートルールでバリデーションを実行。

| カテゴリ | ID | 深刻度 | 概要 |
|---------|-----|--------|-----|
| 論理エラー | L-001〜L-005 | ERROR/WARNING | 目標設定の矛盾チェック |
| 時系列エラー | T-001〜T-003 | ERROR/WARNING/INFO | 目標日の妥当性チェック |
| 遷移エラー | S-001〜S-004 | WARNING/INFO | ステージ遷移の妥当性チェック |
| 目標管理 | G-001〜G-005 | ERROR/WARNING/INFO | 目標変更パターンのチェック |
| データ整合性 | D-001, D-003 | ERROR/WARNING | 必須項目・理由入力チェック |

### 深刻度と対応

- **ERROR**: 保存ブロック、修正必須
- **WARNING**: 警告表示、確認後に保存可能（一部は理由入力必須）
- **INFO**: 情報表示、そのまま保存可能

---

## ステージ管理モーダル

STP企業一覧の📊ボタンから開く専用モーダル。

### 機能

1. 現在の状況（ステージ、滞在日数、目標情報）
2. ステージ進捗ビジュアル（横一列のプログレス表示）
3. ステージ履歴（最新5件、全件表示可能）
4. 統計情報（達成回数、達成率、後退回数）
5. ステージ更新フォーム（リアルタイムバリデーション）

### 操作分離

- **新規登録時**: フォームでステージ入力可能
- **編集時**: ステージ関連は読み取り専用、変更はモーダルから

---

## 外部ユーザー認証

NextAuth.jsを使用した認証システム。

### 認証フロー

1. `/login` でメールアドレスとパスワードを入力
2. NextAuthがCredentialsProviderで認証
3. セッションにユーザー情報を保存
4. ミドルウェアで保護されたルートへのアクセスを制御

### ユーザーステータス

- `pending_email`: メール認証待ち
- `pending_approval`: 管理者承認待ち
- `active`: アクティブ（ログイン可能）
- `suspended`: 停止中

### 外部ユーザーの登録フロー

1. 管理者が登録トークンを発行
2. ユーザーがトークンURL経由で登録フォームにアクセス
3. 必要情報を入力して登録
4. メール認証リンクをクリック
5. 管理者が承認
6. ログイン可能に

---

## 社内スタッフ認証

NextAuth.jsを使用した社内スタッフ向け認証システム。

### 認証フロー

1. `/login` でメールアドレスとパスワードを入力
2. `MasterStaff` テーブルでメールアドレスを検索
3. `passwordHash` があり `isActive` が `true` の場合、bcryptでパスワード検証
4. 認証成功時、セッションにスタッフ情報と権限を保存

### 社内スタッフの登録フロー（招待方式）

```
管理者が /staff でスタッフ登録（名前・メール・プロジェクト・役割）
  ↓
「招待送信」ボタンクリック
  ↓
招待メールが届く（/staff/setup/[token] リンク付き）
  ↓
スタッフがリンクからパスワード設定
  ↓
設定完了 → /login へ → すぐにログイン可能（承認不要）
```

### 招待トークン

| フィールド | 説明 |
|-----------|------|
| `inviteToken` | 招待用トークン（64文字、ユニーク） |
| `inviteTokenExpiresAt` | トークン有効期限（24時間） |

### スタッフ一覧の「アカウント」カラム表示

| 状態 | 表示 |
|------|------|
| パスワード設定済み | ✅ 設定済み |
| メールあり・招待済み・有効期限内 | 🕐 招待中 + 再送信ボタン |
| メールあり・未招待 or 期限切れ | 招待送信ボタン |
| メールなし | メール未設定 |

### 注意事項

- スタッフ追加時、`isActive` はデフォルトで `true`
- `isActive` が `false` の場合、ログインできない
- パスワード設定完了後、`inviteToken` は `null` にクリアされる

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/auth.ts` | 認証ロジック（スタッフ・外部ユーザー両対応） |
| `src/app/staff/actions.ts` | スタッフCRUD + 招待送信 |
| `src/app/staff/staff-table.tsx` | スタッフ一覧（招待ボタン含む） |
| `src/app/staff/setup/[token]/page.tsx` | パスワード設定ページ |
| `src/app/api/staff/setup/route.ts` | パスワード設定API |
| `src/app/api/staff/setup/validate/[token]/route.ts` | トークン検証API |
| `src/lib/email/index.ts` | 招待メール送信 |
| `src/middleware.ts` | `/staff/setup` を公開パスに設定 |

---

## リード獲得フォーム

代理店経由でリードを獲得するための公開フォーム。

### フロー

1. 代理店ごとにユニークなトークンを発行
2. `/form/stp-lead/[token]` でフォームにアクセス
3. 回答データは `stp_lead_form_submissions` に保存
4. 管理画面 `/stp/lead-submissions` で回答を確認・処理

### フォーム構成（2ページ制）

**ページ1: 基本情報 + 採用実績**
- 会社名（必須）、担当者氏名（必須）、メールアドレス（必須）
- 職種選択（必須）← この職種がページ2に自動反映される
- 過去1年間の採用費用（人材紹介/求人広告/リファラル/その他）
- 過去1年間の採用人数

**ページ2: 今後の採用予定**
- 採用希望の職種（読み取り専用、ページ1から自動コピー）
- 年間採用予算、年間採用希望人数
- 採用エリア（都道府県）、採用タイムライン、年齢幅
- 採用必須条件、採用希望条件

### 職種連動ルール（SPEC-STP-002）

- ページ1の職種選択は**必須**
- ページ2の「採用希望の職種」にはページ1の選択値が自動反映され、**変更不可**
- 詳細は [SPEC-STP-002](specs/SPEC-STP-002.md) を参照

### 再送信フロー

- 送信完了画面に「別の職種で回答する」ボタンを表示
- クリック時: 基本情報（会社名・担当者・メール）を保持し、その他をリセットしてページ1に戻る
- これにより、複数職種の回答を効率的に行える

### リード回答の処理モーダル（3シナリオ分岐）

管理画面 `/stp/lead-submissions` で回答を処理する際、選択する処理方法と紐付け先企業の状態に応じて3つのUIシナリオに分岐する。

#### シナリオ1: 新規企業として登録

Stella全顧客マスタとSTP企業情報の両方に新規登録。モーダル内は2つのセクションに分離表示。

| セクション | 色 | 入力項目 |
|-----------|-----|---------|
| Stella 全顧客マスタに登録 | 青（`border-blue-200 bg-blue-50/30`） | 企業名、業界、売上規模、企業HP |
| STP 企業情報に登録 | 緑（`border-emerald-200 bg-emerald-50/30`） | ステージ（リード固定）、代理店、リード獲得日、企業メモ |

#### シナリオ2: 既存企業に紐付け → STP登録済み企業

STP企業情報に既に登録されている企業を選択した場合、情報入力フォームは表示せず、メッセージのみ表示。

```
ℹ️ 採用ブーストの顧客に紐づけます。情報更新は企業情報ページから行ってください。
```

- `stpCompanyInfo` は `undefined` として送信 → Server Actionで既存STP企業の情報は変更しない

#### シナリオ3: 既存企業に紐付け → Stellaのみ（STP未登録）企業

Stella全顧客マスタの情報更新 + STP企業情報に新規登録。シナリオ1と同様に2セクション表示だが、以下の違いがある。

| セクション | 色 | 入力項目 |
|-----------|-----|---------|
| Stella 全顧客マスタの情報を更新 | 青 | 業界、売上規模、企業HP（3カラムグリッド） |
| STP 企業情報に登録 | 緑 | **企業名（表示のみ・編集不可）**、ステージ、代理店、リード獲得日、企業メモ |

- **企業名**: ラジオボタン（企業名が異なる場合）で選択した方の企業名が表示のみで反映される
- 企業名の不一致警告・代理店の不一致警告は、STP未登録企業の場合のみ表示

#### 判定ロジック

```typescript
// CompanyOption に isInStp: boolean を持たせて判定
const isSelectedCompanyInStp = () => {
  const company = companyOptions.find((c) => c.value === selectedCompanyId);
  return company?.isInStp === true;
};

// ⚠️ stpAgentId != null での判定は NG（agentId が null の STP 企業で誤判定）
```

#### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/stp/lead-submissions/submissions-table.tsx` | 処理モーダルUI（3シナリオ分岐） |
| `src/app/stp/lead-submissions/page.tsx` | データ取得（`isInStp`フラグ付与） |
| `src/app/api/stp/lead-submissions/route.ts` | APIルート（ポーリング用、同じ`isInStp`付与） |
| `src/app/stp/lead-submissions/actions.ts` | Server Actions（`processWithExistingCompany`が`stpCompanyInfo: undefined`を処理） |

---

## 請求先担当者の設計パターン

### 設計方針：担当者IDのみ保存、表示時に導出

請求先担当者は**担当者マスタ（StellaCompanyContact）で一元管理**し、StpCompanyには**担当者IDのみ保存**する設計。

```
StpCompany
└── billingRepresentative: "1,3,5"  ← 担当者ID（カンマ区切り）のみ保存

↓ 表示時にStellaCompanyContactから導出

"田中太郎 (tanaka@example.com)"
"山田花子 (yamada@example.com)"
```

### なぜこの設計か

| 観点 | 説明 |
|------|------|
| データの正規化 | 担当者情報は1箇所（マスタ）で管理、冗長な保存を避ける |
| 自動反映 | 担当者マスタでメールアドレスや名前が変更されると、自動的に最新が表示される |
| シンプル | 保存時の導出ロジックが不要 |

### 削除した冗長カラム

以下のカラムは不要として削除済み：

| 削除カラム | 理由 |
|-----------|------|
| `billingEmail` | 担当者IDから導出可能 |
| `billingEmailSource` | 未使用 |
| `billingContactId` | `billingRepresentative`（複数対応）で代替 |

### 実装パターン

**1. データ取得時（page.tsx）：IDから名前・メールを導出**

```typescript
// billingRepresentativeには担当者IDが保存されている
billingContactIds: c.billingRepresentative,
// 請求先担当者（名前とメールを統合表示）
billingContacts: (() => {
  if (!c.billingRepresentative) return null;
  const contactIds = c.billingRepresentative.split(",").map((id) => Number(id.trim()));
  const contactInfoList = contactIds
    .map((id) => {
      const contact = c.company.contacts.find((contact) => contact.id === id);
      if (!contact) return null;
      return contact.email ? `${contact.name} (${contact.email})` : contact.name;
    })
    .filter((info): info is string => !!info);
  return contactInfoList.length > 0 ? contactInfoList : null;
})(),
```

**2. カラム定義（stp-companies-table.tsx）：1カラムに統合**

```typescript
// 請求先担当者（選択用、非表示）- インライン編集可能
{ key: "billingContactIds", header: "請求先担当者（選択）", type: "multiselect",
  dynamicOptionsKey: "billingContactIds", dependsOn: "companyId", hidden: true, inlineEditable: true },
// 請求先担当者（名前とメールを統合表示）
{ key: "billingContacts", header: "請求先担当者", editable: false },
```

**3. インライン編集マッピング**

```typescript
displayToEditMapping: {
  "billingContacts": "billingContactIds",  // 表示カラム → 編集カラム
},
```

**4. カスタムレンダラー：配列を縦並び表示**

```typescript
billingContacts: (value) => {
  if (!value || !Array.isArray(value) || value.length === 0) return "-";
  return (
    <div className="flex flex-col gap-1">
      {value.map((contact, index) => (
        <div key={index} className="text-sm">{contact}</div>
      ))}
    </div>
  );
},
```

**5. 保存時（actions.ts）：IDのみ保存**

```typescript
// 請求先担当者IDs（複数）- billingRepresentativeに保存
if ("billingContactIds" in data) {
  const billingContactIds = toCommaSeparatedString(data.billingContactIds);
  updateData.billingRepresentative = billingContactIds;
}
```

### 将来の請求書自動送信への対応

請求書送信機能を実装する際は、**送信履歴に送信時点のメールアドレスを記録**する設計を推奨：

```
StpCompany（現在）
└── billingRepresentative: "1,3"  ← 担当者IDのみ

↓ 請求書送信時

Invoice（将来作成）
├── stpCompanyId
├── sentAt: 2026-02-04
├── sentToEmail: "tanaka@example.com"  ← 送信時点のメールを記録
├── sentToName: "田中太郎"
└── ...
```

**理由：**
- 「この請求書、どのアドレスに送った？」を後から確認可能
- 担当者マスタ変更後も、過去の送信履歴は正確に残る

---

## 接触履歴管理

STP企業および代理店との接触記録を管理する機能。

### データ構造

接触履歴は `contact_histories` テーブルで全プロジェクト共通に管理。`contact_history_roles` 中間テーブルで顧客種別との紐付けを行う。

### 企業接触と代理店接触の違い

| 項目 | 企業接触履歴 | 代理店接触履歴 |
|------|------------|--------------|
| 一覧画面パス | `/stp/records/company-contacts` | `/stp/records/agent-contacts` |
| 編集方法 | STP企業一覧のモーダル or 一覧画面 | 代理店一覧のモーダル or 一覧画面 |

### CRUD操作

#### 新規作成

```typescript
// src/app/stp/companies/contact-history-actions.ts
export async function addContactHistory(
  companyId: number,
  data: {
    contactDate: string;
    contactMethodId?: number | null;
    assignedTo?: string | null;        // カンマ区切りのスタッフID
    customerParticipants?: string | null;
    meetingMinutes?: string | null;
    note?: string | null;
    customerTypeIds: number[];         // 選択された顧客種別ID配列
  }
)
```

#### 論理削除

削除操作は `deletedAt` に現在日時をセット。物理削除は行わない。

```typescript
export async function deleteContactHistory(id: number) {
  await prisma.contactHistory.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

### 担当者の複数選択ロジック

担当者（`assignedTo`）は複数のスタッフIDをカンマ区切りで保存。

```typescript
// 選択/解除ロジック
const handleStaffChange = (staffId: string) => {
  const currentIds = (formData.assignedTo || "").split(",").filter(Boolean);
  const isSelected = currentIds.includes(staffId);

  let newIds: string[];
  if (isSelected) {
    newIds = currentIds.filter((id) => id !== staffId);
  } else {
    newIds = [...currentIds, staffId];
  }

  setFormData({ ...formData, assignedTo: newIds.join(",") });
};

// IDを名前に変換（表示時）
const assignedNames = (assignedTo || "")
  .split(",")
  .filter(Boolean)
  .map((id) => staffMap[id]?.name || id)
  .join(", ");
```

### キャッシュ無効化

Server Action実行後、関連パスのキャッシュを無効化：

```typescript
// 企業接触履歴
revalidatePath("/stp/companies");
revalidatePath("/stp/records/company-contacts");

// 代理店接触履歴
revalidatePath("/stp/agents");
revalidatePath("/stp/records/agent-contacts");
```

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/stp/companies/contact-history-actions.ts` | 企業接触履歴CRUD |
| `src/app/stp/companies/contact-history-modal.tsx` | 企業接触履歴モーダル |
| `src/app/stp/agents/contact-history-actions.ts` | 代理店接触履歴CRUD |
| `src/app/stp/agents/contact-history-modal.tsx` | 代理店接触履歴モーダル |
| `src/app/stp/records/company-contacts/page.tsx` | 企業接触履歴一覧ページ |
| `src/app/stp/records/agent-contacts/page.tsx` | 代理店接触履歴一覧ページ |

---

## 運用KPIシート

STP企業の運用成果を週単位で管理するKPIシート機能。媒体ごと（Indeed、Wantedly等）にシートを作成し、目標・実績・差分を管理。

### 機能概要

1. **シート管理**: 媒体ごとにKPIシートを作成・削除
2. **週次データ**: 週単位で目標値・実績値を入力
3. **自動計算**: 計算項目は手入力データから自動算出
4. **共有リンク**: 時間制限付きの公開URLを発行

### データ構造

```
StpCompany (STP企業)
└── StpKpiSheet (KPIシート: Indeed, Wantedly...)
    ├── StpKpiWeeklyData (週次データ: 2/2〜2/8, 2/9〜2/15...)
    │   ├── target* (目標値)
    │   └── actual* (実績値)
    └── StpKpiShareLink (共有リンク)
```

### KPI計算ロジック

#### 手入力項目（4項目）

ユーザーが直接入力する項目。UIではオレンジ系の背景色で表示。

| 項目 | フィールド名 | 型 |
|------|-------------|-----|
| 表示回数 | impressions | INT |
| クリック数 | clicks | INT |
| 応募数 | applications | INT |
| 費用（運用費込み） | cost | INT |

#### 計算項目（5項目）

手入力項目から自動計算される項目。UIでは白背景で表示。

| 項目 | フィールド名 | 計算式 | 型 |
|------|-------------|--------|-----|
| 表示単価（CPM） | cpm | `cost ÷ impressions` | DECIMAL(10,2) |
| クリック率（CTR） | ctr | `clicks ÷ impressions × 100` | DECIMAL(5,2) |
| クリック単価（CPC） | cpc | `cost ÷ clicks` | DECIMAL(10,2) |
| 応募率（CVR） | cvr | `applications ÷ clicks × 100` | DECIMAL(5,2) |
| 応募単価（CPA） | cpa | `cost ÷ applications` | DECIMAL(10,2) |

#### 計算実装（フロントエンド）

```typescript
// src/components/kpi-sheet/types.ts

export function calculateMetricValue(
  metricKey: KpiMetricKey,
  data: {
    impressions: number | null;
    clicks: number | null;
    applications: number | null;
    cost: number | null;
  }
): number | null {
  const { impressions, clicks, applications, cost } = data;

  switch (metricKey) {
    case "cpm": // 表示単価 = 費用 ÷ 表示回数
      if (cost === null || impressions === null || impressions === 0) return null;
      return cost / impressions;

    case "ctr": // クリック率 = クリック数 ÷ 表示回数 × 100
      if (clicks === null || impressions === null || impressions === 0) return null;
      return (clicks / impressions) * 100;

    case "cpc": // クリック単価 = 費用 ÷ クリック数
      if (cost === null || clicks === null || clicks === 0) return null;
      return cost / clicks;

    case "cvr": // 応募率 = 応募数 ÷ クリック数 × 100
      if (applications === null || clicks === null || clicks === 0) return null;
      return (applications / clicks) * 100;

    case "cpa": // 応募単価 = 費用 ÷ 応募数
      if (cost === null || applications === null || applications === 0) return null;
      return cost / applications;

    default:
      return null;
  }
}
```

**注意**: 計算項目はDBにも保存されるが、表示時はフロントエンドで再計算して最新値を表示。

### 差分計算

差分行は「実績 - 目標」で計算。

```typescript
export function calculateDiff(
  targetValue: number | null,
  actualValue: number | null
): number | null {
  if (targetValue === null || actualValue === null) return null;
  return actualValue - targetValue;
}
```

- **正の値（緑色）**: 目標超過達成
- **負の値（赤色）**: 目標未達

### 共有リンク

#### 発行フロー

1. シート詳細画面で「共有リンクを発行」ボタン
2. 有効期限を選択（1時間/6時間/24時間/7日間）
3. ランダムトークン（64文字）を生成
4. URLをコピーして外部共有

#### 共有ページの特徴

- `/s/kpi/[token]` で公開アクセス
- 認証不要（トークンのみで認証）
- 閲覧専用（編集不可）
- 有効期限表示（日本時間）
- 期限切れは自動でエラー表示

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/stp/companies/[id]/kpi/page.tsx` | KPIシート管理ページ |
| `src/app/stp/companies/[id]/kpi/actions.ts` | KPIシートCRUD（Server Actions） |
| `src/app/s/kpi/[token]/page.tsx` | 共有ページ（公開） |
| `src/components/kpi-sheet/index.ts` | KPIコンポーネントエクスポート |
| `src/components/kpi-sheet/kpi-table.tsx` | KPIテーブル（メインUI） |
| `src/components/kpi-sheet/kpi-cell.tsx` | 編集可能セル |
| `src/components/kpi-sheet/types.ts` | 型定義・計算ロジック |

### UIデザイン

#### テーブル構造

```
┌─────────────────┬──────────┬──────────┬──────────┐
│       月        │    2月    │          │          │
├─────────────────┼──────────┼──────────┼──────────┤
│      開始       │  2月2日  │  2月9日  │  2月16日 │  ← 編集可能
├─────────────────┼──────────┼──────────┼──────────┤
│      終了       │  2月8日  │  2月15日 │  2月22日 │  ← 自動計算
├─────────────────┼──────────┼──────────┼──────────┤
│      目標       │          │          │          │  ← セクションヘッダー（青）
├─────────────────┼──────────┼──────────┼──────────┤
│    表示回数     │    -     │    -     │    -     │  ← 手入力（amber背景）
│    表示単価     │    -     │    -     │    -     │  ← 計算（白背景）
│    クリック数   │    -     │    -     │    -     │
│    ...          │          │          │          │
├─────────────────┼──────────┼──────────┼──────────┤
│      実績       │          │          │          │  ← セクションヘッダー（緑）
├─────────────────┼──────────┼──────────┼──────────┤
│    表示回数     │    -     │    -     │    -     │
│    ...          │          │          │          │
├─────────────────┼──────────┼──────────┼──────────┤
│      差分       │          │          │          │  ← セクションヘッダー（グレー）
├─────────────────┼──────────┼──────────┼──────────┤
│    表示回数     │    -     │    -     │    -     │  ← 正=緑、負=赤
│    ...          │          │          │          │
└─────────────────┴──────────┴──────────┴──────────┘
```

#### 色設計

| 要素 | 色 | Tailwindクラス |
|------|-----|----------------|
| 日付ヘッダー（開始/終了） | スレートグレー | `bg-slate-600` |
| 目標セクションヘッダー | 薄い青 | `bg-blue-100` |
| 実績セクションヘッダー | 薄い緑 | `bg-emerald-100` |
| 差分セクションヘッダー | 薄いグレー | `bg-slate-100` |
| 手入力セル | 薄いアンバー | `bg-amber-50` |
| 計算セル | 白 | `bg-white` |
| 差分（正） | 緑文字 | `text-green-600` |
| 差分（負） | 赤文字 | `text-red-600` |

---

## 代理店契約履歴・報酬管理

代理店との契約条件と報酬体系を管理する機能。代理店一覧テーブルの「契約条件」ボタンからモーダルで操作する。

### 概念モデル

```
StpAgent（代理店）
└── StpAgentContractHistory（契約履歴：期間ごとの契約条件）
    ├── デフォルト報酬率（全紹介企業に適用）
    │   ├── 月額プラン（Mp）報酬
    │   └── 成果報酬プラン（Pp）報酬
    └── StpAgentCommissionOverride（企業別報酬例外）
        ├── 月額プラン（Mp）報酬（例外）
        └── 成果報酬プラン（Pp）報酬（例外）
```

### 報酬体系の設計

報酬はクライアント企業の契約プラン（月額/成果報酬）に応じて2系統に分離。各系統の報酬構造は以下の通り:

#### 月額プラン（Mp: Monthly Plan）を契約した企業からの報酬

| 報酬項目 | DB接頭辞 | タイプ | 説明 |
|---------|---------|--------|------|
| 初期費用報酬 | `defaultMpInitial` / `mpInitial` | 率(%) + 期間(ヶ月) | 契約獲得時の初期報酬 |
| 月額報酬 | `defaultMpMonthly` / `mpMonthly` | 率(%) or 固定額 + 期間(ヶ月) | 毎月の継続報酬 |

- **月額報酬タイプ** (`mpMonthlyType`): `"rate"` = 売上の率(%), `"fixed"` = 固定額(円)

#### 成果報酬プラン（Pp: Performance Plan）を契約した企業からの報酬

| 報酬項目 | DB接頭辞 | タイプ | 説明 |
|---------|---------|--------|------|
| 初期費用報酬 | `defaultPpInitial` / `ppInitial` | 率(%) + 期間(ヶ月) | 契約獲得時の初期報酬 |
| 成果報酬 | `defaultPpPerf` / `ppPerf` | 率(%) or 固定額 + 期間(ヶ月) | 成果発生時の報酬 |

- **成果報酬タイプ** (`ppPerfType`): `"rate"` = 売上の率(%), `"fixed"` = 固定額(円)

### 報酬適用ロジック

```
紹介企業に対する報酬を決定:
  1. 該当企業に対する CommissionOverride が存在するか？
     ├── YES → Override の報酬設定を適用
     └── NO  → ContractHistory のデフォルト報酬を適用
```

### formatCommissionSummary（報酬サマリー表示）

一覧テーブルで報酬内容を簡潔に表示するための関数。

**表示例**:
```
月額プラン: 初期10%(12ヶ月) / 月額5%(24ヶ月)
成果プラン: 初期10%(12ヶ月) / 成果¥100,000(12ヶ月)
```

**ロジック**:
- `ppPerfType` が `"rate"` → `成果{rate}%` 表示
- `ppPerfType` が `"fixed"` → `成果¥{fixed}` 表示（通貨フォーマット）
- `ppPerfType` が未設定で `ppPerfRate` があれば → `成果{rate}%` 表示（後方互換）
- 月額報酬も同様に `mpMonthlyType` で分岐

### 契約履歴のCRUD操作

| 操作 | Server Action | 説明 |
|------|--------------|------|
| 一覧取得 | `getAgentContractHistories(agentId)` | 論理削除されていないレコードを取得、commissionOverridesも一括取得 |
| 追加 | `addAgentContractHistory(agentId, data)` | 新しい契約履歴を作成 |
| 更新 | `updateAgentContractHistory(id, data)` | 既存の契約履歴を更新（確認ダイアログあり） |
| 削除 | `deleteAgentContractHistory(id)` | 論理削除（`deletedAt` をセット） |

### 報酬例外のCRUD操作

| 操作 | Server Action | 説明 |
|------|--------------|------|
| 追加 | `addCommissionOverride(data)` | 企業別の報酬例外を作成 |
| 更新 | `updateCommissionOverride(id, data)` | 報酬例外を更新 |
| 削除 | `deleteCommissionOverride(id)` | 物理削除 |

### UI構成

```
┌─ 代理店契約履歴管理モーダル ─────────────────────────────┐
│                                                          │
│  [契約履歴を追加] ボタン                                   │
│                                                          │
│  ┌─ 追加/編集フォーム ──────────────────────────────────┐ │
│  │ 契約開始日* | 契約終了日 | ステータス*                 │ │
│  │ 初期費用(¥#,##0) | 月額費用(¥#,##0)                  │ │
│  │                                                      │ │
│  │ ── 月額プランを契約した企業からの報酬（青見出し）── │ │
│  │ 初期費用報酬率(%) | 報酬発生期間(ヶ月)                │ │
│  │ 月額報酬タイプ [率/固定] | 率(%) or 固定額(¥) | 期間  │ │
│  │                                                      │ │
│  │ ── 成果報酬プランを契約した企業からの報酬（緑見出し）── │ │
│  │ 初期費用報酬率(%) | 報酬発生期間(ヶ月)                │ │
│  │ 成果報酬タイプ [率/固定] | 率(%) or 固定額(¥) | 期間  │ │
│  │                                                      │ │
│  │ 備考                                                 │ │
│  │                           [キャンセル] [追加/更新]    │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ 契約履歴一覧テーブル ───────────────────────────────┐ │
│  │ ＞ | ステータス | 開始日 | 終了日 | 初期 | 月額 |     │ │
│  │     | デフォルト報酬 | 備考 | [編集][削除]            │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌─ 紹介企業の報酬設定（行クリックで展開）──────────────┐ │
│  │ [例外を追加] ボタン                                   │ │
│  │ 企業 | 適用(デフォルト/例外) | 報酬内容 | 操作        │ │
│  └──────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────┘
```

### 金額フォーマット

金額入力フィールド（`initialFee`, `monthlyFee`, `mpMonthlyFixed`, `ppPerfFixed`）は `CurrencyInput` コンポーネントを使用:
- **フォーカス時**: `type="number"` で数値入力
- **ブラー時**: `¥#,##0` 形式で表示（例: `¥150,000`）

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/stp/agents/agent-contract-history-actions.ts` | 契約履歴・報酬例外のServer Actions（CRUD） |
| `src/app/stp/agents/agent-contract-history-modal.tsx` | 契約履歴管理モーダルUI |
| `src/app/stp/agents/agents-table.tsx` | 代理店一覧テーブル（「契約条件」ボタン） |
| `prisma/schema.prisma` | StpAgentContractHistory, StpAgentCommissionOverride モデル定義 |

### 代理店契約ステータスの自動計算

代理店の契約ステータス（`contractStatus`）は、`StpAgentContractHistory` の契約履歴データから**サーバーサイドで自動計算**される。手動入力は不可。

#### 計算ロジック

```
代理店の契約履歴（deletedAt is null）を取得:

  履歴が0件
  → 「契約前」

  今日時点で有効な契約あり
  （contractStartDate <= 今日 AND (contractEndDate is null OR contractEndDate >= 今日)）
  → 「契約済み」

  履歴はあるが全て終了済み
  → 「契約終了」
```

#### ステータスと表示色

| ステータス | 条件 | バッジ色 |
|-----------|------|---------|
| 契約前 | 契約履歴が存在しない | 黄（`bg-yellow-100 text-yellow-800`） |
| 契約済み | 今日時点で有効な契約履歴がある | 緑（`bg-green-100 text-green-800`） |
| 契約終了 | 契約履歴はあるが全て終了 | 灰（`bg-gray-100 text-gray-600`） |

#### 実装箇所

```typescript
// src/app/stp/agents/page.tsx（データ取得時に計算）
contractStatus: (() => {
  const histories = a.agentContractHistories;
  if (histories.length === 0) return "契約前";
  const hasActive = histories.some((h) => {
    const start = new Date(h.contractStartDate);
    start.setHours(0, 0, 0, 0);
    if (start > today) return false;
    if (!h.contractEndDate) return true;
    const end = new Date(h.contractEndDate);
    end.setHours(0, 0, 0, 0);
    return end >= today;
  });
  return hasActive ? "契約済み" : "契約終了";
})(),
```

#### 変更経緯（2026-02-06）

- **変更前**: `StpAgent.contractStatus` に手動で値を保存（選択肢: 契約済み/商談済み/未商談/日程調整中）
- **変更後**: `StpAgentContractHistory` の日付データから自動計算、DBカラムは未使用（将来的に削除候補）
- **UI変更**: インライン編集を無効化、バッジ表示に変更
- **理由**: 契約履歴の日付と契約ステータスの整合性を自動で保証するため

#### 関連ファイル

| ファイル | 変更内容 |
|---------|---------|
| `src/app/stp/agents/page.tsx` | `agentContractHistories` をinclude、contractStatusを動的計算 |
| `src/app/stp/agents/agents-table.tsx` | contractStatusカラムを編集不可に、バッジ表示追加 |
| `src/app/stp/agents/actions.ts` | contractStatusの手動保存/更新を除去 |

### マイグレーション履歴

| マイグレーション | 内容 |
|----------------|------|
| `20260206040819_restructure_to_contract_based` | テーブル新規作成（契約履歴） |
| `20260206072630_financial_restructure` | CommissionOverrideテーブル追加 |
| `20260206125849_restructure_commission_by_plan_type` | 旧フラットカラム → プランタイプ別カラムへリストラクチャ |
| `20260206221055_add_pp_perf_type_and_fixed` | 成果報酬にタイプ選択（率/固定額）追加 |

---

## 売上・経費グルーピングと請求書生成

売上レコード・経費レコードを**企業×月（売上）/ 代理店×月（経費）**でグルーピング表示し、請求書の一括生成・個別生成を可能にする機能。

### 背景（2026-02-07）

同一企業・同一月に複数の売上/経費レコードが発生するため、これらをグルーピングして管理し、請求書を一括で生成する運用ニーズがあった。

### データモデル

```
StpInvoice（請求書）
├── revenueRecords: StpRevenueRecord[] (1:N)  ← invoiceId で紐づき
└── expenseRecords: StpExpenseRecord[] (1:N)   ← invoiceId で紐づき
```

**ポイント**: Invoice → Record は1:Nの関係。1つの請求書に複数のレコードを紐づけできる（一括請求書）。個別生成の場合は1:1になる。

### グルーピングロジック

#### 売上（Revenue）: 企業×月

```typescript
// グループキー: stpCompanyId + targetMonth(YYYY-MM)
const groupKey = `${record.stpCompanyId}_${record.targetMonth?.slice(0, 7)}`;
```

- **表示**: アコーディオン形式で企業×月ごとにグループ化
- **グループヘッダー**: 月、企業コード+名、税込合計金額、レコード数、請求書ステータスサマリー
- **展開時**: グループ内の個別レコードをCrudTableで表示（企業・月カラムはヘッダーに表示済みのため省略）

#### 経費（Expenses）: 代理店×月

```typescript
// グループキー: agentId + targetMonth(YYYY-MM)
const groupKey = `${record.agentId}_${record.targetMonth?.slice(0, 7)}`;
```

- **表示**: アコーディオン形式で代理店×月ごとにグループ化
- **グループヘッダー**: 月、代理店名、税込合計金額、レコード数、ステータスサマリー

### 請求書生成

#### 一括生成（売上のみ）

```typescript
// createBatchInvoice(stpCompanyId, targetMonth)
// 同一企業×月の未請求（invoiceId = null）レコードを全て1つの請求書に紐づけ
async function createBatchInvoice(stpCompanyId: number, targetMonth: string) {
  // 1. 未請求レコードを取得
  const records = await prisma.stpRevenueRecord.findMany({
    where: { stpCompanyId, targetMonth, invoiceId: null, deletedAt: null }
  });
  // 2. 合計金額を税込で計算
  // 3. StpInvoice を作成（direction: "outgoing"）
  // 4. 全レコードの invoiceId を更新
}
```

**グループヘッダーの「一括請求書生成」ボタン**: 未請求レコードが1件以上ある場合のみ有効。

#### 個別生成（売上のみ）

```typescript
// createInvoiceFromRevenue(revenueId)
// 1レコード = 1請求書
async function createInvoiceFromRevenue(revenueId: number) {
  // 1. レコードの invoiceId が null であることを確認
  // 2. StpInvoice を作成
  // 3. レコードの invoiceId を更新
}
```

**各レコード行の「個別生成」ボタン**: invoiceId が null の場合のみ表示。

### 請求書削除時の処理

請求書を論理削除する際、紐づくレコードの `invoiceId` をクリアする:

```typescript
async function deleteInvoice(id: number) {
  // 紐づくレコードのinvoiceIdをクリア
  await prisma.stpRevenueRecord.updateMany({
    where: { invoiceId: id },
    data: { invoiceId: null },
  });
  await prisma.stpExpenseRecord.updateMany({
    where: { invoiceId: id },
    data: { invoiceId: null },
  });
  // 論理削除
  await prisma.stpInvoice.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
```

### UI構成

```
┌─ 売上管理 ───────────────────────────────────────────────┐
│  [すべて展開] [すべて閉じる]                              │
│                                                          │
│  ▼ 2026年1月 | ABC株式会社 (A001) | ¥500,000 | 3件      │
│    ┌──────────────────────────────────────────┐          │
│    │ CrudTable（企業・月カラムなし）          │          │
│    │ 各行に [個別生成] ボタン                  │          │
│    └──────────────────────────────────────────┘          │
│    [一括請求書生成] ← 未請求レコードがある場合のみ        │
│                                                          │
│  ▶ 2026年1月 | DEF株式会社 (D002) | ¥300,000 | 2件      │
│  ▶ 2026年2月 | ABC株式会社 (A001) | ¥450,000 | 2件      │
│                                                          │
│  ── 新規売上レコード追加 ──                               │
│  CrudTable（全カラム表示、追加専用）                      │
└──────────────────────────────────────────────────────────┘
```

### 関連ファイル

| ファイル | 役割 |
|---------|------|
| `src/app/stp/finance/revenue/revenue-table.tsx` | 売上グルーピングUI（企業×月アコーディオン） |
| `src/app/stp/finance/revenue/actions.ts` | 売上CRUD + 一括/個別請求書生成 |
| `src/app/stp/finance/revenue/page.tsx` | 売上データ取得（invoice含む） |
| `src/app/stp/finance/expenses/expenses-table.tsx` | 経費グルーピングUI（代理店×月アコーディオン） |
| `src/app/stp/finance/expenses/page.tsx` | 経費データ取得（invoice含む） |
| `src/app/stp/finance/invoices/actions.ts` | 請求書CRUD（削除時にlinkedレコードクリア） |
| `src/app/stp/finance/invoices/invoices-table.tsx` | 請求書一覧（紐づきレコード数表示） |
| `src/app/stp/finance/invoices/page.tsx` | 請求書データ取得（紐づきレコードカウント） |

### マイグレーション履歴

| マイグレーション | 内容 |
|----------------|------|
| `20260206141749_add_stp_invoices` | StpInvoice テーブル新規作成 |
| `20260207065741_restructure_invoice_to_one_to_many` | Invoice→Record関係を1:1→1:Nに変更（invoiceIdをRecord側に移動） |
