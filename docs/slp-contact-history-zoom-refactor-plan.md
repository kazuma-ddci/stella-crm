# SLP 接触履歴×Zoom 再設計 — 実装計画書

**作成日**: 2026-04-17
**対象**: SLP（公的制度教育推進協会）プロジェクト
**目的**: 1つの接触履歴に複数のZoom情報を紐付け可能にする、および手動Zoom URL追加機能の提供

---

## 1. 背景・目的

### 現状の課題

**①「商談1つにつき接触履歴が商談中のZoom数だけ増える」問題**

- 現状: 商談（Session）→ SessionZoom（Zoom情報）→ ZoomRecording（議事録データ）→ ContactHistory（接触履歴）が **1:1:1:1** で連結
- Zoom途中で切れて再開した場合、SessionZoom が2件→それぞれ別 ContactHistory が作成され、**1つの商談に対して接触履歴が2つ**できてしまう

**②「手動でZoom URLを追加できない」問題**

- 現状、議事録取得はプロライン経由で作成された商談の自動Webhookからしか発動しない
- プロライン経由でない単発Zoomや、後から思い出した過去Zoomの議事録を取り込めない
- また、途中で切れて再開した追加Zoomを既存の接触履歴に紐付けて取り込む手段がない

### 今回の目的

- **1つの接触履歴に複数のZoom情報を紐付けられる**ようにする（`1:N`）
- 接触履歴画面から**手動でZoom URLを追加**して議事録取得できるようにする
- Zoom情報に「**予定**」ステータスを追加し、未実施Zoomも先行登録可能にする
- 複数議事録は区切り線付きで接触履歴の議事録欄に**追記統合**する

---

## 2. 現状と新構造の比較

### 現状（別セッションで直近にリファクタ完了した構造）

```
①SlpMeetingSession (商談)
    ↓ 1:N
②SlpMeetingSessionZoom (Zoom URL情報)
    ↓ 1:1 (zoomMeetingId UNIQUE、実質)
③SlpZoomRecording (議事録・録画データ)
    ↓ 1:1 (contactHistoryId UNIQUE)
④SlpContactHistory (接触履歴、sessionIdで任意紐付け)
```

**問題点**:
- ContactHistory:ZoomRecording が 1:1 → 分割実施時に ContactHistory が増殖
- SessionZoom と ZoomRecording の二段構造により情報が二箇所に分散

### 新構造（今回の目標）

```
①SlpMeetingSession (商談)
    ↓ 1:1 (任意紐付け、sessionIdはContactHistory側)
②SlpContactHistory (接触履歴)
    ↓ 1:N  ★ここが変わる
③SlpZoomRecording (Zoom URL + 議事録・録画データ統合)
    ├ joinUrl  ★ここに集約
    ├ zoomMeetingId
    ├ state (予定 / 完了 / 失敗)
    ├ 議事録データ、録画、参加者、チャット等
    └ ...
```

**②SlpMeetingSessionZoom は廃止**し、必要フィールド（`joinUrl` / `isPrimary` / `label` / `scheduledAt` 等）を `SlpZoomRecording` に統合する。

---

## 3. データベース設計

### 3.1 `SlpZoomRecording` へのカラム追加

