# クラウドサイン連携 設計仕様書

作成日: 2026-03-08

---

## 1. 概要

Stella CRM にクラウドサインの Web API を統合し、契約書の送付から締結までを自動化する。手動運用との併用も想定し、柔軟な同期制御を実現する。

---

## 2. 利用ケース

| # | ケース | 説明 |
|---|---|---|
| 1 | 全自動 | API で送付 → Webhook で締結完了まで自動管理 |
| 2 | 手動送付 + 自動管理 | 手動で送付し documentID を CRM に入力 → Webhook で以降を自動管理 |
| 3 | API送付 + 手動管理 | API で送付するが、以降のステータスは手動管理（API連携解除） |
| 4 | 全手動 | クラウドサインを使わない。documentID 空欄 |
| 5 | 取り消し → 再送付 | 金額ミス等で一度取り消して再送付。documentID が変わる。新レコードを作成 |
| 6 | 1契約に複数書類 | 本契約 + 覚書など。子契約（parentContractId）で対応 |
| 7 | 先方却下 → 再送付 | 先方が却下した場合、旧レコードと新レコードを紐付けて管理 |

---

## 3. スキーマ変更

### 3.1 OperatingCompany（運営法人）に追加

| カラム | 型 | DB名 | 説明 |
|---|---|---|---|
| `cloudsignClientId` | String? | `cloudsign_client_id` | クラウドサインのクライアントID（AES-256 で暗号化して保存） |
| `cloudsignRegisteredEmail` | String? | `cloudsign_registered_email` | クラウドサインに登録しているメールアドレス（先方/弊社破棄の判定に使用） |

#### セキュリティ要件
- `cloudsignClientId` は DB に暗号化して保存（AES-256）
- 管理画面では保存後マスク表示（`●●●●●●●●` または末尾4文字のみ表示）
- コピー不可（`user-select: none` + 右クリック無効）
- 「変更」ボタンで新しい値を入力可能。現在の値は表示しない
- 入力と保存のみ可能な UI

### 3.2 ContractType（契約種別）に追加

| カラム | 型 | DB名 | 説明 |
|---|---|---|---|
| `cloudsignTemplateId` | String? (VarChar(100)) | `cloudsign_template_id` | クラウドサインのテンプレートID |

### 3.3 MasterContractStatus（契約ステータス）に追加

| カラム | 型 | DB名 | 説明 |
|---|---|---|---|
| `cloudsignStatusMapping` | String? (VarChar(30)) | `cloudsign_status_mapping` | クラウドサインステータスとのマッピング |

#### マッピング値
- `draft` — 下書き（CloudSign で書類作成済み・未送信）
- `sent` — 送信済み
- `completed` — 締結完了
- `canceled_by_recipient` — 先方による取り消し
- `canceled_by_sender` — 弊社による取り消し

### 3.4 MasterContract（契約書）に追加/変更

#### 追加カラム

| カラム | 型 | DB名 | 説明 |
|---|---|---|---|
| `cloudsignTitle` | String? (VarChar(200)) | `cloudsign_title` | クラウドサイン側のタイトル（相手先に表示される） |
| `cloudsignAutoSync` | Boolean (default: true) | `cloudsign_auto_sync` | API連携の有効/無効フラグ |

#### 既存カラム（変更なし、そのまま使用）

| カラム | 用途 |
|---|---|
| `cloudsignDocumentId` | クラウドサインの documentID（API送付時は自動設定、手動入力も可能） |
| `cloudsignStatus` | クラウドサイン側のステータス（Webhook で自動更新） |
| `cloudsignSentAt` | クラウドサインでの送信日時 |
| `cloudsignCompletedAt` | クラウドサインでの締結完了日時 |
| `cloudsignUrl` | クラウドサインの書類URL（`https://www.cloudsign.jp/documents/{documentId}`） |

#### 廃止カラム

