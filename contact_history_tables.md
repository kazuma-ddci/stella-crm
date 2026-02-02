# 接触履歴テーブル改修 実装指示書

## 概要

接触履歴を全プロジェクト共通の1つのテーブルで管理するように改修する。
1つの接触履歴に対して、複数のプロジェクト・顧客種別を紐付けられる設計とする。

---

## 背景・目的

### 現状の課題

1. 現在の `stp_contact_histories` テーブルはSTPプロジェクト専用
2. プロジェクトが増えるたびに別テーブルが必要になる
3. 全顧客マスタで全プロジェクトの接触履歴を一覧表示するのが困難

### 解決したいこと

1. 全プロジェクト共通の接触履歴テーブルで一元管理
2. 1社が複数の役割（企業・代理店など）を持てる
3. 1回の接触で複数の役割の話をした場合に対応
4. プロジェクトごとに異なる顧客種別を定義可能

---

## 作成するテーブル一覧

| No | テーブル名 | 説明 |
|----|-----------|------|
| 1 | contact_histories | 接触履歴テーブル（全プロジェクト共通） |
| 2 | contact_history_roles | 接触履歴ロールテーブル（中間テーブル） |
| 3 | customer_types | 顧客種別マスタ |

※ 既存の `stp_contact_histories` テーブルは新テーブルに置き換え

---

## テーブル関係図

```
┌───────────────────────┐     ┌─────────────────────────┐
│ master_stella_companies│     │ master_projects         │
│（全顧客マスタ・既存）   │     │（プロジェクト・既存）    │
└───────────┬───────────┘     └────────────┬────────────┘
            │                              │
            │ company_id                   │ project_id
            │                              │
            ▼                              ▼
┌───────────────────────┐     ┌─────────────────────────┐
│ contact_histories     │     │ customer_types          │
│（接触履歴）            │     │（顧客種別マスタ）        │
└───────────┬───────────┘     └────────────┬────────────┘
            │                              │
            │ contact_history_id           │ customer_type_id
            │                              │
            └──────────────┬───────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ contact_history_roles   │
              │（接触履歴ロール）        │
              │ ※中間テーブル           │
              └─────────────────────────┘
```

---

## 1. contact_histories（接触履歴テーブル）

### 概要

全プロジェクト共通の接触履歴を管理するテーブル。
現在の `stp_contact_histories` の内容を引き継ぐ。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| company_id | INT | NO | - | 企業ID（外部キー → master_stella_companies） |
| contact_date | TIMESTAMP | NO | - | 接触日時 |
| contact_method_id | INT | YES | NULL | 接触方法（外部キー → contact_methods） |
| assigned_to | VARCHAR(255) | YES | NULL | 担当者（スタッフIDをカンマ区切り） |
| customer_participants | VARCHAR(500) | YES | NULL | 先方参加者 |
| meeting_minutes | TEXT | YES | NULL | 議事録 |
| note | TEXT | YES | NULL | 備考 |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |
| deleted_at | TIMESTAMP | YES | NULL | 論理削除日時 |

### インデックス

| インデックス名 | カラム | 説明 |
|---------------|--------|------|
| idx_contact_histories_company_id | company_id | 企業別検索用 |
| idx_contact_histories_contact_date | contact_date | 日付検索用 |
| idx_contact_histories_deleted_at | deleted_at | 論理削除フィルタ用 |

### Prismaスキーマ

```prisma
model ContactHistory {
  id                   Int       @id @default(autoincrement())
  companyId            Int       @map("company_id")
  contactDate          DateTime  @map("contact_date")
  contactMethodId      Int?      @map("contact_method_id")
  assignedTo           String?   @db.VarChar(255) @map("assigned_to")
  customerParticipants String?   @db.VarChar(500) @map("customer_participants")
  meetingMinutes       String?   @map("meeting_minutes")
  note                 String?
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  deletedAt            DateTime? @map("deleted_at")

  // リレーション
  company        MasterStellaCompany  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  contactMethod  ContactMethod?       @relation(fields: [contactMethodId], references: [id])
  roles          ContactHistoryRole[]

  @@index([companyId], map: "idx_contact_histories_company_id")
  @@index([contactDate], map: "idx_contact_histories_contact_date")
  @@index([deletedAt], map: "idx_contact_histories_deleted_at")
  @@map("contact_histories")
}
```

