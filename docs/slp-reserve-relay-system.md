# SLP予約中継URL システム

CRM中継URL方式により、プロライン側のフォーム＋予約フローと CRM 側の企業名簿を **正確に紐付ける** ための仕組み。

## 背景

- プロラインの予約は **LINE friend（uid）単位**で発行される
- CRM の企業名簿は **企業単位（SlpCompanyRecord）**で管理される
- 1人の担当者が複数企業を担当しているケースで、予約時にどの企業の話か判別できない問題があった
- 解決策: **CRM中継URL** で「どの企業の予約か」を事前にCRMに保存し、フォームの hidden field 経由でトークンを送って紐付ける

## 全体フロー

```
[ユーザー] リッチメニュー押下
   ↓ /slp/public/reserve/briefing?uid=[[uid]]
[CRM中継ページ]
   - uidから担当企業をリストアップ
   - 既存企業を選択 or 新しい企業名を入力
   ↓ 「予約に進む」ボタン押下
[CRM Server Action]
   - SlpReservationPending を作成（token生成）
   - プロラインのフォームAPI呼び出し
     - form3-1 = 企業名
     - form3-5 = token (hidden)
   ↓
[ユーザー] 予約カレンダーURLを開く
   - https://zcr5z7pk.autosns.app/cl/gUoC9cmzVa?uid=[[uid]]
   ↓ 日時選択 → フォーム表示
   - form3-1: 企業名（CRMが事前送信した値が入っている）
   - form3-2,3,4: 年間人件費・従業員数（ユーザーが手動入力）
   - form3-5: token（hidden）
   ↓ 「予約する」ボタン押下
[プロライン] → 予約webhook
[CRM webhook]
   - form3-5(token) で SlpReservationPending を検索
   - 既存企業 → updateMany で複製レコード含めて一括更新
   - 新規企業 → 新規 SlpCompanyRecord 作成
   - 予約ID（[[cl1-booking-id]]）を保存
   - 年間人件費・従業員数を保存
```

## webhook URL とクエリパラメータ

### 概要案内 (form3 / cl1)

#### 新規予約 webhook (`/api/public/slp/briefing-reservation`)

```
GET /api/public/slp/briefing-reservation
  ?uid=[[uid]]
  &bookingId=[[cl1-booking-id]]
  &booked=[[cl1-booking-create]]
  &briefingDate=[[cl1-booking-start]]
  &briefingStaff=[[cl1-booking-staff]]
  &form3-1=[[form3-1]]   # 企業名
  &form3-2=[[form3-2]]   # 年間人件費（役員様分）
  &form3-3=[[form3-3]]   # 年間人件費（従業員様分）
  &form3-4=[[form3-4]]   # 従業員数
  &form3-5=[[form3-5]]   # CRMトークン
  &secret=...
```

#### 変更 webhook (`/api/public/slp/briefing-change`)

```
GET /api/public/slp/briefing-change
  ?uid=[[uid]]
  &bookingId=[[cl1-booking-id]]
  &booked=[[cl1-booking-create]]
  &briefingDate=[[cl1-booking-start]]
  &briefingStaff=[[cl1-booking-staff]]
  &secret=...
```

※ 変更時はフォーム回答は送らない

#### キャンセル webhook (`/api/public/slp/briefing-cancel`)

```
GET /api/public/slp/briefing-cancel
  ?uid=[[uid]]
  &bookingId=[[cl1-booking-id]]
  &secret=...
```

### 導入希望商談 (form14 / cl2)

#### 新規予約 webhook (`/api/public/slp/consultation-reservation`)

```
GET /api/public/slp/consultation-reservation
  ?uid=[[uid]]
  &bookingId=[[cl2-booking-id]]
  &booked=[[cl2-booking-create]]
  &consultationDate=[[cl2-booking-start]]
  &consultationStaff=[[cl2-booking-staff]]
  &form14-1=[[form14-1]]   # 企業名
  &form14-2=[[form14-2]]   # CRMトークン
  &secret=...
```

#### 変更 webhook (`/api/public/slp/consultation-change`)

```
GET /api/public/slp/consultation-change
  ?uid=[[uid]]
  &bookingId=[[cl2-booking-id]]
  &booked=[[cl2-booking-create]]
  &consultationDate=[[cl2-booking-start]]
  &consultationStaff=[[cl2-booking-staff]]
  &secret=...
```

#### キャンセル webhook (`/api/public/slp/consultation-cancel`)

```
GET /api/public/slp/consultation-cancel
  ?uid=[[uid]]
  &bookingId=[[cl2-booking-id]]
  &secret=...
```

## プロライン側のフォーム設定

### form3 (概要案内)

