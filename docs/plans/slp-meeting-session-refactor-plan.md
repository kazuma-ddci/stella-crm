# SLP商談セッション再設計 — 実装計画書

**作成日**: 2026-04-17
**対象プロジェクト**: SLP（公的）プロジェクト
**対象機能**: 概要案内・導入希望商談の予約管理機能全面刷新

---

## 1. 背景・目的

### 現状の課題
- `SlpCompanyRecord` に `briefing_*`, `consultation_*` のフラットなカラムが直接乗っており、**1企業=1概要案内+1導入希望商談**という前提設計になっている
- 複数回の商談（2回目、3回目...）を記録する仕組みがない
- 過去の重複予約は `mergedBriefingReservationIds[]` という配列ハックで吸収していた

### 今回の目的
- 同一企業に対して**複数回の概要案内・導入希望商談**を記録・管理できるようにする
- 各商談を独立したセッションとして扱い、履歴・議事録・Zoom記録を正しく紐付ける
- スタッフ側で「ラウンド切替」UIを提供、ラウンドごとの新規/変更/キャンセル/完了を明確に管理
- 顧客側では「完了済み」表示のまま再予約導線を提供

---

## 2. 最終確定仕様（全論点の結論）

### 2.1 ラウンド番号の定義

- **ラウンド番号 = 完了回数 + 現在進行中（最大1つ）**
- キャンセル・飛び・論理削除は**ラウンド番号を消費しない**
- 同じラウンド番号に複数の試行が紐づく可能性がある（予約→キャンセル→再予約→完了）

### 2.2 ステータス（5種類）

| ステータス | 意味 |
|-----------|------|
| `未予約` | スタッフが起票した「次回予定」マーキング。日時・担当者・Zoom なし。自動遷移は一切なし |
| `予約中` | 日時・担当者・Zoom確定、実施待ち |
| `完了` | 実施済み |
| `キャンセル` | キャンセル済み |
| `飛び` | 当日お客様がZoomに参加しなかった |

#### 遷移規則

```
┌──────┐    ┌──────┐    ┌────┐
│未予約│───→│予約中│───→│完了│
└──────┘    └──────┘    └────┘
                │  ↑        │
                ├──┴─キャンセル
                │
                └── 飛び
```

- **完了→他ステータスへ戻す**はSLP編集権限者に許可、**変更理由必須**
- **次ラウンドが既に作成されている場合、それ以前のラウンドは変更不可**
- 論理削除はどのステータスからも可能

### 2.3 セッションのソース（2種類）

| source | 意味 |
|--------|------|
| `proline` | プロライン経由でお客様が予約したもの（既存フロー） |
| `manual` | スタッフがCRMから手動セットしたもの（新機能） |

### 2.4 飛び（no-show）の扱い

- キャンセルと同じ扱いで予約情報は履歴として残る
- **お客様側には飛び情報は一切表示しない**（再予約画面も通常通り）
- スタッフ側の企業詳細ページで「⚠️ 過去に飛びあり（N回）」警告バッジ表示
- 再予約はお客様のLINEからそのまま可能

### 2.5 重複予約の検知

- DB制約で強制排除はせず、プロラインの仕様上の重複発生を許容
- 同企業・同カテゴリで「予約中」セッションが2件以上ある場合、アプリで検知
- 企業一覧・詳細に「⚠️ 重複予約あり」バッジ表示（E-2採用）
- スタッフが片方を論理削除して整理

### 2.6 追加Zoom機能

- 1ラウンドに複数Zoom記録を紐付け可能（稀な運用）
- 利用シーン: Zoomが途中で切れて分割実施した場合など
- 追加・変更・削除可能
- 議事録紐付きZoomは日時変更時に警告表示

### 2.7 手動商談セット機能

- スタッフがCRMから直接商談セッションを作成できる
- 日時・担当者を入力 → Zoom自動発行 → LINE通知送信 → cronリマインド動作
- プロラインに予約データは作成されない
- お客様は**予約変更・キャンセルをLINEから操作不可**
- 対応: 通知文面と中継ページで「変更は公式LINEへ」と案内