| カラム | 理由 |
|---|---|
| `filePath` | 新テーブル ContractFile に移行 |
| `fileName` | 新テーブル ContractFile に移行 |

※ 既存データの移行が必要

### 3.5 新テーブル: ContractFile（契約ファイル）

```prisma
model ContractFile {
  id          Int      @id @default(autoincrement())
  contractId  Int      @map("contract_id")
  filePath    String   @db.VarChar(500) @map("file_path")
  fileName    String   @db.VarChar(200) @map("file_name")
  fileSize    Int?     @map("file_size")
  mimeType    String?  @db.VarChar(50) @map("mime_type")
  category    String   @db.VarChar(30)
  isVisible   Boolean  @default(true) @map("is_visible")
  uploadedBy  String?  @db.VarChar(100) @map("uploaded_by")
  createdAt   DateTime @default(now()) @map("created_at")

  contract MasterContract @relation(fields: [contractId], references: [id], onDelete: Cascade)

  @@index([contractId])
  @@map("contract_files")
}
```

#### カテゴリ値

| category 値 | 表示名 | 自動/手動 | 説明 |
|---|---|---|---|
| `contract_draft` | 契約書（締結前） | 自動 | CloudSign 送付時に API から取得 |
| `contract_signed` | 契約書（締結済） | 自動 | CloudSign 締結時に API から取得 |
| `memorandum` | 覚書 | 手動 | |
| `amendment` | 変更契約書 | 手動 | |
| `other` | その他 | 手動 | |

#### ファイル保存先
- パス: `/public/uploads/contracts/{YYYY}/{MM}/{filename}`
- 既存の `/api/contracts/upload` エンドポイントのパターンを踏襲
- ローカルファイルシステム保存（Docker コンテナ内）

### 3.6 新テーブル: ContractRelation（契約関連）

```prisma
model ContractRelation {
  id                Int      @id @default(autoincrement())
  sourceContractId  Int      @map("source_contract_id")
  targetContractId  Int      @map("target_contract_id")
  relationType      String   @db.VarChar(20) @map("relation_type")
  note              String?  @db.Text
  createdAt         DateTime @default(now()) @map("created_at")

  sourceContract MasterContract @relation("RelationSource", fields: [sourceContractId], references: [id])
  targetContract MasterContract @relation("RelationTarget", fields: [targetContractId], references: [id])

  @@index([sourceContractId])
  @@index([targetContractId])
  @@map("contract_relations")
}
```

#### relationType 値

| 値 | 表示名 | 説明 |
|---|---|---|
| `replaces` | 再送付 | この契約は旧契約（破棄済み）の代替 |
| `renewal` | 更新契約 | 年度更新など |
| `amendment` | 変更契約 | 条件変更の覚書 |
| `supplement` | 補足契約 | 追加条件の覚書 |

#### parentContractId との使い分け
- `parentContractId`: 「本契約→個別契約」のような**階層構造**用（既存のまま）
- `ContractRelation`: 破棄→再送付、更新、変更などの**横の関係**用（新規）

---

## 4. ステータスマスタの更新

### 4.1 最終的なステータス一覧

| ID | 名前 | displayOrder | isTerminal | cloudsignMapping |
|---|---|---|---|---|
| 1 | 雛形作成中 | 1 | false | null |
| 2 | 内容確認中 | 2 | false | null |
| 3 | 合意待ち | 3 | false | null |
| 4 | 修正対応中 | 4 | false | null |
| 5 | 送付情報確認中 | 5 | false | null |
| 6 | 送付済み | 6 | false | `sent` |
| 7 | 締結済み | 7 | true | `completed` |
| 9 | 下書き中 | 8 | false | `draft` |
| 10 | 先方破棄 | 9 | true | `canceled_by_recipient` |
| 11 | 弊社破棄 | 10 | true | `canceled_by_sender` |