---

## 2. contact_history_roles（接触履歴ロールテーブル）

### 概要

接触履歴と顧客種別を紐付ける中間テーブル。
1つの接触履歴に対して、複数の顧客種別を紐付け可能。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| contact_history_id | INT | NO | - | 接触履歴ID（外部キー → contact_histories） |
| customer_type_id | INT | NO | - | 顧客種別ID（外部キー → customer_types） |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |

### 制約

- `contact_history_id` と `customer_type_id` の組み合わせはユニーク

### インデックス

| インデックス名 | カラム | 説明 |
|---------------|--------|------|
| idx_contact_history_roles_contact_history_id | contact_history_id | 接触履歴別検索用 |
| idx_contact_history_roles_customer_type_id | customer_type_id | 顧客種別別検索用 |

### Prismaスキーマ

```prisma
model ContactHistoryRole {
  id               Int      @id @default(autoincrement())
  contactHistoryId Int      @map("contact_history_id")
  customerTypeId   Int      @map("customer_type_id")
  createdAt        DateTime @default(now()) @map("created_at")

  // リレーション
  contactHistory ContactHistory @relation(fields: [contactHistoryId], references: [id], onDelete: Cascade)
  customerType   CustomerType   @relation(fields: [customerTypeId], references: [id])

  @@unique([contactHistoryId, customerTypeId])
  @@index([contactHistoryId], map: "idx_contact_history_roles_contact_history_id")
  @@index([customerTypeId], map: "idx_contact_history_roles_customer_type_id")
  @@map("contact_history_roles")
}
```

---

## 3. customer_types（顧客種別マスタ）

### 概要

プロジェクトごとの顧客種別を管理するマスタテーブル。
顧客種別は必ず1つのプロジェクトに紐づく。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| project_id | INT | NO | - | プロジェクトID（外部キー → master_projects） |
| name | VARCHAR(50) | NO | - | 顧客種別名 |
| display_order | INT | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

### 初期データ

| project_id | name | display_order | 説明 |
|------------|------|---------------|------|
| 1（採用ブースト） | 企業 | 1 | クライアント企業 |
| 1（採用ブースト） | 代理店 | 2 | 代理店 |

※ 他のプロジェクトの顧客種別は、プロジェクト追加時に設定

### Prismaスキーマ

```prisma
model CustomerType {
  id           Int      @id @default(autoincrement())
  projectId    Int      @map("project_id")
  name         String   @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // リレーション
  project MasterProject        @relation(fields: [projectId], references: [id])
  roles   ContactHistoryRole[]

  @@index([projectId], map: "idx_customer_types_project_id")
  @@map("customer_types")
}
```

---

## 4. contact_methods（接触方法マスタ）

### 概要

既存の `stp_contact_methods` を全プロジェクト共通化する。
テーブル名を `contact_methods` に変更。

### テーブル定義

| カラム名 | 型 | NULL | デフォルト | 説明 |
|---------|-----|------|-----------|------|
| id | SERIAL | NO | 自動採番 | 主キー |
| name | VARCHAR(50) | NO | - | 接触方法名 |
| display_order | INT | NO | 0 | 表示順 |
| is_active | BOOLEAN | NO | true | 有効フラグ |
| created_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 作成日時 |
| updated_at | TIMESTAMP | NO | CURRENT_TIMESTAMP | 更新日時 |

### 初期データ

| name | display_order |
|------|---------------|
| 電話 | 1 |
| メール | 2 |
| 訪問 | 3 |
| Web会議 | 4 |
| その他 | 5 |

### Prismaスキーマ

```prisma
model ContactMethod {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  // リレーション
  contactHistories ContactHistory[]

  @@map("contact_methods")
}
```

---

## データの流れ

### 例1：企業一覧ページから接触履歴を追加（企業としてのみ）

