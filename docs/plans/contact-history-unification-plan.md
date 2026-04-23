# 接触履歴 統一設計書

**作成日**: 2026-04-21
**最終更新**: 2026-04-23
**対象**: 全プロジェクト（STP / HOJO / SLP / SRD / 今後追加予定含む）
**ステータス**: 設計確定（実装フェーズ待ち）

**目的**:
- 3つに分かれている接触履歴テーブル（`contact_histories` / `slp_contact_histories` / `hojo_contact_histories`）を統一
- 予定（未実施）と実績（実施済み）の両方を同一テーブルで管理
- Slack / Telegram / Google Calendar / Zoom / Google Meet との連携を前提とした拡張性のある構造

---

## 0. 用語集

| 用語 | 意味 |
|---|---|
| 接触履歴 | お客様や取引先との「打ち合わせ・連絡・訪問」1件の記録。予定も実績もここに含む |
| 会議（meeting） | 接触のうち、Zoom / Google Meet / Teams などのオンライン会議が発生したもの |
| 会議記録（meeting record） | 会議実施後の録画・議事録・AI要約などのデータ |
| 顧客側参加者 | 接触の相手側（顧客企業・代理店・ベンダー・LINE友達など）に属する企業/団体と個人 |
| スタッフ参加者 | 弊社側の担当者。Google カレンダー同期対象 |
| プロバイダ | `zoom` / `google_meet` / `teams` / `other` などオンライン会議のサービス名 |
| ホスト | オンライン会議の主催者。Zoom/Meet の開始権限を持つ。API連携の基準となる |
| API連携 | Zoom/Google Meet の API を用いた URL 自動生成・録画自動取得・議事録自動追記 |

---

## 1. 運用決定事項（確定済み）

### 1.1 Zoom アカウント方式

**採用: 各スタッフごとの OAuth 連携（方式A）**

- 基本的には各スタッフが自分の Zoom アカウントを連携
- ただし Zoom 未契約のスタッフも存在する
- **Zoom 未連携者がホストの場合、自動的に Google Meet を使う**（または記録のみで API 連携しない）運用

### 1.2 Google カレンダー運用

**現状**: スタッフ各自が個人 Google カレンダーで予定管理。プロジェクト別カレンダーの整備は未。

**方針**:
- 各スタッフが自分の個人カレンダーを Stella CRM に連携
- カレンダー取り込み時のプロジェクト判定は、`calendar_project_mapping` テーブルで「カレンダー ID + タイトルキーワード」の組合せで判定
- 将来プロジェクト別カレンダーを整備するなら移行しやすい構造

### 1.3 着手プロジェクト順

**Phase 1 = SLP** → Phase 5 = HOJO → Phase 6 = STP（最後）

- **SLP から着手**: 既存の Zoom 連携が最も完成度高く、資産を活かせる
- **STP は最後・慎重に**: 既に本番運用中でデータ量が多く、移行影響が最も大きい

### 1.4 チャットボット

**Slack と Telegram の両方**を実装。ボットの業務ロジックは共通化し、送受信層のみチャネル別。

### 1.5 移行方針

**ローカル開発 → stg 環境テスト → 本番一発切替**

- ローカルで完成させる
- stg で全シナリオ確認（本番データコピー）
- 本番切替は計画メンテ時間内で一発移行
- 切替後も旧テーブルは一定期間（3ヶ月程度）残す（ロールバック余地）

---

## 2. 全体構造

```
接触履歴 (contact_histories)                         ★統一テーブル
  │
  ├─▶ 顧客側参加エンティティ (contact_customer_participants)   [1:N]
  │     └─▶ 先方参加者 個人 (contact_customer_attendees)       [1:N]
  │
  ├─▶ 弊社スタッフ参加者 (contact_staff_participants)           [1:N]
  │
  ├─▶ 添付ファイル (contact_history_files)                     [1:N]
  │
  ├─▶ オンライン会議 (contact_history_meetings)                [1:N]
  │     └─▶ 会議記録 (contact_history_meeting_records)         [1:1]
  │           └─▶ AI要約バージョン (meeting_record_summaries)   [1:N]
  │
  ├─▶ 通知ログ (contact_history_notifications)                [1:N]
  │
  └─▶ 外部連携イベント (contact_history_external_events)       [1:N]
         (Googleカレンダー双方向同期 / 重複防止)

【連携用の独立テーブル】
  - staff_google_auth              : スタッフごとの Google OAuth（カレンダー＋Meet兼用）
  - staff_zoom_auth                : スタッフごとの Zoom OAuth
  - staff_slack_link               : Slack ユーザー ↔ スタッフ
  - staff_telegram_link            : Telegram ユーザー ↔ スタッフ
  - calendar_project_mapping       : 監視対象カレンダー ↔ プロジェクト
  - google_calendar_subscriptions  : Push Notification 購読情報
  - contact_history_sync_queue     : 外部連携のリトライ用ジョブキュー
```

---

## 3. コアテーブル設計

### 3.1 `contact_histories`（接触履歴 本体）