### 4.2 既存「破棄」ステータス（ID: 8）の処理
- **削除する**（先方破棄・弊社破棄に完全置き換え）
- 手動での破棄操作は「弊社破棄」を使用する
- 既存データでステータスが「破棄」のレコードは、マイグレーション時に「弊社破棄」に移行

---

## 5. UI 仕様

### 5.1 契約管理モーダル内のボタン

企業情報ページの契約書管理モーダルに2つのボタンを配置:

| ボタン | 用途 |
|---|---|
| 契約書を追加 | 既存の契約書をアップロード（現行機能） |
| 契約書を送付 | クラウドサインAPI経由で契約書を送付（新規機能） |

### 5.2 契約書送付フォーム

#### フォーム構成

```
┌──────────────────────────────────────────────┐
│ 契約書送付                                     │
│                                               │
│ 【基本情報】                                   │
│  契約種別:  [業務委託契約 ▼]                     │
│  テンプレート: [業務委託基本契約書 ▼] ← 種別で絞込 │
│                                               │
│  管理タイトル: [株式会社ABC 業務委託契約書     ]   │
│  ☐ クラウドサインで別タイトルを使用する           │
│   └ (チェック時のみ表示)                        │
│     クラウドサインタイトル: [業務委託基本契約書  ]  │
│     ※ 相手先に表示されるタイトルです              │
│                                               │
│ 【宛先】                                       │
│  TO: [yamada@abc.co.jp ×] [追加▼]              │
│   ├ 既存担当者から選択                          │
│   └ 手動入力                                   │
│  ※ 未登録のメールアドレスは送付後に保存確認表示    │
│                                               │
│ 【入力項目】← テンプレートAPIから動的生成         │
│  契約金額:   [        ] 円                      │
│  契約開始日: [    /  /   ]  ☐ 契約開始日に反映   │
│  契約終了日: [    /  /   ]  ☐ 契約終了日に反映   │
│  特記事項:   [                         ]        │
│                                               │
│     [プレビュー確認]   [下書き保存]   [送付する]  │
└──────────────────────────────────────────────┘
```

#### フォーム要素の詳細

**契約種別選択**
- 契約種別マスタ（ContractType）からプロジェクトに応じた選択肢を表示
- 選択すると、その種別に紐づくテンプレートIDが設定される

**テンプレート選択**
- 契約種別に `cloudsignTemplateId` が設定されている場合、自動選択
- 1つの契約種別に複数テンプレートが対応する場合は選択式（将来拡張）

**管理タイトル**
- CRM 内部での管理用タイトル
- デフォルトでクラウドサインタイトルにもコピーされる

**「クラウドサインで別タイトルを使用する」チェックボックス**
- 未チェック: 管理タイトル = クラウドサインタイトル（同期状態）
- チェック: クラウドサインタイトル入力欄が表示され、独立して入力可能（同期解除）

**宛先（TO）**
- 請求管理の送付モーダル（invoice-mail-modal.tsx）を参考に実装
- 既存担当者（StellaCompanyContact）から選択 or 手動入力
- 手動入力した未登録メールアドレスは、送付完了後に「担当者として保存しますか？」確認ダイアログを表示
- メール形式バリデーション、重複チェック

**入力項目（動的フォーム）**
- テンプレート選択後、`GET /templates/{id}` で widgets 情報を取得
- 送信者が入力する項目のみフォームとして表示
- 受信者が入力する項目（押印等）は表示のみ（参考情報として）
- 各widget の label, type に応じたフォーム要素を生成
  - フリーテキスト → テキスト入力
  - チェックボックス → チェックボックス
  - 押印 → 表示のみ

**「契約開始日に反映」「契約終了日に反映」チェックボックス**
- 各入力項目の横に配置（送付フォーム上で毎回選ぶ方式）
- チェックした項目の値が、締結完了時に MasterContract の `startDate` / `endDate` に反映される
- 任意（チェックしなくても送付可能）
- どの widget にチェックが入ったかを MasterContract に保存する必要あり（カラムまたはメタデータ）