```
【ユーザー操作】
/stp/companies で「株式会社ABC」の接触履歴を追加
顧客種別：企業（必須）を選択

【保存されるデータ】
contact_histories
├── id: 1
├── company_id: 100（株式会社ABC）
├── contact_date: 2025-02-01 10:00:00
└── note: "サービス紹介の打ち合わせ"

contact_history_roles
└── id: 1, contact_history_id: 1, customer_type_id: 1（企業）
```

### 例2：企業一覧ページから接触履歴を追加（企業・代理店両方）

```
【ユーザー操作】
/stp/companies で「株式会社ABC」の接触履歴を追加
顧客種別：企業（必須）、代理店（追加選択）を選択

【保存されるデータ】
contact_histories
├── id: 2
├── company_id: 100（株式会社ABC）
├── contact_date: 2025-02-05 14:00:00
└── note: "自社の採用支援 + 他社の紹介について"

contact_history_roles
├── id: 2, contact_history_id: 2, customer_type_id: 1（企業）
└── id: 3, contact_history_id: 2, customer_type_id: 2（代理店）
```

### 例3：複数プロジェクトにまたがる接触

```
【ユーザー操作】
/stp/companies で「株式会社ABC」の接触履歴を追加
・採用ブースト：企業（必須）
・プロジェクトB：クライアント（追加選択）

【保存されるデータ】
contact_histories
├── id: 3
├── company_id: 100（株式会社ABC）
├── contact_date: 2025-02-10 15:00:00
└── note: "採用ブーストとプロジェクトBの両方について相談"

contact_history_roles
├── id: 4, contact_history_id: 3, customer_type_id: 1（採用ブースト/企業）
└── id: 5, contact_history_id: 3, customer_type_id: 4（プロジェクトB/クライアント）
```

---

## UI仕様

### 接触履歴追加モーダル

#### 基本動作

1. ページによって必須の顧客種別が決まる
2. 必須の顧客種別は外せない（外そうとすると警告表示）
3. 同じプロジェクトの他の顧客種別は追加選択可能
4. 他のプロジェクトも追加可能
5. 追加したプロジェクトの顧客種別を選択可能

#### ページと必須顧客種別の対応

| ページ | プロジェクト | 必須顧客種別 |
|--------|-------------|-------------|
| /stp/companies | 採用ブースト | 企業 |
| /stp/agents | 採用ブースト | 代理店 |

#### 警告メッセージ

必須の顧客種別を外そうとした場合：
```
この顧客種別を外す場合は、[代理店一覧] ページから接触履歴を追加してください。
```

#### UIイメージ