```prisma
model SlpZoomRecording {
  id                          Int       @id @default(autoincrement())
  contactHistoryId            Int       @map("contact_history_id") // ★ UNIQUE削除
  zoomMeetingId               BigInt    @unique @map("zoom_meeting_id")
  zoomMeetingUuid             String?   @db.VarChar(200)
  category                    String    @db.VarChar(30)
  hostStaffId                 Int?      @map("host_staff_id")

  // ================================================
  // ★新規追加（旧 SlpMeetingSessionZoom から移行）
  // ================================================
  joinUrl                     String    @map("join_url") @db.VarChar(1000)
  startUrl                    String?   @map("start_url") @db.VarChar(2000)
  password                    String?   @db.VarChar(100)
  scheduledAt                 DateTime? @map("scheduled_at")
  isPrimary                   Boolean   @default(true) @map("is_primary")
  label                       String?   @db.VarChar(100) // "延長分", "再実施" 等
  state                       String    @default("予定") @map("state") @db.VarChar(20) // "予定" | "取得中" | "完了" | "失敗"
  confirmSentAt               DateTime? @map("confirm_sent_at")
  remindDaySentAt             DateTime? @map("remind_day_sent_at")
  remindHourSentAt            DateTime? @map("remind_hour_sent_at")
  zoomApiError                String?   @map("zoom_api_error") @db.Text
  zoomApiErrorAt              DateTime? @map("zoom_api_error_at")

  // ================================================
  // 既存（そのまま）
  // ================================================
  recordingStartAt            DateTime? @map("recording_start_at")
  recordingEndAt              DateTime? @map("recording_end_at")
  mp4Path                     String?   @db.VarChar(1000)
  mp4SizeBytes                BigInt?
  transcriptPath              String?   @db.VarChar(1000)
  transcriptText              String?   @db.Text
  aiCompanionSummary          String?   @db.Text
  aiCompanionFetchedAt        DateTime?
  summaryNextSteps            String?   @db.Text
  chatLogPath                 String?   @db.VarChar(1000)
  chatLogText                 String?   @db.Text
  chatFetchedAt               DateTime?
  participantsJson            String?   @db.Text
  participantsFetchedAt       DateTime?
  claudeSummary               String?   @db.Text
  claudeSummaryGeneratedAt    DateTime?
  claudeSummaryPromptSnapshot String?   @db.Text
  claudeSummaryModel          String?   @db.VarChar(80)
  participantsExtracted       String?   @db.Text
  downloadStatus              String    @default("pending") @db.VarChar(30)
  downloadError               String?   @db.Text
  zoomCloudDeletedAt          DateTime?

  createdAt                   DateTime  @default(now())
  updatedAt                   DateTime  @updatedAt
  deletedAt                   DateTime? @map("deleted_at") // ★新規（SessionZoomから移行）

  contactHistory SlpContactHistory  @relation(fields: [contactHistoryId], references: [id], onDelete: Cascade)
  hostStaff      MasterStaff?       @relation("SlpZoomRecordingHost", fields: [hostStaffId], references: [id])
  // sessionZoom 関連は削除

  @@index([contactHistoryId])    // ★新規（UNIQUE削除の代替）
  @@index([zoomMeetingId])       // 既存
  @@index([state])               // ★新規（予定フィルタ用）
  @@index([downloadStatus])      // 既存
  @@index([createdAt])           // 既存
  @@map("slp_zoom_recordings")
}
```

### 3.2 `SlpMeetingSessionZoom` 廃止

- テーブルごと削除
- リレーション `SlpMeetingSession.zoomRecords` → `SlpMeetingSession.contactHistory.zoomRecordings` 経由にする
- UIで参照しているコードはすべて書き換え

### 3.3 `SlpMeetingSession` のリレーション変更

```prisma
model SlpMeetingSession {
  // ... 既存フィールド ...

  // ★ 変更前
  // zoomRecords SlpMeetingSessionZoom[]

  // ★ 変更後
  contactHistory SlpContactHistory? @relation("SlpMeetingSessionContactHistory")
  // ContactHistory.sessionId で紐付く（既存FK）
}
```

### 3.4 `state` 列挙値の定義

Zoom 情報の状態を表す文字列:

| 値 | 意味 | UI表示 |
|---|------|-------|
| `予定` | URLは登録済み、まだ議事録取得を試していない or 未実施 | 🕐 灰色バッジ |
| `取得中` | Zoom API呼び出し中（短時間の中間状態） | ⏳ スピナー |
| `完了` | 議事録・録画取得済み | ✅ 緑バッジ |
| `失敗` | API試行したがエラー（再取得可能） | ⚠️ 赤バッジ＋再取得ボタン |

**注**: 既存の `downloadStatus` は録画ファイル DL の内部状態なので残す。`state` はユーザー視点での上位ステータス。

### 3.5 `SlpContactHistory` のリレーション変更

```prisma
model SlpContactHistory {
  // ... 既存 ...

  // ★ 変更前
  // zoomRecording SlpZoomRecording?

  // ★ 変更後
  zoomRecordings SlpZoomRecording[]  // 1:N
}
```

---

## 4. マイグレーション戦略