| # | 質問 | 形式 | 必須 | 設定 |
|---|---|---|---|---|
| form3-1 | 企業名 | フリー項目 | ✅ | 登録済みの値があれば最初から入れる |
| form3-2 | 年間人件費（役員様分） | フリー項目 | - | ユーザーが手動入力 |
| form3-3 | 年間人件費（従業員様分） | フリー項目 | - | ユーザーが手動入力 |
| form3-4 | 従業員数 | フリー項目 | - | ユーザーが手動入力 |
| form3-5 | CRMトークン | フリー項目 | ✅ | 登録済みの値があれば最初から入れる + **登録済みなら隠す(hidden)** |

### form14 (導入希望商談)

| # | 質問 | 形式 | 必須 | 設定 |
|---|---|---|---|---|
| form14-1 | 企業名 | フリー項目 | ✅ | 登録済みの値があれば最初から入れる |
| form14-2 | CRMトークン | フリー項目 | ✅ | 登録済みの値があれば最初から入れる + **登録済みなら隠す(hidden)** |

## DBスキーマ

### `SlpCompanyRecord` への追加カラム

- `reservationId String?` — 概要案内の予約ID（[[cl1-booking-id]]）
- `consultationReservationId String?` — 導入希望商談の予約ID（[[cl2-booking-id]]）

これらのカラムにより、変更・キャンセル時に予約IDで該当レコードを正確に特定できる。
**同じ予約IDが複数レコードに紐付いている場合は updateMany で全てまとめて更新される（CRMで案件分割した時の複製対応）**。

### `SlpReservationPending`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | Int | PK |
| `token` | String (unique) | CRMが生成するランダムトークン（フォームhiddenで送る） |
| `uid` | String | 対象ユーザーのプロラインUID |
| `reservationType` | String | "briefing" \| "consultation" |
| `companyRecordIds` | Int[] | 既存企業を選択した場合のレコードID配列 |
| `newCompanyName` | String? | 新規企業として予約する場合の企業名（カンマ区切り可） |
| `expectedCompanyName` | String | 整合性チェック用 |
| `createdAt` | DateTime | 作成時刻 |
| `expiresAt` | DateTime | 30分後 |
| `consumedAt` | DateTime? | 紐付け完了時刻 |
| `consumedReservationId` | String? | 紐付けに使われた予約ID |

## クリーンアップ cron

```
0 4 * * * curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:4001/api/cron/cleanup-reservation-pending
```

期限切れ（30分）または消費済みかつ24時間経過したペンディング情報を物理削除する。

## フォールバック動作

中継URLを通らない予約（既存メッセージのプロライン予約URLを直接叩いた場合）：

1. webhook で token が見つからない、または期限切れ
2. **従来通り uid ベースで新規 `SlpCompanyRecord` を作成**
3. `automation_errors` に警告ログを残す
4. スタッフが定期的にレビューして不整合を検出

## 抜け道と運用対策

### 抜け道1: 複数タブ同時操作

ユーザーがA社の予約URLを開いたまま、別タブでB社の中継URLを開く → プロラインのフォームがB社のtokenに上書き → A社のタブから予約 → B社として記録される。

**対策**:
- 中継ページに警告表示
- トークンの有効期限を30分に
- automation_errors ログで検知

### 抜け道2: 中継URLバイパス

過去のメッセージのプロライン予約URLをブックマーク → 直接予約。

**対策**:
- フォールバック処理で従来通り動作
- ログを残してスタッフが監視

### 抜け道3: ユーザーが企業名を編集

フォームの企業名は編集可能なので、ユーザーが意図的に変更する可能性。

**対策**:
- ラベルに「変更しないでください」と注記
- webhook 受信時に整合性チェック → 不一致なら automation_errors にログ
- トークンを正式な紐付けキーとして使うので、企業名が変わっても CRMでは正しく紐付く

### 抜け道4: webhook の重複呼び出し

プロライン側のリトライなどで同じ予約 webhook が複数回呼ばれた場合、重複レコードが作成される可能性があった。

**対策**: webhook の冒頭で **冪等性チェック** を実施
- `bookingId` で既存の `reservationId` または `mergedBriefingReservationIds`（マージで取り込まれたID配列）を検索
- 既に処理済みなら何もせず success レスポンスを返す

### 抜け道5: トークンの uid 不一致

CRMトークンが正しくても、ペンディング情報の `uid` と webhook の `uid` が異なる場合（プロライン側のバグや異常時）、データの紐付けがズレる可能性があった。

**対策**: ペンディング情報取得時に `pending.uid !== webhook.uid` をチェックし、不一致ならペンディングを無視 + automation_errors にログ。

---

# SLP企業名簿の重複統合機能

新規予約時の表記ゆれや、別LINE担当者からの重複予約による「同じ企業のレコードが複数できる」問題を解決する。