```
┌─────────────────────────────────────────────────────────────┐
│  接触履歴を追加                                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  接触日時: [2025-02-01 10:00 ▼]                             │
│                                                             │
│  接触方法: [電話 ▼]                                         │
│                                                             │
│  ─────────────────────────────────────────────              │
│  【顧客種別を選択】                                          │
│  ─────────────────────────────────────────────              │
│                                                             │
│  ▼ 採用ブースト                                             │
│    ☑ 企業（必須）                                           │
│    ☐ 代理店                                                 │
│                                                             │
│  [+ 他のプロジェクトを追加]                                  │
│                                                             │
│  ─────────────────────────────────────────────              │
│                                                             │
│  担当者: [山田太郎 ▼] [+ 追加]                              │
│                                                             │
│  先方参加者: [________________]                              │
│                                                             │
│  議事録:                                                    │
│  ┌─────────────────────────────────────────────┐            │
│  │                                             │            │
│  │                                             │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│  備考:                                                      │
│  ┌─────────────────────────────────────────────┐            │
│  │                                             │            │
│  └─────────────────────────────────────────────┘            │
│                                                             │
│            [キャンセル]  [保存]                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## クエリパターン

### 1. 採用ブーストの企業接触履歴を取得

```typescript
const histories = await prisma.contactHistory.findMany({
  where: {
    deletedAt: null,
    roles: {
      some: {
        customerType: {
          projectId: 1,  // 採用ブースト
          name: '企業',
        },
      },
    },
  },
  include: {
    company: true,
    contactMethod: true,
    roles: {
      include: {
        customerType: true,
      },
    },
  },
  orderBy: {
    contactDate: 'desc',
  },
});
```

### 2. 採用ブーストの代理店接触履歴を取得

```typescript
const histories = await prisma.contactHistory.findMany({
  where: {
    deletedAt: null,
    roles: {
      some: {
        customerType: {
          projectId: 1,  // 採用ブースト
          name: '代理店',
        },
      },
    },
  },
  include: {
    company: true,
    contactMethod: true,
    roles: {
      include: {
        customerType: true,
      },
    },
  },
  orderBy: {
    contactDate: 'desc',
  },
});
```

### 3. 全顧客詳細：特定企業の全接触履歴を取得

```typescript
const histories = await prisma.contactHistory.findMany({
  where: {
    companyId: 100,  // 株式会社ABC
    deletedAt: null,
  },
  include: {
    contactMethod: true,
    roles: {
      include: {
        customerType: {
          include: {
            project: true,
          },
        },
      },
    },
  },
  orderBy: {
    contactDate: 'desc',
  },
});
```

### 4. 特定プロジェクトの顧客種別を取得

```typescript
const customerTypes = await prisma.customerType.findMany({
  where: {
    projectId: 1,  // 採用ブースト
    isActive: true,
  },
  orderBy: {
    displayOrder: 'asc',
  },
});
```

---

## 既存コードの修正箇所

### 修正が必要なファイル

| ファイル | 修正内容 |
|----------|----------|
| prisma/schema.prisma | 新テーブル定義追加、StpContactHistory削除 |
| src/app/stp/companies/contact-history-actions.ts | 新テーブル構造に対応 |
| src/app/stp/agents/contact-history-actions.ts | 新テーブル構造に対応 |
| src/app/stp/companies/contact-history-modal.tsx | 顧客種別選択UI追加 |
| src/app/stp/agents/contact-history-modal.tsx | 顧客種別選択UI追加 |
| src/app/stp/records/company-contacts/page.tsx | クエリ変更 |
| src/app/stp/records/agent-contacts/page.tsx | クエリ変更 |
| src/app/companies/[id]/contact-history-section.tsx | クエリ変更（全履歴表示） |

### Server Action の変更例

```typescript
// src/app/stp/companies/contact-history-actions.ts

export async function addContactHistory(
  companyId: number,
  data: {
    contactDate: string;
    contactMethodId?: number | null;
    assignedTo?: string | null;
    customerParticipants?: string | null;
    meetingMinutes?: string | null;
    note?: string | null;
    customerTypeIds: number[];  // ★ 追加：選択された顧客種別ID配列
  }
) {
  return await prisma.$transaction(async (tx) => {
    // 1. 接触履歴を作成
    const history = await tx.contactHistory.create({
      data: {
        companyId,
        contactDate: new Date(data.contactDate),
        contactMethodId: data.contactMethodId,
        assignedTo: data.assignedTo,
        customerParticipants: data.customerParticipants,
        meetingMinutes: data.meetingMinutes,
        note: data.note,
      },
    });

    // 2. 顧客種別との紐付けを作成
    await tx.contactHistoryRole.createMany({
      data: data.customerTypeIds.map((customerTypeId) => ({
        contactHistoryId: history.id,
        customerTypeId,
      })),
    });

    return history;
  });
}
```

---

## 実装の優先順位

### Step 1: テーブル作成

1. customer_types テーブル作成
2. contact_histories テーブル作成
3. contact_history_roles テーブル作成
4. contact_methods テーブル作成（既存から移行）

### Step 2: 初期データ投入

1. contact_methods に接触方法を投入
2. customer_types に採用ブーストの顧客種別を投入
   - 企業（display_order: 1）
   - 代理店（display_order: 2）

### Step 3: 既存テーブルの削除

1. stp_contact_histories テーブルを削除
2. stp_contact_methods テーブルを削除

### Step 4: アプリケーションコード修正

1. Server Actions の修正
2. モーダルコンポーネントの修正
3. 一覧ページの修正
4. 全顧客詳細の接触履歴セクション修正

---

## 注意事項

### 1. トランザクション処理

接触履歴の作成時は、`contact_histories` と `contact_history_roles` を同一トランザクションで処理すること。

### 2. 論理削除

- 削除操作は `deleted_at` に現在日時をセット
- 一覧表示時は `deleted_at IS NULL` でフィルタ
- 物理削除は行わない

### 3. 顧客種別の必須チェック

- UIで必須の顧客種別が選択されているかチェック
- Server Action側でも `customerTypeIds` が空でないことを検証

### 4. キャッシュ無効化

Server Action実行後、関連パスのキャッシュを無効化：

```typescript
revalidatePath("/stp/companies");
revalidatePath("/stp/agents");
revalidatePath("/stp/records/company-contacts");
revalidatePath("/stp/records/agent-contacts");
revalidatePath(`/companies/${companyId}`);
```

---

## Prismaスキーマ全体（追加分）

```prisma
// ===== 接触履歴関連（新規追加） =====