本番データなし（ユーザー確認済み）のため、データ保全マイグレーションは不要。

### マイグレーションファイル（順番に実行）

**`20260418xxxxxx_zoom_recording_absorbs_session_zoom`**:

```sql
-- 1. SlpMeetingSessionZoom のカラムを SlpZoomRecording に追加
ALTER TABLE "slp_zoom_recordings"
  ADD COLUMN "join_url" VARCHAR(1000) NOT NULL DEFAULT '',
  ADD COLUMN "start_url" VARCHAR(2000),
  ADD COLUMN "password" VARCHAR(100),
  ADD COLUMN "scheduled_at" TIMESTAMP(3),
  ADD COLUMN "is_primary" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "label" VARCHAR(100),
  ADD COLUMN "state" VARCHAR(20) NOT NULL DEFAULT '予定',
  ADD COLUMN "confirm_sent_at" TIMESTAMP(3),
  ADD COLUMN "remind_day_sent_at" TIMESTAMP(3),
  ADD COLUMN "remind_hour_sent_at" TIMESTAMP(3),
  ADD COLUMN "zoom_api_error" TEXT,
  ADD COLUMN "zoom_api_error_at" TIMESTAMP(3),
  ADD COLUMN "deleted_at" TIMESTAMP(3);

-- 2. contactHistoryId UNIQUE 制約削除
ALTER TABLE "slp_zoom_recordings"
  DROP CONSTRAINT "slp_zoom_recordings_contact_history_id_key";

-- 3. 新インデックス追加
CREATE INDEX "slp_zoom_recordings_contact_history_id_idx"
  ON "slp_zoom_recordings"("contact_history_id");
CREATE INDEX "slp_zoom_recordings_state_idx"
  ON "slp_zoom_recordings"("state");

-- 4. sessionZoomId カラム削除（SessionZoom廃止のため）
ALTER TABLE "slp_zoom_recordings"
  DROP COLUMN "session_zoom_id";

-- 5. SlpMeetingSessionZoom テーブル削除
DROP TABLE "slp_meeting_session_zooms";
```

注:
- `join_url` を `NOT NULL DEFAULT ''` で作るのは、既存データ（あれば）を壊さないため。手動 INSERT 時は必ず URL を入れる運用
- `sessionZoomId` のカラム削除は FK 削除も含む

### 適用手順

CLAUDE.md の Prisma 手順通り:

```bash
docker compose exec app npx prisma migrate deploy
npx prisma generate
docker compose exec app npx prisma generate
docker compose restart app
```

---

## 5. 自動フロー改修（プロライン連携）

### 5.1 プロライン予約時の流れ

#### 変更前
```
プロラインwebhook → Session 作成
                  → SessionZoom 作成（joinUrl自動発行）
                  → お客様に LINE 通知
→ Zoom完了 webhook → SessionZoom を meeting_id で検索
                  → ContactHistory 新規作成 + ZoomRecording 作成（議事録データ）
```

#### 変更後
```
プロラインwebhook → Session 作成
                  → ContactHistory 同時作成（sessionId紐付き）
                  → ZoomRecording 作成（isPrimary=true, state=予定, joinUrl 自動発行）
                  → お客様に LINE 通知（URL は ZoomRecording.joinUrl から取得）
→ Zoom完了 webhook → ZoomRecording を meeting_id で検索
                  → 該当あり → そのレコードに議事録データを埋める（state=予定→完了）
                  → 該当なし → ContactHistory + ZoomRecording を新規作成（従来動作、fallback）
```

### 5.2 改修対象関数一覧

#### `src/lib/slp/zoom-reservation-handler.ts`

- `ensureZoomMeetingForSession`
  - 操作対象を `SlpMeetingSessionZoom` → `SlpZoomRecording` に変更
  - ContactHistory が未作成なら作成してから Recording を作る
  - Zoom API で新 meeting 作成時は `state="予定"` で保存

- `cancelZoomMeetingForSession`
  - primary Recording を論理削除
  - Zoom API delete は継続

- `regenerateZoomForSession`
  - 既存 primary Recording 論理削除 → 新規作成（同様）

#### `src/lib/slp/zoom-recording-processor.ts`