### 2.8 通知仕様（最終）

#### お客様への通知

| タイミング | プロライン経由 | 手動セット |
|-----------|--------------|-----------|
| 予約確定通知 | ✅ 送信 | ✅ 送信（文面分岐） |
| リマインド（前日・当日） | ✅ 送信 | ✅ 送信（文面分岐） |
| 完了後お礼 | ✅ 送信 | ✅ 送信 |

#### 紹介者への通知

| ラウンド | プロライン経由 | 手動セット |
|---------|--------------|-----------|
| 概要案内1回目 | ✅ 自動通知 | ⚠️ 確認ダイアログ（チェックON時のみ） |
| 概要案内2回目以降 | ❌ 送信なし | ❌ 送信なし |
| 導入希望商談 | ❌ 送信なし | ❌ 送信なし |

### 2.9 通知form統合（プロライン側）

**新規作成 Form18: 概要案内_紹介者通知用**
- URL: `https://zcr5z7pk.autosns.app/fm/K4v2Yh7knG?uid=[[uid]]`
- フィールド: `form18-1: bodyText`
- 全トリガー（予約確定/変更/キャンセル/完了）で同じformを使用
- 本文テンプレートはCRM側管理

**廃止**: Form6, Form7, Form9, Form10（本番データなしのため即廃止）

### 2.10 編集権限

- SLPプロジェクトの編集権限を持つ全スタッフが、過去ラウンドの編集と完了→他ステータスへの戻しを実行可能
- 全操作で**変更理由の記載を必須**
- 編集履歴（誰がいつ何を何に変えたか）を全カラムで記録
- Zoom関連フィールド（meetingId/URL）は**原則編集不可**、ただし議事録紐付きラウンドには**別Zoomの追加**が可能
- 議事録紐付きラウンドの日時変更時は警告表示

### 2.11 KPI・月次締め

- 過去データの変更は自由（月次締め機能なし）
- 変更履歴で追跡のみ

---

## 3. データベース設計

### 3.1 新規テーブル

#### `SlpMeetingSession`（商談セッション）

```prisma
model SlpMeetingSession {
  id                    String    @id @default(cuid())
  companyRecordId       String
  companyRecord         SlpCompanyRecord @relation(fields: [companyRecordId], references: [id])

  category              String    // "briefing" | "consultation"
  roundNumber           Int
  status                String    // "未予約" | "予約中" | "完了" | "キャンセル" | "飛び"
  source                String    // "proline" | "manual"

  scheduledAt           DateTime?
  assignedStaffId       String?
  assignedStaff         Staff?    @relation("SlpSessionAssignedStaff", fields: [assignedStaffId], references: [id])

  prolineReservationId  String?   // プロライン予約ID（webhook紐付け、manual時はnull）

  completedAt           DateTime?
  cancelledAt           DateTime?
  noShowAt              DateTime?
  cancelReason          String?
  noShowReason          String?

  notes                 String?

  createdByStaffId      String?
  createdByStaff        Staff?    @relation("SlpSessionCreatedBy", fields: [createdByStaffId], references: [id])

  zoomRecords           SlpMeetingSessionZoom[]
  histories             SlpMeetingSessionHistory[]
  reservationHistories  SlpReservationHistory[]
  zoomSendLogs          SlpZoomSendLog[]

  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  deletedAt             DateTime?

  @@index([companyRecordId, category, roundNumber])
  @@index([companyRecordId, category, status])
  @@index([prolineReservationId])
  @@map("slp_meeting_sessions")
}
```

#### `SlpMeetingSessionZoom`（Zoom記録 — 1セッションに複数可）

```prisma
model SlpMeetingSessionZoom {
  id              String    @id @default(cuid())
  sessionId       String
  session         SlpMeetingSession @relation(fields: [sessionId], references: [id])

  zoomMeetingId   String
  joinUrl         String
  startUrl        String?
  scheduledAt     DateTime?

  isPrimary       Boolean   @default(true)  // false = 追加Zoom
  label           String?   // 例: "延長分", "再実施" など

  recordings      SlpZoomRecording[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  deletedAt       DateTime?

  @@index([sessionId])
  @@index([zoomMeetingId])
  @@map("slp_meeting_session_zooms")
}
```

