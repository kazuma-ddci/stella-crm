# SLP（公的プロジェクト）機能 全体マニュアル

このドキュメントは、Stella CRM の **SLP（公的制度教育推進協会）プロジェクト** に実装されている全機能を、ユーザーの動線順にまとめたものです。スタッフがどの場面でどんな挙動が起きるか把握するために使用してください。

最終更新: 2026-04-09

---

## 目次

### A. ユーザーが体験する流れ
- [A-1. LINE友達追加（紹介経由 or 直接）](#a-1-line友達追加紹介経由-or-直接)
- [A-2. 組合員入会フォーム送信](#a-2-組合員入会フォーム送信)
- [A-3. クラウドサイン契約書の送付](#a-3-クラウドサイン契約書の送付)
- [A-4. 契約書未締結時の自動リマインド](#a-4-契約書未締結時の自動リマインド)
- [A-5. クラウドサイン送信失敗の検知](#a-5-クラウドサイン送信失敗の検知)
- [A-6. 契約書締結 → リッチメニュー切替](#a-6-契約書締結--リッチメニュー切替)
- [A-7. 概要案内の予約](#a-7-概要案内の予約)
- [A-8. 概要案内予約の変更](#a-8-概要案内予約の変更)
- [A-9. 概要案内予約のキャンセル](#a-9-概要案内予約のキャンセル)
- [A-10. 概要案内の完了処理（手動）](#a-10-概要案内の完了処理手動)

### B. CRMの管理画面
- [B-1. 企業名簿](#b-1-企業名簿)
- [B-2. 組合員名簿](#b-2-組合員名簿)
- [B-3. 公式LINE友達情報](#b-3-公式line友達情報)
- [B-4. 契約書管理](#b-4-契約書管理)
- [B-5. 契約書リマインド](#b-5-契約書リマインド)
- [B-6. 自動化エラー](#b-6-自動化エラー)
- [B-7. 設定（プロジェクト設定／概要案内担当者マッピング／資料管理／プロライン情報）](#b-7-設定)

### C. 全Webhook / Cron / 外部URL一覧
- [C-1. CRMが受信するWebhook](#c-1-crmが受信するwebhook)
- [C-2. 定期実行されるCron](#c-2-定期実行されるcron)
- [C-3. CRMから実行する外部URL（プロライン）](#c-3-crmから実行する外部urlプロライン)

---

# A. ユーザーが体験する流れ

## A-1. LINE友達追加（紹介経由 or 直接）

### 起こること
1. お客様が公式LINEを友達追加します。
2. 紹介者URLから追加した場合は、プロライン側で `free1` に**紹介者のUID**が記録されます。
3. プロラインから CRM に Webhook が飛んできて、**公式LINE友達情報**ページに新規レコードが追加されます。
4. 紹介者がいる場合（free1あり）→ **紹介者の公式LINE宛にメッセージが自動送信されます**（form4）。

### スタッフが気にする点
- 友達追加直後に「○○さんが追加されました」と紹介者にメッセージが届きます。
- 紹介経由でない場合（free1なし）は通知は送られません。
- メッセージ送信に失敗した場合は **自動化エラー** ページに記録されます。

### 関連URL
- **CRMが受信するWebhook**: `GET /api/public/slp/line-friend-webhook?secret=XXX&uid=...&snsname=...&free1=...&...`
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/HnUSeKL5O9?uid=[紹介者UID]`（form4-1: 友達のsnsname）

---

## A-2. 組合員入会フォーム送信

### 起こること
1. お客様が公式LINEのリッチメニュー「組合入会はこちら」をタップ → 入会フォームが開きます。
2. お客様がフォームに必要事項を入力して送信します。
3. CRM の `member-registration` API が呼ばれて **組合員名簿** にレコードが新規追加されます。
4. プロジェクト設定で「契約書自動送付」が **ON** の場合、続いてクラウドサイン契約書が自動送付されます。

### スタッフが気にする点
- 組合員名簿にすぐにレコードが追加されるので、データを確認できます。
- 同じ uid で2回目以降の入会申込があった場合の挙動：
  - **既に契約締結済み** → "already_signed" を返す（何もしない）
  - **送付済み + メアド変わってない** → リマインドボタンを表示
  - **送付済み + メアド変わってる** → メアド変更確認 → 新メアドで再送付
- メールアドレス変更は **2回まで** 許容されます。

### 関連URL
- **CRMが受信**: `POST /api/public/slp/member-registration`（JSON body: uid, name, email, phone, ...）

---

## A-3. クラウドサイン契約書の送付

### 起こること
1. 入会フォーム回答時、設定が ON なら自動でクラウドサインが送付されます。
2. CRM内部で「契約書送付済」ステータスに変わります。
3. **MasterContract** にも契約書レコードが作成されます（cloudsignStatus: "sent"）。

### スタッフが気にする点
- お客様には **クラウドサインからメール** が届きます。
- ステータスが「契約書送付済」となります。
- もし **メールアドレスが無効** だった場合は、後述の [A-5: 送信失敗検知](#a-5-クラウドサイン送信失敗の検知) で検知されます。

### 設定箇所
- 「契約書自動送付ON/OFF」: `/slp/settings/project` の **契約書自動送付** スイッチ

---

## A-4. 契約書未締結時の自動リマインド

### 起こること
1. 毎日10:00（VPSのcrontab）に CRM が「契約書送付済 かつ N日経過 かつ 未リマインド」の組合員を抽出します。
2. クラウドサインの **リマインドAPI** を実行 → お客様に再度クラウドサインのメールが届きます。
3. 同時に、お客様の **公式LINEにも契約書リマインドメッセージが届きます**（Form15 組合員向け契約書通知統合フォーム / `trigger=contract_reminder`）。

### LINE通知の文面
本文は `/slp/settings/notification-templates` の「組合員向け」タブ → 「契約書関連」で編集可能（デフォルトは下記）。

```
【組合員契約書のお手続きについて】

いつもお世話になっております。

{{contractSentDate}}にお送りいたしました組合員契約書につきまして、現時点でお手続きが完了していないようでございます。

下記メールアドレス宛にクラウドサインよりご案内をお送りしておりますので、お手数ですが内容をご確認いただき、お手続きをお願いいたします。

送付先：{{contractSentEmail}}

ご不明な点がございましたら、お気軽にお問い合わせください。
何卒よろしくお願いいたします。
```

変数: `{{memberName}}` / `{{contractSentDate}}` / `{{contractSentEmail}}` が利用可能。

### スタッフが気にする点
- リマインド対象から **特定の組合員を除外** したい場合は、組合員名簿で「リマインド除外」フラグをONにします。
- 自動リマインドは **1組合員につき1回のみ**。期限切れ後に再フォーム送信されたら再度対象になります。
- リマインド日数（何日経過後にリマインドするか）は **プロジェクト設定** で変更できます。
- 組合員名簿の **リマインド送付ボタン** から**手動でも実行可能**です。手動実行時もLINE通知は同時に送信されます。
- 文面を変更したい場合は通知テンプレ設定ページから編集してください（開発不要）。

### 関連URL
- **自動Cron**: `GET /api/cron/remind-slp-members`（VPS crontabで毎日10時実行）
- **CRMから実行（LINE通知）**: `POST https://zcr5z7pk.autosns.app/fm/q4KYTVil9N?uid=[組合員のuid]`（Form15 統合フォーム / `form15-1` にテンプレレンダリング後の完成文面を送信）
- **送信経路**: `src/lib/slp/slp-member-notification.ts` の `sendMemberNotification({ trigger: "contract_reminder", ... })`

---

## A-5. クラウドサイン送信失敗の検知

### 起こること
1. クラウドサインからメールを送付したが、お客様のメールアドレスが無効だった場合、クラウドサインが **Webhook** で CRM に通知します（text フィールドが `BOUNCED : ...` で始まる）。
2. CRM は text から不達メールアドレスを抽出します。
3. 該当する組合員レコードに「送信失敗フラグ」を立てます。
4. 組合員名簿でその行が **赤背景**＋「✉️送信失敗」バッジで表示されます。
5. 自動化エラーページにも記録されます。

### スタッフの対処
- 組合員名簿で赤くなっている人に対し、メールアドレスを修正してから「新規契約書送付」ボタンで再送付してください。

### 設定箇所
- クラウドサイン管理画面: **設定 > Web API > Webhook** で、以下のURLを登録し「メール不達時」にチェックを入れる
  - 本番: `https://portal.stella-international.co.jp/api/cloudsign/webhook?token=<CLOUDSIGN_WEBHOOK_SECRET>`
  - stg:  `https://stg-portal.stella-international.co.jp/api/cloudsign/webhook?token=<CLOUDSIGN_WEBHOOK_SECRET>`
- メール受信設定は **不要**（Webhookで検知するため IMAP 巡回は廃止）

### 関連エンドポイント
- **Webhook受信**: `POST /api/cloudsign/webhook`（締結・取消・メール不達すべて同じURL）

---

## A-6. 契約書締結 → リッチメニュー切替

### 起こること
1. お客様がクラウドサイン上で署名 → クラウドサイン側から CRM に Webhook が飛びます。
2. CRM はステータスを「**組合員契約書締結**」に更新します。
3. **紹介者の公式LINEにメッセージが自動送信されます**（form5）。
4. **お客様の公式LINEのリッチメニューが組合員専用メニューに切り替わります**（リッチメニュー切替URL実行）。

### 重要：LINE後紐付けの遅延処理
契約締結が完了したタイミングで、お客様がまだ公式LINEを友達追加していなかった場合：
- リッチメニュー切替・紹介者通知 が「保留状態」になります。
- その後、お客様が公式LINEを友達追加した瞬間に：
  - **リッチメニュー切替は必ず実行されます**（必須）
  - 紹介者通知（form5）は **プロジェクト設定がONの場合のみ自動実行**（OFFの場合は組合員名簿から手動送信）

### 設定箇所
- 「LINE後紐付け時の紹介者通知」スイッチ: `/slp/settings/project`

### 関連URL
- **CRMが受信**: `POST /api/cloudsign/webhook`
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/UrXFSkd82v?uid=[紹介者UID]`（form5-1: lineName, form5-2: name）
- **CRMから実行（リッチメニュー切替）**: `GET https://autosns.jp/api/call-beacon/xZugEszbhx/[組合員のuid]`

---

## A-7. 概要案内の予約

### 起こること
1. お客様が公式LINEで「概要案内予約」を行うと、プロラインから CRM に Webhook が飛びます。
2. CRM の **企業名簿**に新規レコードが追加されます。
3. ステータスは「**予約中**」になります。
4. 担当者として、予約者の公式LINEユーザーが**自動で追加**されます。
   - 役割: 「概要案内予約者」
   - メールアドレス: 組合員名簿から自動取得
   - 公式LINE: 自動紐付け
5. 概要案内担当者名（プロラインから来るテキスト）が**マッピング表**に登録済みなら、対応するスタッフが自動で紐付きます。
6. **紹介者の公式LINEにメッセージが自動送信されます**（form6）。

### 関連URL
- **CRMが受信**: `GET /api/public/slp/briefing-reservation?secret=XXX&uid=[[uid]]&booked=[[cl1-booking-create]]&briefingDate=[[cl1-booking-start]]&briefingStaff=[[cl1-booking-staff]]`
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/R1eZuaU0hb?uid=[紹介者UID]`（form6-1: snsname, form6-2: 概要案内日）

---

## A-8. 概要案内予約の変更

### 起こること
1. お客様が予約日時を変更すると、プロラインから CRM に Webhook が飛びます。
2. CRM 側で該当の企業名簿レコードを検索し、**予約日 / 案内日 / 案内担当者** を上書きします。
3. **変更日時** が記録されます（履歴ポップオーバーで確認可）。
4. **紹介者の公式LINEにメッセージが自動送信されます**（form7）。

### 関連URL
- **CRMが受信**: `GET /api/public/slp/briefing-change?secret=XXX&uid=[[uid]]&booked=[[cl1-booking-create]]&briefingDate=[[cl1-booking-start]]&briefingStaff=[[cl1-booking-staff]]`
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/B6EuRmzFs9?uid=[紹介者UID]`（form7-1: snsname, form7-2: 新しい概要案内日）

---

## A-9. 概要案内予約のキャンセル

### 起こること
1. お客様が予約をキャンセルすると、プロラインから CRM に Webhook が飛びます（uidのみ）。
2. CRM 側で該当レコードのステータスを「**キャンセル**」に変更します。
3. **キャンセル日時** が記録されます（履歴ポップオーバーで確認可）。
4. **紹介者の公式LINEにメッセージが自動送信されます**（form9）。

### 関連URL
- **CRMが受信**: `GET /api/public/slp/briefing-cancel?secret=XXX&uid=[[uid]]`
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/MmAiXC8uOh?uid=[紹介者UID]`（form9-1: snsname）

---

## A-10. 概要案内の完了処理（手動）

### 起こること
1. 実際に概要案内が終わったら、スタッフが企業名簿を開きます。
2. 該当企業のステータスを **「予約中」→「完了」** に変更します。
3. **完了モーダル**が開きます：
   - **お礼メッセージ入力欄**（フリーテキスト）
   - **担当者選択**（チェックボックス）— 公式LINE紐付けあり/なしで選択可能/不可
4. 「保存して送信」を押すと：
   - 選択した担当者の公式LINEに **お礼メッセージ** が送信されます（form11）
   - 選択した担当者の **紹介者** にも完了通知が送信されます（form10）
     - 同じ紹介者を持つ複数の担当者がいる場合は **1通だけ送信**（snsname はカンマ区切り）
   - 全担当者（公式LINE紐付け済）に **概要案内完了タグ** が付与されます

### キャンセル → 完了のケース
ステータスを「キャンセル → 完了」にする場合は、まず**理由入力**が必要 → その後完了モーダルへ進みます。

### ステータス変更時の挙動まとめ

| 現在 | 変更先 | 動作 |
|------|------|------|
| 予約中 | 完了 | 完了モーダル直接（理由不要） |
| キャンセル | 完了 | 理由入力 → 完了モーダル |
| 予約中 | キャンセル | 理由入力モーダル |
| キャンセル | 予約中 | 理由入力モーダル |
| 完了 | 予約中 | 理由入力モーダル + **タグ削除** |
| 完了 | キャンセル | 理由入力モーダル + **タグ削除** |

### 概要案内完了タグの自動連動
- ステータスが「完了」になると → **企業の全担当者**にタグ付与
- ステータスが「完了」から離れると → **企業の全担当者**からタグ削除
- 完了状態の企業に **担当者を追加** → その担当者にタグ付与
- 完了状態の企業から **担当者を削除** → その担当者からタグ削除
- 完了状態の企業の担当者に **後から公式LINE紐付け** → タグ付与

### 関連URL
- **CRMから実行（お礼メッセージ）**: `POST https://zcr5z7pk.autosns.app/fm/YjNCxOyln8?uid=[受講者UID]`（form11-1: フリーテキスト）
- **CRMから実行（紹介者通知）**: `POST https://zcr5z7pk.autosns.app/fm/IAsRa82wNF?uid=[紹介者UID]`（form10-1: snsname）
- **CRMから実行（タグ付与）**: `GET https://autosns.jp/api/call-beacon/pWp2FUaCif/[組合員uid]`
- **CRMから実行（タグ削除）**: `GET https://autosns.jp/api/call-beacon/R0I3t5ARZq/[組合員uid]`

---

# B. CRMの管理画面

## B-1. 企業名簿

**パス**: `/slp/companies`

**できること**:
- 概要案内予約があった企業の一覧表示
- 検索（企業名 / 企業No / 担当営業）、ステータスフィルタ
- 企業詳細ページへの遷移
- 「新規企業を追加」で手動レコード作成
- 各レコードの担当者管理（複数人対応、主担当設定）
- 概要案内ステータス変更（理由入力＋履歴記録）
- 概要案内予約の変更履歴・キャンセル履歴の確認（時計アイコンのポップオーバー）

---

## B-2. 組合員名簿

**パス**: `/slp/members`

**できること**:
- 組合員一覧表示
- 新規メンバー追加（手動）
- 「契約管理」ボタン: 個別の契約書管理モーダル
- 「新規契約書送付」ボタン: 個別にクラウドサイン送付
- 「リマインド送付」ボタン: クラウドサインリマインド + LINE通知（Form15 / trigger=contract_reminder）
- 「紹介者通知」ボタン: form5 を手動送信
- 一括契約書送付（複数選択）

**色分け**:
- 🔴 **赤背景**: クラウドサインメール送信失敗（バッジ「✉️送信失敗」）
- 🌸 **薄赤背景**: 公式LINE未紐付け
- 🟡 **黄背景**: 紹介者未通知

---

## B-3. 公式LINE友達情報

**パス**: `/slp/line-friends`

**3つのタブ構成**:
1. **公式LINE友達情報** — プロラインの全項目（snsname, email, phone, free1〜6 など）
2. **ユーザー情報** — 番号 / LINE名 / 紹介者 / 組合員ステータスを簡潔表示
3. **AS管理** — ASスタッフ管理

---

## B-4. 契約書管理

**パス**: `/slp/contracts`

**できること**:
- すべての MasterContract の一覧（CloudSign状態・送付日・締結日）
- 契約書ステータスの確認

---

## B-5. 契約書リマインド

**パス**: `/slp/reminders`

**できること**:
- 契約書未締結のリマインド対象一覧
- 一括リマインド送付

---

## B-6. 自動化エラー

**パス**: `/slp/automation-errors`

**できること**:
- すべての自動化処理の失敗ログ閲覧
- 「未解決 / 解決済み」タブで切り替え
- エラー詳細の展開
- **リトライボタン**で個別に再実行可能（成功すると自動的に解決済みになる）
- 「解決済みにする」ボタンで手動マーク

**リトライ可能なエラータイプ**:
- プロラインフォーム送信
- クラウドサイン契約書送付
- 概要案内完了タグ付与/削除
- 概要案内予約/変更/キャンセル通知（form6/7/9）
- 概要案内完了通知（form10）
- 概要案内お礼メッセージ（form11）
- 契約書リマインドLINE（Form15 統合・trigger=contract_reminder）

---

## B-7. 設定

### B-7-1. プロジェクト設定 (`/slp/settings/project`)
- 契約書自動送付 ON/OFF
- LINE後紐付け時の紹介者通知（Form5）自動送信 ON/OFF
- 入会フォーム用契約種別の選択
- リマインド日数の設定
- メール / 銀行口座の紐付け

### B-7-2. 概要案内担当者マッピング (`/slp/settings/briefing-staff`)
- プロラインから送られてくる「概要案内担当者名」を、CRM スタッフ・公式LINE友達と紐付け
- これにより企業名簿で「{スタッフ名}」が表示される

### B-7-3. 資料管理 (`/slp/settings/documents`)
- 組合員向け配布資料（PDF）のアップロード・管理
- 1つの「現在有効な資料」を切り替え可能

### B-7-4. プロライン情報 (`/slp/settings/proline`)
- プロラインアカウント情報（ログイン情報など）

---

# C. 全Webhook / Cron / 外部URL一覧

## C-1. CRMが受信するWebhook

| パス | メソッド | 認証 | 役割 |
|------|--------|------|------|
| `/api/public/slp/line-friend-webhook` | GET | secret | LINE友達追加・更新 |
| `/api/public/slp/member-registration` | POST | なし | 入会フォーム送信 |
| `/api/public/slp/member-remind` | POST | なし | リマインド送付（フォームから） |
| `/api/public/slp/briefing-reservation` | GET | secret | 概要案内予約 |
| `/api/public/slp/briefing-change` | GET | secret | 概要案内予約変更 |
| `/api/public/slp/briefing-cancel` | GET | secret | 概要案内予約キャンセル |
| `/api/cloudsign/webhook` | POST | clientId検証 | クラウドサイン契約状態変更 |

### Webhookの認証
- **secret方式**: クエリパラメータ `secret=XXX` を環境変数 `LINE_FRIEND_WEBHOOK_SECRET` と照合
- **クラウドサインWebhook**: clientId が `OperatingCompany.cloudsignClientId` と一致するかを確認

---

## C-2. 定期実行されるCron

| パス | 推奨頻度 | 役割 |
|------|---------|------|
| `/api/cron/remind-slp-members` | 毎日10:00 | 契約書未締結リマインド送付（クラウドサイン + LINE） |
| `/api/cron/check-cloudsign-signing` | 5分に1度 | クラウドサイン署名URL取得 |
| `/api/cron/check-inbound-invoices` | 5分に1度 | 受領請求書チェック |
| `/api/cron/sync-line-friends` | 任意 | プロラインから公式LINE友達同期 |
| `/api/cron/slp-proline-accounts` | 任意 | プロラインアカウント情報の同期 |

※ クラウドサイン送信失敗検知は Cron ではなく **Webhook** で受信するようになりました（`POST /api/cloudsign/webhook`）。

### Cron認証
- HTTPヘッダー `Authorization: Bearer $CRON_SECRET` で認証

### crontab設定例
```
# 毎日10時：契約書リマインド
0 10 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/remind-slp-members

# 5分に1度：CloudSign署名URL取得
*/5 * * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/check-cloudsign-signing
```

---

## C-3. CRMから実行する外部URL（プロライン）

### フォーム送信URL（公式LINEへのメッセージ送信）

| Form | URL | 役割 | パラメータ |
|------|-----|------|----------|
| form2 | `https://zcr5z7pk.autosns.app/fm/AVJSqEbK0G` | 入会フォーム送信内容のプロライン記録 | uid + 入会情報 |
| form4 | `https://zcr5z7pk.autosns.app/fm/HnUSeKL5O9` | 友達追加通知（紹介者） | uid + form4-1: snsname |
| form5 | `https://zcr5z7pk.autosns.app/fm/UrXFSkd82v` | 契約締結通知（紹介者） | uid + form5-1: lineName, form5-2: name |
| form6 | `https://zcr5z7pk.autosns.app/fm/R1eZuaU0hb` | 概要案内予約通知（紹介者） | uid + form6-1: snsname, form6-2: 概要案内日 |
| form7 | `https://zcr5z7pk.autosns.app/fm/B6EuRmzFs9` | 概要案内変更通知（紹介者） | uid + form7-1: snsname, form7-2: 新しい概要案内日 |
| form9 | `https://zcr5z7pk.autosns.app/fm/MmAiXC8uOh` | 概要案内キャンセル通知（紹介者） | uid + form9-1: snsname |
| form10 | `https://zcr5z7pk.autosns.app/fm/IAsRa82wNF` | 概要案内完了通知（紹介者） | uid + form10-1: snsname（カンマ区切り可） |
| form11 | `https://zcr5z7pk.autosns.app/fm/YjNCxOyln8` | 概要案内完了お礼メッセージ（受講者） | uid + form11-1: フリーテキスト |
| ~~form12~~ | ~~`WCBa6uIxM2`~~ | 2026-04-20 に Form15 統合フォームへ移行、廃止 | — |
| form15 | `https://zcr5z7pk.autosns.app/fm/q4KYTVil9N` | 組合員向け契約書通知統合フォーム（リマインド + メール不達） | uid + form15-1: テンプレレンダリング後の本文 |

### ビーコンURL（タグ付与・リッチメニュー切替）

| URL | 役割 |
|-----|------|
| `https://autosns.jp/api/call-beacon/xZugEszbhx/[uid]` | リッチメニュー切替（締結後 → 組合員メニュー） |
| `https://autosns.jp/api/call-beacon/pWp2FUaCif/[uid]` | 概要案内完了タグ付与 |
| `https://autosns.jp/api/call-beacon/R0I3t5ARZq/[uid]` | 概要案内完了タグ削除 |

### URL形式の注意
- **uid は URL末尾**: `https://autosns.jp/api/call-beacon/[ビーコンID]/[uid]`
- **uid はクエリパラメータ**: `https://zcr5z7pk.autosns.app/fm/[フォームID]?uid=[uid]`

### 成功判定
- **フォーム送信**: レスポンスJSONの `status === "200"` で成功
- **ビーコン**: レスポンスJSONの `status === 0` で成功

---

# 補足: トラブル時の対応

## 「自動化エラー」ページに失敗が記録された場合
1. `/slp/automation-errors` を開く
2. 「未解決」タブで該当エラーを確認
3. 「もう一度実行」ボタンで再実行 → 成功すれば自動的に解決済みになります
4. リトライ不要なエラーは「解決済みにする」ボタンで手動マーク

## 組合員名簿で赤背景になっている場合
- ✉️**送信失敗**バッジ → クラウドサインのメールアドレスに送信失敗。メールアドレスを確認・修正後、「新規契約書送付」で再送付
- LINE未紐付け → そのうちお客様が公式LINE追加すれば自動で解消

## ステータスが想定と違う場合
- 企業名簿のステータス変更は理由入力が必須（「予約中→完了」を除く）
- 履歴は時計アイコンのポップオーバーで全件確認可能（プロライン自動更新と手動変更の両方）
