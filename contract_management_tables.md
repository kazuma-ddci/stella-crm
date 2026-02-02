# 契約書管理テーブル実装指示書

## 概要

CRMシステムに契約書管理機能を追加するためのデータベーステーブルを作成する。
将来的にクラウドサインAPIとの連携を想定した設計となっている。

## 技術スタック

- データベース: PostgreSQL
- ORM: Prisma
- フレームワーク: Next.js

---

## 作成するテーブル一覧

| No | テーブル名 | 説明 |
|----|-----------|------|
| 1 | projects | プロジェクトマスタ |
| 2 | contract_statuses | 契約書ステータスマスタ |
| 3 | contracts | 契約書テーブル |
| 4 | contract_status_histories | 契約書ステータス変更履歴 |

---

## テーブル関係図

```
┌─────────────┐     ┌─────────────┐     ┌───────────────────┐
│ companies   │     │ projects    │     │ contract_statuses │
│（既存）      │     │             │     │                   │
└──────┬──────┘     └──────┬──────┘     └─────────┬─────────┘
       │                   │                      │
       │ company_id        │ project_id           │ current_status_id
       │                   │                      │
       └───────────┬───────┴──────────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │ contracts           │
         │                     │
         │ parent_contract_id ─┼──→ contracts（自己参照）
         └──────────┬──────────┘
                    │
                    │ contract_id (1:N)
                    ▼
         ┌─────────────────────────────┐
         │ contract_status_histories   │
         │                             │
         │ from_status_id ─────────────┼──→ contract_statuses
         │ to_status_id ───────────────┼──→ contract_statuses
         └─────────────────────────────┘
```

---

## 1. projects（プロジェクトマスタ）

### 概要
社内プロジェクトの一覧を管理するマスタテーブル。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| name | VARCHAR(100) | NO | - | プロジェクト名 |
| description | TEXT | YES | NULL | プロジェクト説明 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| display_order | INT | NO | 0 | 表示順 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

### 初期データ

| name | description | display_order |
|------|-------------|---------------|
| 採用ブースト | 採用支援サービス | 1 |

### Prismaスキーマ

```prisma
model Project {
  id           Int        @id @default(autoincrement())
  name         String     @db.VarChar(100)
  description  String?
  isActive     Boolean    @default(true) @map("is_active")
  displayOrder Int        @default(0) @map("display_order")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  // リレーション
  contracts    Contract[]

  @@map("projects")
}
```

---

## 2. contract_statuses（契約書ステータスマスタ）

### 概要
契約書のステータス（フェーズ）の選択肢を管理するマスタテーブル。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| name | VARCHAR(50) | NO | - | ステータス名 |
| display_order | INT | NO | 0 | 表示順 |
| is_terminal | BOOLEAN | NO | false | 終了ステータスかどうか |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

### 初期データ

| name | display_order | is_terminal | 説明 |
|------|---------------|-------------|------|
| 雛形作成中 | 1 | false | 契約書の雛形を作成している段階 |
| 内容確認中 | 2 | false | 社内で内容を確認している段階 |
| 合意待ち | 3 | false | 先方と内容の合意を待っている段階 |
| 修正対応中 | 4 | false | 先方からの修正依頼に対応している段階（送付前） |
| 送付情報確認中 | 5 | false | 送付先メールアドレス等を先方に確認している段階 |
| 送付済み | 6 | false | 契約書を送付完了、先方の署名待ち |
| 締結済み | 7 | true | 契約が締結された状態 |
| 破棄 | 8 | true | 契約が破棄・中止された状態 |

### 業務フロー

```
雛形作成中 → 内容確認中 → 合意待ち ←→ 修正対応中 → 送付情報確認中 → 送付済み → 締結済み
                          ↑________|
                       （修正があれば戻る）

※ 破棄はどの段階からでも遷移可能
```

### Prismaスキーマ

```prisma
model ContractStatus {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(50)
  displayOrder Int       @default(0) @map("display_order")
  isTerminal   Boolean   @default(false) @map("is_terminal")
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  // リレーション
  contractsCurrent       Contract[]                  @relation("CurrentStatus")
  historiesFrom          ContractStatusHistory[]     @relation("FromStatus")
  historiesTo            ContractStatusHistory[]     @relation("ToStatus")

  @@map("contract_statuses")
}
```