#### ボタンの挙動

| ボタン | CloudSign API | CRM処理 |
|---|---|---|
| プレビュー確認 | なし | テンプレート + 入力値でPDFプレビュー表示（請求書プレビューと同じ方式） |
| 下書き保存 | `POST /documents`（draft作成のみ） | CRMステータス「下書き中」、documentID 保存、cloudsignUrl 生成 |
| 送付する | `POST /documents` → `POST /documents/{id}`（送信） | CRMステータス「送付済み」、documentID 保存、締結前PDF自動保存、cloudsignUrl 生成 |

#### 送付完了後の処理
1. MasterContract レコード作成（または更新）
2. `cloudsignDocumentId` を保存
3. `cloudsignUrl` を生成・保存（`https://www.cloudsign.jp/documents/{documentId}`）
4. `cloudsignStatus` を `sent` に設定
5. `cloudsignSentAt` を現在日時に設定
6. `cloudsignTitle` を設定（管理タイトルと同じ or 別タイトル）
7. CRMステータスを「送付済み」に更新
8. CloudSign API から締結前PDFを取得し、ContractFile に保存（category: `contract_draft`）
9. ステータス履歴（MasterContractStatusHistory）にイベント記録
10. 未登録メールアドレスの保存確認ダイアログ表示

### 5.3 クラウドサインリンク表示

`cloudsignDocumentId` が存在する場合:
- 「クラウドサインで確認する」テキストをリンク化
- クリックで `https://www.cloudsign.jp/documents/{cloudsignDocumentId}` を新しいタブで開く
- `cloudsignDocumentId` が空の場合はリンクを表示しない

### 5.4 ファイル管理UI

```
📄 業務委託契約書（締結済）.pdf    [ダウンロード] [削除]
📄 覚書_20260308.pdf              [ダウンロード] [削除]
☐ 締結前の書類も表示する
  └ 📄 業務委託契約書（締結前）.pdf  [ダウンロード]

[ファイルを追加] ← カテゴリ選択付きアップロード
```

- 締結済みファイルが存在する場合、締結前ファイルはデフォルト非表示（`isVisible: false`）
- チェックボックスで表示切替
- 手動アップロード時はカテゴリを選択

### 5.5 ステータス不一致時の表示

CRM ステータスの `cloudsignMapping` と `cloudsignStatus` が異なる場合に表示:

```
⚠ クラウドサインのステータスと異なります
  CRM: 交渉中
  クラウドサイン: 締結完了

  [クラウドサインに合わせる]  [このまま管理]  [API連携を解除]
```

| ボタン | 挙動 |
|---|---|
| クラウドサインに合わせる | `GET /documents/{id}` で最新取得 → CRM ステータスを対応するものに更新 |
| このまま管理 | 何もしない（不一致のまま並行管理を継続） |
| API連携を解除 | `cloudsignAutoSync = false` に更新。以降の Webhook で CRM ステータスを触らない |

### 5.6 一覧フィルタ

契約一覧ページに以下のフィルタを追加:
- 「クラウドサインと不一致」: `cloudsignDocumentId` が存在し、かつ CRM ステータスの `cloudsignMapping` ≠ `cloudsignStatus` のレコードを抽出

### 5.7 API連携の再有効化

「API連携を解除」後に再度連携を有効にする場合:
1. 「API連携を再開する」ボタンを表示
2. クリック → `GET /documents/{id}` で CloudSign 側の最新状態を取得
3. 差分を表示（「クラウドサインの現在の状態: ○○」）
4. ユーザーが確認して「再開する」を押す → `cloudsignAutoSync = true` に更新 + CRM ステータスも同期

### 5.8 破棄→再送付のUI

