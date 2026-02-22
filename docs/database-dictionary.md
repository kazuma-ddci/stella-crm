# Stella CRM データベース・項目辞書

> KPI管理やダッシュボード構築のためのデータベース構造・管理項目一覧です。
> 非エンジニアの方にもわかりやすいよう、日本語の表示名と説明を記載しています。

---

## 目次

1. [システム全体構成](#1-システム全体構成)
2. [全顧客マスタ（Stella共通）](#2-全顧客マスタstella共通)
3. [スタッフ・権限管理](#3-スタッフ権限管理)
4. [STP（採用ブースト）- 企業管理](#4-stp採用ブースト--企業管理)
5. [STP - 代理店管理](#5-stp--代理店管理)
6. [STP - 商談パイプライン](#6-stp--商談パイプライン)
7. [STP - リード獲得・提案書](#7-stp--リード獲得提案書)
8. [STP - 求職者管理](#8-stp--求職者管理)
9. [STP - 運用KPI](#9-stp--運用kpi)
10. [STP - 売上・経費・請求](#10-stp--売上経費請求)
11. [STP - 入出金・月次締め](#11-stp--入出金月次締め)
12. [経理（横断）- 会計取引・消込](#12-経理横断--会計取引消込)
13. [接触履歴](#13-接触履歴)
14. [契約書管理](#14-契約書管理)
15. [外部ユーザー・認証](#15-外部ユーザー認証)
16. [マスタデータ（設定）](#16-マスタデータ設定)
17. [画面一覧とメニュー構成](#17-画面一覧とメニュー構成)

---

## 1. システム全体構成

### プロジェクト構成

Stella CRMは複数プロジェクトを横断管理するCRMシステムです。

| プロジェクト | コード | 説明 |
|---|---|---|
| 採用ブースト | `stp` | 求人広告運用代行サービス |
| *(将来拡張)* | `srd`, `slo` 等 | 他プロジェクト |

### データの流れ（概要）

```
代理店 → リード獲得フォーム → フォーム回答 → STP企業登録
                                            ↓
                                    商談パイプライン管理
                                            ↓
                                    契約 → 運用KPI管理
                                            ↓
                                    売上・経費 → 請求書 → 入出金
```

---

## 2. 全顧客マスタ（Stella共通）

> 画面: **Stella全顧客マスタ** (`/companies`)

すべてのプロジェクトで共通の企業情報を管理します。STP企業や代理店はこのマスタに紐づきます。

### 企業基本情報 (`master_stella_companies`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢・備考 |
|---|---|---|---|---|
| id | 企業ID | 整数（自動採番） | システム内部ID | |
| companyCode | 企業コード | 文字列 | SC-1, SC-2... の形式 | ユニーク |
| name | 企業名 | 文字列 | 正式企業名 | |
| nameKana | フリガナ（法人格除く） | 文字列 | 企業名のカタカナ読み | |
| corporateNumber | 法人番号 | 文字列(13桁) | 国税庁の法人番号 | ユニーク |
| companyType | 区分 | 文字列 | 法人か個人かの区分 | 法人 / 個人 |
| websiteUrl | 企業HP | 文字列 | 企業ホームページURL | |
| industry | 業界 | 文字列 | 所属業界 | 自由入力 |
| revenueScale | 売上規模 | 文字列 | 企業の売上規模 | 自由入力 |
| staffId | 担当者 | 整数 | 社内担当者（AS） | スタッフから選択 |
| leadSource | 流入経路 | 文字列 | どこから顧客になったか | 紹介 / Web問い合わせ / テレアポ / 展示会 / セミナー / 代理店 |
| note | メモ | テキスト | 自由記述メモ | |
| closingDay | 締め日 | 整数 | 月次の請求締め日 | 0=月末, 1〜28=指定日 |
| paymentMonthOffset | 支払月 | 整数 | 締め後何ヶ月後に支払うか | 1=翌月, 2=翌々月... |
| paymentDay | 支払日 | 整数 | 支払日 | 0=末日, 1〜28=指定日 |
| mergedIntoId | 統合先企業ID | 整数 | 企業統合時の統合先 | |
| mergedAt | 統合日時 | 日時 | 企業統合を行った日時 | |
| createdAt | 登録日 | 日時 | データ作成日 | 自動 |
| updatedAt | 更新日 | 日時 | 最終更新日 | 自動 |

### 企業拠点 (`stella_company_locations`)

> 企業詳細画面 > **拠点一覧** セクション

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 拠点ID | 整数（自動採番） | |
| companyId | 企業ID | 整数 | 親企業への紐付け |
| name | 拠点名 | 文字列 | 本社、大阪支店 など |
| address | 拠点住所 | 文字列 | 住所 |
| phone | 拠点電話 | 文字列 | 電話番号 |
| email | 拠点メール | 文字列 | メールアドレス |
| isPrimary | 主要拠点フラグ | 真偽値 | 主要拠点かどうか |
| note | 拠点備考 | テキスト | 備考 |
| deletedAt | 削除日時 | 日時 | 論理削除日時（非表示） |

### 企業担当者 (`stella_company_contacts`)

> 企業詳細画面 > **担当者一覧** セクション

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 担当者ID | 整数（自動採番） | |
| companyId | 企業ID | 整数 | 親企業への紐付け |
| name | 担当者名 | 文字列 | 先方の担当者名 |
| email | 担当者メール | 文字列 | メールアドレス |
| phone | 担当者電話番号 | 文字列 | 電話番号 |
| department | 担当部署 | 文字列 | 所属部署 |
| isPrimary | 主連絡先フラグ | 真偽値 | 主連絡先かどうか |
| note | 担当者備考 | テキスト | 備考 |
| deletedAt | 削除日時 | 日時 | 論理削除日時（非表示） |

### 企業銀行口座 (`stella_company_bank_accounts`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 口座ID | 整数（自動採番） | |
| companyId | 企業ID | 整数 | 親企業への紐付け |
| bankName | 銀行名 | 文字列 | |
| bankCode | 銀行コード | 文字列 | |
| branchName | 支店名 | 文字列 | |
| branchCode | 支店コード | 文字列 | |
| accountNumber | 口座番号 | 文字列 | |
| accountHolderName | 口座名義人 | 文字列 | |
| note | 銀行メモ | テキスト | |
| deletedAt | 削除日時 | 日時 | 論理削除日時（非表示） |

---

## 3. スタッフ・権限管理

> 画面: **スタッフ管理** (`/staff`)

### スタッフ (`master_staff`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢・備考 |
|---|---|---|---|---|
| id | ID | 整数（自動採番） | | |
| name | 名前 | 文字列 | スタッフ名 | |
| nameKana | フリガナ | 文字列 | カタカナ読み | |
| email | メールアドレス | 文字列 | ログイン用 | ユニーク |
| phone | 電話番号 | 文字列 | | |
| contractType | 契約形態 | 文字列 | 雇用形態 | 役員 / 正社員 / 契約社員 / 業務委託 / パート / アルバイト |
| displayOrder | 表示順 | 整数 | 一覧での表示順序 | |
| isActive | 有効 | 真偽値 | アカウントが有効か | |
| isSystemUser | システムユーザー | 真偽値 | UI非表示のシステムユーザー | |
| canEditMasterData | 固定データ編集権限 | 真偽値 | マスタデータの編集可否 | |

### スタッフ権限 (`staff_permissions`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| staffId | スタッフ | 整数 | 対象スタッフ | |
| projectId | プロジェクト | 整数 | 対象プロジェクト | |
| permissionLevel | 権限レベル | 文字列 | アクセス権限 | なし(none) / 閲覧(view) / 編集(edit) / 管理者(admin) |

### スタッフ役割種別 (`staff_role_types`)

> 画面: **スタッフ役割種別** (`/staff/role-types`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| code | コード | 文字列 | 営業, 運用, CS, AS など |
| name | 表示名 | 文字列 | 役割の表示名 |
| description | 説明 | テキスト | 役割の説明 |
| displayOrder | 表示順 | 整数 | |
| isActive | 有効 | 真偽値 | |

### 担当者フィールド制約 (`staff_field_restrictions`)

> 画面: **担当者フィールド制約** (`/staff/field-restrictions`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| fieldCode | フィールドコード | 文字列 | 対象フィールドの識別子 |
| projectId | プロジェクト | 整数 | 絞り込み対象プロジェクト |
| roleTypeId | 役割種別 | 整数 | 絞り込み対象の役割 |

---

## 4. STP（採用ブースト） - 企業管理

> 画面: **STP 企業情報** (`/stp/companies`)

### STP企業 (`stp_companies`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢・備考 |
|---|---|---|---|---|
| id | プロジェクトNo. | 整数（自動採番） | STP企業の管理番号 | |
| companyId | 企業ID | 整数 | 全顧客マスタへの紐付け | |
| *(company.name)* | 企業名 | 文字列 | 全顧客マスタから取得 | |
| agentId | 代理店 | 整数 | 紹介元の代理店 | 代理店から選択 |
| currentStageId | 現在パイプライン | 整数 | 現在の商談ステージ | パイプライン設定から選択 |
| nextTargetStageId | ネクストパイプライン | 整数 | 次の目標ステージ | パイプライン設定から選択 |
| nextTargetDate | パイプラインコミット | 日付 | 次ステージの目標日 | |
| leadAcquiredDate | リード獲得日 | 日付 | リード獲得した日 | |
| meetingDate | 初回商談日 | 日付 | 初回商談の日付 | |
| firstKoDate | 初回KO日 | 日付 | 初回キックオフの日付 | |
| jobPostingStartDate | 求人掲載開始日 | 文字列 | 求人掲載を開始した日 | テキスト入力 |
| progressDetail | 進捗詳細 | テキスト | 案件の進捗メモ | |
| forecast | ヨミ | 文字列 | 受注確度の見込み | MIN / 落とし / MAX / 来月 / 辞退 |
| operationStatus | 運用ステータス | 文字列 | 運用フェーズの状態 | テスト1 / テスト2 |
| lostReason | 失注理由 | テキスト | 失注した理由 | |
| industryType | 業種区分 | 文字列 | 業種の区分 | 一般 / 派遣 |
| industry | 業界 | 文字列 | 業界 | |
| plannedHires | 採用予定人数 | 整数 | 採用する予定の人数 | |
| leadSourceId | 流入経路 | 整数 | 顧客の流入元 | 流入経路マスタから選択 |
| contractPlan | 契約プラン | 文字列 | 契約のプラン | |
| media | 求人媒体 | 文字列 | 使用する求人媒体 | テキスト入力 |
| contractStartDate | 契約開始日 | 日付 | 契約の開始日 | |
| contractEndDate | 契約終了日 | 日付 | 契約の終了日 | |
| initialFee | 初期費用 | 整数（円） | 初期費用 | 0 / 100,000 / 150,000 |
| monthlyFee | 月額 | 整数（円） | 月額費用 | |
| performanceFee | 成果報酬単価 | 整数（円） | 成果1件あたりの報酬額 | |
| salesStaffId | 担当営業 | 整数 | 営業担当者 | スタッフから選択 |
| adminStaffId | 担当事務 | 整数 | 事務担当者 | スタッフから選択 |
| operationStaffList | 担当運用 | 文字列 | 運用担当者（複数） | indeed, 運用2 等 |
| accountId | アカウントID | 文字列 | 媒体のアカウントID | |
| accountPass | アカウントPASS | 文字列 | 媒体のアカウントPASS | |
| jobInfoFolderLink | 求人票/会社情報フォルダリンク | 文字列 | Google Drive等のリンク | |
| operationReportLink | 運用進捗レポートリンク | 文字列 | レポートのリンク | |
| proposalLink | 提案書リンク | 文字列 | 提案書のリンク | |
| billingLocationId | 請求先住所（拠点ID） | 整数 | 請求先拠点 | 企業の拠点から選択 |
| billingCompanyName | 請求先企業名 | 文字列 | 請求先の企業名 | |
| billingAddress | 請求先住所 | 文字列 | 請求先の住所 | |
| billingRepresentative | 請求先担当者 | 文字列 | 請求先の担当者 | カンマ区切りで複数 |
| paymentTerms | 支払いサイト | 文字列 | 支払条件（自由テキスト） | |
| note | 企業メモ | テキスト | 企業に関するメモ | |
| contractNote | 契約メモ | テキスト | 契約に関するメモ | |
| pendingReason | 検討理由 | テキスト | 検討中の理由 | |
| pendingResponseDate | 回答予定日 | 日付 | 先方の回答予定日 | |

### STP企業契約書 (`stp_company_contracts`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 契約書ID | 整数（自動採番） | | |
| stpCompanyId | STP企業 | 整数 | 対象のSTP企業 | |
| contractUrl | 契約書URL | 文字列 | 契約書のリンク | |
| signedDate | 締結日 | 日付 | 契約締結日 | |
| title | 契約書タイトル | 文字列 | | |
| externalId | 外部サービスID | 文字列 | クラウドサイン等のID | |
| externalService | 外部サービス名 | 文字列 | | |
| status | ステータス | 文字列 | 契約書の状態 | draft / 送付済み / 先方情報待ち / signed / expired |
| note | 備考 | テキスト | | |

### 契約履歴 (`stp_contract_histories`)

> 企業の契約条件を期間ごとに管理

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 契約履歴ID | 整数（自動採番） | | |
| companyId | 企業 | 整数 | 全顧客マスタへの紐付け | |
| industryType | 業種区分 | 文字列 | | 一般(general) / 派遣(dispatch) |
| contractPlan | 契約プラン | 文字列 | | 月額(monthly) / 成果報酬(performance) |
| jobMedia | 求人媒体 | 文字列 | Indeed, Wantedly等 | |
| contractStartDate | 契約開始日 | 日付 | | |
| contractEndDate | 契約終了日 | 日付 | nullの場合はアクティブ | |
| initialFee | 初期費用 | 整数（円） | | 0 / 100,000 / 150,000 |
| monthlyFee | 月額 | 整数（円） | 契約時点の金額 | |
| performanceFee | 成果報酬単価 | 整数（円） | 契約時点の単価 | |
| salesStaffId | 担当営業 | 整数 | | スタッフから選択 |
| operationStaffId | 担当運用 | 整数 | | スタッフから選択 |
| status | ステータス | 文字列 | 契約の状態 | active / cancelled / dormant |
| operationStatus | 運用ステータス | 文字列 | | テスト1 / テスト2 |
| accountId | アカウントID | 文字列 | 媒体のアカウントID | |
| accountPass | アカウントPASS | 文字列 | 媒体のアカウントPASS | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

---

## 5. STP - 代理店管理

> 画面: **STP 代理店情報** (`/stp/agents`)

### 代理店 (`stp_agents`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢・備考 |
|---|---|---|---|---|
| id | 代理店No. | 整数（自動採番） | | |
| companyId | 代理店名 | 整数 | 全顧客マスタへの紐付け | 企業から選択 |
| status | ステータス | 文字列 | 代理店の状態 | アクティブ / 非アクティブ / 解約 |
| category1 | 区分 | 文字列 | 代理店の種別 | 代理店 / 顧問 |
| contractStatus | 契約ステータス | 文字列 | 契約の状態（自動計算） | 契約前 / 契約済み / 契約終了 |
| referrerCompanyId | 紹介者 | 整数 | 紹介元の企業 | 企業から選択 |
| note | 代理店メモ | テキスト | メモ | |
| minimumCases | 最低件数 | 整数 | 顧問の最低件数 | 顧問のみ |
| agentInitialFee | 代理店への初期費用 | 整数（円） | | |
| monthlyFee | 月額費用 | 整数（円） | | |
| hearingUrl | ヒアリングURL | 文字列 | | |
| adminStaffId | 担当事務 | 整数 | 事務担当者 | スタッフから選択 |
| isIndividualBusiness | 個人事業主 | 真偽値 | 個人事業主かどうか | |
| withholdingTaxRate | 源泉徴収税率 | 小数(%) | デフォルトの源泉徴収税率 | |
| *(staffAssignments)* | 担当営業 | 複数選択 | 営業担当者（複数可） | スタッフから選択 |
| *(referralCount)* | 紹介件数 | 整数 | 紹介した企業数（集計値） | |
| *(contractedCount)* | 契約件数 | 整数 | 契約に至った企業数（集計値） | |
| *(leadFormToken)* | フォームURL | 文字列 | リード獲得フォームのURL | |

### 代理店契約書 (`stp_agent_contracts`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 契約書ID | 整数（自動採番） | | |
| agentId | 代理店 | 整数 | 対象の代理店 | |
| contractUrl | 契約書URL | 文字列 | 契約書のリンク | |
| signedDate | 締結日 | 日付 | 契約締結日 | |
| title | 契約書タイトル | 文字列 | | |
| status | ステータス | 文字列 | 契約書の状態 | draft / pending / signed / expired |
| note | 備考 | テキスト | | |

### 代理店契約履歴 (`stp_agent_contract_histories`)

> 代理店との契約条件を期間ごとに管理

| DB カラム名 | 表示名 | データ型 | 説明 | 備考 |
|---|---|---|---|---|
| id | 契約履歴ID | 整数（自動採番） | | |
| agentId | 代理店 | 整数 | 対象の代理店 | |
| contractStartDate | 契約開始日 | 日付 | | |
| contractEndDate | 契約終了日 | 日付 | nullの場合は現在有効 | |
| status | ステータス | 文字列 | | 契約前 / 契約済み |
| initialFee | 初期費用 | 整数（円） | 代理店への直接費用 | |
| monthlyFee | 月額費用 | 整数（円） | 代理店への直接費用 | |
| **月額プラン報酬（デフォルト）** | | | | |
| defaultMpInitialRate | 初期費用報酬率 | 小数(%) | 月額プランの初期費用から | |
| defaultMpInitialDuration | 報酬発生期間 | 整数（ヶ月） | 初期費用の報酬期間 | |
| defaultMpMonthlyType | 月額報酬種別 | 文字列 | 率か固定か | rate / fixed |
| defaultMpMonthlyRate | 月額報酬率 | 小数(%) | | |
| defaultMpMonthlyFixed | 月額報酬固定額 | 整数（円） | | |
| defaultMpMonthlyDuration | 月額報酬発生期間 | 整数（ヶ月） | | |
| **成果報酬プラン報酬（デフォルト）** | | | | |
| defaultPpInitialRate | 初期費用報酬率 | 小数(%) | 成果プランの初期費用から | |
| defaultPpInitialDuration | 報酬発生期間 | 整数（ヶ月） | | |
| defaultPpPerfType | 成果報酬種別 | 文字列 | 率か固定か | rate / fixed |
| defaultPpPerfRate | 成果報酬率 | 小数(%) | | |
| defaultPpPerfFixed | 成果報酬固定額 | 整数（円） | | |
| defaultPpPerfDuration | 報酬発生期間 | 整数（ヶ月） | | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 代理店企業別報酬例外 (`stp_agent_commission_overrides`)

> 代理店のデフォルト報酬率に対して、特定企業だけ異なる報酬率を設定

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| agentContractHistoryId | 代理店契約履歴 | 整数 | 対象の代理店契約 |
| stpCompanyId | STP企業 | 整数 | 例外を設定する企業 |
| mp...系 | 月額プラン報酬（上書き） | 各種 | 代理店契約履歴と同構造 |
| pp...系 | 成果報酬プラン報酬（上書き） | 各種 | 代理店契約履歴と同構造 |
| note | 備考 | テキスト | |

---

## 6. STP - 商談パイプライン

> 画面: **商談パイプライン履歴** (`/stp/records/stage-histories`)
> 設定: **STP_商談パイプライン** (`/stp/settings/stages`)

### 商談ステージマスタ (`stp_stages`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | ステージID | 整数（自動採番） | | |
| name | ステージ名 | 文字列 | パイプラインの名前 | |
| displayOrder | 表示順 | 整数 | 一覧での表示順序 | null=特殊ステージ |
| stageType | ステージタイプ | 文字列 | ステージの分類 | progress(進行中) / closed_won(受注) / closed_lost(失注) / pending(検討中) |
| isActive | 有効 | 真偽値 | 使用中かどうか | |

### ステージ変更履歴 (`stp_stage_histories`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 履歴ID | 整数（自動採番） | | |
| stpCompanyId | STP企業 | 整数 | 対象企業 | |
| eventType | イベント種別 | 文字列 | 変更の種別 | commit / achieved / recommit / progress / back / cancel / won / lost / suspended / resumed / revived / reason_updated |
| fromStageId | 変更前ステージ | 整数 | 変更前のステージ | |
| toStageId | 変更後ステージ | 整数 | 変更後のステージ | |
| targetDate | 目標日 | 日付 | コミットした目標日 | |
| recordedAt | 記録日時 | 日時 | 変更が記録された日時 | |
| changedBy | 変更者 | 文字列 | 変更を行った人 | |
| note | 備考 | テキスト | | |
| lostReason | 失注理由 | テキスト | | |
| pendingReason | 検討中理由 | テキスト | | |
| subType | サブタイプ | 文字列 | recommit時の方向性 | positive / negative / neutral |
| isVoided | 取消済み | 真偽値 | この履歴が取り消されたか | |
| voidReason | 取消理由 | テキスト | | |

---

## 7. STP - リード獲得・提案書

> 画面: **STP リード獲得フォーム回答** (`/stp/lead-submissions`)

### リード獲得フォームトークン (`stp_lead_form_tokens`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | トークンID | 整数（自動採番） | | |
| token | URLトークン | 文字列 | フォームURLの識別子 | ユニーク |
| agentId | 代理店 | 整数 | 代理店ごとの専用URL | nullは直接顧客用 |
| status | ステータス | 文字列 | トークンの状態 | active / paused / revoked |
| expiresAt | 有効期限 | 日時 | nullは無期限 | |

### フォーム回答 (`stp_lead_form_submissions`)

| DB カラム名 | 表示名 | データ型 | 説明 | 備考 |
|---|---|---|---|---|
| id | 回答ID | 整数（自動採番） | | |
| tokenId | フォームトークン | 整数 | どのフォームURLからの回答か | |
| stpCompanyId | 紐付けSTP企業 | 整数 | 処理後に紐付けた企業 | |
| masterCompanyId | 紐付け全顧客マスタ | 整数 | 処理後に紐付けた企業 | |
| **基本情報** | | | | |
| companyName | 会社名 | 文字列 | 回答者の会社名 | |
| contactName | 担当者 | 文字列 | 回答者の氏名 | |
| contactEmail | メール | 文字列 | 回答者のメールアドレス | |
| contactPhone | 電話 | 文字列 | 回答者の電話番号 | |
| **採用実績** | | | | |
| pastHiringJobTypes | 過去採用職種 | JSON | 過去に採用した職種リスト | |
| pastRecruitingCostAgency | 人材紹介費用 | 整数（円） | 過去1年間の費用 | |
| pastRecruitingCostAds | 求人広告費用 | 整数（円） | 過去1年間の費用 | |
| pastRecruitingCostReferral | リファラル費用 | 整数（円） | 過去1年間の費用 | |
| pastRecruitingCostOther | その他費用 | 整数（円） | 過去1年間の費用 | |
| pastHiringCount | 過去採用人数 | 整数 | 過去1年間の採用人数 | |
| **採用計画** | | | | |
| desiredJobTypes | 希望職種 | JSON | 採用希望の職種リスト | |
| annualBudget | 年間予算 | 整数（円） | 年間の採用予算 | |
| annualHiringTarget | 年間採用予定 | 整数 | 年間の採用目標人数 | |
| hiringAreas | 採用エリア | JSON | 採用する都道府県リスト | |
| hiringTimeline | 採用希望時期 | 文字列 | いつまでに採用したいか | |
| ageRange | 採用可能年齢 | 文字列 | 採用可能な年齢幅 | 不問 / 〜30 / 〜35 等 |
| requiredConditions | 必須条件 | テキスト | 採用の必須条件 | |
| preferredConditions | 希望条件 | テキスト | 採用の希望条件 | |
| **処理情報** | | | | |
| status | ステータス | 文字列 | 回答の処理状態 | 未処理(pending) / 処理済(processed) / 却下(rejected) |
| processedAt | 処理日時 | 日時 | 処理された日時 | |
| processedBy | 処理者 | 整数 | 処理したスタッフ | |
| processingNote | 処理メモ | テキスト | 処理時のメモ | |
| submittedAt | 受信日時 | 日時 | フォーム回答日時 | |

### 提案書 (`stp_proposals`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 提案書ID | 整数（自動採番） | | |
| stpCompanyId | STP企業 | 整数 | 紐付け先のSTP企業 | |
| submissionId | フォーム回答 | 整数 | 紐付け先のフォーム回答 | |
| title | タイトル | 文字列 | 提案書のタイトル | |
| proposalNumber | 提案書番号 | 文字列 | 自動採番の番号 | |
| filePath | ファイルパス | 文字列 | PDF等のファイルパス | |
| fileName | ファイル名 | 文字列 | 元のファイル名 | |
| externalUrl | 外部URL | 文字列 | Canva, Google Docs等 | |
| externalService | 外部サービス | 文字列 | | canva / google_docs / other |
| status | ステータス | 文字列 | 提案書の状態 | draft / sent / viewed / accepted / rejected |
| sentAt | 送付日時 | 日時 | 送付した日時 | |
| assignedTo | 担当者 | 文字列 | | |
| note | 備考 | テキスト | | |
| isAutoGenerated | 自動生成 | 真偽値 | フォーム回答から自動生成 | |
| proposalContent | 提案データ | JSON | シミュレーション結果等 | |
| sourceProposalId | 元提案書 | 整数 | 確定元の自動生成提案書 | |
| slideVersion | スライドバージョン | 整数 | 確定したバージョン番号 | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

---

## 8. STP - 求職者管理

> 画面: **STP 求職者情報** (`/stp/candidates`)

### 求職者 (`stp_candidates`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 求職者ID | 整数（自動採番） | | |
| lastName | 姓 | 文字列 | | |
| firstName | 名 | 文字列 | | |
| stpCompanyId | 企業 | 整数 | 応募先のSTP企業 | |
| interviewDate | 面接日程 | 日付 | | |
| interviewAttendance | 面接参加有無 | 文字列 | | 参加 / 不参加 |
| selectionStatus | 選考状況 | 文字列 | 選考の進捗 | |
| offerDate | 内定日 | 日付 | | |
| joinDate | 入社日 | 日付 | | |
| sendDate | 送客日 | 日付 | | |
| industryType | 業種区分 | 文字列 | | general / dispatch |
| jobMedia | 求人媒体 | 文字列 | | Indeed / doda / Wantedly / マイナビ / リクナビ |
| note | メモ書き | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

---

## 9. STP - 運用KPI

### KPIシート (`stp_kpi_sheets`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | シートID | 整数（自動採番） | |
| stpCompanyId | STP企業 | 整数 | 対象企業 |
| name | シート名 | 文字列 | Indeed, Wantedly 等 |

### KPI週次データ (`stp_kpi_weekly_data`)

> 週単位の目標値と実績値を記録

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | データID | 整数（自動採番） | |
| kpiSheetId | KPIシート | 整数 | 対象シート |
| weekStartDate | 週開始日 | 日付 | |
| weekEndDate | 週終了日 | 日付 | |
| **目標値** | | | |
| targetImpressions | 表示回数（目標） | 整数 | |
| targetCpm | 表示単価（目標） | 小数（円） | CPM |
| targetClicks | クリック数（目標） | 整数 | |
| targetCtr | クリック率（目標） | 小数(%) | CTR |
| targetCpc | クリック単価（目標） | 小数（円） | CPC |
| targetApplications | 応募数（目標） | 整数 | |
| targetCvr | 応募率（目標） | 小数(%) | CVR |
| targetCpa | 応募単価（目標） | 小数（円） | CPA |
| targetCost | 費用（目標） | 整数（円） | |
| **実績値** | | | |
| actualImpressions | 表示回数（実績） | 整数 | |
| actualCpm | 表示単価（実績） | 小数（円） | |
| actualClicks | クリック数（実績） | 整数 | |
| actualCtr | クリック率（実績） | 小数(%) | |
| actualCpc | クリック単価（実績） | 小数（円） | |
| actualApplications | 応募数（実績） | 整数 | |
| actualCvr | 応募率（実績） | 小数(%) | |
| actualCpa | 応募単価（実績） | 小数（円） | |
| actualCost | 費用（実績） | 整数（円） | |

### KPI共有リンク (`stp_kpi_share_links`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | リンクID | 整数（自動採番） | |
| kpiSheetId | KPIシート | 整数 | 対象シート |
| token | 共有トークン | 文字列 | 公開用トークン |
| expiresAt | 有効期限 | 日時 | |
| createdBy | 発行者 | 整数 | 発行したスタッフ |

---

## 10. STP - 売上・経費・請求

> 画面: **売上管理** (`/stp/finance/revenue`)、**経費管理** (`/stp/finance/expenses`)、**請求書管理** (`/stp/finance/invoices`)

### 売上実績 (`stp_revenue_records`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 売上ID | 整数（自動採番） | | |
| stpCompanyId | STP企業 | 整数 | 売上元の企業 | |
| contractHistoryId | 契約履歴 | 整数 | 基づく契約条件 | |
| candidateId | 求職者 | 整数 | 成果報酬の対象者 | |
| invoiceId | 請求書 | 整数 | 紐づく請求書 | |
| revenueType | 売上種別 | 文字列 | 売上の種類 | initial(初期費用) / monthly(月額) / performance(成果報酬) |
| targetMonth | 対象年月 | 日付 | 売上が属する月 | 月初日で統一 |
| expectedAmount | 請求金額 | 整数（円） | 請求する金額 | |
| status | ステータス | 文字列 | 売上の状態 | pending / approved / invoiced / paid / overdue / cancelled |
| paymentStatus | 入金ステータス | 文字列 | 入金の詳細状態 | null(通常) / partial(一部入金) / completed_different(金額相違あり) |
| invoiceDate | 請求日 | 日付 | | |
| dueDate | 支払期限 | 日付 | | |
| paidDate | 着金日 | 日付 | | |
| paidAmount | 着金額 | 整数（円） | 実際の着金額 | |
| approvedAt | 承認日時 | 日時 | | |
| approvedBy | 承認者 | 整数 | 承認したスタッフ | |
| taxType | 税区分 | 文字列 | | 内税(tax_included) / 外税(tax_excluded) |
| taxRate | 税率 | 整数(%) | | デフォルト10 |
| taxAmount | 税額 | 整数（円） | | |
| isAutoGenerated | 自動生成 | 真偽値 | 自動生成されたか | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 経費実績 (`stp_expense_records`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 経費ID | 整数（自動採番） | | |
| agentId | 代理店 | 整数 | 支払先の代理店 | |
| stpCompanyId | STP企業 | 整数 | 紹介報酬の対象企業 | |
| agentContractHistoryId | 代理店契約履歴 | 整数 | 基づく代理店契約 | |
| contractHistoryId | 企業契約履歴 | 整数 | 基づく企業契約 | |
| revenueRecordId | 対象売上 | 整数 | 対応する売上レコード | |
| invoiceId | 請求書 | 整数 | 紐づく請求書 | |
| expenseType | 経費種別 | 文字列 | 経費の種類 | agent_initial(代理店初期) / agent_monthly(代理店月額) / commission_initial(紹介初期) / commission_performance(紹介成果) / commission_monthly(紹介月額) |
| targetMonth | 対象年月 | 日付 | 経費が属する月 | 月初日で統一 |
| expectedAmount | 支払予定額 | 整数（円） | 支払う予定の金額 | |
| appliedCommissionRate | 適用報酬率 | 小数(%) | 生成時に適用した率 | |
| appliedCommissionType | 報酬種別 | 文字列 | | rate / fixed |
| isWithholdingTarget | 源泉徴収対象 | 真偽値 | 源泉徴収が必要か | |
| withholdingTaxRate | 源泉徴収税率 | 小数(%) | | 10.21% or 20.42% |
| withholdingTaxAmount | 源泉徴収税額 | 整数（円） | | |
| netPaymentAmount | 差引支払額 | 整数（円） | 源泉徴収後の支払額 | |
| status | ステータス | 文字列 | 経費の状態 | pending / approved / paid / cancelled |
| paymentStatus | 支払ステータス | 文字列 | 支払の詳細状態 | null(通常) / partial(一部支払) / completed_different(金額相違あり) |
| approvedDate | 承認日 | 日付 | | |
| paidDate | 支払日 | 日付 | | |
| paidAmount | 支払額 | 整数（円） | 実際の支払額 | |
| taxType | 税区分 | 文字列 | | 内税 / 外税 |
| taxRate | 税率 | 整数(%) | | デフォルト10 |
| taxAmount | 税額 | 整数（円） | | |
| isAutoGenerated | 自動生成 | 真偽値 | 自動生成されたか | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 請求書 (`stp_invoices`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 請求書ID | 整数（自動採番） | | |
| direction | 種別 | 文字列 | 発行/受領の区分 | outgoing(自社発行) / incoming(先方受領) |
| stpCompanyId | 顧客企業 | 整数 | outgoingの場合 | |
| agentId | 代理店 | 整数 | incomingの場合 | |
| invoiceType | 請求書タイプ | 文字列 | 通常か赤伝か | standard(通常) / credit_note(赤伝) |
| originalInvoiceId | 元の請求書 | 整数 | 赤伝の場合の元請求書 | |
| registrationNumber | 登録番号 | 文字列 | 適格請求書発行事業者番号 | T+13桁 |
| invoiceNumber | 請求書番号 | 文字列 | 自動採番 | INV-YYYYMM-NNNN形式 |
| invoiceDate | 請求日 | 日付 | | |
| dueDate | 支払期限 | 日付 | | |
| totalAmount | 請求金額（税込） | 整数（円） | | |
| taxAmount | 消費税額 | 整数（円） | | |
| subtotalByTaxRate | 税率別小計 | JSON | インボイス制度対応 | |
| withholdingTaxAmount | 源泉徴収税額 | 整数（円） | incoming用 | |
| netPaymentAmount | 差引支払額 | 整数（円） | | |
| status | ステータス | 文字列 | 請求書の状態 | **outgoing:** draft → issued → sent → paid / **incoming:** received → approved → paid |
| filePath | ファイルパス | 文字列 | 保存ファイル | |
| fileName | ファイル名 | 文字列 | 元ファイル名 | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 請求書明細行 (`stp_invoice_line_items`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 明細ID | 整数（自動採番） | | |
| invoiceId | 請求書 | 整数 | 親の請求書 | |
| sortOrder | 表示順 | 整数 | | |
| description | 品目・サービス名 | 文字列 | 明細内容 | |
| quantity | 数量 | 整数 | | デフォルト1 |
| unitPrice | 単価（税抜） | 整数（円） | | |
| amount | 小計（税抜） | 整数（円） | = quantity × unitPrice | |
| taxRate | 適用税率 | 整数(%) | | デフォルト10 |
| taxRateCategory | 税率区分 | 文字列 | | standard(10%) / reduced(8%) / exempt(0%) |
| revenueRecordId | 売上レコード | 整数 | 紐づく売上 | |
| expenseRecordId | 経費レコード | 整数 | 紐づく経費 | |

### 売上・経費 編集ログ (`stp_finance_edit_logs`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | ログID | 整数（自動採番） | | |
| revenueRecordId | 売上レコード | 整数 | 対象の売上 | |
| expenseRecordId | 経費レコード | 整数 | 対象の経費 | |
| editType | 編集タイプ | 文字列 | | field_change(フィールド変更) / amount_mismatch(金額不一致) |
| fieldName | フィールド名 | 文字列 | 変更されたフィールド | |
| oldValue | 変更前の値 | 文字列 | | |
| newValue | 変更後の値 | 文字列 | | |
| reason | 変更理由 | テキスト | ユーザーが入力した理由 | |
| editedBy | 編集者 | 整数 | 編集したスタッフ | |

---

## 11. STP - 入出金・月次締め

> 画面: **入出金履歴** (`/stp/finance/payments`)、**月次締め** (`/stp/finance/monthly-close`)

### 入出金履歴 (`stp_payment_transactions`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 取引ID | 整数（自動採番） | | |
| direction | 取引区分 | 文字列 | 入金か出金か | incoming(入金) / outgoing(出金) |
| transactionDate | 取引日 | 日付 | | |
| amount | 取引金額 | 整数（円） | | |
| counterpartyName | 取引先名 | 文字列 | 銀行明細の振込名義人等 | |
| bankAccountName | 自社口座名 | 文字列 | | |
| accountCode | 勘定科目コード | 文字列 | | |
| accountName | 勘定科目名 | 文字列 | | |
| subAccountCode | 補助科目コード | 文字列 | | |
| subAccountName | 補助科目名 | 文字列 | | |
| withholdingTaxAmount | 源泉徴収税額 | 整数（円） | 経費支払時 | |
| status | 消込ステータス | 文字列 | | unmatched / partial / matched / excluded |
| processedBy | 処理者 | 整数 | 処理したスタッフ | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 入出金配分 (`stp_payment_allocations`)

> 入出金と売上/経費のN:Nマッピング（消込）

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 配分ID | 整数（自動採番） | |
| paymentTransactionId | 入出金取引 | 整数 | 対象の入出金 |
| revenueRecordId | 売上レコード | 整数 | 消込先の売上 |
| expenseRecordId | 経費レコード | 整数 | 消込先の経費 |
| allocatedAmount | 配分金額 | 整数（円） | この配分で消し込む金額 |
| note | 備考 | テキスト | |

### 月次締め (`stp_monthly_closes`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 締めID | 整数（自動採番） | |
| targetMonth | 締め対象月 | 日付 | 月初日で統一 |
| closedAt | 締め実行日時 | 日時 | |
| closedBy | 締め実行者 | 整数 | |
| reopenedAt | 再オープン日時 | 日時 | null=ロック中 |
| reopenedBy | 再オープン者 | 整数 | |
| reopenReason | 再オープン理由 | テキスト | |
| note | 備考 | テキスト | |

### 請求書番号採番 (`stp_invoice_number_sequences`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| yearMonth | 年月 | 文字列 | "2026-02" 形式 |
| lastNumber | 最後の番号 | 整数 | その月の最終番号 |

---

## 12. 経理（横断） - 会計取引・消込

> 画面: **会計取引** (`/accounting/transactions`)、**消込管理** (`/accounting/reconciliation`)、**確認管理** (`/accounting/verification`)

### 取込バッチ (`accounting_import_batches`)

> 画面: **取込管理** (`/accounting/imports`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | バッチID | 整数（自動採番） | | |
| source | データ元 | 文字列 | | freee / bank_csv / manual |
| sourceService | サービス名 | 文字列 | | freee / mufg / smbc 等 |
| fileName | ファイル名 | 文字列 | 取込ファイル名 | |
| periodFrom | 対象期間（開始） | 日付 | | |
| periodTo | 対象期間（終了） | 日付 | | |
| totalCount | 総件数 | 整数 | | |
| newCount | 新規取込件数 | 整数 | | |
| duplicateCount | 重複スキップ件数 | 整数 | | |
| status | ステータス | 文字列 | | processing / completed / error |
| errorMessage | エラー内容 | テキスト | | |
| importedBy | 取込実行者 | 整数 | | |
| importedAt | 取込日時 | 日時 | | |

### 会計取引 (`accounting_transactions`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 取引ID | 整数（自動採番） | | |
| direction | 入出金区分 | 文字列 | | incoming(入金) / outgoing(出金) |
| transactionDate | 取引日 | 日付 | | |
| valueDate | 決済日・受渡日 | 日付 | | |
| amount | 金額（税込） | 整数（円） | | |
| taxAmount | 消費税額 | 整数（円） | | |
| counterpartyName | 取引先名 | 文字列 | freee/銀行の表記 | |
| counterpartyCode | 取引先コード | 文字列 | freee上の管理コード | |
| description | 摘要 | テキスト | 銀行明細の摘要欄 | |
| memo | 社内メモ | テキスト | | |
| accountCode | 勘定科目コード | 文字列 | | |
| accountName | 勘定科目名 | 文字列 | | |
| bankAccountName | 口座名 | 文字列 | みずほ普通、UFJ当座 等 | |
| source | データ元 | 文字列 | | freee / bank_csv / manual |
| sourceService | サービス名 | 文字列 | | |
| sourceTransactionId | 外部取引ID | 文字列 | | |
| reconciliationStatus | 消込ステータス | 文字列 | | unmatched / partial / matched / excluded |
| projectId | プロジェクト | 整数 | 紐付けプロジェクト | |

### 会計消込 (`accounting_reconciliations`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 消込ID | 整数（自動採番） | | |
| transactionId | 会計取引 | 整数 | 対象の会計取引 | |
| projectId | プロジェクト | 整数 | | |
| recordType | レコード種別 | 文字列 | | revenue(売上) / expense(経費) |
| revenueRecordId | 売上レコード | 整数 | 売上の場合 | |
| expenseRecordId | 経費レコード | 整数 | 経費の場合 | |
| allocatedAmount | 消込金額 | 整数（円） | | |
| matchMethod | 照合方法 | 文字列 | | auto(自動) / manual(手動) |
| matchedBy | 消込実行者 | 整数 | | |
| matchedAt | 消込日時 | 日時 | | |
| note | 備考 | テキスト | | |

### 会計確認 (`accounting_verifications`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 確認ID | 整数（自動採番） | | |
| transactionId | 会計取引 | 整数 | 対象の会計取引 | |
| verificationType | 確認種別 | 文字列 | | project(業務発生確認) / accounting(経理確認) |
| status | ステータス | 文字列 | | pending / verified / flagged |
| verifiedBy | 確認者 | 整数 | | |
| verifiedAt | 確認日時 | 日時 | | |
| flagReason | 問題あり理由 | テキスト | | |
| note | 確認メモ | テキスト | | |

### 会計月次締め (`accounting_monthly_closes`)

> 画面: **月次締め（経理）** (`/accounting/monthly-close`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 締めID | 整数（自動採番） | | |
| targetMonth | 対象月 | 日付 | 月初日で統一 | |
| projectId | プロジェクト | 整数 | | |
| status | ステータス | 文字列 | | open / project_closed / accounting_closed |
| projectClosedAt | プロジェクト側締め日時 | 日時 | | |
| projectClosedBy | プロジェクト側締め者 | 整数 | | |
| accountingClosedAt | 経理側締め日時 | 日時 | | |
| accountingClosedBy | 経理側締め者 | 整数 | | |
| reopenedAt | 再オープン日時 | 日時 | | |
| reopenedBy | 再オープン者 | 整数 | | |
| reopenReason | 再オープン理由 | テキスト | | |
| note | 備考 | テキスト | | |

---

## 13. 接触履歴

> 画面: **企業接触履歴** (`/stp/records/company-contacts`)、**代理店接触履歴** (`/stp/records/agent-contacts`)

### 接触履歴 (`contact_histories`)

| DB カラム名 | 表示名 | データ型 | 説明 | 備考 |
|---|---|---|---|---|
| id | 接触ID | 整数（自動採番） | | |
| companyId | 企業 | 整数 | 接触した企業 | |
| contactDate | 接触日時 | 日時 | | 必須 |
| contactMethodId | 接触方法 | 整数 | | 接触方法マスタから選択 |
| contactCategoryId | 接触種別 | 整数 | | 接触種別マスタから選択 |
| staffId | 担当者 | 整数 | 社内の担当者 | |
| customerParticipants | 先方参加者 | 文字列 | 先方の参加者名 | |
| meetingMinutes | 議事録 | テキスト | | |
| note | 備考 | テキスト | | |
| deletedAt | 削除日時 | 日時 | 論理削除 | |

### 接触履歴ファイル (`contact_history_files`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| contactHistoryId | 接触履歴 | 整数 | 親の接触履歴 |
| filePath | ファイルパス | 文字列 | 保存ファイルパス |
| fileName | ファイル名 | 文字列 | 元ファイル名 |
| fileSize | ファイルサイズ | 整数 | バイト |
| mimeType | MIMEタイプ | 文字列 | ファイルの種別 |

### 接触履歴ロール (`contact_history_roles`)

> 接触履歴がどの顧客種別に属するかのタグ付け

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| contactHistoryId | 接触履歴 | 整数 | |
| customerTypeId | 顧客種別 | 整数 | 顧客種別マスタから |

---

## 14. 契約書管理

> 画面: **契約書情報** (`/stp/contracts`)

### 契約書 (`master_contracts`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | 契約書ID | 整数（自動採番） | | |
| companyId | 企業 | 整数 | 対象企業 | |
| projectId | プロジェクト | 整数 | 所属プロジェクト | |
| contractNumber | 契約書番号 | 文字列 | | |
| parentContractId | 親契約書 | 整数 | 親子関係 | |
| contractType | 契約種別 | 文字列 | 契約の種類 | |
| title | タイトル | 文字列 | 契約書の名前 | |
| startDate | 開始日 | 日付 | | |
| endDate | 終了日 | 日付 | | |
| currentStatusId | 現在のステータス | 整数 | | 契約ステータスマスタから選択 |
| targetDate | 目標日 | 日付 | | |
| signedDate | 締結日 | 日付 | | |
| isActive | アクティブ | 真偽値 | | |
| signingMethod | 締結方法 | 文字列 | | |
| cloudsignDocumentId | クラウドサインID | 文字列 | | |
| cloudsignStatus | クラウドサインステータス | 文字列 | | |
| cloudsignSentAt | クラウドサイン送信日時 | 日時 | | |
| cloudsignCompletedAt | クラウドサイン完了日時 | 日時 | | |
| cloudsignUrl | クラウドサインURL | 文字列 | | |
| filePath | ファイルパス | 文字列 | 契約書ファイル | |
| fileName | ファイル名 | 文字列 | | |
| assignedTo | 担当者 | 文字列 | | |
| note | 備考 | テキスト | | |

### 契約書ステータスマスタ (`master_contract_statuses`)

> 画面: **契約ステータス** (`/settings/contract-statuses`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ステータスID | 整数（自動採番） | |
| name | ステータス名 | 文字列 | |
| displayOrder | 表示順 | 整数 | |
| isTerminal | 終端フラグ | 真偽値 | これ以上進まない状態か |
| isActive | 有効 | 真偽値 | |

### 契約書ステータス変更履歴 (`master_contract_status_histories`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| contractId | 契約書 | 整数 | |
| eventType | イベント種別 | 文字列 | |
| fromStatusId | 変更前ステータス | 整数 | |
| toStatusId | 変更後ステータス | 整数 | |
| targetDate | 目標日 | 日付 | |
| changedBy | 変更者 | 文字列 | |
| note | 備考 | テキスト | |
| recordedAt | 記録日時 | 日時 | |

---

## 15. 外部ユーザー・認証

> 画面: **外部ユーザー管理** (`/admin/users`)、**承認待ちユーザー** (`/admin/pending-users`)

### 外部ユーザー (`external_users`)

| DB カラム名 | 表示名 | データ型 | 説明 | 選択肢 |
|---|---|---|---|---|
| id | ユーザーID | 整数（自動採番） | | |
| companyId | 所属企業 | 整数 | | |
| contactId | 担当者情報 | 整数 | 企業の担当者に紐付け | |
| name | 名前 | 文字列 | | |
| position | 役職 | 文字列 | | |
| email | メールアドレス | 文字列 | ログイン用 | ユニーク |
| status | ステータス | 文字列 | アカウントの状態 | pending_email(メール未確認) / pending_approval(承認待ち) / active(有効) / suspended(停止) |
| emailVerifiedAt | メール認証日時 | 日時 | | |
| approvedAt | 承認日時 | 日時 | | |
| approvedBy | 承認者 | 整数 | 承認したスタッフ | |
| lastLoginAt | 最終ログイン | 日時 | | |

### 登録トークン (`registration_tokens`)

> 画面: **登録トークン管理** (`/admin/registration-tokens`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | トークンID | 整数（自動採番） | |
| token | 招待トークン | 文字列 | |
| companyId | 対象企業 | 整数 | |
| name | 管理名 | 文字列 | 誰向けか等 |
| note | 備考 | テキスト | |
| expiresAt | 有効期限 | 日時 | |
| maxUses | 最大使用回数 | 整数 | デフォルト1 |
| useCount | 使用回数 | 整数 | |
| status | ステータス | 文字列 | active / expired / exhausted / revoked |
| issuedBy | 発行者 | 整数 | |

### 表示ビュー (`display_views`)

> 画面: **外部ユーザー表示区分** (`/settings/display-views`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| viewKey | ビューキー | 文字列 | stp_client, stp_agent 等 |
| viewName | ビュー名 | 文字列 | 例: 採用ブースト（クライアント版） |
| projectId | プロジェクト | 整数 | |
| description | 説明 | テキスト | |
| isActive | 有効 | 真偽値 | |

---

## 16. マスタデータ（設定）

### プロジェクト (`master_projects`)

> 画面: **プロジェクト管理** (`/settings/projects`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | プロジェクトID | 整数（自動採番） | |
| code | プロジェクトコード | 文字列 | stp, srd, slo 等 |
| name | プロジェクト名 | 文字列 | |
| description | 説明 | テキスト | |
| operatingCompanyId | 運営法人 | 整数 | |
| isActive | 有効 | 真偽値 | |
| displayOrder | 表示順 | 整数 | |

### 運営法人 (`operating_companies`)

> 画面: **運営法人マスタ** (`/settings/operating-companies`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | 法人ID | 整数（自動採番） | |
| companyName | 法人名 | 文字列 | |
| registrationNumber | 適格請求書発行事業者登録番号 | 文字列 | T+13桁 |
| postalCode | 郵便番号 | 文字列 | |
| address | 住所 | 文字列 | |
| representativeName | 代表者名 | 文字列 | |
| phone | 電話番号 | 文字列 | |
| isActive | 有効 | 真偽値 | |

### 運営法人銀行口座 (`operating_company_bank_accounts`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| operatingCompanyId | 運営法人 | 整数 | |
| bankName | 銀行名 | 文字列 | |
| bankCode | 銀行コード | 文字列 | |
| branchName | 支店名 | 文字列 | |
| branchCode | 支店コード | 文字列 | |
| accountNumber | 口座番号 | 文字列 | |
| accountHolderName | 口座名義人 | 文字列 | |
| note | メモ | テキスト | |

### 接触方法 (`contact_methods`)

> 画面: **接触方法** (`/settings/contact-methods`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| name | 接触方法名 | 文字列 | 電話、メール、対面 等 |
| displayOrder | 表示順 | 整数 | |
| isActive | 有効 | 真偽値 | |

### 接触種別 (`contact_categories`)

> 画面: **接触種別** (`/settings/contact-categories`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| projectId | プロジェクト | 整数 | 所属プロジェクト |
| name | 接触種別名 | 文字列 | 商談、キックオフ 等 |
| displayOrder | 表示順 | 整数 | |
| isActive | 有効 | 真偽値 | |

### 顧客種別 (`customer_types`)

> 画面: **顧客種別** (`/settings/customer-types`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| projectId | プロジェクト | 整数 | 所属プロジェクト |
| name | 顧客種別名 | 文字列 | |
| displayOrder | 表示順 | 整数 | |
| isActive | 有効 | 真偽値 | |

### 流入経路 (`stp_lead_sources`)

> 画面: **STP_流入経路** (`/settings/lead-sources`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| name | 流入経路名 | 文字列 | |
| displayOrder | 表示順 | 整数 | |
| isActive | 有効 | 真偽値 | |

### 短縮URL (`short_urls`)

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| id | ID | 整数（自動採番） | |
| shortCode | 短縮コード | 文字列 | 6文字英数字 |
| originalUrl | 元URL | 文字列 | リダイレクト先 |

### フィールド変更履歴 (`field_change_logs`)

> 担当者変更等の重要フィールドの変更ログ

| DB カラム名 | 表示名 | データ型 | 説明 |
|---|---|---|---|
| entityType | 対象種別 | 文字列 | stp_company / stp_agent / stp_contract_history |
| entityId | 対象ID | 整数 | 対象レコードのID |
| fieldName | フィールド名 | 文字列 | salesStaffId 等 |
| displayName | 表示名 | 文字列 | 担当営業、担当事務 等 |
| oldValue | 変更前の値 | 文字列 | |
| newValue | 変更後の値 | 文字列 | |
| note | 変更理由メモ | テキスト | 必須 |

---

## 17. 画面一覧とメニュー構成

### Stella（共通）

| メニュー名 | URL | 主な機能 |
|---|---|---|
| ダッシュボード | `/` | トップページ |
| Stella全顧客マスタ | `/companies` | 企業の一覧・登録・編集・検索 |
| スタッフ管理 | `/staff` | 社内スタッフの管理・権限設定 |

### STP（採用ブースト）

| メニュー名 | URL | 主な機能 |
|---|---|---|
| ダッシュボード | `/stp/dashboard` | STPプロジェクトの概要 |
| 企業情報 | `/stp/companies` | STP企業の一覧・商談管理 |
| 代理店情報 | `/stp/agents` | 代理店の一覧・契約管理 |
| 求職者情報 | `/stp/candidates` | 求職者の一覧・選考管理 |
| リード回答 | `/stp/lead-submissions` | フォーム回答の処理 |
| 契約書情報 | `/stp/contracts` | 契約書の管理 |

### STP > 売上・経費

| メニュー名 | URL | 主な機能 |
|---|---|---|
| ダッシュボード | `/stp/finance` | 財務概要 |
| 売上管理 | `/stp/finance/revenue` | 売上レコードの管理 |
| 経費管理 | `/stp/finance/expenses` | 経費レコードの管理 |
| 請求書管理 | `/stp/finance/invoices` | 請求書の発行・受領管理 |
| 入出金履歴 | `/stp/finance/payments` | 銀行取引の記録・消込 |
| 売掛金年齢表 | `/stp/finance/aging` | 未回収売掛金の経過日数管理 |
| 月次締め | `/stp/finance/monthly-close` | 月次のデータロック |
| 企業別サマリー | `/stp/finance/company-summary` | 企業ごとの売上・経費集計 |
| 代理店別サマリー | `/stp/finance/agent-summary` | 代理店ごとの経費集計 |

### STP > 記録

| メニュー名 | URL | 主な機能 |
|---|---|---|
| 企業接触履歴 | `/stp/records/company-contacts` | 企業との接触ログ |
| 代理店接触履歴 | `/stp/records/agent-contacts` | 代理店との接触ログ |
| 商談パイプライン履歴 | `/stp/records/stage-histories` | ステージ変更の履歴 |

### 経理

| メニュー名 | URL | 主な機能 |
|---|---|---|
| ダッシュボード | `/accounting` | 経理概要 |
| 会計取引 | `/accounting/transactions` | freee/銀行の入出金データ |
| 消込管理 | `/accounting/reconciliation` | 会計取引とプロジェクト側の照合 |
| 確認管理 | `/accounting/verification` | ダブルチェック（業務/経理） |
| 月次締め | `/accounting/monthly-close` | プロジェクト横断の月次締め |
| 取込管理 | `/accounting/imports` | CSV/freeeデータ取込 |

### 設定（マスタデータ）

| メニュー名 | URL | 主な機能 |
|---|---|---|
| 運営法人マスタ | `/settings/operating-companies` | 運営法人の管理 |
| プロジェクト管理 | `/settings/projects` | プロジェクトの管理 |
| スタッフ役割種別 | `/staff/role-types` | 役割種別の管理 |
| 顧客種別 | `/settings/customer-types` | 顧客種別の管理 |
| 接触方法 | `/settings/contact-methods` | 接触方法の管理 |
| 接触種別 | `/settings/contact-categories` | 接触種別の管理 |
| 契約ステータス | `/settings/contract-statuses` | 契約ステータスの管理 |
| 外部ユーザー表示区分 | `/settings/display-views` | 外部ユーザービューの管理 |
| STP_流入経路 | `/settings/lead-sources` | 流入経路の管理 |
| STP_商談パイプライン | `/stp/settings/stages` | パイプラインステージの管理 |
| 担当者フィールド制約 | `/staff/field-restrictions` | フィールド絞り込みの管理 |

### 外部ユーザー管理

| メニュー名 | URL | 主な機能 |
|---|---|---|
| 外部ユーザー管理 | `/admin/users` | 外部ユーザーの一覧・管理 |
| 承認待ちユーザー | `/admin/pending-users` | 承認待ちユーザーの処理 |
| 登録トークン管理 | `/admin/registration-tokens` | 招待トークンの発行・管理 |

---

## テーブル間のリレーション（主要な関係）

```
MasterStellaCompany (全顧客マスタ)
├── StellaCompanyLocation (拠点)
├── StellaCompanyContact (担当者)
├── StellaCompanyBankAccount (銀行口座)
├── StpCompany (STP企業) ── 1企業 : N件
│   ├── StpStageHistory (ステージ変更履歴)
│   ├── StpCompanyContract (契約書)
│   ├── StpProposal (提案書)
│   ├── StpKpiSheet (KPIシート) → StpKpiWeeklyData (週次データ)
│   ├── StpCandidate (求職者)
│   ├── StpRevenueRecord (売上実績)
│   └── StpExpenseRecord (経費実績)
├── StpAgent (代理店) ── 1企業 : 0-1件
│   ├── StpAgentContract (契約書)
│   ├── StpAgentContractHistory (契約履歴) → StpAgentCommissionOverride (報酬例外)
│   ├── StpLeadFormToken (フォームトークン) → StpLeadFormSubmission (フォーム回答)
│   └── StpExpenseRecord (経費実績)
├── StpContractHistory (契約履歴)
├── ContactHistory (接触履歴) → ContactHistoryFile / ContactHistoryRole
└── MasterContract (契約書) → MasterContractStatusHistory

MasterStaff (スタッフ)
├── StaffPermission (権限)
├── StaffRoleAssignment (役割割当)
└── StaffProjectAssignment (プロジェクト割当)

StpInvoice (請求書) → StpInvoiceLineItem (明細行)
StpPaymentTransaction (入出金) → StpPaymentAllocation (配分)
AccountingTransaction (会計取引) → AccountingReconciliation / AccountingVerification
```

---

> 最終更新: 2026-02-20