#### `SlpMeetingSessionHistory`（編集履歴）

```prisma
model SlpMeetingSessionHistory {
  id                String    @id @default(cuid())
  sessionId         String
  session           SlpMeetingSession @relation(fields: [sessionId], references: [id])

  changedByStaffId  String?
  changedByStaff    Staff?    @relation(fields: [changedByStaffId], references: [id])

  changeType        String    // "created" | "field_edit" | "status_change" | "deleted" | "restored"
  fieldName         String?
  oldValue          String?
  newValue          String?
  reason            String?   // 変更理由（status_change時は必須）

  changedAt         DateTime  @default(now())

  @@index([sessionId, changedAt])
  @@map("slp_meeting_session_histories")
}
```

#### `SlpNotificationTemplate`（通知テンプレート統合テーブル）

```prisma
model SlpNotificationTemplate {
  id           String    @id @default(cuid())

  recipient    String    // "customer" | "referrer"
  category     String    // "briefing" | "consultation"
  roundType    String?   // "first" | "continuous"（referrerの場合はnull）
  source       String?   // "proline" | "manual"（referrerの場合はnull）
  trigger      String    // "confirm" | "change" | "cancel" | "complete" | "remind_day_before" | "remind_hour_before"

  formId       String    // "form16" | "form17" | "form18" | "form11" | "form13"
  body         String    @db.Text
  isActive     Boolean   @default(true)

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([recipient, category, roundType, source, trigger])
  @@map("slp_notification_templates")
}
```

### 3.2 既存テーブル変更

#### `SlpReservationHistory`
- `sessionId String?` を追加
- `roundNumber Int?` を追加
- 既存 `companyRecordId`, `actionType` は維持

#### `SlpZoomSendLog`
- `sessionId String?` を追加
- 既存 `category`, `trigger` は維持

#### `SlpZoomRecording`
- `sessionZoomId String?` を追加（どのZoom記録の録画か）

#### `SlpCompanyRecord` — カラム削除
- `briefing_status`, `briefing_date`, `briefing_staff_id`, `briefing_zoom_meeting_id`, `briefing_*` 全般を削除
- `consultation_*` 全般を削除
- `mergedBriefingReservationIds`, `mergedConsultationReservationIds` を削除

### 3.3 既存テーブル廃止

#### `SlpZoomMessageTemplate`
- `SlpNotificationTemplate` への移行後、削除

### 3.4 マイグレーション戦略

本番データがないため、以下の順で実行:

1. 新規テーブル作成（`SlpMeetingSession`, `SlpMeetingSessionZoom`, `SlpMeetingSessionHistory`, `SlpNotificationTemplate`）
2. 既存テーブルにカラム追加（`SlpReservationHistory.sessionId` など）
3. 旧カラム削除（`SlpCompanyRecord.briefing_*` など）
4. 旧テーブル削除（`SlpZoomMessageTemplate`）
5. シード: `SlpNotificationTemplate` にデフォルトテンプレートを投入

---

## 4. 業務ロジック

### 4.1 ラウンド番号の自動付与

新規セッション作成時:
```
currentRound = 完了したセッションの最大 roundNumber
hasActiveSession = 同category内に "予約中" or "未予約" セッションがあるか
newRoundNumber = hasActiveSession ? currentRound + 1 : currentRound + 1
```

補足: キャンセル・飛びのセッションは「試行」として既存ラウンド番号に紐付けて追加する。新規セッション作成時は下記のロジック:

```
完了セッションの最大 roundNumber を N とする
- 同ラウンド（N+1）で「試行中」（未予約・予約中）のセッションがある
  → エラー（並列不可ルール）。ただし重複検知モードでは許容
- ない
  → roundNumber = N + 1 で新規作成
```

### 4.2 並列予約禁止ルール

- 同じ企業・同じカテゴリで `status IN ('未予約', '予約中')` のセッションが同時に存在しないことが原則
- ただしプロラインwebhookの重複発生を許容するため、DB制約ではなくアプリロジックで警告
- 検知: 企業詳細ページを開いた際、該当企業で上記状態が2件以上あれば「⚠️ 重複予約あり」バッジ表示

