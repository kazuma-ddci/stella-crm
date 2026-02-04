# データベース設計書

このドキュメントはstella-crmのデータベース構造を詳細に記述したものです。
DBスキーマに変更があった場合は、このファイルを更新してください。

**最終更新日**: 2026-02-02

---

## 目次

1. [テーブル一覧](#テーブル一覧)
2. [ER図](#er図)
3. [テーブル詳細](#テーブル詳細)
   - [全顧客マスタ系](#1-全顧客マスタ系)
   - [STPプロジェクト系](#2-stpプロジェクト系)
   - [スタッフ・権限系](#3-スタッフ権限系)
   - [共通マスタ系](#4-共通マスタ系)
   - [契約書管理系](#5-契約書管理系)
   - [外部ユーザー系](#6-外部ユーザー系)
4. [リレーション一覧](#リレーション一覧)
5. [インデックス一覧](#インデックス一覧)
6. [選択肢・Enum値](#選択肢enum値)

---

## テーブル一覧

| # | テーブル名（物理名） | モデル名（Prisma） | 説明 | 分類 |
|---|---------------------|-------------------|------|------|
| 1 | master_stella_companies | MasterStellaCompany | 全顧客マスタ | 全顧客マスタ系 |
| 2 | stella_company_locations | StellaCompanyLocation | 企業拠点 | 全顧客マスタ系 |
| 3 | stella_company_contacts | StellaCompanyContact | 企業担当者 | 全顧客マスタ系 |
| 4 | stp_agents | StpAgent | 代理店マスタ | STP系 |
| 5 | stp_agent_contracts | StpAgentContract | 代理店契約書 | STP系 |
| 6 | stp_agent_staff | StpAgentStaff | 代理店担当者（中間） | STP系 |
| 7 | stp_stages | StpStage | 商談ステージマスタ | STP系 |
| 8 | stp_lead_sources | StpLeadSource | 流入経路マスタ | STP系 |
| 9 | stp_communication_methods | StpCommunicationMethod | 連絡方法マスタ | STP系 |
| 10 | stp_companies | StpCompany | STP企業 | STP系 |
| 11 | stp_company_contracts | StpCompanyContract | STP企業契約書 | STP系 |
| 12 | stp_stage_histories | StpStageHistory | ステージ変更履歴 | STP系 |
| 13 | stp_contract_histories | StpContractHistory | 契約履歴 | STP系 |
| 14 | contact_methods | ContactMethod | 接触方法マスタ | 共通マスタ系 |
| 15 | contact_histories | ContactHistory | 接触履歴 | 共通マスタ系 |
| 16 | contact_history_roles | ContactHistoryRole | 接触履歴ロール（中間） | 共通マスタ系 |
| 17 | customer_types | CustomerType | 顧客種別マスタ | 共通マスタ系 |
| 18 | master_staff | MasterStaff | スタッフマスタ | スタッフ系 |
| 19 | staff_role_types | StaffRoleType | スタッフ役割種別 | スタッフ系 |
| 20 | staff_role_assignments | StaffRoleAssignment | スタッフ役割割当（廃止予定） | スタッフ系 |
| 21 | staff_project_assignments | StaffProjectAssignment | スタッフプロジェクト割当 | スタッフ系 |
| 22 | staff_permissions | StaffPermission | スタッフ権限 | スタッフ系 |
| 23 | master_projects | MasterProject | プロジェクトマスタ | 共通マスタ系 |
| 24 | master_contracts | MasterContract | 契約書 | 契約書管理系 |
| 25 | master_contract_statuses | MasterContractStatus | 契約書ステータスマスタ | 契約書管理系 |
| 26 | master_contract_status_histories | MasterContractStatusHistory | 契約書ステータス変更履歴 | 契約書管理系 |
| 27 | external_users | ExternalUser | 外部ユーザー | 外部ユーザー系 |
| 28 | display_views | DisplayView | 表示ビュー定義 | 外部ユーザー系 |
| 29 | external_user_display_permissions | ExternalUserDisplayPermission | 外部ユーザー表示権限（中間） | 外部ユーザー系 |
| 30 | registration_tokens | RegistrationToken | 登録トークン | 外部ユーザー系 |
| 31 | registration_token_default_views | RegistrationTokenDefaultView | 登録トークンデフォルトビュー（中間） | 外部ユーザー系 |
| 32 | email_verification_tokens | EmailVerificationToken | メール認証トークン | 外部ユーザー系 |
| 33 | password_reset_tokens | PasswordResetToken | パスワードリセットトークン | 外部ユーザー系 |
| 34 | login_histories | LoginHistory | ログイン履歴 | 外部ユーザー系 |
| 35 | stp_kpi_sheets | StpKpiSheet | KPIシート | STP系 |
| 36 | stp_kpi_weekly_data | StpKpiWeeklyData | KPI週次データ | STP系 |
| 37 | stp_kpi_share_links | StpKpiShareLink | KPI共有リンク | STP系 |

---

## ER図

### 全体構成（概念レベル）

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              全顧客マスタ系                                      │
│  ┌──────────────────────┐                                                       │
│  │ MasterStellaCompany  │←────────────────────────────────────────────┐         │
│  │   (全顧客マスタ)      │                                             │         │
│  └──────────┬───────────┘                                             │         │
│             │                                                          │         │
│     ┌───────┴───────┐                                                 │         │
│     ▼               ▼                                                 │         │
│  ┌────────────┐ ┌────────────┐                                       │         │
│  │ Locations  │ │  Contacts  │                                       │         │
│  │ (企業拠点)  │ │ (企業担当者) │                                       │         │
│  └────────────┘ └────────────┘                                       │         │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    ▼                   ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              STPプロジェクト系                                   │
│                                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐                              │
│  │    StpAgent      │←────────│    StpCompany    │                              │
│  │   (代理店)        │         │   (STP企業)      │                              │
│  └────────┬─────────┘         └────────┬─────────┘                              │
│           │                            │                                        │
│     ┌─────┴─────┐              ┌───────┴───────┐                                │
│     ▼           ▼              ▼               ▼                                │
│  ┌──────────┐ ┌──────────┐  ┌──────────┐ ┌──────────────┐                       │
│  │ Agent    │ │ Agent    │  │ Company  │ │ Stage        │                       │
│  │ Contracts│ │ Staff    │  │ Contracts│ │ Histories    │                       │
│  │(代理店契約)│ │(担当者)   │  │(企業契約) │ │(ステージ履歴) │                       │
│  └──────────┘ └──────────┘  └──────────┘ └──────────────┘                       │
│                                    │                                            │
│              ┌─────────────────────┼─────────────────────┐                      │
│              ▼                     ▼                     ▼                      │
│       ┌─────────────┐      ┌─────────────┐      ┌─────────────┐                 │
│       │  StpStage   │      │ LeadSource  │      │Communication│                 │
│       │ (ステージ)   │      │ (流入経路)   │      │   Method    │                 │
│       └─────────────┘      └─────────────┘      │ (連絡方法)   │                 │
│                                                 └─────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              スタッフ・権限系                                    │
│                                                                                  │
│  ┌──────────────────┐                                                           │
│  │   MasterStaff    │                                                           │
│  │   (スタッフ)      │                                                           │
│  └────────┬─────────┘                                                           │
│           │                                                                      │
│     ┌─────┼─────┬─────────────┐                                                 │
│     ▼     ▼     ▼             ▼                                                 │
│  ┌──────┐┌────────┐┌─────────────┐┌─────────────┐                               │
│  │ Role ││Project ││  Staff      ││ Staff       │                               │
│  │Assign││Assign  ││ Permissions ││ RoleTypes   │                               │
│  └──────┘└────────┘└─────────────┘└─────────────┘                               │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              共通・接触履歴系                                    │
│                                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐                              │
│  │  ContactHistory  │←────────│  ContactMethod   │                              │
│  │   (接触履歴)      │         │   (接触方法)      │                              │
│  └────────┬─────────┘         └──────────────────┘                              │
│           │                                                                      │
│           ▼                                                                      │
│  ┌──────────────────┐         ┌──────────────────┐                              │
│  │ContactHistoryRole│────────→│   CustomerType   │                              │
│  │ (履歴ロール中間)   │         │   (顧客種別)      │                              │
│  └──────────────────┘         └────────┬─────────┘                              │
│                                        │                                        │
│                                        ▼                                        │
│                               ┌──────────────────┐                              │
│                               │  MasterProject   │                              │
│                               │  (プロジェクト)   │                              │
│                               └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              契約書管理系                                        │
│                                                                                  │
│  ┌──────────────────┐                                                           │
│  │  MasterContract  │←────────────────────────────────┐ (自己参照: 親子契約)      │
│  │   (契約書)        │─────────────────────────────────┘                         │
│  └────────┬─────────┘                                                           │
│           │                                                                      │
│           ▼                                                                      │
│  ┌────────────────────────┐    ┌────────────────────────┐                       │
│  │MasterContractStatus    │    │MasterContractStatus    │                       │
│  │History (ステータス履歴) │───→│     (ステータス)        │                       │
│  └────────────────────────┘    └────────────────────────┘                       │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              外部ユーザー系                                      │
│                                                                                  │
│  ┌──────────────────┐         ┌──────────────────┐                              │
│  │   ExternalUser   │←────────│RegistrationToken │                              │
│  │   (外部ユーザー)  │         │   (登録トークン)  │                              │
│  └────────┬─────────┘         └────────┬─────────┘                              │
│           │                            │                                        │
│     ┌─────┼─────────────┐              ▼                                        │
│     ▼     ▼             ▼     ┌──────────────────┐                              │
│  ┌──────┐┌─────────┐┌──────┐  │  DefaultViews    │                              │
│  │Email ││Password ││Login │  │  (デフォルトビュー)│                              │
│  │Token ││Reset    ││History│  └─────────┬────────┘                              │
│  │(認証) ││(リセット)||(履歴) │            │                                        │
│  └──────┘└─────────┘└──────┘            ▼                                        │
│           │                    ┌──────────────────┐                              │
│           ▼                    │   DisplayView    │                              │
│  ┌──────────────────┐          │   (表示ビュー)    │                              │
│  │DisplayPermission │─────────→└──────────────────┘                              │
│  │ (表示権限)        │                                                            │
│  └──────────────────┘                                                            │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### 詳細リレーション図

```
MasterStellaCompany (1) ──────┬────── (N) StellaCompanyLocation
                              │
                              ├────── (N) StellaCompanyContact
                              │
                              ├────── (N) StpCompany
                              │
                              ├────── (1) StpAgent [AgentCompany]
                              │
                              ├────── (N) StpAgent [ReferrerCompany]
                              │
                              ├────── (N) StpContractHistory
                              │
                              ├────── (N) ContactHistory
                              │
                              ├────── (N) MasterContract
                              │
                              ├────── (N) ExternalUser
                              │
                              └────── (N) RegistrationToken


StpAgent (1) ─────────────────┬────── (N) StpAgentContract
                              │
                              ├────── (N) StpAgentStaff
                              │
                              └────── (N) StpCompany


StpCompany (1) ───────────────┬────── (N) StpCompanyContract
                              │
                              └────── (N) StpStageHistory


StpStage (1) ─────────────────┬────── (N) StpCompany [CurrentStage]
                              │
                              ├────── (N) StpCompany [TargetStage]
                              │
                              ├────── (N) StpStageHistory [FromStage]
                              │
                              └────── (N) StpStageHistory [ToStage]


MasterStaff (1) ──────────────┬────── (N) StaffPermission
                              │
                              ├────── (N) StaffRoleAssignment
                              │
                              ├────── (N) StaffProjectAssignment
                              │
                              ├────── (N) StpAgentStaff
                              │
                              ├────── (N) MasterStellaCompany
                              │
                              ├────── (N) StpCompany [SalesStaff]
                              │
                              ├────── (N) StpContractHistory [SalesStaff]
                              │
                              ├────── (N) StpContractHistory [OperationStaff]
                              │
                              ├────── (N) ContactHistory
                              │
                              ├────── (N) ExternalUser [Approver]
                              │
                              └────── (N) RegistrationToken [Issuer]


ContactHistory (1) ───────────┴────── (N) ContactHistoryRole


CustomerType (1) ─────────────┴────── (N) ContactHistoryRole


MasterProject (1) ────────────┬────── (N) MasterContract
                              │
                              ├────── (N) StaffProjectAssignment
                              │
                              └────── (N) CustomerType


MasterContract (1) ───────────┬────── (N) MasterContractStatusHistory
                              │
                              └────── (N) MasterContract [子契約]


MasterContractStatus (1) ─────┬────── (N) MasterContract [CurrentStatus]
                              │
                              ├────── (N) MasterContractStatusHistory [FromStatus]
                              │
                              └────── (N) MasterContractStatusHistory [ToStatus]


StellaCompanyContact (1) ─────┴────── (1) ExternalUser


ExternalUser (1) ─────────────┬────── (N) ExternalUserDisplayPermission
                              │
                              ├────── (N) LoginHistory
                              │
                              ├────── (N) EmailVerificationToken
                              │
                              └────── (N) PasswordResetToken


DisplayView (1) ──────────────┬────── (N) ExternalUserDisplayPermission
                              │
                              └────── (N) RegistrationTokenDefaultView


RegistrationToken (1) ────────┬────── (N) RegistrationTokenDefaultView
                              │
                              └────── (N) ExternalUser
```

---

## テーブル詳細

### 1. 全顧客マスタ系

#### 1.1 master_stella_companies（全顧客マスタ）

**概要**: システム全体で共有される顧客企業の基本情報を管理するマスタテーブル。すべてのプロジェクト（STP等）から参照される中心的なテーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyCode | VARCHAR(20) | NO | - | UNIQUE | 企業コード（SC-1, SC-2...） |
| name | VARCHAR(200) | NO | - | - | 企業名 |
| websiteUrl | VARCHAR(500) | YES | - | - | 企業HP URL |
| industry | VARCHAR(100) | YES | - | - | 業界（自由入力） |
| revenueScale | VARCHAR(100) | YES | - | - | 売上規模（自由入力） |
| staffId | INT | YES | - | FK(master_staff) | 担当者（AS） |
| note | TEXT | YES | - | - | メモ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `staff` → MasterStaff (N:1) - 担当スタッフ
- `locations` ← StellaCompanyLocation (1:N) - 企業拠点
- `contacts` ← StellaCompanyContact (1:N) - 企業担当者
- `stpCompanies` ← StpCompany (1:N) - STP企業
- `stpContractHistories` ← StpContractHistory (1:N) - 契約履歴
- `agentCompanies` ← StpAgent (1:1) - 代理店としての登録
- `referredAgents` ← StpAgent (1:N) - 紹介した代理店
- `contracts` ← MasterContract (1:N) - 契約書
- `contactHistories` ← ContactHistory (1:N) - 接触履歴
- `externalUsers` ← ExternalUser (1:N) - 外部ユーザー
- `registrationTokens` ← RegistrationToken (1:N) - 登録トークン

---

#### 1.2 stella_company_locations（企業拠点）

**概要**: 全顧客マスタに紐づく企業の拠点情報（本社、支社、営業所など）を管理。請求先住所の選択元としても使用。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK(master_stella_companies) | 企業ID |
| name | VARCHAR(100) | NO | - | - | 拠点名（本社、大阪支店など） |
| address | TEXT | YES | - | - | 住所 |
| phone | VARCHAR(50) | YES | - | - | 電話番号 |
| email | VARCHAR(255) | YES | - | - | メールアドレス |
| isPrimary | BOOLEAN | NO | false | - | 主要拠点フラグ |
| note | TEXT | YES | - | - | 備考 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |
| deletedAt | TIMESTAMP | YES | - | - | 論理削除日時 |

**リレーション**:
- `company` → MasterStellaCompany (N:1, CASCADE削除) - 親企業

**特記事項**:
- 論理削除対応（deletedAt）
- isPrimary=trueは1企業につき1拠点のみを推奨

---

#### 1.3 stella_company_contacts（企業担当者）

**概要**: 全顧客マスタに紐づく企業側の担当者情報を管理。請求先代表者の選択元としても使用。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK(master_stella_companies) | 企業ID |
| name | VARCHAR(100) | NO | - | - | 担当者名 |
| email | VARCHAR(255) | YES | - | - | メールアドレス |
| phone | VARCHAR(50) | YES | - | - | 電話番号 |
| department | VARCHAR(100) | YES | - | - | 担当部署 |
| isPrimary | BOOLEAN | NO | false | - | 主連絡先フラグ |
| note | TEXT | YES | - | - | 備考 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |
| deletedAt | TIMESTAMP | YES | - | - | 論理削除日時 |

**リレーション**:
- `company` → MasterStellaCompany (N:1, CASCADE削除) - 親企業
- `externalUser` ← ExternalUser (1:1) - 外部ユーザーとの紐付け

**特記事項**:
- 論理削除対応（deletedAt）
- isPrimary=trueは1企業につき1担当者のみを推奨

---

### 2. STPプロジェクト系

#### 2.1 stp_agents（代理店マスタ）

**概要**: STPプロジェクトの代理店情報を管理。全顧客マスタと1:1で紐づき、企業情報は全顧客マスタから取得。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK, UNIQUE | 代理店企業（master_stella_companiesへ） |
| status | VARCHAR(20) | NO | - | - | ステータス（アクティブ/休止/解約） |
| category1 | VARCHAR(20) | NO | - | - | 区分①（代理店/顧問） |
| category2 | VARCHAR(20) | NO | - | - | 区分②（法人/個人） |
| meetingDate | DATE | YES | - | - | 商談日 |
| contractStatus | VARCHAR(20) | YES | - | - | 契約ステータス |
| contractNote | TEXT | YES | - | - | 契約内容メモ |
| referrerCompanyId | INT | YES | - | FK(master_stella_companies) | 紹介者企業ID |
| note | TEXT | YES | - | - | 代理店メモ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**status選択肢**: `アクティブ`, `休止`, `解約`

**category1選択肢**: `代理店`, `顧問`

**category2選択肢**: `法人`, `個人`

**contractStatus選択肢**: `契約済み`, `商談済み`, `未商談`, `日程調整中`

**リレーション**:
- `company` → MasterStellaCompany (1:1) - 代理店企業情報
- `referrerCompany` → MasterStellaCompany (N:1) - 紹介者企業
- `stpCompanies` ← StpCompany (1:N) - 担当するSTP企業
- `contracts` ← StpAgentContract (1:N) - 代理店契約書
- `staffAssignments` ← StpAgentStaff (1:N) - 担当スタッフ

**特記事項**:
- companyIdはUNIQUE制約により1企業=1代理店
- 企業名、電話番号、メール等はcompanyリレーションから取得

---

#### 2.2 stp_agent_contracts（代理店契約書）

**概要**: 代理店との契約書情報を管理。クラウドサイン等の外部サービス連携にも対応。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| agentId | INT | NO | - | FK(stp_agents) | 代理店ID |
| contractUrl | VARCHAR | NO | - | - | 契約書URL |
| signedDate | DATE | YES | - | - | 締結日（未締結はnull） |
| title | VARCHAR(200) | YES | - | - | 契約書タイトル |
| externalId | VARCHAR(100) | YES | - | - | 外部サービスID |
| externalService | VARCHAR(50) | YES | - | - | 外部サービス名 |
| status | VARCHAR(20) | NO | 'signed' | - | ステータス |
| note | TEXT | YES | - | - | 備考 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**status選択肢**: `draft`, `pending`, `signed`, `expired`

**リレーション**:
- `agent` → StpAgent (N:1, CASCADE削除) - 親代理店

---

#### 2.3 stp_agent_staff（代理店担当者中間テーブル）

**概要**: 代理店とスタッフの多対多関係を管理する中間テーブル。1つの代理店に複数のスタッフを割り当て可能。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| agentId | INT | NO | - | FK(stp_agents) | 代理店ID |
| staffId | INT | NO | - | FK(master_staff) | スタッフID |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(agentId, staffId)` - 同一代理店に同一スタッフは1回のみ

**リレーション**:
- `agent` → StpAgent (N:1, CASCADE削除)
- `staff` → MasterStaff (N:1, CASCADE削除)

---

#### 2.4 stp_stages（商談ステージマスタ）

**概要**: STPプロジェクトの商談ステージを定義するマスタテーブル。ステージの順序と種別を管理。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(50) | NO | - | - | ステージ名 |
| displayOrder | INT | YES | - | - | 表示順（NULLは特殊ステージ） |
| stageType | VARCHAR(20) | NO | 'progress' | - | ステージ種別 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**stageType選択肢**:
- `progress` - 進行ステージ（通常の商談フロー）
- `closed_won` - 受注（終了ステージ）
- `closed_lost` - 失注（終了ステージ）
- `pending` - 保留/検討中（特殊ステージ）

**初期データ**:
| id | name | displayOrder | stageType |
|----|------|--------------|-----------|
| 1 | リード | 1 | progress |
| 2 | 商談化 | 2 | progress |
| 3 | 提案中 | 3 | progress |
| 4 | 見積提示 | 4 | progress |
| 5 | 受注 | 5 | closed_won |
| 6 | 失注 | 6 | closed_lost |
| 7 | 検討中 | 7 | pending |

**リレーション**:
- `currentStageCompanies` ← StpCompany (1:N) - 現在このステージにいる企業
- `targetStageCompanies` ← StpCompany (1:N) - このステージを目標にしている企業
- `fromStageHistories` ← StpStageHistory (1:N) - このステージからの変更履歴
- `toStageHistories` ← StpStageHistory (1:N) - このステージへの変更履歴

**特記事項**:
- 失注(6)、検討中(7)は目標ステージとして設定不可
- displayOrderがNULLの場合は特殊ステージとして扱う

---

#### 2.5 stp_lead_sources（流入経路マスタ）

**概要**: STPプロジェクトのリード獲得経路を定義するマスタテーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(100) | NO | - | - | 流入経路名 |
| displayOrder | INT | NO | 0 | - | 表示順 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `stpCompanies` ← StpCompany (1:N) - この経路から獲得した企業

---

#### 2.6 stp_communication_methods（連絡方法マスタ）

**概要**: STPプロジェクトで企業との主な連絡方法を定義するマスタテーブル。接触方法とは別。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(100) | NO | - | - | 連絡方法名 |
| displayOrder | INT | NO | 0 | - | 表示順 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `stpCompanies` ← StpCompany (1:N) - この連絡方法を使用する企業

**注意**: 接触履歴の「接触方法」とは別のマスタ。こちらは企業との日常的な連絡手段を示す。

---

#### 2.7 stp_companies（STP企業）

**概要**: STPプロジェクトの商談対象企業を管理するメインテーブル。全顧客マスタと紐づき、商談ステージ、契約情報、請求先情報等を保持。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| **基本情報** |
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK(master_stella_companies) | 全顧客マスタID |
| agentId | INT | YES | - | FK(stp_agents) | 担当代理店ID |
| note | TEXT | YES | - | - | 企業メモ |
| **ステージ管理** |
| currentStageId | INT | YES | - | FK(stp_stages) | 現在のステージ |
| nextTargetStageId | INT | YES | - | FK(stp_stages) | 目標ステージ |
| nextTargetDate | DATE | YES | - | - | 目標達成予定日 |
| **日付情報** |
| leadAcquiredDate | DATE | YES | - | - | リード獲得日 |
| meetingDate | DATE | YES | - | - | 初回商談日 |
| firstKoDate | DATE | YES | - | - | 初回KO日 |
| jobPostingStartDate | VARCHAR(100) | YES | - | - | 求人掲載開始日（テキスト） |
| **進捗・ステータス** |
| progressDetail | TEXT | YES | - | - | 進捗詳細 |
| forecast | VARCHAR(20) | YES | - | - | ヨミ |
| operationStatus | VARCHAR(20) | YES | - | - | 運用ステータス |
| lostReason | TEXT | YES | - | - | 失注理由 |
| **企業情報** |
| industryType | VARCHAR(20) | YES | - | - | 業種区分 |
| industry | VARCHAR(100) | YES | - | - | 業界 |
| plannedHires | INT | YES | - | - | 採用予定人数 |
| leadSourceId | INT | YES | - | FK(stp_lead_sources) | 流入経路 |
| **契約情報** |
| contractPlan | VARCHAR(50) | YES | - | - | 契約プラン |
| media | VARCHAR(100) | YES | - | - | 媒体 |
| contractStartDate | DATE | YES | - | - | 契約開始日 |
| contractEndDate | DATE | YES | - | - | 契約終了日 |
| initialFee | INT | YES | - | - | 初期費用 |
| monthlyFee | INT | YES | - | - | 月額 |
| performanceFee | INT | YES | - | - | 成果報酬単価 |
| salesStaffId | INT | YES | - | FK(master_staff) | 担当営業 |
| operationStaffList | VARCHAR(100) | YES | - | - | 担当運用（カンマ区切り） |
| contractNote | TEXT | YES | - | - | 契約メモ |
| **アカウント情報** |
| accountId | VARCHAR(100) | YES | - | - | アカウントID |
| accountPass | VARCHAR(100) | YES | - | - | アカウントPASS |
| **リンク情報** |
| jobInfoFolderLink | TEXT | YES | - | - | 求人票/会社情報フォルダリンク |
| operationReportLink | TEXT | YES | - | - | 運用進捗レポートリンク |
| proposalLink | TEXT | YES | - | - | 提案書リンク |
| **請求先情報** |
| billingLocationId | INT | YES | - | - | 請求先住所（拠点ID） |
| billingContactId | INT | YES | - | - | 請求先代表者（担当者ID） |
| billingEmailSource | VARCHAR(50) | YES | - | - | 請求先アドレス元 |
| billingCompanyName | VARCHAR(200) | YES | - | - | 請求先企業名 |
| billingAddress | TEXT | YES | - | - | 請求先住所（コピー） |
| billingRepresentative | VARCHAR(100) | YES | - | - | 請求先代表者（コピー） |
| billingEmail | VARCHAR(255) | YES | - | - | 請求先アドレス（コピー） |
| paymentTerms | VARCHAR(100) | YES | - | - | 支払いサイト |
| **連絡方法** |
| communicationMethodId | INT | YES | - | FK(stp_communication_methods) | 連絡方法 |
| **検討中専用** |
| pendingReason | TEXT | YES | - | - | 検討中理由 |
| pendingResponseDate | DATE | YES | - | - | 回答予定日 |
| **システム** |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**forecast選択肢**: `MIN`, `落とし`, `MAX`, `来月`, `辞退`

**operationStatus選択肢**: `テスト1`, `テスト2`

**industryType選択肢**: `一般`, `派遣`

**initialFee選択肢**: `0`, `100000`, `150000`

**リレーション**:
- `company` → MasterStellaCompany (N:1, CASCADE削除) - 全顧客マスタ
- `currentStage` → StpStage (N:1) - 現在のステージ
- `nextTargetStage` → StpStage (N:1) - 目標ステージ
- `agent` → StpAgent (N:1) - 担当代理店
- `leadSource` → StpLeadSource (N:1) - 流入経路
- `communicationMethod` → StpCommunicationMethod (N:1) - 連絡方法
- `salesStaff` → MasterStaff (N:1) - 担当営業
- `stageHistories` ← StpStageHistory (1:N) - ステージ変更履歴
- `contracts` ← StpCompanyContract (1:N) - 契約書

**特記事項**:
- 請求先情報は選択時に拠点/担当者からコピーされる
- 全顧客マスタの業界・売上規模・企業HPはcompanyリレーションから取得

---

#### 2.8 stp_company_contracts（STP企業契約書）

**概要**: STP企業との契約書情報を管理。クラウドサイン等の外部サービス連携にも対応。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| stpCompanyId | INT | NO | - | FK(stp_companies) | STP企業ID |
| contractUrl | TEXT | YES | - | - | 契約書URL |
| signedDate | DATE | YES | - | - | 締結日（未締結はnull） |
| title | VARCHAR(200) | YES | - | - | 契約書タイトル |
| externalId | VARCHAR(100) | YES | - | - | 外部サービスID |
| externalService | VARCHAR(50) | YES | - | - | 外部サービス名 |
| status | VARCHAR(50) | NO | 'draft' | - | ステータス |
| note | TEXT | YES | - | - | 備考 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**status選択肢**: `draft`, `送付済み`, `先方情報待ち`, `signed`, `expired`

**リレーション**:
- `stpCompany` → StpCompany (N:1, CASCADE削除) - 親STP企業

---

#### 2.9 stp_stage_histories（ステージ変更履歴）

**概要**: STP企業のステージ変更を記録する履歴テーブル。イベント種別により商談の進捗を追跡。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| stpCompanyId | INT | NO | - | FK(stp_companies) | STP企業ID |
| eventType | VARCHAR(20) | NO | - | - | イベント種別 |
| fromStageId | INT | YES | - | FK(stp_stages) | 変更前ステージ |
| toStageId | INT | YES | - | FK(stp_stages) | 変更後ステージ |
| targetDate | DATE | YES | - | - | 目標日 |
| recordedAt | TIMESTAMP | NO | now() | - | 記録日時 |
| changedBy | VARCHAR(100) | YES | - | - | 変更者 |
| note | TEXT | YES | - | - | 備考 |
| isCorrected | BOOLEAN | NO | false | - | 修正済みフラグ |
| alertAcknowledged | BOOLEAN | NO | false | - | アラート確認フラグ |
| lostReason | TEXT | YES | - | - | 失注理由 |
| pendingReason | TEXT | YES | - | - | 検討中理由 |
| subType | VARCHAR(20) | YES | - | - | サブタイプ |
| isVoided | BOOLEAN | NO | false | - | 取り消しフラグ |
| voidedAt | TIMESTAMP | YES | - | - | 取り消し日時 |
| voidedBy | VARCHAR(100) | YES | - | - | 取り消した人 |
| voidReason | TEXT | YES | - | - | 取り消し理由 |

**eventType選択肢**:
| 値 | 意味 | 発生タイミング |
|----|------|---------------|
| commit | 新規目標設定 | 目標がない状態から新しく目標を設定 |
| achieved | 目標達成 | 現在のステージが目標ステージに到達 |
| recommit | 目標変更 | 目標ステージまたは目標日を変更 |
| progress | 前進 | 目標とは関係なくステージが前に進んだ |
| back | 後退 | 現在のステージが前のステージに戻った |
| cancel | 目標取消 | 目標を達成せずに削除した |
| won | 受注 | 受注ステージへの遷移 |
| lost | 失注 | 失注ステージへの遷移 |
| suspended | 保留 | 検討中ステージへの遷移 |
| resumed | 再開 | 検討中から通常ステージへ復帰 |
| revived | 復活 | 失注から通常ステージへ復帰 |
| reason_updated | 理由更新 | 失注/検討中理由の更新 |

**subType選択肢**（recommit用）: `positive`, `negative`, `neutral`

**リレーション**:
- `stpCompany` → StpCompany (N:1, CASCADE削除) - 親STP企業
- `fromStage` → StpStage (N:1) - 変更前ステージ
- `toStage` → StpStage (N:1) - 変更後ステージ

**特記事項**:
- 論理削除対応（isVoided, voidedAt, voidedBy, voidReason）
- isCorrectedは履歴の修正を示す
- alertAcknowledgedはアラートを確認して更新したことを示す

---

#### 2.10 stp_contract_histories（契約履歴）

**概要**: STPプロジェクトの契約履歴を管理。契約期間や料金の履歴を保持。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK(master_stella_companies) | 全顧客マスタID |
| industryType | VARCHAR(20) | NO | - | - | 業種区分 |
| contractPlan | VARCHAR(20) | NO | - | - | 契約プラン |
| contractStartDate | DATE | NO | - | - | 契約開始日 |
| contractEndDate | DATE | YES | - | - | 契約終了日 |
| initialFee | INT | NO | - | - | 初期費用 |
| monthlyFee | INT | NO | - | - | 月額 |
| performanceFee | INT | NO | - | - | 成果報酬単価 |
| salesStaffId | INT | YES | - | FK(master_staff) | 担当営業 |
| operationStaffId | INT | YES | - | FK(master_staff) | 担当運用 |
| status | VARCHAR(20) | NO | - | - | ステータス |
| note | TEXT | YES | - | - | 備考 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |
| deletedAt | TIMESTAMP | YES | - | - | 論理削除日時 |

**industryType選択肢**: `general`（一般）, `dispatch`（派遣）

**contractPlan選択肢**: `monthly`（月額）, `performance`（成果報酬）

**status選択肢**: `active`, `cancelled`, `dormant`

**リレーション**:
- `company` → MasterStellaCompany (N:1, CASCADE削除) - 全顧客マスタ
- `salesStaff` → MasterStaff (N:1) - 担当営業
- `operationStaff` → MasterStaff (N:1) - 担当運用

**特記事項**:
- 論理削除対応（deletedAt）
- contractEndDateがNULLの場合はアクティブな契約

---

#### 2.14 stp_kpi_sheets（KPIシート）

**概要**: STP企業の運用KPIを管理するシート。媒体ごと（Indeed、Wantedly等）にシートを作成可能。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| stpCompanyId | INT | NO | - | FK(stp_companies) | STP企業ID |
| name | VARCHAR(100) | NO | - | - | シート名（Indeed、Wantedly等） |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `stpCompany` → StpCompany (N:1, CASCADE削除) - 親STP企業
- `weeklyData` ← StpKpiWeeklyData (1:N) - 週次データ
- `shareLinks` ← StpKpiShareLink (1:N) - 共有リンク

---

#### 2.15 stp_kpi_weekly_data（KPI週次データ）

**概要**: 週単位のKPI目標値・実績値を管理。手入力項目（表示回数、クリック数、応募数、費用）と自動計算項目（CPM、CTR、CPC、CVR、CPA）がある。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| kpiSheetId | INT | NO | - | FK(stp_kpi_sheets) | KPIシートID |
| weekStartDate | DATE | NO | - | UK | 週開始日 |
| weekEndDate | DATE | NO | - | - | 週終了日 |
| targetImpressions | INT | YES | - | - | 表示回数（目標） |
| targetCpm | DECIMAL(10,2) | YES | - | - | 表示単価（目標）※計算 |
| targetClicks | INT | YES | - | - | クリック数（目標） |
| targetCtr | DECIMAL(5,2) | YES | - | - | クリック率（目標）※計算 |
| targetCpc | DECIMAL(10,2) | YES | - | - | クリック単価（目標）※計算 |
| targetApplications | INT | YES | - | - | 応募数（目標） |
| targetCvr | DECIMAL(5,2) | YES | - | - | 応募率（目標）※計算 |
| targetCpa | DECIMAL(10,2) | YES | - | - | 応募単価（目標）※計算 |
| targetCost | INT | YES | - | - | 費用（目標） |
| actualImpressions | INT | YES | - | - | 表示回数（実績） |
| actualCpm | DECIMAL(10,2) | YES | - | - | 表示単価（実績）※計算 |
| actualClicks | INT | YES | - | - | クリック数（実績） |
| actualCtr | DECIMAL(5,2) | YES | - | - | クリック率（実績）※計算 |
| actualCpc | DECIMAL(10,2) | YES | - | - | クリック単価（実績）※計算 |
| actualApplications | INT | YES | - | - | 応募数（実績） |
| actualCvr | DECIMAL(5,2) | YES | - | - | 応募率（実績）※計算 |
| actualCpa | DECIMAL(10,2) | YES | - | - | 応募単価（実績）※計算 |
| actualCost | INT | YES | - | - | 費用（実績） |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**制約**: `UNIQUE(kpiSheetId, weekStartDate)` - 同一シート内で週の重複を防止

**リレーション**:
- `kpiSheet` → StpKpiSheet (N:1, CASCADE削除) - 親KPIシート

**特記事項**:
- 手入力項目: impressions, clicks, applications, cost
- 計算項目（フロントエンドで自動計算）: cpm, ctr, cpc, cvr, cpa
- 計算式は `docs/business-logic.md` 参照

---

#### 2.16 stp_kpi_share_links（KPI共有リンク）

**概要**: KPIシートの時間制限付き共有リンク。トークン経由で外部公開。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| kpiSheetId | INT | NO | - | FK(stp_kpi_sheets) | KPIシートID |
| token | VARCHAR(64) | NO | - | UNIQUE | 共有トークン（64文字ランダム） |
| expiresAt | TIMESTAMP | NO | - | - | 有効期限 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| createdBy | INT | YES | - | FK(master_staff) | 発行者スタッフID |

**リレーション**:
- `kpiSheet` → StpKpiSheet (N:1, CASCADE削除) - 親KPIシート

**特記事項**:
- 有効期限は発行時に1時間/6時間/24時間/7日間から選択
- 期限切れリンクは表示されない（取得時にフィルタ）
- 公開URL: `/s/kpi/[token]`

---

### 3. スタッフ・権限系

#### 3.1 master_staff（スタッフマスタ）

**概要**: 社内スタッフ・担当者の情報を管理するマスタテーブル。ログイン情報も保持。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(100) | NO | - | - | 名前 |
| nameKana | VARCHAR(100) | YES | - | - | フリガナ |
| email | VARCHAR(255) | YES | - | UNIQUE | メールアドレス |
| phone | VARCHAR(20) | YES | - | - | 電話番号 |
| contractType | VARCHAR(50) | YES | - | - | 契約形態 |
| loginId | VARCHAR(100) | YES | - | UNIQUE | ログインID |
| passwordHash | VARCHAR(255) | YES | - | - | パスワード（ハッシュ化） |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| inviteToken | VARCHAR(64) | YES | - | UNIQUE | 招待トークン |
| inviteTokenExpiresAt | TIMESTAMP | YES | - | - | 招待トークン有効期限 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**contractType選択肢**: `正社員`, `契約社員`, `業務委託` など

**招待トークン**: スタッフ招待メール送信時に生成され、パスワード設定完了後にクリア。有効期限は24時間。

**リレーション**:
- `permissions` ← StaffPermission (1:N) - 権限
- `roleAssignments` ← StaffRoleAssignment (1:N) - 役割割当（廃止予定）
- `projectAssignments` ← StaffProjectAssignment (1:N) - プロジェクト割当
- `salesContractHistories` ← StpContractHistory (1:N) - 担当営業として
- `operationContractHistories` ← StpContractHistory (1:N) - 担当運用として
- `agentAssignments` ← StpAgentStaff (1:N) - 代理店担当
- `assignedCompanies` ← MasterStellaCompany (1:N) - 担当企業
- `salesStpCompanies` ← StpCompany (1:N) - 担当STP企業
- `contactHistories` ← ContactHistory (1:N) - 接触履歴
- `approvedExternalUsers` ← ExternalUser (1:N) - 承認した外部ユーザー
- `issuedRegistrationTokens` ← RegistrationToken (1:N) - 発行した登録トークン

---

#### 3.2 staff_role_types（スタッフ役割種別マスタ）

**概要**: スタッフが担当できる役割の種別を定義するマスタテーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| code | VARCHAR(50) | NO | - | UNIQUE | 役割コード |
| name | VARCHAR(100) | NO | - | - | 表示名 |
| description | TEXT | YES | - | - | 説明 |
| displayOrder | INT | NO | 0 | - | 表示順 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**code例**: `営業`, `運用`, `CS`, `AS` など

**リレーション**:
- `staffAssignments` ← StaffRoleAssignment (1:N) - スタッフ割当

---

#### 3.3 staff_role_assignments（スタッフ役割割当）※廃止予定

**概要**: スタッフと役割種別の多対多関係を管理する中間テーブル。後方互換のため残存。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| staffId | INT | NO | - | FK(master_staff) | スタッフID |
| roleTypeId | INT | NO | - | FK(staff_role_types) | 役割種別ID |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(staffId, roleTypeId)`

**リレーション**:
- `staff` → MasterStaff (N:1, CASCADE削除)
- `roleType` → StaffRoleType (N:1, CASCADE削除)

**注意**: このテーブルは廃止予定。新規実装ではStaffProjectAssignmentを使用。

---

#### 3.4 staff_project_assignments（スタッフプロジェクト割当）

**概要**: スタッフとプロジェクトの多対多関係を管理する中間テーブル。担当者選択時にプロジェクトでフィルタリング可能。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| staffId | INT | NO | - | FK(master_staff) | スタッフID |
| projectId | INT | NO | - | FK(master_projects) | プロジェクトID |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(staffId, projectId)`

**リレーション**:
- `staff` → MasterStaff (N:1, CASCADE削除)
- `project` → MasterProject (N:1, CASCADE削除)

---

#### 3.5 staff_permissions（スタッフ権限）

**概要**: スタッフのプロジェクトごとの閲覧・変更権限を管理。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| staffId | INT | NO | - | FK(master_staff) | スタッフID |
| projectCode | VARCHAR(50) | NO | - | - | プロジェクトコード |
| permissionLevel | VARCHAR(20) | NO | - | - | 権限レベル |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**projectCode例**: `stp`, `stella`

**permissionLevel選択肢**: `none`, `view`, `edit`, `admin`

**制約**: `UNIQUE(staffId, projectCode)`

**リレーション**:
- `staff` → MasterStaff (N:1, CASCADE削除)

---

### 4. 共通マスタ系

#### 4.1 master_projects（プロジェクトマスタ）

**概要**: システム内のプロジェクト（Stella, STPなど）を定義するマスタテーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(100) | NO | - | - | プロジェクト名 |
| description | TEXT | YES | - | - | 説明 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| displayOrder | INT | NO | 0 | - | 表示順 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `contracts` ← MasterContract (1:N) - 契約書
- `staffAssignments` ← StaffProjectAssignment (1:N) - スタッフ割当
- `customerTypes` ← CustomerType (1:N) - 顧客種別

---

#### 4.2 contact_methods（接触方法マスタ）

**概要**: 全プロジェクト共通の接触方法を定義するマスタテーブル。接触履歴で使用。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(50) | NO | - | - | 接触方法名 |
| display_order | INT | NO | 0 | - | 表示順 |
| is_active | BOOLEAN | NO | true | - | 有効フラグ |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |
| updated_at | TIMESTAMP | NO | auto | - | 更新日時 |

**初期データ**:
| id | name | display_order |
|----|------|---------------|
| 1 | 電話 | 1 |
| 2 | メール | 2 |
| 3 | 訪問 | 3 |
| 4 | Web会議 | 4 |
| 5 | その他 | 5 |

**リレーション**:
- `contactHistories` ← ContactHistory (1:N) - 接触履歴

**注意**: `stp_communication_methods`（企業との連絡方法）とは別のマスタ。

---

#### 4.3 contact_histories（接触履歴）

**概要**: 全プロジェクト共通の顧客接触履歴を管理。企業・代理店両方の接触を記録。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| company_id | INT | NO | - | FK(master_stella_companies) | 企業ID |
| contact_date | TIMESTAMP | NO | - | - | 接触日時 |
| contact_method_id | INT | YES | - | FK(contact_methods) | 接触方法ID |
| staff_id | INT | YES | - | FK(master_staff) | 担当スタッフID |
| assigned_to | VARCHAR(255) | YES | - | - | 担当者（後方互換） |
| customer_participants | VARCHAR(500) | YES | - | - | 顧客側参加者 |
| meeting_minutes | TEXT | YES | - | - | 議事録/メモ |
| note | TEXT | YES | - | - | 備考 |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |
| updated_at | TIMESTAMP | NO | auto | - | 更新日時 |
| deleted_at | TIMESTAMP | YES | - | - | 論理削除日時 |

**リレーション**:
- `company` → MasterStellaCompany (N:1, CASCADE削除) - 企業
- `contactMethod` → ContactMethod (N:1) - 接触方法
- `staff` → MasterStaff (N:1) - 担当スタッフ
- `roles` ← ContactHistoryRole (1:N) - ロール（顧客種別）

**インデックス**:
- `idx_contact_histories_company_id` (company_id)
- `idx_contact_histories_contact_date` (contact_date)
- `idx_contact_histories_deleted_at` (deleted_at)
- `idx_contact_histories_staff_id` (staff_id)

**特記事項**:
- 論理削除対応（deleted_at）
- assigned_toは後方互換のため残存、新規ではstaff_idを使用

---

#### 4.4 contact_history_roles（接触履歴ロール中間テーブル）

**概要**: 接触履歴と顧客種別の多対多関係を管理。1つの接触が複数の顧客種別に対応可能。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| contact_history_id | INT | NO | - | FK(contact_histories) | 接触履歴ID |
| customer_type_id | INT | NO | - | FK(customer_types) | 顧客種別ID |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(contact_history_id, customer_type_id)`

**リレーション**:
- `contactHistory` → ContactHistory (N:1, CASCADE削除)
- `customerType` → CustomerType (N:1)

**インデックス**:
- `idx_contact_history_roles_contact_history_id` (contact_history_id)
- `idx_contact_history_roles_customer_type_id` (customer_type_id)

---

#### 4.5 customer_types（顧客種別マスタ）

**概要**: プロジェクトごとの顧客種別を定義するマスタテーブル。接触履歴のロール分類に使用。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| project_id | INT | NO | - | FK(master_projects) | プロジェクトID |
| name | VARCHAR(50) | NO | - | - | 顧客種別名 |
| display_order | INT | NO | 0 | - | 表示順 |
| is_active | BOOLEAN | NO | true | - | 有効フラグ |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |
| updated_at | TIMESTAMP | NO | auto | - | 更新日時 |

**制約**: `UNIQUE(project_id, name)`

**リレーション**:
- `project` → MasterProject (N:1) - プロジェクト
- `roles` ← ContactHistoryRole (1:N) - 接触履歴ロール

**インデックス**:
- `idx_customer_types_project_id` (project_id)

---

### 5. 契約書管理系

#### 5.1 master_contract_statuses（契約書ステータスマスタ）

**概要**: 契約書のステータスを定義するマスタテーブル。ワークフロー管理に使用。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| name | VARCHAR(50) | NO | - | - | ステータス名 |
| display_order | INT | NO | 0 | - | 表示順 |
| is_terminal | BOOLEAN | NO | false | - | 終了ステータスフラグ |
| is_active | BOOLEAN | NO | true | - | 有効フラグ |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |
| updated_at | TIMESTAMP | NO | auto | - | 更新日時 |

**リレーション**:
- `contractsCurrent` ← MasterContract (1:N) - 現在このステータスの契約
- `historiesFrom` ← MasterContractStatusHistory (1:N) - このステータスからの変更
- `historiesTo` ← MasterContractStatusHistory (1:N) - このステータスへの変更

---

#### 5.2 master_contracts（契約書）

**概要**: 企業との契約書を管理するテーブル。クラウドサイン連携、親子契約の階層構造に対応。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| company_id | INT | NO | - | FK(master_stella_companies) | 企業ID |
| project_id | INT | NO | - | FK(master_projects) | プロジェクトID |
| contract_number | VARCHAR(50) | YES | - | - | 契約番号 |
| parent_contract_id | INT | YES | - | FK(self) | 親契約ID |
| contract_type | VARCHAR(50) | NO | - | - | 契約種別 |
| title | VARCHAR(200) | NO | - | - | 契約書タイトル |
| start_date | DATE | YES | - | - | 契約開始日 |
| end_date | DATE | YES | - | - | 契約終了日 |
| current_status_id | INT | YES | - | FK(master_contract_statuses) | 現在のステータス |
| target_date | DATE | YES | - | - | 目標日 |
| signed_date | DATE | YES | - | - | 締結日 |
| is_active | BOOLEAN | NO | false | - | 有効フラグ |
| signing_method | VARCHAR(20) | YES | - | - | 締結方法 |
| cloudsign_document_id | VARCHAR(100) | YES | - | - | クラウドサインドキュメントID |
| cloudsign_status | VARCHAR(30) | YES | - | - | クラウドサインステータス |
| cloudsign_sent_at | TIMESTAMP | YES | - | - | クラウドサイン送信日時 |
| cloudsign_completed_at | TIMESTAMP | YES | - | - | クラウドサイン完了日時 |
| cloudsign_url | VARCHAR(500) | YES | - | - | クラウドサインURL |
| file_path | VARCHAR(500) | YES | - | - | ファイルパス |
| file_name | VARCHAR(200) | YES | - | - | ファイル名 |
| assigned_to | VARCHAR(100) | YES | - | - | 担当者 |
| note | TEXT | YES | - | - | 備考 |
| created_at | TIMESTAMP | NO | now() | - | 作成日時 |
| updated_at | TIMESTAMP | NO | auto | - | 更新日時 |

**signing_method選択肢**: `cloudsign`, `paper`, `other`

**リレーション**:
- `company` → MasterStellaCompany (N:1) - 企業
- `project` → MasterProject (N:1) - プロジェクト
- `currentStatus` → MasterContractStatus (N:1) - 現在のステータス
- `parentContract` → MasterContract (N:1, self) - 親契約
- `childContracts` ← MasterContract (1:N, self) - 子契約
- `statusHistories` ← MasterContractStatusHistory (1:N) - ステータス履歴

**インデックス**:
- `idx_master_contracts_company_id` (company_id)
- `idx_master_contracts_project_id` (project_id)
- `idx_master_contracts_company_project` (company_id, project_id)
- `idx_master_contracts_current_status_id` (current_status_id)
- `idx_master_contracts_is_active` (is_active)
- `idx_master_contracts_cloudsign_document_id` (cloudsign_document_id)

---

#### 5.3 master_contract_status_histories（契約書ステータス変更履歴）

**概要**: 契約書のステータス変更を記録する履歴テーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| contract_id | INT | NO | - | FK(master_contracts) | 契約書ID |
| event_type | VARCHAR(30) | NO | - | - | イベント種別 |
| from_status_id | INT | YES | - | FK(master_contract_statuses) | 変更前ステータス |
| to_status_id | INT | YES | - | FK(master_contract_statuses) | 変更後ステータス |
| target_date | DATE | YES | - | - | 目標日 |
| changed_by | VARCHAR(100) | YES | - | - | 変更者 |
| note | TEXT | YES | - | - | 備考 |
| recorded_at | TIMESTAMP | NO | now() | - | 記録日時 |

**リレーション**:
- `contract` → MasterContract (N:1) - 契約書
- `fromStatus` → MasterContractStatus (N:1) - 変更前ステータス
- `toStatus` → MasterContractStatus (N:1) - 変更後ステータス

**インデックス**:
- `idx_master_contract_status_histories_contract_id` (contract_id)
- `idx_master_contract_status_histories_recorded_at` (recorded_at)

---

### 6. 外部ユーザー系

#### 6.1 external_users（外部ユーザー）

**概要**: クライアント・代理店担当者向けのログインアカウントを管理。メール認証と管理者承認の2段階認証フローに対応。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| companyId | INT | NO | - | FK(master_stella_companies) | 所属企業ID |
| registrationTokenId | INT | YES | - | FK(registration_tokens) | 登録に使用されたトークン |
| contactId | INT | YES | - | FK(stella_company_contacts), UNIQUE | 担当者情報（任意） |
| name | VARCHAR(100) | NO | - | - | 名前 |
| position | VARCHAR(100) | YES | - | - | 役職 |
| email | VARCHAR(255) | NO | - | UNIQUE | ログイン用メールアドレス |
| passwordHash | VARCHAR(255) | NO | - | - | パスワード（ハッシュ化） |
| status | VARCHAR(20) | NO | 'pending_email' | - | ステータス |
| emailVerifiedAt | TIMESTAMP | YES | - | - | メール認証日時 |
| approvedAt | TIMESTAMP | YES | - | - | 管理者承認日時 |
| approvedBy | INT | YES | - | FK(master_staff) | 承認者 |
| lastLoginAt | TIMESTAMP | YES | - | - | 最終ログイン日時 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**status選択肢**: `pending_email`（メール認証待ち）, `pending_approval`（管理者承認待ち）, `active`（有効）, `suspended`（停止）

**リレーション**:
- `company` → MasterStellaCompany (N:1) - 所属企業
- `registrationToken` → RegistrationToken (N:1) - 登録トークン
- `contact` → StellaCompanyContact (1:1) - 担当者情報
- `approver` → MasterStaff (N:1) - 承認者
- `displayPermissions` ← ExternalUserDisplayPermission (1:N) - 表示権限
- `loginHistories` ← LoginHistory (1:N) - ログイン履歴
- `emailVerificationTokens` ← EmailVerificationToken (1:N) - メール認証トークン
- `passwordResetTokens` ← PasswordResetToken (1:N) - パスワードリセットトークン

**インデックス**:
- `idx_external_users_company_id` (companyId)
- `idx_external_users_status` (status)

**特記事項**:
- 登録フロー: 登録 → メール認証（pending_email → pending_approval） → 管理者承認（→ active）
- contactIdはオプション（担当者情報と紐付けない場合もある）

---

#### 6.2 display_views（表示ビュー定義）

**概要**: 外部ユーザー向け画面の定義を管理。プロジェクトごとに異なるビューを設定可能。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| viewKey | VARCHAR(50) | NO | - | UNIQUE | ビューキー |
| viewName | VARCHAR(100) | NO | - | - | ビュー表示名 |
| projectCode | VARCHAR(50) | NO | - | - | プロジェクトコード |
| description | TEXT | YES | - | - | 説明 |
| isActive | BOOLEAN | NO | true | - | 有効フラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |
| updatedAt | TIMESTAMP | NO | auto | - | 更新日時 |

**viewKey例**: `stp_client`（STPクライアント版）, `stp_agent`（STP代理店版）

**リレーション**:
- `userPermissions` ← ExternalUserDisplayPermission (1:N) - ユーザー権限
- `registrationTokenDefaults` ← RegistrationTokenDefaultView (1:N) - トークンデフォルト

---

#### 6.3 external_user_display_permissions（外部ユーザー表示権限）

**概要**: 外部ユーザーと表示ビューの多対多関係を管理する中間テーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| externalUserId | INT | NO | - | FK(external_users) | 外部ユーザーID |
| displayViewId | INT | NO | - | FK(display_views) | 表示ビューID |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(externalUserId, displayViewId)`

**リレーション**:
- `externalUser` → ExternalUser (N:1, CASCADE削除)
- `displayView` → DisplayView (N:1)

---

#### 6.4 registration_tokens（登録トークン）

**概要**: 外部ユーザー登録用の招待トークンを管理。使用回数制限と有効期限に対応。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| token | VARCHAR(64) | NO | - | UNIQUE | 招待トークン |
| companyId | INT | NO | - | FK(master_stella_companies) | 対象企業ID |
| expiresAt | TIMESTAMP | NO | - | - | 有効期限 |
| maxUses | INT | NO | 1 | - | 最大使用回数 |
| useCount | INT | NO | 0 | - | 使用回数 |
| status | VARCHAR(20) | NO | 'active' | - | ステータス |
| issuedBy | INT | NO | - | FK(master_staff) | 発行者 |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**status選択肢**: `active`（有効）, `expired`（期限切れ）, `exhausted`（使用回数超過）, `revoked`（無効化）

**リレーション**:
- `company` → MasterStellaCompany (N:1) - 対象企業
- `issuer` → MasterStaff (N:1) - 発行者
- `defaultViews` ← RegistrationTokenDefaultView (1:N) - デフォルトビュー
- `externalUsers` ← ExternalUser (1:N) - 登録されたユーザー

**インデックス**:
- `idx_registration_tokens_token` (token)

---

#### 6.5 registration_token_default_views（登録トークンデフォルトビュー）

**概要**: 登録トークン発行時に指定するデフォルトの表示権限を管理する中間テーブル。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| registrationTokenId | INT | NO | - | FK(registration_tokens) | 登録トークンID |
| displayViewId | INT | NO | - | FK(display_views) | 表示ビューID |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**制約**: `UNIQUE(registrationTokenId, displayViewId)`

**リレーション**:
- `registrationToken` → RegistrationToken (N:1, CASCADE削除)
- `displayView` → DisplayView (N:1)

---

#### 6.6 email_verification_tokens（メール認証トークン）

**概要**: メールアドレス確認用のトークンを管理。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| token | VARCHAR(64) | NO | - | UNIQUE | 認証トークン |
| externalUserId | INT | NO | - | FK(external_users) | 外部ユーザーID |
| expiresAt | TIMESTAMP | NO | - | - | 有効期限 |
| isUsed | BOOLEAN | NO | false | - | 使用済みフラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**リレーション**:
- `externalUser` → ExternalUser (N:1, CASCADE削除)

**インデックス**:
- `idx_email_verification_tokens_token` (token)

---

#### 6.7 password_reset_tokens（パスワードリセットトークン）

**概要**: パスワード再設定用のトークンを管理。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| token | VARCHAR(64) | NO | - | UNIQUE | リセットトークン |
| externalUserId | INT | NO | - | FK(external_users) | 外部ユーザーID |
| expiresAt | TIMESTAMP | NO | - | - | 有効期限 |
| isUsed | BOOLEAN | NO | false | - | 使用済みフラグ |
| createdAt | TIMESTAMP | NO | now() | - | 作成日時 |

**リレーション**:
- `externalUser` → ExternalUser (N:1, CASCADE削除)

**インデックス**:
- `idx_password_reset_tokens_token` (token)

---

#### 6.8 login_histories（ログイン履歴）

**概要**: 外部ユーザーのログイン記録を管理。成功・失敗を問わず記録。

| カラム名 | 型 | NULL | デフォルト | 制約 | 説明 |
|---------|-----|------|-----------|------|------|
| id | INT | NO | auto_increment | PK | 主キー |
| externalUserId | INT | NO | - | FK(external_users) | 外部ユーザーID |
| loginAt | TIMESTAMP | NO | now() | - | ログイン日時 |
| ipAddress | VARCHAR(45) | YES | - | - | IPアドレス |
| userAgent | TEXT | YES | - | - | ユーザーエージェント |
| result | VARCHAR(20) | NO | - | - | 結果 |
| failureReason | VARCHAR(50) | YES | - | - | 失敗理由 |

**result選択肢**: `success`, `failure`

**failureReason例**: `invalid_password`, `account_suspended`, `email_not_verified`

**リレーション**:
- `externalUser` → ExternalUser (N:1, CASCADE削除)

**インデックス**:
- `idx_login_histories_external_user_id` (externalUserId)
- `idx_login_histories_login_at` (loginAt)

---

## リレーション一覧

### 1:1 リレーション

| 親テーブル | 子テーブル | 外部キー | 説明 |
|-----------|-----------|---------|------|
| MasterStellaCompany | StpAgent | companyId (UNIQUE) | 企業→代理店 |

### 1:N リレーション

| 親テーブル | 子テーブル | 外部キー | ON DELETE | 説明 |
|-----------|-----------|---------|-----------|------|
| MasterStellaCompany | StellaCompanyLocation | companyId | CASCADE | 企業→拠点 |
| MasterStellaCompany | StellaCompanyContact | companyId | CASCADE | 企業→担当者 |
| MasterStellaCompany | StpCompany | companyId | CASCADE | 企業→STP企業 |
| MasterStellaCompany | StpContractHistory | companyId | CASCADE | 企業→契約履歴 |
| MasterStellaCompany | StpAgent (referrer) | referrerCompanyId | - | 企業→紹介代理店 |
| MasterStellaCompany | MasterContract | companyId | - | 企業→契約書 |
| MasterStellaCompany | ContactHistory | companyId | CASCADE | 企業→接触履歴 |
| StpAgent | StpAgentContract | agentId | CASCADE | 代理店→契約書 |
| StpAgent | StpAgentStaff | agentId | CASCADE | 代理店→担当者割当 |
| StpAgent | StpCompany | agentId | - | 代理店→STP企業 |
| StpStage | StpCompany (current) | currentStageId | - | ステージ→現在企業 |
| StpStage | StpCompany (target) | nextTargetStageId | - | ステージ→目標企業 |
| StpStage | StpStageHistory (from) | fromStageId | - | ステージ→変更元履歴 |
| StpStage | StpStageHistory (to) | toStageId | - | ステージ→変更先履歴 |
| StpLeadSource | StpCompany | leadSourceId | - | 流入経路→STP企業 |
| StpCommunicationMethod | StpCompany | communicationMethodId | - | 連絡方法→STP企業 |
| StpCompany | StpCompanyContract | stpCompanyId | CASCADE | STP企業→契約書 |
| StpCompany | StpStageHistory | stpCompanyId | CASCADE | STP企業→履歴 |
| MasterStaff | StaffPermission | staffId | CASCADE | スタッフ→権限 |
| MasterStaff | StaffRoleAssignment | staffId | CASCADE | スタッフ→役割割当 |
| MasterStaff | StaffProjectAssignment | staffId | CASCADE | スタッフ→PJ割当 |
| MasterStaff | StpAgentStaff | staffId | CASCADE | スタッフ→代理店割当 |
| MasterStaff | MasterStellaCompany | staffId | - | スタッフ→担当企業 |
| MasterStaff | StpCompany (sales) | salesStaffId | - | スタッフ→担当STP |
| MasterStaff | StpContractHistory (sales) | salesStaffId | - | スタッフ→契約(営業) |
| MasterStaff | StpContractHistory (operation) | operationStaffId | - | スタッフ→契約(運用) |
| MasterStaff | ContactHistory | staffId | - | スタッフ→接触履歴 |
| StaffRoleType | StaffRoleAssignment | roleTypeId | CASCADE | 役割種別→割当 |
| MasterProject | MasterContract | projectId | - | PJ→契約書 |
| MasterProject | StaffProjectAssignment | projectId | CASCADE | PJ→スタッフ割当 |
| MasterProject | CustomerType | projectId | - | PJ→顧客種別 |
| ContactMethod | ContactHistory | contactMethodId | - | 接触方法→履歴 |
| ContactHistory | ContactHistoryRole | contactHistoryId | CASCADE | 履歴→ロール |
| CustomerType | ContactHistoryRole | customerTypeId | - | 顧客種別→ロール |
| MasterContractStatus | MasterContract | currentStatusId | - | ステータス→契約 |
| MasterContractStatus | MasterContractStatusHistory (from) | fromStatusId | - | ステータス→履歴元 |
| MasterContractStatus | MasterContractStatusHistory (to) | toStatusId | - | ステータス→履歴先 |
| MasterContract | MasterContractStatusHistory | contractId | - | 契約→履歴 |
| MasterContract | MasterContract (child) | parentContractId | - | 契約→子契約 |
| MasterStellaCompany | ExternalUser | companyId | - | 企業→外部ユーザー |
| MasterStellaCompany | RegistrationToken | companyId | - | 企業→登録トークン |
| MasterStaff | ExternalUser (approver) | approvedBy | - | スタッフ→承認外部ユーザー |
| MasterStaff | RegistrationToken (issuer) | issuedBy | - | スタッフ→発行トークン |
| ExternalUser | ExternalUserDisplayPermission | externalUserId | CASCADE | 外部ユーザー→表示権限 |
| ExternalUser | LoginHistory | externalUserId | CASCADE | 外部ユーザー→ログイン履歴 |
| ExternalUser | EmailVerificationToken | externalUserId | CASCADE | 外部ユーザー→認証トークン |
| ExternalUser | PasswordResetToken | externalUserId | CASCADE | 外部ユーザー→リセットトークン |
| DisplayView | ExternalUserDisplayPermission | displayViewId | - | ビュー→ユーザー権限 |
| DisplayView | RegistrationTokenDefaultView | displayViewId | - | ビュー→トークンデフォルト |
| RegistrationToken | RegistrationTokenDefaultView | registrationTokenId | CASCADE | トークン→デフォルトビュー |
| RegistrationToken | ExternalUser | registrationTokenId | - | トークン→登録ユーザー |

### 1:1 リレーション（追加）

| 親テーブル | 子テーブル | 外部キー | 説明 |
|-----------|-----------|---------|------|
| StellaCompanyContact | ExternalUser | contactId (UNIQUE) | 担当者→外部ユーザー |

---

## インデックス一覧

| テーブル | インデックス名 | カラム | 用途 |
|---------|---------------|--------|------|
| contact_histories | idx_contact_histories_company_id | company_id | 企業別検索 |
| contact_histories | idx_contact_histories_contact_date | contact_date | 日付範囲検索 |
| contact_histories | idx_contact_histories_deleted_at | deleted_at | 論理削除フィルタ |
| contact_histories | idx_contact_histories_staff_id | staff_id | スタッフ別検索 |
| contact_history_roles | idx_contact_history_roles_contact_history_id | contact_history_id | 履歴別検索 |
| contact_history_roles | idx_contact_history_roles_customer_type_id | customer_type_id | 顧客種別検索 |
| customer_types | idx_customer_types_project_id | project_id | PJ別検索 |
| master_contracts | idx_master_contracts_company_id | company_id | 企業別検索 |
| master_contracts | idx_master_contracts_project_id | project_id | PJ別検索 |
| master_contracts | idx_master_contracts_company_project | company_id, project_id | 複合検索 |
| master_contracts | idx_master_contracts_current_status_id | current_status_id | ステータス別検索 |
| master_contracts | idx_master_contracts_is_active | is_active | 有効契約検索 |
| master_contracts | idx_master_contracts_cloudsign_document_id | cloudsign_document_id | CS連携検索 |
| master_contract_status_histories | idx_master_contract_status_histories_contract_id | contract_id | 契約別検索 |
| master_contract_status_histories | idx_master_contract_status_histories_recorded_at | recorded_at | 日時検索 |
| external_users | idx_external_users_company_id | companyId | 企業別検索 |
| external_users | idx_external_users_status | status | ステータス別検索 |
| registration_tokens | idx_registration_tokens_token | token | トークン検索 |
| email_verification_tokens | idx_email_verification_tokens_token | token | トークン検索 |
| password_reset_tokens | idx_password_reset_tokens_token | token | トークン検索 |
| login_histories | idx_login_histories_external_user_id | externalUserId | ユーザー別検索 |
| login_histories | idx_login_histories_login_at | loginAt | 日時検索 |

---

## 選択肢・Enum値

### STPプロジェクト

```typescript
// ヨミ（StpCompany.forecast）
const FORECASTS = ['MIN', '落とし', 'MAX', '来月', '辞退'] as const;

// 運用ステータス（StpCompany.operationStatus）
const OPERATION_STATUSES = ['テスト1', 'テスト2'] as const;

// 業種区分（StpCompany.industryType, StpContractHistory.industryType）
const INDUSTRY_TYPES = ['一般', '派遣'] as const;
// StpContractHistory用: ['general', 'dispatch']

// 初期費用（StpCompany.initialFee, StpContractHistory.initialFee）
const INITIAL_FEES = [0, 100000, 150000] as const;

// 担当運用（StpCompany.operationStaffList）
const OPERATION_STAFF_OPTIONS = ['indeed', '運用2'] as const;

// 代理店ステータス（StpAgent.status）
const AGENT_STATUSES = ['アクティブ', '休止', '解約'] as const;

// 代理店区分①（StpAgent.category1）
const AGENT_CATEGORY1 = ['代理店', '顧問'] as const;

// 代理店区分②（StpAgent.category2）
const AGENT_CATEGORY2 = ['法人', '個人'] as const;

// 代理店契約ステータス（StpAgent.contractStatus）
const AGENT_CONTRACT_STATUSES = ['契約済み', '商談済み', '未商談', '日程調整中'] as const;

// 代理店契約書ステータス（StpAgentContract.status）
const AGENT_CONTRACT_DOC_STATUSES = ['draft', 'pending', 'signed', 'expired'] as const;

// 企業契約書ステータス（StpCompanyContract.status）
const COMPANY_CONTRACT_STATUSES = ['draft', '送付済み', '先方情報待ち', 'signed', 'expired'] as const;

// 契約履歴プラン（StpContractHistory.contractPlan）
const CONTRACT_PLANS = ['monthly', 'performance'] as const;

// 契約履歴ステータス（StpContractHistory.status）
const CONTRACT_HISTORY_STATUSES = ['active', 'cancelled', 'dormant'] as const;
```

### ステージ関連

```typescript
// ステージ種別（StpStage.stageType）
const STAGE_TYPES = ['progress', 'closed_won', 'closed_lost', 'pending'] as const;

// イベント種別（StpStageHistory.eventType）
const EVENT_TYPES = [
  'commit',      // 新規目標設定
  'achieved',    // 目標達成
  'recommit',    // 目標変更
  'progress',    // 前進
  'back',        // 後退
  'cancel',      // 目標取消
  'won',         // 受注
  'lost',        // 失注
  'suspended',   // 保留
  'resumed',     // 再開
  'revived',     // 復活
  'reason_updated' // 理由更新
] as const;

// サブタイプ（StpStageHistory.subType）
const SUB_TYPES = ['positive', 'negative', 'neutral'] as const;
```

### 権限関連

```typescript
// 権限レベル（StaffPermission.permissionLevel）
const PERMISSION_LEVELS = ['none', 'view', 'edit', 'admin'] as const;

// プロジェクトコード（StaffPermission.projectCode）
const PROJECT_CODES = ['stella', 'stp'] as const;

// 契約形態（MasterStaff.contractType）
const CONTRACT_TYPES = ['正社員', '契約社員', '業務委託'] as const;
```

### 契約書関連

```typescript
// 締結方法（MasterContract.signingMethod）
const SIGNING_METHODS = ['cloudsign', 'paper', 'other'] as const;
```

### 外部ユーザー関連

```typescript
// 外部ユーザーステータス（ExternalUser.status）
const EXTERNAL_USER_STATUSES = [
  'pending_email',    // メール認証待ち
  'pending_approval', // 管理者承認待ち
  'active',           // 有効
  'suspended'         // 停止
] as const;

// 登録トークンステータス（RegistrationToken.status）
const REGISTRATION_TOKEN_STATUSES = [
  'active',    // 有効
  'expired',   // 期限切れ
  'exhausted', // 使用回数超過
  'revoked'    // 無効化
] as const;

// ログイン結果（LoginHistory.result）
const LOGIN_RESULTS = ['success', 'failure'] as const;

// ログイン失敗理由（LoginHistory.failureReason）
const LOGIN_FAILURE_REASONS = [
  'invalid_password',
  'account_suspended',
  'email_not_verified',
  'approval_pending',
  'account_not_found'
] as const;

// ビューキー（DisplayView.viewKey）
const VIEW_KEYS = [
  'stp_client',  // STPクライアント版
  'stp_agent'    // STP代理店版
] as const;
```

---

## 更新履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-02-02 | 初版作成 |
| 2026-02-02 | 外部ユーザー系テーブル追加（ExternalUser, DisplayView, ExternalUserDisplayPermission, RegistrationToken, RegistrationTokenDefaultView, EmailVerificationToken, PasswordResetToken, LoginHistory） |