- `findCompanyByMeetingId`
  - 検索先を `SlpMeetingSessionZoom` → `SlpZoomRecording` に変更
  - `SlpZoomRecording` から contactHistory を辿り、そこから session / companyRecord / assignedStaff を取得

- `ensureRecordingRow`
  - 既存 recording あれば（`state="予定"` も含め）更新
  - なければ ContactHistory + ZoomRecording を新規作成
  - **議事録テキストは区切り線付きで追記**（新規ロジック）

- `processZoomRecordingCompleted` / `processMeetingSummaryCompleted`
  - 内部ロジックはそのまま（呼び出す関数が新構造対応）

- `fetchAllForRecording` / `fetchAndSaveAiSummary` / `downloadAndSaveRecordingFiles` / `fetchAndSaveParticipants`
  - **議事録テキスト反映ロジックを区切り線付き追記に変更**（複数Recording対応）

### 5.3 議事録テキスト追記ロジック

`SlpContactHistory.meetingMinutes` への書き込みルール:

```typescript
function appendMeetingMinutes(existing: string | null, newText: string, label: string, startedAt: Date): string {
  const header = `----- ${label} (${formatJst(startedAt)}〜) -----`;
  const chunk = `${header}\n${newText}`;
  if (!existing || existing.trim().length === 0) {
    return chunk;
  }
  return `${existing}\n\n${chunk}`;
}
```

- `label` は Recording の `label`（"メイン" / "延長分" / "再実施" / "追加Zoom" 等）
- 既に同じ Recording の議事録が追記済みかどうかは、`SlpZoomRecording` に `minutesAppendedAt DateTime?` を追加して判定、二重追記を防止

**追加カラム**: `SlpZoomRecording.minutesAppendedAt`（nullable DateTime）

---

## 6. 手動フロー（新機能）

### 6.1 UI 配置

**接触履歴詳細画面** （`src/components/contact-history-modal.tsx` を拡張）

```
┌────────────────────────────────────────────────┐
│ 【接触履歴】株式会社A さま                     │
│                                                │
│ 紐付く商談: 概要案内 第1回                     │
│ 日時: 2026-04-25 14:00                         │
│ 担当: 田中                                     │
│ 議事録: [テキストエリア…]                      │
│                                                │
│ 📹 Zoom情報                                    │
│  ┌────────────────────────────────────────┐    │
│  │ #1 メイン  https://zoom.us/j/xxx       │    │
│  │          ✅ 取得済み                    │    │
│  └────────────────────────────────────────┘    │
│  ┌────────────────────────────────────────┐    │
│  │ #2 延長分 https://zoom.us/j/yyy        │    │
│  │          🕐 予定                        │    │
│  └────────────────────────────────────────┘    │
│  [ + Zoom 議事録連携を追加 ]                   │
└────────────────────────────────────────────────┘
```

### 6.2 URL追加ダイアログ

```
┌─────────────────────────────────────┐
│ Zoom 議事録連携を追加               │
│                                     │
│ Zoom URL（必須）:                   │
│ [https://zoom.us/j/12345...       ] │
│                                     │
│ ホストスタッフ（必須）:             │
│ [プルダウン — Zoom連携済みのみ]    │
│                                     │
│ ラベル（任意、例: 延長分）:         │
│ [                                 ] │
│                                     │
│ このZoomは:                         │
│ (●) 実施済み（今すぐ議事録を取得）  │
│ ( ) 未実施（予定として保存）        │
│                                     │
│     [キャンセル]  [ 追加する ]     │
└─────────────────────────────────────┘
```

### 6.3 バックエンド処理

**新規 Server Action**: `addManualZoomToContactHistory`

```typescript
addManualZoomToContactHistory({
  contactHistoryId: number;
  zoomUrl: string;
  hostStaffId: number;
  label?: string;
  mode: "fetch_now" | "scheduled";
}): Promise<ActionResult<{ recordingId: number; state: string }>>
```

処理:

1. URL から meeting_id 抽出（`/^https:\/\/(?:[a-z0-9-]+\.)?zoom\.us\/j\/(\d+)/`）
   - 抽出失敗 → 即時エラー「Zoom URLの形式が不正です」