---

## 3. contracts（契約書テーブル）

### 概要
契約書1件ごとの情報を管理するテーブル。
クラウドサインAPI連携を想定したカラムを含む。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| company_id | INT | NO | - | 企業ID（外部キー → companies） |
| project_id | INT | NO | - | プロジェクトID（外部キー → projects） |
| contract_number | VARCHAR(50) | YES | NULL | 契約管理番号 |
| parent_contract_id | INT | YES | NULL | 親契約ID（外部キー → contracts）※更新契約の場合 |
| contract_type | VARCHAR(50) | NO | - | 契約種別 |
| title | VARCHAR(200) | NO | - | 契約書タイトル |
| start_date | DATE | YES | NULL | 契約開始日 |
| end_date | DATE | YES | NULL | 契約終了日 |
| current_status_id | INT | YES | NULL | 現在のステータス（外部キー → contract_statuses） |
| target_date | DATE | YES | NULL | 目標日（締結予定日） |
| signed_date | DATE | YES | NULL | 締結日 |
| is_active | BOOLEAN | NO | false | 有効フラグ |
| signing_method | VARCHAR(20) | YES | NULL | 署名方法（cloudsign / paper / other） |
| cloudsign_document_id | VARCHAR(100) | YES | NULL | クラウドサイン書類ID |
| cloudsign_status | VARCHAR(30) | YES | NULL | クラウドサイン側ステータス |
| cloudsign_sent_at | TIMESTAMP | YES | NULL | クラウドサイン送信日時 |
| cloudsign_completed_at | TIMESTAMP | YES | NULL | クラウドサイン締結完了日時 |
| cloudsign_url | VARCHAR(500) | YES | NULL | クラウドサイン書類URL |
| file_path | VARCHAR(500) | YES | NULL | ファイルパス |
| file_name | VARCHAR(200) | YES | NULL | ファイル名 |
| assigned_to | VARCHAR(100) | YES | NULL | 担当者 |
| note | TEXT | YES | NULL | 備考 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

### contract_type（契約種別）の選択肢

| 値 | 説明 |
|----|------|
| 基本契約 | 基本契約書 |
| NDA | 秘密保持契約 |
| 個別契約 | 個別契約書 |
| 覚書 | 覚書 |
| その他 | その他 |

### signing_method（署名方法）の選択肢

| 値 | 説明 |
|----|------|
| cloudsign | クラウドサインで電子契約 |
| paper | 紙の契約書（郵送など） |
| other | 他の電子契約サービス |

### インデックス

| インデックス名 | カラム | 説明 |
|---------------|--------|------|
| idx_contracts_company_id | company_id | 企業別検索用 |
| idx_contracts_project_id | project_id | プロジェクト別検索用 |
| idx_contracts_company_project | company_id, project_id | 複合検索用 |
| idx_contracts_current_status_id | current_status_id | ステータス別検索用 |
| idx_contracts_is_active | is_active | 有効契約検索用 |
| idx_contracts_cloudsign_document_id | cloudsign_document_id | クラウドサイン連携用 |

### Prismaスキーマ

