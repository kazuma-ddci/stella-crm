# 接触履歴V2 実装レビュー結果（2026-04-30）

## 前提

- 対象ブランチ: `feature/new-contact-history`
- レビュー対象: 接触履歴 V1 -> V2 完全移行、特に SLP 商談セッション連動部分
- 参照設計書:
  - `docs/plans/contact-history-unification-plan.md`
  - `docs/plans/slp-meeting-session-refactor-plan.md`
  - `docs/plans/slp-contact-history-zoom-refactor-plan.md`
- 実施内容: コード修正なしのレビューのみ

## 総合評価

**NEEDS_FIX**

主要な V1 -> V2 移行はかなり進んでいるが、リリース前に直した方がよい不整合が残っている。

## 致命的な問題（本番リリース前に必ず修正）

### 1. ProLine予約webhookの冪等性が副作用送信まで守られていない

- 優先度: P0
- ファイル: `src/app/api/public/slp/briefing-reservation/route.ts:388-405`
- 関連ファイル:
  - `src/app/api/public/slp/consultation-reservation/route.ts:295-311`
  - `src/lib/slp/session-helper.ts:440-456`

`applyProlineReservationToSession` は同じ `prolineReservationId` の既存セッションを返して冪等化している。しかし呼び出し側は、既存/新規を区別せず `handleSessionReservationSideEffects` を必ず実行する。

具体的なシナリオ:

1. ProLine から同じ予約 webhook が再送される。
2. `applyProlineReservationToSession` は既存セッションを返すため、セッション自体は増えない。
3. その後 `handleSessionReservationSideEffects` が再実行される。
4. Form16/Form17 の顧客通知と、概要案内1回目なら紹介者 Form18 が再送される。

修正案:

- `applyProlineReservationToSession` の戻り値を `{ session, action: "created" | "promoted" | "noop" }` のように変更し、`noop` の場合は通知しない。
- もしくは V2 primary meeting の `confirmSentAt` を confirm 送信前に確認し、送信済みなら confirm 通知を止める。

影響範囲:

- ProLine予約 webhook の再送
- 顧客向け Form16/Form17
- 紹介者向け Form18

## 軽微な問題（修正推奨）

### 2. URLなし通知後にZoom URLを自動送信する経路がない

- 優先度: P1
- ファイル: `src/app/slp/companies/[id]/zoom-meeting-actions.ts:17-20`
- 関連ファイル:
  - `src/app/slp/companies/[id]/components/session-zoom-issue-panel.tsx:299-333`
  - `src/lib/slp/slp-session-notification.ts:30-47`
  - `prisma/migrations/20260430124500_seed_slp_v2_no_url_notification_templates/migration.sql:28-49`

URLなしテンプレートは「Zoom URLは準備でき次第、改めてお送りいたします」と送る。一方、再発行/手動URL設定の実装は「自動送信されません」前提で、`regenerated_manual_notice` も通知処理の `NotificationTrigger` 型に入っていない。

具体的なシナリオ:

1. Zoom未連携スタッフでProLine予約が入る。
2. 顧客には URLなし予約確定通知が送られる。
3. 後でスタッフがZoom URLを再発行または手動入力する。
4. 顧客へURLは自動送信されず、スタッフの手動コピー運用に依存する。

修正案:

- 再発行成功・手動URL設定成功時に `regenerated_manual_notice` を Form16/Form17 で自動送信する。
- もしくは URLなしテンプレートの文面を「公式LINEで案内します」など、手動運用に合わせた内容へ変更する。

影響範囲:

- Zoom未連携/Zoom API失敗時の予約確定通知
- 後続のZoom URL案内
- 顧客体験

### 3. 商談完了時にV2会議stateが連動しない

- 優先度: P1
- ファイル: `src/lib/slp/v2-session-sync.ts:441-459`

`completeV2ForSession` は `ContactHistoryV2.status` と `actualEndAt` だけを更新し、`ContactHistoryMeeting.state` を更新していない。設計書では `status=completed` 時に会議 `state` を「取得中」または「完了」へ遷移させる前提。

具体的なシナリオ:

1. 商談タブで予約中の商談を完了にする。
2. V2接触履歴本体は `completed` になる。
3. 紐づく会議カードは `state="予定"` のまま残る。
4. スタッフが「まだ予定扱いなのか」と誤認する。

修正案:

- 完了同期時に、URL/API連携ありの会議は `取得中`、URLなし・手動URL・API不可の会議は `完了` へ更新する。
- 既に `完了` / `失敗` の会議は上書きしない。

影響範囲:

- 商談完了処理
- V2接触履歴詳細
- Zoom録画取得状態の表示

### 4. Zoom AI要約が接触履歴の議事録欄へ自動追記されない

- 優先度: P1
- ファイル: `src/lib/contact-history-v2/zoom/direct-processor.ts:186-191`
- 関連設計:
  - `docs/plans/contact-history-unification-plan.md:59-63`
  - `docs/plans/contact-history-unification-plan.md:409`
  - `docs/plans/slp-contact-history-zoom-refactor-plan.md:637`

V2 direct processor は Zoom AI Companion 要約を `ContactHistoryMeetingRecord` と `MeetingRecordSummary` に保存するが、設計書で確定している `meetingMinutes` への自動追記と `minutesAppendedAt` による二重防止がない。

具体的なシナリオ:

1. SLP商談セッション経由で発行されたZoomが終了する。
2. Zoom webhook から V2 direct processor が動く。
3. 録画・参加者・AI要約は取得される。
4. しかし商談タブやV2接触履歴の「議事録」欄には反映されない。

修正案:

- `saveZoomAiCompanionSummary` 後に `ContactHistoryV2.meetingMinutes` へ区切り線付きで追記する。
- `ContactHistoryMeetingRecord.minutesAppendedAt` を立て、二重追記を防ぐ。
- V1の `appendRecordingMinutes` 相当を V2 meeting record 用に作る。

影響範囲:

- Zoom webhook -> V2 direct processor
- 商談タブの接触履歴モーダル
- V2接触履歴詳細
- 議事録自動反映

### 5. 商談内の接触履歴モーダルで顧客種別と先方参加者が同じ値になる

- 優先度: P2
- ファイル: `src/app/slp/companies/[id]/components/session-contact-histories-modal.tsx:160-184`
- 関連ファイル: `src/app/slp/companies/[id]/session-actions.ts:371-388`

表示側で「プロジェクト・顧客種別」と「先方参加者」の両方に `current.customerLabels` を使っている。`customerLabels` は `targetType` と参加者名を混ぜた表示なので、先方参加者欄としては不正確で、顧客種別欄にも参加者名が混ざる。

具体的なシナリオ:

1. 商談タブから接触履歴モーダルを開く。
2. 「プロジェクト・顧客種別」と「先方参加者」に同じ文字列が表示される。
3. スタッフが顧客分類と実際の参加者を区別できない。

修正案:

- loader の戻り値を `customerTargets` と `attendeeNames` に分ける。
- 顧客種別欄には `targetType/targetId` を表示する。
- 先方参加者欄には `attendees.name` だけを表示する。

影響範囲:

- 商談タブ内の接触履歴閲覧モーダル
- スタッフの確認作業

## 実装済みと判断できる点

- LINE通知の `{{zoomUrl}}` は V1録画ではなく V2 `ContactHistoryMeeting.joinUrl` を参照している。
- 商談タブのZoom表示も V2 meeting 由来になっている。
- 商談日時/担当者変更、削除、未予約戻し、キャンセル/飛び後の再予約時のZoom再発行は概ね修正方針に沿っている。
- リマインダーcronは V2 meeting を見つつ、対応する商談セッションがまだ予約中か再確認している。
- 商談連動V2接触履歴は、V2画面から直接編集/削除できないようになっている。
- `sourceType/sourceRefId` の一意制約と重複検出migrationは入っている。
- V2汎用ホスト変更の「新Zoom作成後に旧Zoom削除」は直っている。

## 設計上の確認事項

URLなし通知の方針は、現状だと「予約予定は送るが、後でURLができても自動送信しない」になっている。お客様体験としては、URLなし文面を送るなら、後続のURL送信もCRMから自動化した方が安全。

## 補足

このレビューは読み取り専用で実施した。レビュー時点ではテスト実行はしていない。