破棄されたレコードに「再送付」ボタンを表示:
1. ボタンクリック → 新しい MasterContract レコードを作成
2. 送付フォームが開く（旧レコードの情報をプリセット）
3. 送付完了後、ContractRelation を自動作成:
   - `sourceContractId`: 新レコード
   - `targetContractId`: 旧レコード（破棄済み）
   - `relationType`: `replaces`

#### 関連契約の表示

```
レコードA（先方破棄）:
  関連契約: 締結版 → レコードB（リンク）

レコードB（締結済み）:
  関連契約: 破棄版 → レコードA（リンク）
```

### 5.9 運営法人のクラウドサイン設定画面

運営法人の管理画面に「クラウドサイン連携設定」セクションを追加:

```
【クラウドサイン連携設定】
クライアントID:     [●●●●●●●●●●●●]  [変更]
登録メールアドレス:  [admin@example.co.jp      ]

※ クライアントIDはセキュリティのため表示・コピーできません
※ 変更する場合は新しい値を入力してください
```

### 5.10 契約種別マスタのクラウドサインテンプレートID設定

契約種別の設定画面（`/settings/contract-types`）のテーブルに「クラウドサインテンプレートID」列を追加:
- テキスト入力
- 任意項目

---

## 6. Webhook 処理仕様

### 6.1 エンドポイント

`POST /api/cloudsign/webhook`

### 6.2 受信データ

```json
{
  "documentID": "xxx-xxx-xxx",
  "status": 2,
  "userID": "yyy-yyy-yyy",
  "email": "yamada@example.com",
  "text": "..."
}
```

### 6.3 処理フロー

```
1. documentID で MasterContract を検索
   → 見つからない場合: ログ記録して終了（HTTP 200 返却）

2. cloudsignAutoSync を確認
   ├─ false → cloudsignStatus のみ更新して終了
   └─ true → 以下の処理を続行

3. cloudsignStatus を新しい値で更新（常に実行）

4. タイトルの同期:
   GET /documents/{id} でタイトルを取得
   cloudsignTitle を更新
   if (title === 旧cloudsignTitle) → title も更新

5. CRM ステータスの自動更新判定:
   現在の CRM ステータスの cloudsignMapping を取得
   if (mapping === 旧cloudsignStatus)
     → 一致 = 連動している状態 → CRM ステータスも自動更新
   else
     → 不一致 = 手動管理中 → CRM ステータスは触らない

6. ステータス別の追加処理:

   [completed の場合]
   - CRM ステータスを「締結済み」に更新（同期中の場合）
   - GET /documents/{id}/files で締結済み PDF をダウンロード
   - ContractFile に保存（category: contract_signed）
   - 既存の contract_draft ファイルの isVisible を false に設定
   - signedDate を自動設定（Webhook の日時）
   - cloudsignCompletedAt を設定
   - 「契約開始日に反映」チェックがあった widget の値 → startDate に反映
   - 「契約終了日に反映」チェックがあった widget の値 → endDate に反映

   [canceled の場合]
   - Webhook の email を確認
   - 運営法人の cloudsignRegisteredEmail と比較
     - 一致 → 弊社破棄（canceled_by_sender）
     - 不一致 → 先方破棄（canceled_by_recipient）
   - 対応する CRM ステータスに更新（同期中の場合）

   [sent の場合]（draft から送信された場合）
   - CRM ステータスを「送付済み」に更新（同期中の場合）
   - cloudsignSentAt を設定

7. MasterContractStatusHistory にイベント記録
   - eventType: "cloudsign_webhook"
   - fromStatusId / toStatusId
   - changedBy: "CloudSign Webhook"
   - note: Webhook の生データ（参考情報として）

8. HTTP 200 を返却
```

### 6.4 エラーハンドリング

- Webhook 受信時は常に HTTP 200-299 を返す（CloudSign は 500 系で最大3回リトライする）
- 処理エラーはログに記録し、管理者に通知（将来的にはメール or Slack）
- documentID が見つからない場合もログ記録して 200 を返す