```prisma
model Contract {
  id                    Int       @id @default(autoincrement())
  companyId             Int       @map("company_id")
  projectId             Int       @map("project_id")
  contractNumber        String?   @db.VarChar(50) @map("contract_number")
  parentContractId      Int?      @map("parent_contract_id")
  contractType          String    @db.VarChar(50) @map("contract_type")
  title                 String    @db.VarChar(200)
  startDate             DateTime? @db.Date @map("start_date")
  endDate               DateTime? @db.Date @map("end_date")
  currentStatusId       Int?      @map("current_status_id")
  targetDate            DateTime? @db.Date @map("target_date")
  signedDate            DateTime? @db.Date @map("signed_date")
  isActive              Boolean   @default(false) @map("is_active")
  signingMethod         String?   @db.VarChar(20) @map("signing_method")
  cloudsignDocumentId   String?   @db.VarChar(100) @map("cloudsign_document_id")
  cloudsignStatus       String?   @db.VarChar(30) @map("cloudsign_status")
  cloudsignSentAt       DateTime? @map("cloudsign_sent_at")
  cloudsignCompletedAt  DateTime? @map("cloudsign_completed_at")
  cloudsignUrl          String?   @db.VarChar(500) @map("cloudsign_url")
  filePath              String?   @db.VarChar(500) @map("file_path")
  fileName              String?   @db.VarChar(200) @map("file_name")
  assignedTo            String?   @db.VarChar(100) @map("assigned_to")
  note                  String?
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  // リレーション
  company               Company          @relation(fields: [companyId], references: [id])
  project               Project          @relation(fields: [projectId], references: [id])
  currentStatus         ContractStatus?  @relation("CurrentStatus", fields: [currentStatusId], references: [id])
  parentContract        Contract?        @relation("ContractHierarchy", fields: [parentContractId], references: [id])
  childContracts        Contract[]       @relation("ContractHierarchy")
  statusHistories       ContractStatusHistory[]

  @@index([companyId], map: "idx_contracts_company_id")
  @@index([projectId], map: "idx_contracts_project_id")
  @@index([companyId, projectId], map: "idx_contracts_company_project")
  @@index([currentStatusId], map: "idx_contracts_current_status_id")
  @@index([isActive], map: "idx_contracts_is_active")
  @@index([cloudsignDocumentId], map: "idx_contracts_cloudsign_document_id")
  @@map("contracts")
}
```

---

## 4. contract_status_histories（契約書ステータス変更履歴）

### 概要
契約書のステータス変更履歴を記録するテーブル。
いつ・誰が・どのように変更したかを追跡可能にする。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| contract_id | INT | NO | - | 契約書ID（外部キー → contracts） |
| event_type | VARCHAR(30) | NO | - | イベント種別 |
| from_status_id | INT | YES | NULL | 変更前ステータス（外部キー → contract_statuses） |
| to_status_id | INT | YES | NULL | 変更後ステータス（外部キー → contract_statuses） |
| target_date | DATE | YES | NULL | その時点での目標日 |
| changed_by | VARCHAR(100) | YES | NULL | 変更した人 |
| note | TEXT | YES | NULL | 変更理由・備考 |
| recorded_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 記録日時 |

### event_type（イベント種別）の選択肢

| 値 | 説明 | 使用タイミング |
|----|------|---------------|
| created | 新規作成 | 契約書レコードを作成した時 |
| status_changed | ステータス変更 | ステータスを変更した時 |
| target_updated | 目標日変更 | 目標日（締結予定日）を変更した時 |
| signed | 締結完了 | 契約が締結された時 |
| cancelled | 破棄 | 契約が破棄・中止になった時 |
| cloudsign_sent | クラウドサイン送信 | クラウドサインで送信した時 |
| cloudsign_completed | クラウドサイン締結完了 | クラウドサインで締結完了した時 |

### インデックス

| インデックス名 | カラム | 説明 |
|---------------|--------|------|
| idx_contract_status_histories_contract_id | contract_id | 契約書別履歴検索用 |
| idx_contract_status_histories_recorded_at | recorded_at | 日時順検索用 |

### Prismaスキーマ

```prisma
model ContractStatusHistory {
  id           Int       @id @default(autoincrement())
  contractId   Int       @map("contract_id")
  eventType    String    @db.VarChar(30) @map("event_type")
  fromStatusId Int?      @map("from_status_id")
  toStatusId   Int?      @map("to_status_id")
  targetDate   DateTime? @db.Date @map("target_date")
  changedBy    String?   @db.VarChar(100) @map("changed_by")
  note         String?
  recordedAt   DateTime  @default(now()) @map("recorded_at")

  // リレーション
  contract     Contract        @relation(fields: [contractId], references: [id])
  fromStatus   ContractStatus? @relation("FromStatus", fields: [fromStatusId], references: [id])
  toStatus     ContractStatus? @relation("ToStatus", fields: [toStatusId], references: [id])

  @@index([contractId], map: "idx_contract_status_histories_contract_id")
  @@index([recordedAt], map: "idx_contract_status_histories_recorded_at")
  @@map("contract_status_histories")
}
```