2. 既存 `SlpZoomRecording` で同 meeting_id が他 ContactHistory に紐付いていないかチェック
   - 紐付いていれば「この Zoom は既に別の接触履歴 #X に紐付けられています」エラー（`case(b)` 拒否する運用）
   - ※前回の会話で「(a) 移動」も提案したが、予期せぬデータ改変リスク高いので **(b) 拒否** に統一する。ユーザーが不要なら別接触履歴を論理削除してから再試行する運用
3. `SlpZoomRecording.create({ ...joinUrl, zoomMeetingId, contactHistoryId, hostStaffId, label, isPrimary=false, state="予定" })`
4. `mode === "fetch_now"` の場合:
   - 即座に `fetchAllForRecording(recordingId)` を呼ぶ
   - 成功 → state="完了"、議事録を接触履歴に追記
   - Zoom側に録画なし (404 等) → state="予定" に自動フォールバック、toast メッセージ表示「録画がまだのようなので予定状態で保存しました」
   - その他エラー → state="失敗"、エラーメッセージを `zoomApiError` に保存
5. `mode === "scheduled"` の場合:
   - state="予定" で保存のみ
   - Webhook 到着時に `processZoomRecordingCompleted` 内で取得して追記される

### 6.4 再取得ボタン

`state="失敗"` の Recording に「再取得」ボタン表示:

- 既存の `fetchAllForRecording` を呼び直す
- 成功 → state="完了"
- 失敗 → state="失敗" のまま（エラー更新）

### 6.5 Zoom情報の削除

各 Recording に 🗑 削除アイコン:

- 論理削除（`deletedAt` セット）
- 既に議事録テキストに追記済みの場合、テキスト自体は残す（誤削除復元不可なため、削除確認モーダル表示）

---

## 7. 通知・リマインド改修

### 7.1 `src/lib/slp/slp-session-notification.ts`

- `zoomRecords`（SessionZoom）参照を `contactHistory.zoomRecordings`（Recording）に変更
- primary Recording の `joinUrl` を取得するクエリに変更

### 7.2 `src/lib/slp/zoom-reminder-job.ts`

- `prisma.slpMeetingSessionZoom.findMany` → `prisma.slpZoomRecording.findMany`
- `remindDaySentAt` / `remindHourSentAt` は Recording 側に移動済み、そこを見る
- `isPrimary=true` かつ `state IN ('予定','完了')` で絞る

### 7.3 `src/lib/slp/session-lifecycle.ts`

- `ensureZoomMeetingForSession` / `cancelZoomMeetingForSession` 呼び出し側はそのまま（関数シグネチャ同じ、内部のみ変更）

---

## 8. UI 変更一覧

### 8.1 廃止するコンポーネント

- `src/app/slp/companies/[id]/components/add-zoom-modal.tsx` — 削除
- `src/app/slp/companies/[id]/components/edit-zoom-modal.tsx` — 削除
- `src/app/slp/companies/[id]/components/delete-zoom-modal.tsx` — 削除
- `src/app/slp/companies/[id]/components/session-zoom-panel.tsx` — 削除（もし存在）

### 8.2 改修するコンポーネント

#### `src/app/slp/companies/[id]/components/meeting-sessions-card.tsx`

- Zoom記録一覧セクション（現状は SessionZoom を表示）を削除
- 「+追加Zoom」ボタン削除
- 代わりに接触履歴セクションへのリンクを表示（"接触履歴を見る / Zoom情報の確認はこちら" 等）
- 商談完了後に「議事録あり」バッジを表示するロジックも変更（Recording 経由）

#### `src/components/contact-history-modal.tsx`

- 新規: Zoom情報セクション（上記UI案）
- 新規: URL追加ダイアログ
- 既存の `meetingMinutes` 欄はそのまま（自動追記される）

#### `src/app/slp/contact-histories/company-contact-history-section.tsx`

- 接触履歴一覧に「📌 予定のZoomあり」バッジ表示
- フィルタ（チェックボックス or タブ）で「予定あり」の接触履歴のみ表示

#### `src/app/slp/records/zoom-recordings/page.tsx`

- 直接 Recording を一覧表示（既存ロジック）
- 列を追加: `joinUrl` / `state` / `label`