### 4.3 プロラインwebhook処理

お客様がプロラインで予約した際のwebhook受信処理:

```
1. webhookで受け取った companyRecordId, category, 予約日時, prolineReservationId を取得
2. 同company・同categoryで status="未予約" のセッションを検索
   ├─ 存在する（最新1件）:
   │    そのセッションを更新
   │      - status = "予約中"
   │      - source = "proline"（未予約時点では manual だったが、プロライン予約が入ったのでproline扱い）
   │      - scheduledAt = webhook日時
   │      - prolineReservationId = webhook値
   │      - 編集履歴を記録
   │
   └─ 存在しない:
        新規セッションを作成
          - status = "予約中"
          - source = "proline"
          - roundNumber = (完了セッション最大 + 1)
3. Zoom自動発行
4. お客様へLINE通知（customer × category × roundType × proline × confirm テンプレート使用）
5. 1回目かつ概要案内の場合、紹介者へLINE通知（referrer × briefing × confirm テンプレート、Form18）
```

### 4.4 手動セット処理

スタッフがCRMで手動セット:

```
1. UI入力: 日時、担当者、メモ、紹介者通知チェックボックス（1回目のみ表示）
2. セッション作成
   - status = "予約中"
   - source = "manual"
   - scheduledAt, assignedStaffId 入力値
   - roundNumber = (完了セッション最大 + 1)
3. Zoom自動発行
4. お客様へLINE通知（customer × category × roundType × manual × confirm テンプレート使用）
5. 1回目かつ概要案内かつチェックONの場合、紹介者へLINE通知
```

### 4.5 未予約起票 → 予約中遷移

```
未予約起票:
  - status = "未予約"
  - source = "manual"
  - scheduledAt, assignedStaffId は null
  - 通知は一切送信しない

予約中への遷移（スタッフが日時入力して切り替え）:
  - status = "予約中"
  - source は "manual" のまま
  - scheduledAt, assignedStaffId 設定
  - Zoom発行、通知送信（手動セット扱い）
```

### 4.6 ラウンド変更時のロック

```
現在の最大 roundNumber を N とする
編集対象セッションの roundNumber を M とする

- M < N（既に次ラウンドが開始されている）:
  → 完了→他ステータスへの変更は拒否
  → フィールド編集は可能（履歴記録付き）
- M == N（現在進行中 or 最新完了）:
  → 全操作可能
```

### 4.7 飛び処理

```
1. スタッフが「飛び」ボタンを押下（変更理由入力必須）
2. status = "飛び"、noShowAt = now()
3. 編集履歴記録
4. その後の新規予約時:
   - 同じラウンド番号で新規セッション作成可能（キャンセルと同じ扱い）
5. 企業詳細ページに「⚠️ 過去に飛びあり（N回）」バッジ表示
   - N = そのcompany・全category・全ラウンドの "飛び" ステータスセッション数
```

### 4.8 論理削除

```
- deletedAt をセット
- 画面上は完全非表示（C-1採用）
- Zoom URL、議事録は残す（参照されないだけ）
- ラウンド番号を消費しない（次のセッション作成時に考慮されない）
- 編集履歴に changeType = "deleted" を記録
```

---

## 5. UI設計

### 5.1 スタッフ側：企業詳細ページ（`/slp/companies/[id]`）