統一後の中心テーブル。STP/HOJO/SLP の既存3テーブルを統合する。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `projectId` | Int FK | ○ | `MasterProject` への紐付け（STP/HOJO/SLP/SRD） |
| `status` | String(20) | ○ | `scheduled` / `completed` / `cancelled` / `rescheduled` |
| `title` | String(200) | | 予定タイトル（カレンダー表示・リスト表示用） |
| `scheduledStartAt` | Timestamptz(6) | ○ | 予定開始時刻（UTC保存） |
| `scheduledEndAt` | Timestamptz(6) | | 予定終了時刻 |
| `actualStartAt` | Timestamptz(6) | | 実際の開始時刻（会議記録から自動更新） |
| `actualEndAt` | Timestamptz(6) | | 実際の終了時刻 |
| `displayTimezone` | String(50) | | `Asia/Tokyo` 等。表示用 |
| `contactMethodId` | Int FK | | 接触方法マスタ（電話/Zoom/Google Meet/訪問等）既存マスタそのまま |
| `contactCategoryId` | Int FK | | 接触種別マスタ（商談/キックオフ等）既存マスタそのまま |
| `meetingMinutes` | Text | | 議事録本文（AI要約の追記先） |
| `note` | Text | | メモ |
| `sourceType` | String(30) | | `manual` / `slack` / `telegram` / `google_calendar` / `api` |
| `sourceRefId` | String(200) | | ソース側の識別子（Slack message ID 等、監査用） |
| `rescheduledFromAt` | Timestamptz(6) | | リスケ前の予定時刻 |
| `rescheduledCount` | Int | ○ | リスケ回数（default 0） |
| `rescheduledReason` | Text | | 直近のリスケ理由 |
| `cancelledAt` | Timestamptz(6) | | キャンセル日時 |
| `cancelledReason` | Text | | キャンセル理由 |
| `recurringSeriesId` | String(100) | | 繰り返し予定のシリーズ識別子（受け皿、Phase2以降で実装） |
| `parentContactHistoryId` | Int FK | | 前回接触との連続性（受け皿、Phase2以降で実装） |
| `createdByStaffId` | Int FK | | 作成者 |
| `updatedByStaffId` | Int FK | | 最終更新者 |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |
| `deletedAt` | DateTime | | 論理削除 |

**インデックス**
- `(projectId, status)`（プロジェクトごとのステータス絞り込み）
- `(scheduledStartAt)`（カレンダー表示・リマインダー検索）
- `(status, scheduledStartAt)`（予定一覧、今後の接触一覧）
- `(contactCategoryId)` / `(contactMethodId)` / `(createdByStaffId)`
- `(deletedAt)`
- `(recurringSeriesId)` / `(parentContactHistoryId)`

---

### 3.2 `contact_customer_participants`（顧客側参加エンティティ）

1つの接触に複数の顧客側エンティティ（企業/代理店/ベンダー/LINE友達等）を紐付ける多態参照テーブル。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | |
| `targetType` | String(30) | ○ | 下記「対応targetType一覧」参照 |
| `targetId` | Int | | 該当エンティティのID（台帳レコード未整備のものはnull許容） |
| `isPrimary` | Boolean | ○ | 主顧客フラグ（default false、1接触に基本1件のみtrue） |
| `displayOrder` | Int | ○ | 表示並び（default 0） |
| `createdAt` | DateTime | ○ | |

**対応 `targetType` 一覧**:
- `stp_company` : STP企業（MasterStellaCompany）
- `stp_agent` : STP代理店（`StpAgent`）
- `hojo_vendor` : HOJOベンダー（HojoVendor）
- `hojo_bbs` : HOJO BBS（台帳未整備、targetId null可）
- `hojo_lender` : HOJO貸金業者
- `hojo_other` : HOJOその他
- `slp_company_record` : SLP事業者レコード
- `slp_agency` : SLP代理店
- `slp_line_friend` : SLP LINE友達
- （今後のプロジェクト追加に応じて拡張）

**インデックス**
- `(contactHistoryId)`
- `(targetType, targetId)`（「このベンダーの全接触履歴」等の逆引き）

**制約**
- 同一接触への同一エンティティ重複禁止: UNIQUE `(contactHistoryId, targetType, targetId)`

---

### 3.3 `contact_customer_attendees`（先方参加者 個人）

顧客側エンティティ（3.2）にぶら下がる形で、実際に参加した個人を記録。追加型UIでタグのように追加。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `customerParticipantId` | Int FK | ○ | `contact_customer_participants` へ |
| `name` | String(100) | ○ | 氏名 |
| `title` | String(100) | | 役職 |
| `sourceType` | String(30) | ○ | `stella_contact` / `slp_company_contact` / `slp_agency_contact` / `hojo_vendor_contact` / `manual` |
| `sourceId` | Int | | マスタ担当者のID（sourceType が manual以外のとき） |
| `savedToMaster` | Boolean | ○ | 手入力時に「マスタにも登録」を選んだか（default false） |
| `attended` | Boolean | | 出席有無（会議 attendance report 自動更新、null=未取得） |
| `displayOrder` | Int | ○ | |
| `createdAt` | DateTime | ○ | |

**インデックス**
- `(customerParticipantId)`
- `(sourceType, sourceId)`（「この担当者の全接触履歴」検索）

---

### 3.4 `contact_staff_participants`（弊社スタッフ参加者）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | |
| `staffId` | Int FK | ○ | `MasterStaff` |
| `isHost` | Boolean | ○ | Zoom/Meet ホスト指定（1接触に1人、default false） |
| `attended` | Boolean | | 出席有無 |
| `googleCalendarEventId` | String(200) | | このスタッフのGoogleカレンダーに作成されたイベントID |
| `googleCalendarSyncedAt` | DateTime | | カレンダー同期成功日時 |
| `googleCalendarSyncError` | Text | | カレンダー同期エラー |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**制約**
- UNIQUE `(contactHistoryId, staffId)`
- 1接触に `isHost=true` が2つ以上にならないよう、アプリ側でチェック

**インデックス**
- `(staffId)`（「このスタッフの全接触履歴」逆引き）

---

### 3.5 `contact_history_files`（添付ファイル）