---

## 実装の優先順位

### Step 1: テーブル作成
1. projects テーブル作成
2. contract_statuses テーブル作成
3. contracts テーブル作成
4. contract_status_histories テーブル作成

### Step 2: 初期データ投入
1. projects に「採用ブースト」を投入
2. contract_statuses に8つのステータスを投入

### Step 3: 既存テーブルとの連携確認
1. companies テーブルとのリレーション確認
2. マイグレーション実行

---

## 注意事項

### 履歴の自動記録について
契約書のステータスを変更する際は、アプリケーション側で以下の処理を実装する：

1. contracts テーブルの current_status_id を更新
2. 同時に contract_status_histories に履歴レコードを挿入

この2つの処理は**トランザクション**で囲み、整合性を保つこと。

### クラウドサイン連携について
クラウドサイン関連のカラムは Phase 1 では NULL のまま運用可能。
API連携を実装する際に使用する。

### 外部キー制約について
- contracts.company_id → companies.id
- contracts.project_id → projects.id
- contracts.current_status_id → contract_statuses.id
- contracts.parent_contract_id → contracts.id（自己参照）
- contract_status_histories.contract_id → contracts.id
- contract_status_histories.from_status_id → contract_statuses.id
- contract_status_histories.to_status_id → contract_statuses.id

---

## 補足：データの流れイメージ

### 契約書作成から締結までの流れ

```
1. 契約書作成
   contracts: INSERT (current_status_id = 1:雛形作成中)
   contract_status_histories: INSERT (event_type = "created")

2. ステータス変更（送付済みへ）
   contracts: UPDATE (current_status_id = 6:送付済み)
   contract_status_histories: INSERT (event_type = "status_changed", from=5, to=6)

3. 締結完了
   contracts: UPDATE (current_status_id = 7:締結済み, signed_date = 今日, is_active = true)
   contract_status_histories: INSERT (event_type = "signed", from=6, to=7)
```

### 修正が入った場合の流れ

```
1. 合意待ち → 修正対応中（先方から修正依頼）
   contracts: UPDATE (current_status_id = 4:修正対応中)
   contract_status_histories: INSERT (event_type = "status_changed", from=3, to=4)

2. 修正対応中 → 合意待ち（修正完了、再度合意確認）
   contracts: UPDATE (current_status_id = 3:合意待ち)
   contract_status_histories: INSERT (event_type = "status_changed", from=4, to=3)
```

---

## Prismaスキーマ全体（追加分）