```
┌─────────────────────────────────────────────────────┐
│ 株式会社A の商談管理                                │
│ ⚠️ 過去に飛びあり（1回）                           │
│ ⚠️ 重複予約あり（要整理）                          │
├─────────────────────────────────────────────────────┤
│ 【概要案内】                                        │
│ 表示中ラウンド: [第2回（予約中）▼]                  │
│   選択肢: 第1回（完了）／ 第2回（予約中）           │
│                                                     │
│ [+ 新ラウンド追加 ▼]                                │
│   ├ 手動で予約中として作成                          │
│   └ 未予約として起票                                │
│                                                     │
│  ┌─ 第2回 詳細 ─────────────────────────────────┐   │
│  │ ステータス: 予約中 [ステータス変更]          │   │
│  │ 日時: 2026-04-25 14:00 [編集]                │   │
│  │ 担当: 田中 [編集]                            │   │
│  │ ソース: 手動セット                           │   │
│  │                                              │   │
│  │ Zoom記録:                                    │   │
│  │  ・Zoom #1 (メイン): 4/25 14:00 - [URL]      │   │
│  │  ・[+ Zoom追加]                              │   │
│  │                                              │   │
│  │ メモ: [編集可]                               │   │
│  │                                              │   │
│  │ [変更履歴を見る] [論理削除]                  │   │
│  └──────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────┤
│ 【導入希望商談】                                    │
│ （同様の構造）                                      │
└─────────────────────────────────────────────────────┘
```

#### ステータス変更モーダル

```
┌─ ステータス変更 ─────────────────┐
│ 現在: 予約中                     │
│ 変更先:                          │
│   ○ 完了                        │
│   ○ キャンセル                  │
│   ○ 飛び                        │
│                                  │
│ 変更理由（必須）:                │
│ [テキストエリア]                 │
│                                  │
│   [キャンセル] [変更する]       │
└──────────────────────────────────┘
```

#### 手動セット（予約中として作成）モーダル

```
┌─ 手動で商談をセット ─────────────┐
│ カテゴリ: 概要案内（第1回）      │
│ 日時: [DatePicker]               │
│ 担当者: [Select]                 │
│ メモ: [テキストエリア]           │
│                                  │
│ [✓] 紹介者にも予約通知を送信する│
│     （1回目の場合のみ表示）      │
│                                  │
│ ※この予約はお客様側のLINEから   │
│   変更・キャンセルできません。  │
│   変更依頼は公式LINEへ誘導されます│
│                                  │
│   [キャンセル] [セットする]     │
└──────────────────────────────────┘
```

#### 未予約として起票モーダル

```
┌─ 次回商談を起票（未予約）────────┐
│ カテゴリ: 概要案内（第N回）     │
│ メモ: [テキストエリア]           │
│                                  │
│ ※このセッションはスタッフ管理用│
│   お客様への通知は送信されません│
│                                  │
│   [キャンセル] [起票する]       │
└──────────────────────────────────┘
```

### 5.2 顧客側：中継ページ

```
現在の予約状況:

株式会社A
 ・概要案内: 予約中（2026-04-25 14:00）
   [変更する]
     ├─ プロライン経由予約:
     │   → プロライン変更ページへ遷移
     └─ 手動セット予約:
         → 「この予約の変更はこちらではできません。
            公式LINEから直接ご連絡ください」表示
 ・導入希望商談: 未実施
   [予約する]

株式会社B
 ・概要案内: 実施済
   [追加で予約する]
 ・導入希望商談: 予約中
   ...
```

**ポイント**:
- 「第N回」とラウンド番号は顧客側に**一切表示しない**
- 「実施済」と表示しつつ、追加予約が可能
- 予約中のセッションがある場合は新規予約ボタンを無効化

### 5.3 Zoom通知メッセージ設定画面（`/slp/settings/notification-templates`）

新規画面として `SlpNotificationTemplate` を管理:

```
【通知テンプレート設定】

タブ構成:
 ├─ お客様への通知
 │    ├─ 概要案内
 │    │    ├─ 1回目（プロライン経由）
 │    │    │    ├─ 予約確定
 │    │    │    ├─ 予約変更
 │    │    │    ├─ キャンセル
 │    │    │    ├─ リマインド前日
 │    │    │    └─ リマインド当日
 │    │    ├─ 1回目（手動セット）
 │    │    │    └─ ...（同じトリガー）
 │    │    ├─ 2回目以降（プロライン経由）
 │    │    └─ 2回目以降（手動セット）
 │    └─ 導入希望商談
 │         └─ 同じ構造
 ├─ 紹介者への通知（概要案内1回目のみ）
 │    ├─ 予約確定（Form18）
 │    ├─ 予約変更（Form18）
 │    ├─ キャンセル（Form18）
 │    └─ 完了（Form18）
 └─ 完了お礼メッセージ
      ├─ 概要案内（1回目／2回目以降）
      └─ 導入希望商談（1回目／2回目以降）
```