### 8.3 新規コンポーネント

- `src/app/slp/contact-histories/zoom-recording-section.tsx` — 接触履歴モーダル内のZoom情報セクション
- `src/app/slp/contact-histories/add-zoom-url-modal.tsx` — URL追加ダイアログ

### 8.4 新規 Server Actions

- `src/app/slp/contact-histories/zoom-actions.ts`:
  - `addManualZoomToContactHistory(…)`
  - `retryZoomRecording(recordingId)` — 失敗した取得を再試行
  - `deleteZoomRecording(recordingId, reason)` — 論理削除

---

## 9. 影響ファイル一覧

### スキーマ / マイグレーション

- `prisma/schema.prisma` — `SlpZoomRecording`, `SlpMeetingSession`, `SlpContactHistory`, `SlpMeetingSessionZoom`（削除）
- `prisma/migrations/20260418xxxxxx_zoom_recording_absorbs_session_zoom/migration.sql`（新規）

### バックエンド（`src/lib/`）

- `src/lib/slp/zoom-recording-processor.ts` — 大規模改修
- `src/lib/slp/zoom-reservation-handler.ts` — 大規模改修
- `src/lib/slp/slp-session-notification.ts` — primary Zoom取得先変更
- `src/lib/slp/zoom-reminder-job.ts` — クエリ先変更
- `src/lib/slp/session-lifecycle.ts` — 軽微な変更（呼び出し先変更のみ）
- `src/lib/slp/zoom-ai.ts` — Recording 側のフィールド参照（軽微）
- `src/lib/slp/session-helper.ts` — Session 経由で Zoom情報にアクセスするヘルパー追加（接触履歴経由）

### Server Actions

- `src/app/slp/companies/[id]/session-actions.ts` — `addSessionZoom` / `updateSessionZoom` / `deleteSessionZoom` 削除
- `src/app/slp/companies/[id]/zoom-meeting-actions.ts` — `regenerateZoomMeeting` の内部を新構造に対応
- `src/app/slp/contact-histories/zoom-actions.ts` — 新規

### UI

- `src/app/slp/companies/[id]/components/meeting-sessions-card.tsx` — Zoom欄削除
- `src/app/slp/companies/[id]/components/add-zoom-modal.tsx` / `edit-zoom-modal.tsx` / `delete-zoom-modal.tsx` — 削除
- `src/app/slp/companies/[id]/zoom-meeting-panel.tsx` — 新構造対応（joinUrl 取得先変更）
- `src/components/contact-history-modal.tsx` — Zoomセクション追加
- `src/app/slp/contact-histories/company-contact-history-section.tsx` — 予定フィルタ追加
- `src/app/slp/records/zoom-recordings/page.tsx` / `recordings-client.tsx` — 表示調整
- `src/app/slp/contact-histories/zoom-recording-section.tsx` — 新規
- `src/app/slp/contact-histories/add-zoom-url-modal.tsx` — 新規

### プロライン webhook（`src/app/api/public/slp/`）

- `briefing-reservation/route.ts` — ContactHistory 作成追加
- `briefing-change/route.ts` — URL取得元変更
- `briefing-cancel/route.ts` — 削除対象変更
- `consultation-reservation/route.ts` / `consultation-change/route.ts` / `consultation-cancel/route.ts` — 同上

### Zoom webhook（`src/app/api/webhooks/zoom/`）

- `route.ts` — 内部処理は `processZoomRecordingCompleted` / `processMeetingSummaryCompleted` に委譲、それらが新構造対応

---

## 10. 実装 Phase

### Phase 1: データベース・型

**目的**: スキーマ変更とPrisma Client更新を先に終わらせ、後続の型エラーを早期に検出する

1. `prisma/schema.prisma` 変更
2. マイグレーション手動作成
3. Docker内で `migrate deploy` + `prisma generate` ×2 + `restart`
4. 型チェック: 既存コードで参照している `SlpMeetingSessionZoom` が軒並みエラーになる（意図通り）

### Phase 2: バックエンドロジック改修

**目的**: 自動フロー（プロラインwebhook、Zoom webhook、リマインド、通知）を新構造に対応させる