既存の `contact_history_files` / `slp_contact_history_files` / `hojo_contact_history_files` を統一。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | |
| `filePath` | String(500) | | ローカル/S3パス（アップロード時） |
| `fileName` | String(200) | ○ | |
| `fileSize` | Int | | |
| `mimeType` | String(100) | | |
| `url` | String(1000) | | 外部URL（Googleドライブ共有等） |
| `uploadedByStaffId` | Int FK | | |
| `createdAt` | DateTime | ○ | |

---

## 4. 会議（オンライン会議）関連テーブル

### 4.1 `contact_history_meetings`（会議 本体）

接触に紐づくオンライン会議。**1接触に複数会議OK**（延長分・再実施・プロバイダ混在）。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | **UNIQUE ではない**（1:N） |
| `provider` | String(30) | ○ | `zoom` / `google_meet` / `teams` / `other` |
| `isPrimary` | Boolean | ○ | 主会議フラグ |
| `label` | String(100) | | "延長分" / "再実施" / "2回目" 等 |
| `displayOrder` | Int | ○ | |
| `externalMeetingId` | String(200) | | プロバイダ側の会議ID |
| `externalMeetingUuid` | String(200) | | プロバイダ側のUUID（Zoomなど） |
| `joinUrl` | String(1000) | | 参加URL（全プロバイダ共通、QR生成もこれ） |
| `startUrl` | String(2000) | | ホスト用URL（Zoom固有、nullable） |
| `passcode` | String(100) | | パスコード（Zoom固有） |
| `hostStaffId` | Int FK | | ホスト（`contact_staff_participants.isHost` と一致） |
| `hostExternalAccountId` | String(200) | | ホストのプロバイダ側アカウントID |
| `urlSource` | String(20) | ○ | `auto_generated` / `manual_entry` / `empty` |
| `urlSetAt` | DateTime | | URL設定日時 |
| `apiIntegrationStatus` | String(30) | ○ | **自動計算される現在状態**（詳細§5） |
| `hostUrlConsistencyConfirmedAt` | DateTime | | ホスト変更時に「現URLのままでOK」とユーザー確認した日時 |
| `scheduledStartAt` | Timestamptz(6) | | 会議予定開始（接触履歴と別に持つ理由: 1接触内で会議ごとに時刻異なる場合） |
| `scheduledEndAt` | Timestamptz(6) | | |
| `state` | String(20) | ○ | `予定` / `進行中` / `完了` / `失敗` / `取得中` |
| `apiError` | Text | | API発行失敗時のエラー |
| `apiErrorAt` | DateTime | | |
| `providerMetadata` | JSON | | プロバイダ固有の設定（Zoom自動録画フラグ、Meet空間IDなど） |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |
| `deletedAt` | DateTime | | |

**インデックス**
- `(contactHistoryId)`
- `(provider, externalMeetingId)` UNIQUE（同じ会議の重複登録防止。nullは除外）
- `(state)` / `(apiIntegrationStatus)`
- `(scheduledStartAt)`

---

### 4.2 `contact_history_meeting_records`（会議記録 ＝ 実施後データ）

会議実施後の録画・議事録・要約データ。**1会議 = 1記録**（UNIQUE）。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `meetingId` | Int FK | ○ | UNIQUE |
| `recordingStartAt` | DateTime | | 実録画開始 |
| `recordingEndAt` | DateTime | | 実録画終了 |
| `recordingUrl` | String(1000) | | 動画URL（Zoom Cloud / Google Drive） |
| `recordingPath` | String(1000) | | ローカル保存パス（ダウンロード済みの場合） |
| `recordingSizeBytes` | BigInt | | |
| `transcriptUrl` | String(1000) | | 文字起こしURL |
| `transcriptText` | Text | | 文字起こし本文 |
| `chatLogUrl` | String(1000) | | チャットログURL |
| `chatLogText` | Text | | チャットログ本文 |
| `attendanceJson` | JSON | | 参加者ログ（入退室時刻） |
| `aiSummary` | Text | | AI要約（現行版） |
| `aiSummarySource` | String(30) | | `zoom_ai_companion` / `gemini` / `claude` / `manual` |
| `aiSummaryModel` | String(80) | | 生成モデル名 |
| `aiSummaryGeneratedAt` | DateTime | | |
| `minutesAppendedAt` | DateTime | | 接触履歴の議事録欄に追記済みか（二重追記防止） |
| `downloadStatus` | String(30) | ○ | `pending` / `in_progress` / `completed` / `failed` / `no_recording` |
| `downloadError` | Text | | |
| `providerRawData` | JSON | | プロバイダAPIレスポンスの生データ（監査・再解析用） |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**インデックス**
- `(meetingId)` UNIQUE
- `(downloadStatus)`
- `(aiSummaryGeneratedAt)`

---

### 4.3 `meeting_record_summaries`（AI要約のバージョン履歴）

プロンプト改善後の再生成、手動編集履歴を保持する。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `meetingRecordId` | Int FK | ○ | |
| `version` | Int | ○ | 1, 2, 3... |
| `summaryText` | Text | ○ | |
| `source` | String(30) | ○ | `zoom_ai_companion` / `gemini` / `claude` / `manual` |
| `model` | String(80) | | |
| `promptSnapshot` | Text | | 使用プロンプトのスナップショット（再現性用） |
| `generatedAt` | DateTime | ○ | |
| `generatedByStaffId` | Int FK | | 手動編集の場合の編集者 |
| `isCurrent` | Boolean | ○ | 現在有効な要約フラグ（1記録に1つだけtrue） |
| `createdAt` | DateTime | ○ | |

**インデックス**
- `(meetingRecordId, version)` UNIQUE
- `(meetingRecordId, isCurrent)`

**方針**: `meeting_records.aiSummary` は最新版（`isCurrent=true` のsummaryText）をキャッシュする形。検索・表示はメインテーブルを見るだけで済む。

---