各テンプレートは:
- 変数挿入: `{{companyName}}`, `{{scheduledAt}}`, `{{zoomUrl}}`, `{{staffName}}` 等
- プレビュー機能
- isActive のオン/オフ切替

---

## 6. API・Server Action設計

### 6.1 セッションCRUD（`src/app/slp/companies/[id]/session-actions.ts`）

```typescript
// セッション作成（手動セット：予約中）
createManualSession({
  companyRecordId,
  category,
  scheduledAt,
  assignedStaffId,
  notes,
  notifyReferrer: boolean  // 1回目のみ有効
}): Promise<Result<SessionDetail>>

// セッション作成（未予約）
createPendingSession({
  companyRecordId,
  category,
  notes
}): Promise<Result<SessionDetail>>

// ステータス変更
changeSessionStatus({
  sessionId,
  newStatus: "予約中" | "完了" | "キャンセル" | "飛び",
  reason: string  // 必須
}): Promise<Result<SessionDetail>>

// 未予約→予約中への昇格
promotePendingToReserved({
  sessionId,
  scheduledAt,
  assignedStaffId,
  notifyReferrer: boolean
}): Promise<Result<SessionDetail>>

// フィールド編集
updateSessionFields({
  sessionId,
  fields: Partial<{ scheduledAt, assignedStaffId, notes, ... }>,
  reason: string  // 必須
}): Promise<Result<SessionDetail>>

// 論理削除
softDeleteSession({ sessionId, reason }): Promise<Result>

// Zoom追加
addSessionZoom({
  sessionId,
  zoomMeetingId?,  // 指定なしなら自動発行
  scheduledAt,
  label?
}): Promise<Result<SessionZoomDetail>>

// 編集履歴取得
getSessionHistory({ sessionId }): Promise<Result<SessionHistory[]>>

// 企業のセッション一覧（ラウンド切替用）
listSessionsForCompany({
  companyRecordId,
  category
}): Promise<Result<SessionSummary[]>>
```

### 6.2 プロラインwebhook処理（`src/app/api/public/slp/briefing-reservation/route.ts` 等）

既存を改修:
```typescript
async function handleProlineReservation({ companyRecordId, category, scheduledAt, prolineReservationId }) {
  const existingPending = await findPendingSession(companyRecordId, category);
  if (existingPending) {
    // 未予約→予約中へ遷移
    return await promotePendingToReserved({ ... });
  } else {
    // 新規予約セッション作成
    return await createProlineSession({ ... });
  }
}
```

### 6.3 通知送信ロジック（`src/lib/slp-notification.ts` 新規）

```typescript
// 統合通知送信
async function sendNotification({
  sessionId,
  trigger: "confirm" | "change" | "cancel" | "complete" | "remind_day_before" | "remind_hour_before",
  recipient: "customer" | "referrer"
}): Promise<void> {
  // 1. セッション情報取得
  // 2. roundType = (roundNumber === 1 ? "first" : "continuous")
  // 3. 該当テンプレート検索 (recipient, category, roundType, source, trigger)
  // 4. 本文レンダリング（変数展開）
  // 5. formId に応じた送信API呼び出し（Form16/17/18/11/13）
  // 6. SlpZoomSendLog に記録
}
```

### 6.4 重複検知

```typescript
// 企業詳細ページ開いた時にチェック
async function detectDuplicateSessions(companyRecordId: string) {
  const activeSessions = await prisma.slpMeetingSession.groupBy({
    by: ['category'],
    where: {
      companyRecordId,
      status: { in: ['未予約', '予約中'] },
      deletedAt: null
    },
    _count: true
  });
  return activeSessions.filter(s => s._count > 1);
}
```

---

## 7. プロラインform定数更新（`src/lib/proline-form.ts`）