### 6.5 Webhook 認証

CloudSign からの正当なリクエストであることを検証する仕組みを実装（CloudSign のドキュメントに記載の認証方式に準拠）

---

## 7. API エンドポイント

### 7.1 CloudSign プロキシ API（新規）

| メソッド | パス | 用途 |
|---|---|---|
| POST | `/api/cloudsign/webhook` | Webhook 受信 |
| GET | `/api/cloudsign/templates/{templateId}` | テンプレート詳細取得（widgets 含む） |
| POST | `/api/cloudsign/documents` | 書類作成（draft） |
| POST | `/api/cloudsign/documents/{documentId}/send` | 書類送信 |
| GET | `/api/cloudsign/documents/{documentId}` | 書類最新情報取得（ポーリング用） |
| GET | `/api/cloudsign/documents/{documentId}/files` | 締結済み PDF ダウンロード |

※ すべてのプロキシ API は、リクエスト元の project → operatingCompany → cloudsignClientId で適切な API キーを使用

### 7.2 契約ファイル API（新規）

| メソッド | パス | 用途 |
|---|---|---|
| GET | `/api/contracts/{contractId}/files` | 契約ファイル一覧 |
| POST | `/api/contracts/{contractId}/files` | 契約ファイルアップロード（カテゴリ付き） |
| DELETE | `/api/contracts/{contractId}/files/{fileId}` | 契約ファイル削除 |

### 7.3 CloudSign トークン管理

- クラウドサインのアクセストークンは **1時間** で失効
- トークン取得: `POST /token`（clientId を送信）
- サーバーサイドでトークンをキャッシュし、期限切れ前に自動リフレッシュ
- 運営法人ごとにトークンを個別管理

### 7.4 レートリミット

- クラウドサイン API のレートリミット: **1分間800リクエスト**
- API 実行後のデータ反映に **数秒〜10秒** かかる場合がある

---

## 8. 同期ロジック詳細

### 8.1 ステータス同期

```
Webhook 受信時:

1. cloudsignStatus を更新（常に）

2. CRM ステータスの自動更新判定:
   currentStatus = 現在の CRM ステータス
   currentMapping = currentStatus.cloudsignStatusMapping

   if (currentMapping === 旧cloudsignStatus)
     → 一致 = 連動状態
     → 新しい cloudsignStatus に対応する CRM ステータスに自動更新
   else
     → 不一致 = 手動管理中 or 別ステータス
     → CRM ステータスは触らない
     → UI に不一致警告を表示
```

#### 具体例: 正常フロー

1. API 送付 → CRM「送付済み」(mapping=sent) / CS「sent」→ **一致**
2. Webhook: completed → CRM「締結済み」(mapping=completed) に自動更新 / CS「completed」

#### 具体例: 手動管理に切り替え

1. API 送付 → CRM「送付済み」(mapping=sent) / CS「sent」→ **一致**
2. ユーザーが CRM ステータスを「交渉中」(mapping=null) に手動変更
3. Webhook: completed → CS「completed」のみ更新 / CRM は「交渉中」のまま → **不一致警告表示**

#### 具体例: API連携解除

1. API 送付 → CRM「送付済み」/ CS「sent」
2. ユーザーが「API連携を解除」→ `cloudsignAutoSync = false`
3. Webhook: completed → CS「completed」のみ更新 / CRM は一切触らない

### 8.2 タイトル同期

```
送付時:
  if (別タイトルチェックなし)
    → cloudsignTitle = title（同期状態）
  else
    → cloudsignTitle = 入力値（非同期状態）

Webhook 受信時（ステータス変更に便乗して確認）:
  GET /documents/{id} でタイトル取得
  cloudsignTitle を最新値で更新
  if (title === 旧cloudsignTitle)
    → title も一緒に更新（同期状態だったので維持）
  else
    → cloudsignTitle のみ更新（非同期状態なので CRM タイトルは触らない）
```