## 5. 会議URL・API連携の動作ルール

### 5.1 URL入力5パターンの網羅

| # | パターン | `urlSource` 状態遷移 | ホスト選択肢 | API連携 |
|---|---|---|---|---|
| 1 | 作成時に自動生成 | `empty` → `auto_generated` | 連携済スタッフのみ | 必ずON |
| 2 | 作成後に自動生成 | `empty`/`manual_entry` → `auto_generated` | 連携済スタッフのみ | 必ずON |
| 3 | 作成時に既存URL挿入 | `empty` → `manual_entry` | 全スタッフ選択可 | ホスト連携状況次第 |
| 4 | 作成後に既存URL挿入 | `empty` → `manual_entry` | 全スタッフ選択可 | ホスト連携状況次第 |
| 5 | URL無し（記録のみ） | `empty` のまま | 全スタッフ選択可 | N/A |

### 5.2 URL入力方式とホスト選択のルール

**自動生成を選択した場合**
- ホスト選択肢に表示されるのは**連携済スタッフのみ**
- 未連携スタッフは選択肢から除外、またはグレーアウト

**手動入力を選択した場合**
- ホスト選択肢は**全スタッフ**
- API連携可否は**ホストの連携状態で自動判定**される

**URL無しの場合**
- ホスト選択肢は全スタッフ
- API連携は発生しない

### 5.3 API連携の自動判定

**基本原則**: 「連携しているのに API を使わない」という選択肢はない。ホストの連携状態だけで決定する。

```
API連携判定ロジック:

provider = "zoom" の場合:
  hostStaffId の staff_zoom_auth が存在する?
    ├─ YES → apiIntegrationStatus = "available"
    └─ NO  → apiIntegrationStatus = "unavailable_unlinked_host"

provider = "google_meet" の場合:
  hostStaffId の staff_google_auth が存在する?
    ├─ YES → apiIntegrationStatus = "available"
    └─ NO  → apiIntegrationStatus = "unavailable_unlinked_host"

joinUrl が空の場合:
  apiIntegrationStatus = "no_url_yet"

provider = "other" or 会議レコード自体なし:
  apiIntegrationStatus = "not_applicable"
```

**`apiIntegrationStatus` の値**
- `available` — API連携可能
- `unavailable_unlinked_host` — ホストが未連携
- `no_url_yet` — URL未設定
- `not_applicable` — 会議対象外（対面・電話等）

**再計算タイミング**: ホスト変更・URL変更・スタッフ連携変更時に自動再計算。

### 5.4 ホスト変更時の警告フロー

**ホスト変更時の判定**
```
URL が未設定:
  → 警告なし、普通に保存

URL が設定済み:
  新ホストが旧ホストと同じ連携状態（両方連携済 or 両方未連携）:
    → 警告なし、普通に保存

  連携状態が変わる（連携済↔未連携、または別のスタッフへ変更）:
    → 警告ダイアログ表示
```

**警告ダイアログの選択肢**
1. **このURLのままにする** → `hostUrlConsistencyConfirmedAt` を記録、そのまま保存
2. **新しいURLを自動生成する** → （新ホストが連携済の場合のみ表示）API呼出して URL発行、`urlSource=auto_generated`
3. **URLを削除して手動入力し直す** → URLクリア、`urlSource=empty` に戻す

**ダイアログ文言例**:
> ホストを変更しました。
> 通常、ホストが変わると Zoom の会議URLも新しく発行されます。
> 現在のURLはこのままでいいですか？

### 5.5 ホスト権限のスコープ（API使用の範囲）

**原則**: **ホストのトークンのみ API 使用**

- ホスト以外の参加スタッフが連携済でも、そのトークンはAPI連携に使わない
- 理由: 「ホストを選ぶ = そのスタッフのアカウントで動作」が明快な原則
- ホストが未連携 → そのミーティングはAPI連携オフで統一

---

## 6. 通知・外部連携テーブル

### 6.1 `contact_history_notifications`（通知ログ）

リマインダー・確認通知の送信管理。二重送信防止。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | |
| `type` | String(30) | ○ | `confirm` / `day_before` / `hour_before` / `cancel` / `reschedule` / `after` |
| `channel` | String(30) | ○ | `slack` / `telegram` / `email` / `line` |
| `recipientStaffId` | Int FK | | 社内宛ての場合 |
| `recipientExternalId` | String(200) | | 外部宛ての場合（顧客LINE友達ID等） |
| `scheduledAt` | DateTime | ○ | 送信予定時刻 |
| `sentAt` | DateTime | | 送信完了時刻 |
| `status` | String(30) | ○ | `pending` / `sent` / `failed` / `cancelled` |
| `error` | Text | | |
| `externalMessageId` | String(200) | | 送信後のSlack message ID / Telegram message ID |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**インデックス**
- `(contactHistoryId, type, channel, recipientStaffId)` UNIQUE-ish
- `(status, scheduledAt)`（送信ワーカーの検索用）

### 6.2 `contact_history_external_events`（外部イベント紐付け・双方向同期）

Googleカレンダーイベントの双方向同期のループ防止に必須。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | ○ | |
| `provider` | String(30) | ○ | `google_calendar` / `zoom` / `google_meet` / その他 |
| `externalEventId` | String(200) | ○ | 外部側のイベント/リソースID |
| `externalCalendarId` | String(200) | | Googleカレンダー固有 |
| `syncDirection` | String(20) | ○ | `inbound` / `outbound` / `bidirectional` |
| `lastSyncedAt` | DateTime | | |
| `syncStatus` | String(30) | ○ | `pending` / `synced` / `failed` |
| `syncError` | Text | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**制約**
- UNIQUE `(provider, externalEventId)` ← **ループ防止の要**