5. `zoom-reservation-handler.ts` 改修
6. `zoom-recording-processor.ts` 改修（議事録追記ロジック追加）
7. `slp-session-notification.ts` の primary Zoom 取得元変更
8. `zoom-reminder-job.ts` のクエリ変更
9. プロライン webhook 改修（ContactHistory 同時作成）
10. `session-actions.ts` から SessionZoom 関連アクション削除
11. 型チェック: 全エラー解消

### Phase 3: UI 改修（既存画面の対応）

**目的**: 商談カードから Zoom欄を撤去し、接触履歴画面から Zoom情報を触れるようにする

12. `meeting-sessions-card.tsx` の Zoom欄削除
13. `add-zoom-modal.tsx` / `edit-zoom-modal.tsx` / `delete-zoom-modal.tsx` 削除
14. `zoom-meeting-panel.tsx` の joinUrl 取得先変更
15. `/slp/records/zoom-recordings` の表示調整

### Phase 4: 手動URL追加機能（新機能）

**目的**: 今回のメイン機能を実装

16. `contact-history-modal.tsx` に Zoom情報セクション追加
17. `add-zoom-url-modal.tsx` 新規作成
18. `zoom-actions.ts`（`addManualZoomToContactHistory` 等）新規作成
19. 接触履歴一覧に予定フィルタ追加

### Phase 5: 検証

20. 自動フロー: ダミーセッション作成 → Zoom発行 → webhook シミュレーション → 議事録確認
21. 手動フロー: 実URL追加 → 取得動作確認
22. 途中切れシナリオ: 2本目のURL追加 → 議事録が区切り線付きで追記されることを確認
23. 通知・リマインド: URL取得元が Recording に移っていることを確認（テンプレートプレビュー等で）
24. 型エラー・lint ゼロ確認

---

## 11. 変えないもの（保護対象）

明示的に **変更しない** ものを列挙。これらに影響する変更が必要になった場合は必ずユーザーに確認する。

### 機能

- 商談のラウンド管理（完了回数ベースの番号採番）
- 5種類の商談ステータス（未予約 / 予約中 / 完了 / キャンセル / 飛び）とその遷移規則
- 商談の論理削除、編集履歴 (`SlpMeetingSessionHistory`)
- 重複予約検知、飛び警告バッジ
- 並列予約禁止ルール
- 顧客側の予約中継ページ（`/slp/public/reserve/*`）
- 紹介者通知チェックボックス（概要案内1回目のみ表示）の仕様
- 通知テンプレート設定画面 (`/slp/settings/notification-templates`)
- 通知テンプレートの中身、対応form (`form16/17/18/11/13`)
- 手動セット予約（プロラインを通さない）仕様
- 未予約→予約中 昇格フロー
- Zoom OAuth認証フロー、スタッフのZoom連携管理
- 組合員LINE紐付け機能（完全別モジュール）
- HOJO / STP / SRD / 経理 / 組合員等の他モジュール

### データ

- `SlpMeetingSession`, `SlpMeetingSessionHistory`, `SlpContactHistory`（sessionId 除く）, `SlpNotificationTemplate`, `SlpReservationHistory`, `SlpZoomSendLog` の構造
- `MasterStaff`, `StaffMeetingIntegration` 等の認証系
- `SlpCompanyRecord` の構造

### コード規約

- `src/lib/auth/staff-action.ts` の権限チェックヘルパー
- Result<T>（`{ ok, data } | { ok: false, reason }`）形式の Server Action 戻り値
- 論理削除パターン（`deletedAt` セット）
- `KoutekiPageShell` 等の顧客フォームデザイン体系

---

## 12. リスクと対策