### 追加
```typescript
export const PROLINE_FORM18_BRIEFING_REFERRER_NOTICE = {
  url: "https://zcr5z7pk.autosns.app/fm/K4v2Yh7knG",
  fields: {
    bodyText: "form18-1"
  }
} as const;
```

### 削除
- `PROLINE_FORM6_BRIEFING_RESERVATION`
- `PROLINE_FORM7_BRIEFING_CHANGE`
- `PROLINE_FORM9_BRIEFING_CANCEL`
- `PROLINE_FORM10_BRIEFING_COMPLETE`

### 呼び出し側の修正
- `submitForm6BriefingReservation` → `submitForm18ReferrerNotification` に変更
- Server Actions / webhook 呼び出し箇所をすべて更新

---

## 8. 実装順序（Phase詳細）

### Phase 1: データ基盤

**対象ファイル**:
- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_slp_meeting_session/migration.sql`
- `src/app/slp/companies/[id]/session-actions.ts` (新規)
- `src/lib/slp-session.ts` (新規：ロジックヘルパー)
- `src/lib/proline-form.ts` (Form18追加、6/7/9/10削除)
- `src/app/slp/companies/actions.ts` (既存呼び出し箇所の修正)
- `src/app/api/public/slp/*` (webhook修正)

**手順**:
1. ファイルロック取得（schema.prisma は特別扱い、全他セッション完了待ち）
2. Prismaスキーマ変更
3. マイグレーション手動作成（`prisma migrate dev` はDockerでインタラクティブ不可のため）
4. マイグレーション適用（4ステップ全実行）
5. セッションCRUD Server Action実装
6. Form18定数追加、旧form定数削除
7. 旧form呼び出し箇所の修正（`submitForm18ReferrerNotification` に置換）
8. 型チェック
9. ロック解放

### Phase 2: スタッフ側UI刷新

**対象ファイル**:
- `src/app/slp/companies/[id]/page.tsx`
- `src/app/slp/companies/[id]/components/*` (新規複数)
  - `MeetingSessionsBlock.tsx`
  - `RoundSelector.tsx`
  - `SessionDetail.tsx`
  - `StatusChangeModal.tsx`
  - `ManualSetModal.tsx`
  - `PendingCreateModal.tsx`
  - `AddZoomModal.tsx`
  - `SessionHistoryModal.tsx`
- `src/app/slp/companies/page.tsx` (企業一覧の表示変更)
- `src/app/slp/companies/companies-table.tsx` (バッジ表示追加)

**手順**:
1. ファイルロック取得
2. 企業詳細ページのブロック構成を刷新
3. ラウンド切替プルダウン実装
4. 各モーダル実装
5. 飛び警告バッジ、重複予約バッジ
6. 企業一覧への反映
7. E2Eテスト（Dockerブラウザ経由）
8. ロック解放

### Phase 3: 通知系

**対象ファイル**:
- `src/app/slp/settings/notification-templates/page.tsx` (新規)
- `src/app/slp/settings/notification-templates/actions.ts` (新規)
- `src/app/slp/settings/notification-templates/components/*` (新規)
- `src/lib/slp-notification.ts` (新規：統合送信ロジック)
- `src/app/api/cron/slp-zoom-reminders/route.ts` (セッション対応)
- `src/app/api/public/slp/briefing-reservation/route.ts` (未予約→予約中遷移)
- `src/app/api/public/slp/briefing-change/route.ts`
- `src/app/api/public/slp/briefing-cancel/route.ts`
- `src/app/slp/settings/zoom-templates/*` (既存画面の削除 or 移行)

**手順**:
1. ファイルロック取得
2. `SlpNotificationTemplate` デフォルトシード作成
3. 設定画面実装（タブ構成、テンプレート編集、プレビュー）
4. 統合通知送信ロジック実装
5. webhook処理の未予約→予約中遷移対応
6. cronリマインドのセッション対応
7. 既存 `SlpZoomMessageTemplate` 画面の削除
8. 動作確認
9. ロック解放

### Phase 4: 顧客側中継ページ

**対象ファイル**:
- `src/app/slp/public/reserve/briefing/page.tsx`
- `src/app/slp/public/reserve/consultation/page.tsx`
- `src/app/slp/public/reserve/components/*`

**手順**:
1. ファイルロック取得
2. 予約中表示ロジックの刷新（セッションベース）
3. プロライン経由/手動セットでの変更動線分岐
4. 「追加で予約する」動線実装
5. 動作確認
6. ロック解放

---

## 9. ファイルロック戦略

### Phase 1
- **schema.prisma**: CLAUDE.md規定により他セッション完了を待つ（ステータス監視）
- セッション関連の新規ファイルは競合リスク低い

### Phase 2以降
- 企業詳細ページ関連ファイルは他機能（契約、契約履歴等）との共存を確認
- 競合発生時はenqueue/waitで対応

---

## 10. リスクと対策

| # | リスク | 対策 |
|---|--------|------|
| 1 | 既存 `SlpCompanyRecord.briefing_*` を参照しているコード箇所の見落とし | grep網羅的調査 + 型チェック + ローカル起動確認 |
| 2 | プロラインwebhook仕様とセッションロジックの噛み合わせミス | 未予約→予約中遷移のユニットテスト、手動E2Eテスト |
| 3 | 通知テンプレートのデフォルトシード不足 | 全パターン網羅的にシード作成（32パターン以上） |
| 4 | Zoom議事録の `zoom_meeting_id` 紐付けが壊れる | `SlpZoomRecording.sessionZoomId` で正しく紐付け、既存データ確認（本番にデータなしのため影響小） |
| 5 | 紹介者通知チェックボックスの判定漏れ（1回目判定） | `roundNumber === 1` + `category === "briefing"` を厳密化 |
| 6 | 重複検知バッジの誤検知 | `status IN ('未予約','予約中')` かつ `deletedAt IS NULL` で絞り込み |
| 7 | 編集履歴の記録漏れ | 全Server Actionで `recordHistory()` ヘルパー経由に統一 |

---

## 11. ユーザー側で必要な準備作業

### プロライン側
1. **Form18（概要案内_紹介者通知用）**: ✅ 作成済み
   - URL: `https://zcr5z7pk.autosns.app/fm/K4v2Yh7knG?uid=[[uid]]`
   - フィールド: `form18-1`
   - 自動応答: 回答内容（bodyText）をそのままLINE送信する設定 ※要確認
2. **Form6, 7, 9, 10**: プロライン側で削除（任意、CRM側からは呼ばれなくなる）

### CRM側の初期データ
- Phase 3で `SlpNotificationTemplate` のデフォルトテンプレートを管理画面経由で入力

---

## 12. 検証方針

### Phase完了時の検証項目

#### Phase 1
- [ ] Prismaマイグレーション成功
- [ ] `tsc --noEmit` 型エラーゼロ
- [ ] セッション作成・更新・削除のServer Actionが動作
- [ ] 旧 `briefing_*` カラム参照箇所が全て置換されている

#### Phase 2
- [ ] 企業詳細ページでラウンド切替が動作
- [ ] 手動セット→Zoom発行→通知送信が動作
- [ ] 未予約起票→予約中遷移が動作
- [ ] ステータス変更（理由必須）、論理削除、編集履歴が動作
- [ ] 飛び警告バッジ、重複予約バッジが正しく表示

#### Phase 3
- [ ] 通知テンプレート設定画面で全パターン編集可能
- [ ] プロラインwebhook経由の予約で未予約→予約中遷移
- [ ] cronリマインドが正しいテンプレートで送信される
- [ ] 紹介者通知チェックボックスの挙動

#### Phase 4
- [ ] 顧客側中継ページで「完了済み＋追加予約」動線が動作
- [ ] プロライン経由/手動セットで変更動線が分岐
- [ ] 予約中時の新規予約ボタン無効化

---

## 13. 備考

- 本計画書は着手前の設計書。実装中に新たな論点が発生した場合、ユーザーと協議の上で本計画書を更新する
- 本番データがないため、データ移行（バックフィル）作業は不要
- `admin/setup-status` へのチェック項目追加は Phase 3 で検討（新マスターデータ追加がないため不要の可能性高い）