### 6.3 `calendar_project_mapping`（監視カレンダー ↔ プロジェクト紐付け）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `googleCalendarId` | String(200) | ○ | Googleカレンダー側のID |
| `calendarDisplayName` | String(200) | | 表示名（管理用） |
| `ownerStaffId` | Int FK | | このカレンダーの所有スタッフ（個人カレンダー連携時） |
| `projectId` | Int FK | ○ | 紐付け先プロジェクト |
| `defaultContactCategoryId` | Int FK | | デフォルト接触種別 |
| `titleKeyword` | String(100) | | タイトルに含まれるキーワード（例: "接触"）。空なら全件取り込み |
| `isActive` | Boolean | ○ | |
| `createdByStaffId` | Int FK | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**制約**
- UNIQUE `(googleCalendarId, titleKeyword)`

### 6.4 `google_calendar_subscriptions`（Push Notification 購読情報）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `googleCalendarId` | String(200) | ○ | |
| `channelId` | String(200) | ○ | Google Watch の channel UUID |
| `resourceId` | String(200) | ○ | |
| `expiration` | DateTime | ○ | 購読期限 |
| `syncToken` | String(500) | | incremental sync 用トークン |
| `isActive` | Boolean | ○ | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

### 6.5 `contact_history_sync_queue`（外部連携リトライキュー）

「Zoom作成成功したがカレンダー作成失敗」等の部分失敗に備えたリトライ用。

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `contactHistoryId` | Int FK | | |
| `meetingId` | Int FK | | |
| `jobType` | String(50) | ○ | `create_zoom` / `create_meet` / `sync_calendar` / `fetch_recording` / `notify_slack` 等 |
| `payload` | JSON | | ジョブ固有パラメータ |
| `status` | String(30) | ○ | `pending` / `running` / `completed` / `failed` |
| `attemptCount` | Int | ○ | |
| `maxAttempts` | Int | ○ | default 5 |
| `nextAttemptAt` | DateTime | | 次回実行時刻 |
| `lastError` | Text | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

**インデックス**
- `(status, nextAttemptAt)`

---

## 7. スタッフ連携テーブル

### 7.1 `staff_google_auth`（Google OAuth : カレンダー＋Meet兼用）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `staffId` | Int FK | ○ | UNIQUE |
| `googleAccountId` | String(200) | ○ | |
| `googleEmail` | String(255) | | 連携したGoogleアカウントのメール（表示用） |
| `accessToken` | Text | ○ | **暗号化保存** |
| `refreshToken` | Text | ○ | **暗号化保存** |
| `scope` | String(1000) | ○ | 許可スコープ |
| `expiresAt` | DateTime | ○ | アクセストークン期限 |
| `primaryCalendarId` | String(200) | | |
| `linkedAt` | DateTime | ○ | 初回連携日時 |
| `lastRefreshedAt` | DateTime | | 直近のトークン再取得日時 |
| `revokedAt` | DateTime | | 解除日時 |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

### 7.2 `staff_zoom_auth`（Zoom OAuth）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `staffId` | Int FK | ○ | UNIQUE |
| `zoomUserId` | String(200) | ○ | |
| `zoomEmail` | String(255) | | |
| `accessToken` | Text | ○ | 暗号化 |
| `refreshToken` | Text | ○ | 暗号化 |
| `scope` | String(1000) | ○ | |
| `expiresAt` | DateTime | ○ | |
| `linkedAt` | DateTime | ○ | |
| `lastRefreshedAt` | DateTime | | |
| `revokedAt` | DateTime | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

### 7.3 `staff_slack_link`（Slackユーザー ↔ スタッフ紐付け）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `staffId` | Int FK | ○ | UNIQUE |
| `slackUserId` | String(50) | ○ | UNIQUE |
| `slackTeamId` | String(50) | ○ | |
| `slackDisplayName` | String(200) | | |
| `slackEmail` | String(255) | | 照合用（スタッフメールと一致確認） |
| `linkedAt` | DateTime | ○ | |
| `revokedAt` | DateTime | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

### 7.4 `staff_telegram_link`（Telegramユーザー ↔ スタッフ紐付け）

| カラム | 型 | 必須 | 説明 |
|---|---|---|---|
| `id` | Int PK | ○ | |
| `staffId` | Int FK | ○ | UNIQUE |
| `telegramUserId` | BigInt | ○ | UNIQUE |
| `telegramUsername` | String(200) | | |
| `telegramChatId` | BigInt | | ボット個別DM用 chat ID |
| `linkedAt` | DateTime | ○ | |
| `revokedAt` | DateTime | | |
| `createdAt` | DateTime | ○ | |
| `updatedAt` | DateTime | ○ | |

---

## 8. 権限・スタッフ管理との関係

### 8.1 `MasterStaff` との紐付け全体図

```
MasterStaff（スタッフ管理本体）
  │
  ├─ 基本情報: 名前・メール・電話・ログインID・パスワード・isActive
  ├─ 組織ロール: founder / member（organizationRole）
  │
  ├─▶【既存の権限系】
  │   ├─ StaffPermission          （個別権限フラグ）
  │   ├─ StaffRoleAssignment      （ロール割当）
  │   └─ StaffProjectAssignment   （どのプロジェクトにアクセス可）
  │
  └─▶【今回追加する連携系】
      ├─ staff_google_auth        （Googleカレンダー＋Meet許可証）
      ├─ staff_zoom_auth          （Zoom許可証）
      ├─ staff_slack_link         （SlackユーザーID紐付け）
      └─ staff_telegram_link      （TelegramユーザーID紐付け）
```

すべての連携テーブルは `staffId` で `MasterStaff` と紐づく。スタッフ単位で連携情報を一括取得可能。