| # | リスク | 対策 |
|---|--------|------|
| 1 | SessionZoom を参照しているコードの見落とし | `grep -r "SlpMeetingSessionZoom\|slpMeetingSessionZoom\|sessionZoom"` で網羅確認、型チェックで検出 |
| 2 | プロライン通知のURL参照箇所の見落としで通知URLが空になる | `grep joinUrl` で全参照箇所を変更、Phase 2完了時に実スタッフアカウントで通知テスト |
| 3 | 議事録追記が二重に書き込まれる | `minutesAppendedAt` カラムで送信済みを判定、二重書き込み防止 |
| 4 | 手動追加URLの meeting_id 衝突 | DB UNIQUE制約で物理的に拒否、アプリレイヤーで親切なエラーメッセージ表示 |
| 5 | state="予定" のまま永遠に残るレコード | (a)案採用: 自動削除はせず、接触履歴一覧の「予定あり」フィルタで可視化してスタッフが手動対応 |
| 6 | Zoom API の URL形式変更（将来） | URLパーサーを1関数に集約 (`src/lib/zoom/url-parser.ts` 新規)、将来変更時は1箇所修正で済む |
| 7 | Recording の UNIQUE削除による意図せぬ重複作成 | webhook 処理で既存レコード検索ロジックを明確化、meeting_id は UNIQUE を維持 |
| 8 | マイグレーション中にコードが古いクライアントで動き続ける | Docker内 `prisma generate` + `restart` を手順書通り実行 |
| 9 | `remindDaySentAt`/`remindHourSentAt` の既存挙動破壊 | Recording に同名カラムを移設、既存ロジックは SessionZoom → Recording に置換のみ |
| 10 | 再取得ボタン連打による Zoom API レート制限 | ボタン押下後はクライアント側で短時間disable、サーバー側でも同レコードの in_progress チェック |

---

## 13. ファイルロック戦略

### Phase 1 (schema.prisma)

- **schema.prisma は特別扱い**: 他全セッション完了を待つ
- CLAUDE.md の規定通り

### Phase 2〜4

- `src/lib/slp/*` はセッション内で連続改修するため先行ロック可
- UIコンポーネントは個別にロック取得
- 競合時は enqueue で待機

---

## 14. ユーザー側で必要な準備

- **特になし** — プロライン側の form、既存マスターデータ等への影響はない
- テンプレート変更も不要（`{{zoomUrl}}` 変数は引き続き動作、内部の取得元だけ変わる）

---

## 15. 検証チェックリスト

### Phase 1（データ基盤）

- [ ] マイグレーション成功
- [ ] `npx tsc --noEmit` で既存コードが意図した型エラーを吐く
- [ ] `SlpMeetingSessionZoom` テーブルが物理削除されている
- [ ] `SlpZoomRecording.join_url` カラムが追加されている

### Phase 2（バックエンド）

- [ ] プロライン予約 webhook → Session + ContactHistory + Recording が作成される
- [ ] Zoom 発行 → Recording.joinUrl に URL が入る
- [ ] Zoom 完了 webhook → 既存Recordingの state が 予定→完了 に変わる
- [ ] 通知メッセージに正しいURLが埋め込まれる
- [ ] リマインドが Recording.remindDaySentAt を更新する
- [ ] 型チェックゼロエラー

### Phase 3（既存UI対応）

- [ ] 商談カードから「+追加Zoom」「Zoom記録」欄が消えている
- [ ] `/slp/records/zoom-recordings` が従来通り表示される
- [ ] 商談ページにエラーが出ない

### Phase 4（新機能）

- [ ] 接触履歴詳細で Zoom情報セクションが表示される
- [ ] 「+ Zoom URL を追加」ダイアログが動作
- [ ] 「実施済み」選択 → 議事録取得 → state=完了 に
- [ ] 「未実施」選択 → state=予定 で保存、webhookで埋まる動作
- [ ] 2本目URL追加 → 議事録が区切り線付きで追記される
- [ ] 失敗時に再取得ボタンで復旧できる
- [ ] 重複meeting_id入力 → 親切なエラーメッセージ
- [ ] 接触履歴一覧に「予定あり」フィルタ

---

## 16. 備考・TODO

- Zoom URLパーサーは `src/lib/zoom/url-parser.ts` として新設し、他機能からも再利用可能にする
- `minutesAppendedAt` カラム追加は同じマイグレーションに含める（議事録追記の二重防止）
- Phase 1〜4 は順序依存。並行実装しない
- 各Phase完了時に `git commit` を推奨（差分を小さく保つため）

---

## 17. 実装開始の承認依頼

本計画書の内容でよろしければ「OK」のサインをお願いします。
不明点・修正点があれば指摘してください。
承認後、Phase 1 から順次実装に入ります。