model ContactHistory {
  id                   Int       @id @default(autoincrement())
  companyId            Int       @map("company_id")
  contactDate          DateTime  @map("contact_date")
  contactMethodId      Int?      @map("contact_method_id")
  assignedTo           String?   @db.VarChar(255) @map("assigned_to")
  customerParticipants String?   @db.VarChar(500) @map("customer_participants")
  meetingMinutes       String?   @map("meeting_minutes")
  note                 String?
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")
  deletedAt            DateTime? @map("deleted_at")

  company        MasterStellaCompany  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  contactMethod  ContactMethod?       @relation(fields: [contactMethodId], references: [id])
  roles          ContactHistoryRole[]

  @@index([companyId], map: "idx_contact_histories_company_id")
  @@index([contactDate], map: "idx_contact_histories_contact_date")
  @@index([deletedAt], map: "idx_contact_histories_deleted_at")
  @@map("contact_histories")
}

model ContactHistoryRole {
  id               Int      @id @default(autoincrement())
  contactHistoryId Int      @map("contact_history_id")
  customerTypeId   Int      @map("customer_type_id")
  createdAt        DateTime @default(now()) @map("created_at")

  contactHistory ContactHistory @relation(fields: [contactHistoryId], references: [id], onDelete: Cascade)
  customerType   CustomerType   @relation(fields: [customerTypeId], references: [id])

  @@unique([contactHistoryId, customerTypeId])
  @@index([contactHistoryId], map: "idx_contact_history_roles_contact_history_id")
  @@index([customerTypeId], map: "idx_contact_history_roles_customer_type_id")
  @@map("contact_history_roles")
}

model CustomerType {
  id           Int      @id @default(autoincrement())
  projectId    Int      @map("project_id")
  name         String   @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  project MasterProject        @relation(fields: [projectId], references: [id])
  roles   ContactHistoryRole[]

  @@index([projectId], map: "idx_customer_types_project_id")
  @@map("customer_types")
}

model ContactMethod {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(50)
  displayOrder Int      @default(0) @map("display_order")
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at")
  updatedAt    DateTime @updatedAt @map("updated_at")

  contactHistories ContactHistory[]

  @@map("contact_methods")
}


// ===== 既存モデルに追加するリレーション =====

// MasterStellaCompany に追加：
// contactHistories ContactHistory[]

// MasterProject に追加：
// customerTypes CustomerType[]
```

---

## シードデータ

```typescript
// prisma/seed.ts に追加

// 接触方法
const contactMethods = [
  { name: '電話', displayOrder: 1 },
  { name: 'メール', displayOrder: 2 },
  { name: '訪問', displayOrder: 3 },
  { name: 'Web会議', displayOrder: 4 },
  { name: 'その他', displayOrder: 5 },
];

// 顧客種別（採用ブースト用）
const customerTypes = [
  { projectId: 1, name: '企業', displayOrder: 1 },
  { projectId: 1, name: '代理店', displayOrder: 2 },
];

// 投入処理
for (const method of contactMethods) {
  await prisma.contactMethod.upsert({
    where: { name: method.name },
    update: {},
    create: method,
  });
}

for (const type of customerTypes) {
  await prisma.customerType.upsert({
    where: { 
      projectId_name: { 
        projectId: type.projectId, 
        name: type.name 
      } 
    },
    update: {},
    create: type,
  });
}
```