### 8.2 スタッフ詳細ページ「連携」タブ仕様

**タブ位置**: スタッフ詳細画面に `基本情報` / `権限` / `プロジェクト` / **`連携`** を追加。

**表示内容**（各スタッフ）:
- Googleカレンダー連携ステータス（連携済/未連携、連携アカウント、[再認証][解除]）
- Zoom連携ステータス（同上、未連携時は「Meetで代替」注記）
- Slack連携ステータス（Slackユーザー名表示）
- Telegram連携ステータス（Telegramユーザー名表示）

**操作権限**:

| 操作 | 本人 | 管理者（founder） | 通常メンバー |
|---|---|---|---|
| 自分の連携状況を見る | ○ | ○ | ○(自分のみ) |
| 自分で認証（OAuth） | ○ | ○ | ○ |
| 自分で解除 | ○ | ○ | ○ |
| 他人の連携状況確認 | — | ○ | ✕ |
| 他人の連携強制解除 | — | ○ | ✕ |

### 8.3 退職時・解除時の動作

**`MasterStaff.isActive = false` になったとき（退職）**:
1. ログイン無効化（既存の仕組み）
2. 全連携トークンを自動失効（`revokedAt` セット、外部側でも revoke API 呼出）
3. 進行中の接触履歴でホスト担当のものを抽出し、管理者に通知（ホスト振替要請）
4. Slack/Telegram のリンクは `revokedAt` のみ立てて残す（過去ログの参照用）

**個別解除（本人または管理者操作）**:
- 対象プロバイダの `revokedAt` をセット
- 該当スタッフが進行中の接触履歴でホストの場合、警告表示（「API連携が失われます」）

### 8.4 トークン暗号化方針

- `accessToken` / `refreshToken` は**DB保存時に暗号化**
- アプリケーション層で暗号化/復号（DBダンプ漏洩時の被害最小化）
- 暗号鍵は環境変数で管理、ローテーション可能な仕組みを想定
- ログ・エラーメッセージにトークン値を出力しない

### 8.5 プロジェクトアクセス権による接触履歴フィルタ

既存の `StaffProjectAssignment` を活用：

- HOJO に所属しているスタッフは HOJO の接触履歴のみ作成可
- カレンダー取り込み時も、作成者のプロジェクト所属チェックを通過したもののみ作成
- 権限チェックヘルパーを新規追加: `requireStaffForContactHistory(projectId)`
- 既存のヘルパー（`requireStaffForFinance` 等）と同様のパターン

### 8.6 ホストに関する権限ルール

- ホスト指定できるのは **「接触履歴と同じプロジェクトにアクセス可能なスタッフ」のみ**
- ホスト指定できるのは **「参加スタッフに含まれているスタッフ」のみ**（ホスト = 参加者の誰か）
- 自動生成時のホスト選択肢は「プロジェクトアクセス権 × 参加者 × Zoom/Meet連携済」の3条件を満たすスタッフ

---

## 9. 既存マスタテーブル（変更なし）

以下は既存のまま使い続ける（プロジェクト横断統一マスタ）。

- `contact_methods` — 接触方法（電話/メール/Zoom/Google Meet/訪問...）※`Google Meet` を追加
- `contact_categories` — 接触種別（projectId付き既存マスタ）
- `customer_types` — 顧客種別（projectId付き既存マスタ）

**補足**: 顧客種別タグの中間テーブル（`ContactHistoryRole` / `SlpContactHistoryTag` / `HojoContactHistoryTag`）は、多くのケースで `targetType` が代替できるため**廃止対象**。必要性は移行時に精査。

**顧客種別ドロップダウンの改善**: 新設計では HOJO の接触履歴作成時でも**全プロジェクトの顧客種別**を選択肢に含める（ユーザー要望 (c) の反映）。

---

## 10. 既存データの移行マッピング

### 10.1 テーブル単位のマッピング

| 既存 | 新 |
|---|---|
| `contact_histories`（STP） | `contact_histories`（projectId=STP、status=completed） |
| `slp_contact_histories` | `contact_histories`（projectId=SLP、status=completed） |
| `hojo_contact_histories` | `contact_histories`（projectId=HOJO、status=completed） |
| `contact_history_files`（STP） | `contact_history_files` |
| `slp_contact_history_files` | `contact_history_files` |
| `hojo_contact_history_files` | `contact_history_files` |
| `SlpZoomRecording` | `contact_history_meetings` + `contact_history_meeting_records` に分離 |
| `HojoZoomRecording` | 同上 |
| `ContactHistoryRole` | 廃止（targetType で代替） |
| `SlpContactHistoryTag` | 同上 |
| `HojoContactHistoryTag` | 同上 |
| `SlpContactHistoryLineFriend` | `contact_customer_participants`（targetType=slp_line_friend）複数行に展開 |

### 10.2 カラム単位の主要マッピング

**接触履歴本体**:
- `companyId`（STP）→ `contact_customer_participants`（targetType=stp_company, isPrimary=true）
- `targetType` + `vendorId`（HOJO）→ `contact_customer_participants` の該当行
- `targetType` + `companyRecordId`/`agencyId`（SLP）→ 同上
- `customerParticipants`（テキスト）→ 区切り文字で分割して `contact_customer_attendees` に展開

**会議情報（Zoom）**:
- `SlpZoomRecording.joinUrl/startUrl/password` → `contact_history_meetings`
- `SlpZoomRecording.mp4Path/transcriptText/claudeSummary` → `contact_history_meeting_records`
- `SlpZoomRecording.minutesAppendedAt` → `contact_history_meeting_records.minutesAppendedAt`
- `SlpZoomRecording.isPrimary/label` → `contact_history_meetings.isPrimary/label`
- `SlpZoomRecording.hostStaffId` → `contact_history_meetings.hostStaffId` および `contact_staff_participants.isHost=true`