### 8.3 canceled の先方/弊社判別

```
Webhook で canceled を受信:
  canceledByEmail = Webhook の email フィールド

  contract → project → operatingCompany → cloudsignRegisteredEmail を取得

  if (canceledByEmail === cloudsignRegisteredEmail)
    → 弊社破棄 (canceled_by_sender)
  else
    → 先方破棄 (canceled_by_recipient)
```

---

## 9. プロジェクトとAPIキーの関係

```
プロジェクト (MasterProject)
  └→ 運営法人 (OperatingCompany)
       ├→ cloudsignClientId（暗号化保存）
       └→ cloudsignRegisteredEmail

各プロジェクトページからの送信時:
  project.operatingCompany.cloudsignClientId を復号して使用
```

- 1つの運営法人が複数のプロジェクトに紐づく場合、同じ CloudSign アカウントを共有
- 運営法人ごとにクラウドサインの契約が別 = トークン取得も別

---

## 10. データ移行

### 10.1 ステータスマスタの移行
- 「破棄」(ID: 8) を削除
- 既存データで `currentStatusId = 8` のレコードを「弊社破棄」(ID: 11) に更新
- 新ステータス（下書き中、先方破棄、弊社破棄）を追加

### 10.2 ファイルデータの移行
- 既存の MasterContract.filePath / fileName のデータを ContractFile テーブルに移行
- category は `other` で移行（既存データはカテゴリ不明のため）
- 移行完了後に MasterContract の filePath / fileName カラムを削除

---

## 11. セットアップ状況チェックへの追加

`src/app/admin/setup-status/actions.ts` の `checkDefinitions` に以下を追加:

```typescript
{
  id: "cloudsign-operating-company",
  category: "共通",
  name: "クラウドサイン連携設定",
  description: "運営法人にクラウドサインのクライアントIDが設定されているか",
  required: 0, // 推奨（クラウドサインを使わない場合もあるため）
  href: "/settings/operating-companies",
  countFn: () =>
    prisma.operatingCompany.count({
      where: { cloudsignClientId: { not: null } },
    }),
},
{
  id: "cloudsign-contract-type-templates",
  category: "共通",
  name: "契約種別テンプレート設定",
  description: "契約種別にクラウドサインのテンプレートIDが設定されているか",
  required: 0, // 推奨
  href: "/settings/contract-types",
  countFn: () =>
    prisma.contractType.count({
      where: { cloudsignTemplateId: { not: null }, isActive: true },
    }),
},
```

---

## 12. 実装優先順位（案）

### フェーズ1: 基盤
1. スキーマ変更（全テーブル追加・変更）+ マイグレーション
2. ステータスマスタの更新
3. 既存データ移行（filePath/fileName → ContractFile）
4. 運営法人管理画面に CloudSign 設定追加（暗号化含む）
5. 契約種別マスタに テンプレートID 追加

### フェーズ2: 契約ファイル管理
6. ContractFile テーブルの CRUD
7. 契約管理モーダルのファイル表示を ContractFile ベースに変更
8. 締結前/締結済の表示切替UI

### フェーズ3: 送付機能
9. CloudSign トークン管理
10. テンプレート情報取得 API
11. 送付フォーム UI（動的フォーム生成）
12. プレビュー機能
13. 下書き保存・送付処理

### フェーズ4: Webhook・同期
14. Webhook 受信エンドポイント
15. ステータス同期ロジック
16. タイトル同期ロジック
17. 先方/弊社破棄の判別
18. 締結時の自動処理（PDF取得、日付反映）
19. ステータス不一致の警告UI
20. API連携解除・再開機能
21. 一覧フィルタ（不一致レコード抽出）

### フェーズ5: 契約関連
22. ContractRelation テーブルの CRUD
23. 再送付フロー
24. 関連契約の表示UI