```prisma
// ===== 追加するモデル =====

model Project {
  id           Int        @id @default(autoincrement())
  name         String     @db.VarChar(100)
  description  String?
  isActive     Boolean    @default(true) @map("is_active")
  displayOrder Int        @default(0) @map("display_order")
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  contracts    Contract[]

  @@map("projects")
}

model ContractStatus {
  id           Int       @id @default(autoincrement())
  name         String    @db.VarChar(50)
  displayOrder Int       @default(0) @map("display_order")
  isTerminal   Boolean   @default(false) @map("is_terminal")
  isActive     Boolean   @default(true) @map("is_active")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")

  contractsCurrent       Contract[]                  @relation("CurrentStatus")
  historiesFrom          ContractStatusHistory[]     @relation("FromStatus")
  historiesTo            ContractStatusHistory[]     @relation("ToStatus")

  @@map("contract_statuses")
}

model Contract {
  id                    Int       @id @default(autoincrement())
  companyId             Int       @map("company_id")
  projectId             Int       @map("project_id")
  contractNumber        String?   @db.VarChar(50) @map("contract_number")
  parentContractId      Int?      @map("parent_contract_id")
  contractType          String    @db.VarChar(50) @map("contract_type")
  title                 String    @db.VarChar(200)
  startDate             DateTime? @db.Date @map("start_date")
  endDate               DateTime? @db.Date @map("end_date")
  currentStatusId       Int?      @map("current_status_id")
  targetDate            DateTime? @db.Date @map("target_date")
  signedDate            DateTime? @db.Date @map("signed_date")
  isActive              Boolean   @default(false) @map("is_active")
  signingMethod         String?   @db.VarChar(20) @map("signing_method")
  cloudsignDocumentId   String?   @db.VarChar(100) @map("cloudsign_document_id")
  cloudsignStatus       String?   @db.VarChar(30) @map("cloudsign_status")
  cloudsignSentAt       DateTime? @map("cloudsign_sent_at")
  cloudsignCompletedAt  DateTime? @map("cloudsign_completed_at")
  cloudsignUrl          String?   @db.VarChar(500) @map("cloudsign_url")
  filePath              String?   @db.VarChar(500) @map("file_path")
  fileName              String?   @db.VarChar(200) @map("file_name")
  assignedTo            String?   @db.VarChar(100) @map("assigned_to")
  note                  String?
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  company               Company          @relation(fields: [companyId], references: [id])
  project               Project          @relation(fields: [projectId], references: [id])
  currentStatus         ContractStatus?  @relation("CurrentStatus", fields: [currentStatusId], references: [id])
  parentContract        Contract?        @relation("ContractHierarchy", fields: [parentContractId], references: [id])
  childContracts        Contract[]       @relation("ContractHierarchy")
  statusHistories       ContractStatusHistory[]

  @@index([companyId], map: "idx_contracts_company_id")
  @@index([projectId], map: "idx_contracts_project_id")
  @@index([companyId, projectId], map: "idx_contracts_company_project")
  @@index([currentStatusId], map: "idx_contracts_current_status_id")
  @@index([isActive], map: "idx_contracts_is_active")
  @@index([cloudsignDocumentId], map: "idx_contracts_cloudsign_document_id")
  @@map("contracts")
}

model ContractStatusHistory {
  id           Int       @id @default(autoincrement())
  contractId   Int       @map("contract_id")
  eventType    String    @db.VarChar(30) @map("event_type")
  fromStatusId Int?      @map("from_status_id")
  toStatusId   Int?      @map("to_status_id")
  targetDate   DateTime? @db.Date @map("target_date")
  changedBy    String?   @db.VarChar(100) @map("changed_by")
  note         String?
  recordedAt   DateTime  @default(now()) @map("recorded_at")

  contract     Contract        @relation(fields: [contractId], references: [id])
  fromStatus   ContractStatus? @relation("FromStatus", fields: [fromStatusId], references: [id])
  toStatus     ContractStatus? @relation("ToStatus", fields: [toStatusId], references: [id])

  @@index([contractId], map: "idx_contract_status_histories_contract_id")
  @@index([recordedAt], map: "idx_contract_status_histories_recorded_at")
  @@map("contract_status_histories")
}


// ===== 既存のCompanyモデルに追加するリレーション =====
// Company モデルに以下を追加：
// contracts Contract[]
```

---

## シードデータ（初期データ投入用）

```typescript
// prisma/seed.ts に追加

// プロジェクト
const projects = [
  { name: '採用ブースト', description: '採用支援サービス', displayOrder: 1 },
];

// 契約書ステータス
const contractStatuses = [
  { name: '雛形作成中', displayOrder: 1, isTerminal: false },
  { name: '内容確認中', displayOrder: 2, isTerminal: false },
  { name: '合意待ち', displayOrder: 3, isTerminal: false },
  { name: '修正対応中', displayOrder: 4, isTerminal: false },
  { name: '送付情報確認中', displayOrder: 5, isTerminal: false },
  { name: '送付済み', displayOrder: 6, isTerminal: false },
  { name: '締結済み', displayOrder: 7, isTerminal: true },
  { name: '破棄', displayOrder: 8, isTerminal: true },
];

// 投入処理
for (const project of projects) {
  await prisma.project.upsert({
    where: { name: project.name },
    update: {},
    create: project,
  });
}

for (const status of contractStatuses) {
  await prisma.contractStatus.upsert({
    where: { name: status.name },
    update: {},
    create: status,
  });
}
```