## 検出ロジック

以下のいずれか1つでも一致したら **重複候補** として記録される（LINE担当者の一致は重複ではない）。

### 企業名
- 会社種別語（株式会社・有限会社・合同会社・一般社団法人・NPO法人 等）を除去
- 残った本体部分で **3文字以上の共通文字列** がある場合に候補

### 電話番号
- ハイフン・空白・括弧を除去した数字のみで **完全一致**

### 住所
1. 全角→半角変換
2. 「丁目」「番地」「番」「号」「ー」「－」「─」 → ハイフンに統一
3. 都道府県を除去
4. 連続するハイフン・空白を1つに
5. 比較: **正規化後、短い方が長い方の部分文字列に含まれていれば一致**
   - 例: 「東京都渋谷区道玄坂1-2-3」 と 「渋谷区道玄坂1丁目2-3 ABCビル」 → 一致

## 検出のタイミング

以下のタイミングで該当レコードについて重複候補が **再計算** される（fire-and-forget）:

| トリガー | ファイル |
|---|---|
| 企業名簿の新規作成 | `addCompanyRecord` |
| 基本情報の更新（企業名・電話・住所・都道府県のいずれかが変わった時） | `updateCompanyBasicInfo` |
| 概要案内の新規予約webhook | `briefing-reservation` |
| 導入希望商談の新規予約webhook | `consultation-reservation` |

## 「重複でない」マーク

スタッフが「この2社は重複ではない」と判定した場合、`SlpCompanyDuplicateExclusion` テーブルに `(recordIdA, recordIdB)` のペアを記録する。

- 一度マークすると、その2社の間では重複候補に上がらなくなる
- 別のレコードが新規作成された場合は、その新規レコードとの組み合わせはまた検出される
- スコープはペア単位なので、3社目以降との関係は独立

## マージ実行フロー

1. スタッフが重複候補リストから「2社」を選んで「統合する」を押す
2. `/slp/companies/merge?a=X&b=Y` に遷移
3. **メイン選択画面**: どちらを統合先（残す側）にするか選ぶ
4. **編集画面**: メインの全フィールドを編集可能な状態で表示
   - 値が異なるフィールドには ⚠ マーク
   - 「←」ボタンで もう一方の値をメインにコピー可能
5. 「統合を保存」 → 確認ダイアログ → 統合実行

## 統合時のデータの扱い

| データ | 動作 |
|---|---|
| **基本情報フィールド** | スタッフが編集した最終値で保存 |
| **担当者** (`SlpCompanyContact`) | 全部マージ先に移動 |
| **ステータス変更履歴** (`SlpCompanyRecordStatusHistory`) | 全部マージ先に移動 |
| **提出書類** (`SlpCompanyDocument`) | 全部マージ先に移動 |
| **予約ID** | マージ元のID を `mergedBriefingReservationIds` / `mergedConsultationReservationIds` 配列に追加 |
| **マージ元レコード** | `deletedAt` をセットして論理削除 |

## 予約IDの追跡

マージ後、変更・キャンセル webhook では以下の両方を検索対象にすることで、マージ元の予約も追跡可能:

```typescript
where: {
  OR: [
    { reservationId: bookingId },
    { mergedBriefingReservationIds: { has: bookingId } },
  ],
}
```

これにより、マージで取り込まれた予約が変更・キャンセルされた場合でも、マージ先のレコードに反映される。

## DBスキーマ

### `SlpCompanyDuplicateCandidate` (重複候補キャッシュ)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | Int | PK |
| `recordIdA` | Int | 小さい方のレコードID |
| `recordIdB` | Int | 大きい方のレコードID |
| `reasons` | String[] | 一致した理由 ["企業名", "電話番号", "住所"] |
| `detectedAt` | DateTime | 検出日時 |

`(recordIdA, recordIdB)` で UNIQUE。

### `SlpCompanyDuplicateExclusion` (「重複でない」マーク)

| カラム | 型 | 説明 |
|---|---|---|
| `id` | Int | PK |
| `recordIdA` | Int | 小さい方のレコードID |
| `recordIdB` | Int | 大きい方のレコードID |
| `excludedById` | Int? | マークしたスタッフ |
| `reason` | Text? | 任意のメモ |
| `createdAt` | DateTime | 作成日時 |

`(recordIdA, recordIdB)` で UNIQUE。

### `SlpCompanyRecord` への追加カラム

| カラム | 型 | 説明 |
|---|---|---|
| `mergedBriefingReservationIds` | String[] | マージで取り込まれた概要案内予約IDたち |
| `mergedConsultationReservationIds` | String[] | マージで取り込まれた導入希望商談予約IDたち |