### 10.3 移行の注意点

- `customerParticipants` テキスト分割は**半自動**（区切り文字揺れ対応、手動確認必要なものが出る）
- マスタ担当者との突合は可能な範囲で自動、マッチしないものは `sourceType=manual` で取り込み
- 既存データは `status=completed` で移行（実施済み扱い）
- 既存機能が壊れないよう、移行後も旧テーブルは**3ヶ月程度残す**（読み取り互換）
- STP の移行は**最後、慎重に**（データ量最大、運用継続中のため）

---

## 11. 新機能との対応表

| 実現したい機能 | 使うテーブル/カラム |
|---|---|
| 予定と実績の管理 | `contact_histories.status` |
| 複数社同時商談 | `contact_customer_participants` 複数行 |
| 先方参加者を追加型で記録 | `contact_customer_attendees` |
| 既存担当者マスタ連携 | `contact_customer_attendees.sourceType/sourceId` |
| 接触履歴から担当者マスタ新規登録 | `contact_customer_attendees.savedToMaster` |
| スタッフ複数指定+ホスト選択 | `contact_staff_participants.isHost` |
| Zoom/Meet選択 | `contact_history_meetings.provider` |
| URL自動生成ON/OFF | `contact_history_meetings.urlSource` |
| URL後入れ・差し替え | `urlSource` の状態遷移 + ホスト変更警告 |
| 1接触に複数会議 | `contact_history_meetings` 1:N + `isPrimary`/`label` |
| QR生成 | `contact_history_meetings.joinUrl` |
| 議事録自動追記（Zoom/Meet共通） | `meeting_records.aiSummary` → `contact_histories.meetingMinutes` |
| Slack/Telegramから作成 | `contact_histories.sourceType` + `staff_slack_link`/`staff_telegram_link` |
| スタッフ全員のカレンダー同期 | `contact_staff_participants.googleCalendarEventId` + `staff_google_auth` |
| カレンダーから逆取り込み | `calendar_project_mapping` + `google_calendar_subscriptions` |
| 双方向同期のループ防止 | `contact_history_external_events` UNIQUE制約 |
| リマインダー通知 | `contact_history_notifications` |
| リスケ対応 | `rescheduledFromAt/Count/Reason` |
| キャンセル | `status=cancelled` + `cancelledAt/Reason` |
| タイムゾーン | `Timestamptz` + `displayTimezone` |
| AI要約バージョン管理 | `meeting_record_summaries` |
| 部分失敗のリトライ | `contact_history_sync_queue` |
| API連携の自動判定 | `apiIntegrationStatus` |
| ホスト変更警告 | `hostUrlConsistencyConfirmedAt` |
| スタッフ連携情報の一元管理 | スタッフ詳細「連携」タブ |
| 退職時の連携自動失効 | `revokedAt` カラム |

---

## 12. 実装フェーズ案（SLP → HOJO → STP）

### Phase 1: SLP 接触履歴の基盤移行
- `contact_histories`（SLPデータのみ）
- `contact_customer_participants`
- `contact_customer_attendees`
- `contact_staff_participants`
- `contact_history_files`
- SLP既存データ移行 + SLP既存画面の置き換え
- **完了条件**: SLPで新画面のみで運用可能

### Phase 2: SLP 会議関連の移行
- `contact_history_meetings`
- `contact_history_meeting_records`
- `meeting_record_summaries`
- 既存 `SlpZoomRecording` データ移行
- Zoom URL手動入力・自動生成UI（5パターン網羅 + ホスト変更警告）
- API連携自動判定（`apiIntegrationStatus`）

### Phase 3: SLP Slack / Telegram / Google Meet 連携
- `staff_zoom_auth` / `staff_google_auth`（SLPスタッフ対象）
- `staff_slack_link` / `staff_telegram_link`
- スタッフ詳細「連携」タブUI
- Slack / Telegram ボット実装
- Google Meet 会議作成 + Transcript / Gemini Notes 取得
- `contact_history_notifications` 通知基盤

### Phase 4: SLP Googleカレンダー双方向連携
- `calendar_project_mapping`
- `google_calendar_subscriptions` (Push Notifications)
- `contact_history_external_events`（ループ防止）
- カレンダー逆取り込みロジック
- スタッフ全員のカレンダー同期
- `contact_history_sync_queue`（リトライ基盤）

### Phase 5: HOJO 横展開
- HOJO既存データ移行
- HOJO固有の targetType（vendor/bbs/lender/other）対応
- HOJOスタッフの連携設定
- HOJO画面の新UI適用

### Phase 6: STP 横展開（最も慎重に）
- STP既存データ移行（**データ量最大、本番運用中のため計画停止必要**）
- STP固有の targetType（stp_company/stp_agent）対応
- STPスタッフの連携設定
- STP画面の新UI適用
- 旧テーブルの段階的廃止準備

### Phase 7: 運用品質向上
- AI要約バージョン履歴UI（`meeting_record_summaries` 表示）
- 監査ログの充実
- 管理画面（連携設定の一覧・健全性監視）
- 繰り返し会議（`recurringSeriesId`）の本実装
- 接触シリーズ（`parentContactHistoryId`）の本実装
- 旧テーブル削除（移行後3ヶ月以降）

---

## 13. 設計確定サマリー（決定事項一覧）

### 構造的決定
1. **3テーブル統一**: `contact_histories` 1本化、`targetType` で相手種別を表現
2. **予定と実績を同テーブル**: `status` で区別、状態遷移で完結
3. **参加者の2層構造**: 顧客側エンティティ → 個人、弊社スタッフは別テーブル
4. **会議情報の分離**: 「予定・URL」と「実施後データ」を別テーブル
5. **1接触に複数会議**: `contact_history_meetings` は1:N、`isPrimary` + `label` で主従
6. **プロバイダ統合**: `provider` カラム + JSON メタデータで Zoom/Meet/Teams を一元扱い
7. **UTC + タイムゾーン**: 最初から用意、将来の海外展開に備える

### API連携・会議運用
8. **API連携は自動判定のみ**: ホスト連携状態で決まる（モード選択なし）
9. **ホスト=API使用者**: ホストのトークンのみ使用、他参加者の連携は使わない
10. **ホスト変更時の警告**: URL設定済み + 連携状態変化時にダイアログ
11. **5パターン網羅**: 自動生成/後から自動生成/作成時手動/作成後手動/URL無し

### 権限・スタッフ管理
12. **MasterStaff 中心**: 全連携テーブルが `staffId` で紐づく
13. **スタッフ詳細「連携」タブ**: 自分の連携を一元管理、管理者は他人の確認可
14. **退職時自動失効**: `revokedAt` で外部トークンも revoke
15. **トークン暗号化**: アプリ層で暗号化、DBダンプ漏洩時の被害最小化
16. **プロジェクトアクセス権**: 既存 `StaffProjectAssignment` を活用してフィルタ
17. **ホスト選択制約**: プロジェクトアクセス可 × 参加者 × （自動生成時は連携済）

### 連携・運用
18. **Zoom方式**: 各スタッフごとのOAuth、未連携者は Meet 使用
19. **Googleカレンダー判定**: `calendar_project_mapping` でカレンダー + キーワード判定
20. **Slack/Telegram 両方対応**: 業務ロジック共通化、送受信層のみ分離
21. **カレンダーループ防止**: `contact_history_external_events` の UNIQUE 制約が要
22. **部分失敗のリトライ**: `contact_history_sync_queue` で自動再試行
23. **AI要約バージョン管理**: `meeting_record_summaries` で履歴保持

### 移行・実装
24. **SLP → HOJO → STP の順**: SLP から着手、STPは最後で慎重に
25. **ローカル → stg → 本番一発切替**: 本番は計画メンテで一気に移行
26. **旧テーブル3ヶ月残す**: ロールバック余地確保
27. **顧客種別タグ中間テーブル廃止**: `targetType` で代替、必要性は移行時精査

---

## 付録A: ER図（簡易）

```
┌──────────────────────┐
│ contact_histories    │
│ (projectId, status,  │
│  scheduledStartAt,   │
│  meetingMinutes,...) │
└─────────┬────────────┘
          │
   ┌──────┼──────┬───────────┬───────────┬──────────────┐
   │      │      │           │           │              │
   ▼      ▼      ▼           ▼           ▼              ▼
┌──────┐ ┌──────┐ ┌────────┐ ┌────────┐ ┌───────────┐ ┌──────────┐
│cust. │ │staff │ │ files  │ │meetings│ │notifs     │ │external  │
│parti-│ │parti-│ └────────┘ └───┬────┘ │(reminders)│ │events    │
│cipants│ │cipants│              │      └───────────┘ │(calendar)│
└───┬──┘ └──┬───┘                │                    └──────────┘
    │       │                    │
    ▼       ▼                    ▼
┌──────────┐  ┌────────────┐ ┌─────────────┐
│attendees │  │staff linked│ │meeting      │
│(個人)    │  │to MasterSt.│ │_records     │
└──────────┘  └────────────┘ │(録画・議事録)│
                             └──────┬──────┘
                                    │
                                    ▼
                             ┌────────────┐
                             │summaries   │
                             │(AI要約履歴)│
                             └────────────┘

┌──────────────┐
│ MasterStaff  │──┬─▶ staff_google_auth
│ (既存)       │  ├─▶ staff_zoom_auth
└──────────────┘  ├─▶ staff_slack_link
                  ├─▶ staff_telegram_link
                  ├─▶ StaffPermission (既存)
                  ├─▶ StaffRoleAssignment (既存)
                  └─▶ StaffProjectAssignment (既存)
```

---

## 付録B: 命名規則

- テーブル名: snake_case、複数形
- カラム名: camelCase（Prisma標準）、`@map("snake_case")` でDBカラム名指定
- 外部キー: `entityId` 形式（例: `contactHistoryId`）
- タイムスタンプ: UTC保存は `Timestamptz(6)`、ローカル時刻用途は `DateTime`
- Boolean: `is` / `has` プレフィックス（例: `isPrimary`, `isHost`）
- ステータス文字列: 英語スネーク（`scheduled`, `completed`...）
- 暗号化保存対象: カラムコメントで `※暗号化` を明示

---

## 付録C: 会話履歴に基づく設計経緯

**2026-04-21 初稿**:
- 3テーブル統一の方針決定
- 顧客参加エンティティ + 先方参加者の2層構造採用
- 会議情報をプロバイダ非依存の1テーブルで設計

**2026-04-21 改訂**:
- Zoom情報を接触履歴から分離、会議テーブル新設
- Google Meet 対応のため会議を「本体」と「記録」に2層分離
- 1接触に複数会議を許可（`isPrimary`/`label`）

**2026-04-23 確定**:
- API連携の「モード選択」を廃止、自動判定のみに簡素化
- ホスト変更時の警告フロー追加（`hostUrlConsistencyConfirmedAt`）
- URL入力5パターンの網羅確認
- 権限・スタッフ管理（MasterStaff）との紐付け詳細化
- 運用前提（Zoom方式/カレンダー/着手順/チャットボット/移行）を確定
- 実装フェーズ案を SLP→HOJO→STP の順に確定
