# CRMシステム開発 - セットアップ手順

## 概要
Docker環境で社内CRMシステムを構築します。
詳細な要件は `docs/REQUIREMENTS.md` を参照してください。

---

## Step 1: プロジェクトディレクトリの作成

```bash
mkdir crm
cd crm
```

---

## Step 2: Docker環境の構築

### docker-compose.yml を作成

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/crm_db
    depends_on:
      db:
        condition: service_healthy
    command: npm run dev

  db:
    image: postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=crm_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

### Dockerfile を作成

```dockerfile
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"]
```

### .dockerignore を作成

```
node_modules
.next
.git
*.log
```

---

## Step 3: Next.js プロジェクトの初期化

```bash
# Next.js プロジェクト作成
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 必要なパッケージをインストール
npm install prisma @prisma/client

# shadcn/ui のセットアップ
npx shadcn@latest init

# shadcn/ui コンポーネントを追加
npx shadcn@latest add button input label card table dialog form select textarea badge separator dropdown-menu sheet toast

# Prisma の初期化
npx prisma init
```

---

## Step 4: 環境変数の設定

### .env を作成

```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/crm_db"
```

---

## Step 5: Prisma スキーマの作成

`prisma/schema.prisma` を以下の内容で作成:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// 全顧客マスタ
// ============================================

model Company {
  id        Int      @id @default(autoincrement())
  name      String   @db.VarChar(200)
  industry  String?  @db.VarChar(100)
  address   String?  @db.VarChar(300)
  phone     String?  @db.VarChar(20)
  email     String?  @db.VarChar(255)
  website   String?  @db.VarChar(255)
  note      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  projectCompanies ProjectCompany[]

  @@map("companies")
}

// ============================================
// 商談ステージマスタ
// ============================================

model Stage {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(50)
  displayOrder Int
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  // Relations
  currentStageCompanies ProjectCompany[] @relation("CurrentStage")
  targetStageCompanies  ProjectCompany[] @relation("TargetStage")
  fromStageHistories    StageHistory[]   @relation("FromStage")
  toStageHistories      StageHistory[]   @relation("ToStage")

  @@map("stages")
}

// ============================================
// 接触方法マスタ
// ============================================

model ContactMethod {
  id           Int      @id @default(autoincrement())
  name         String   @db.VarChar(50)
  displayOrder Int
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())

  // Relations
  contacts Contact[]

  @@map("contact_methods")
}

// ============================================
// 採用ブーストプロジェクト企業情報
// ============================================

model ProjectCompany {
  id                 Int       @id @default(autoincrement())
  companyId          Int
  currentStageId     Int?
  nextTargetStageId  Int?
  nextTargetDate     DateTime? @db.Date
  assignedTo         String?   @db.VarChar(100)
  priority           String?   @db.VarChar(10)
  note               String?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  // Relations
  company         Company        @relation(fields: [companyId], references: [id], onDelete: Cascade)
  currentStage    Stage?         @relation("CurrentStage", fields: [currentStageId], references: [id])
  nextTargetStage Stage?         @relation("TargetStage", fields: [nextTargetStageId], references: [id])
  contacts        Contact[]
  stageHistories  StageHistory[]

  @@map("project_companies")
}

// ============================================
// 接触履歴
// ============================================

model Contact {
  id               Int       @id @default(autoincrement())
  projectCompanyId Int
  contactDate      DateTime  @db.Date
  contactTime      DateTime? @db.Time()
  contactMethodId  Int?
  assignedTo       String?   @db.VarChar(100)
  minutes          String?
  note             String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  // Relations
  projectCompany ProjectCompany @relation(fields: [projectCompanyId], references: [id], onDelete: Cascade)
  contactMethod  ContactMethod? @relation(fields: [contactMethodId], references: [id])

  @@map("contacts")
}

// ============================================
// ステータス変更履歴
// ============================================

model StageHistory {
  id               Int       @id @default(autoincrement())
  projectCompanyId Int
  eventType        String    @db.VarChar(20)
  fromStageId      Int?
  toStageId        Int?
  targetDate       DateTime? @db.Date
  recordedAt       DateTime  @default(now())
  changedBy        String?   @db.VarChar(100)
  note             String?

  // Relations
  projectCompany ProjectCompany @relation(fields: [projectCompanyId], references: [id], onDelete: Cascade)
  fromStage      Stage?         @relation("FromStage", fields: [fromStageId], references: [id])
  toStage        Stage?         @relation("ToStage", fields: [toStageId], references: [id])

  @@map("stage_histories")
}
```

---

## Step 6: シードデータの作成

`prisma/seed.ts` を作成:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 商談ステージの初期データ
  const stages = [
    { name: 'リード', displayOrder: 1 },
    { name: '商談化', displayOrder: 2 },
    { name: '提案中', displayOrder: 3 },
    { name: '見積提示', displayOrder: 4 },
    { name: '受注', displayOrder: 5 },
    { name: '失注', displayOrder: 6 },
    { name: '検討中', displayOrder: 7 },
  ];

  for (const stage of stages) {
    await prisma.stage.upsert({
      where: { id: stages.indexOf(stage) + 1 },
      update: {},
      create: stage,
    });
  }

  // 接触方法の初期データ
  const contactMethods = [
    { name: '電話', displayOrder: 1 },
    { name: 'メール', displayOrder: 2 },
    { name: '訪問', displayOrder: 3 },
    { name: 'Web会議', displayOrder: 4 },
    { name: 'その他', displayOrder: 5 },
  ];

  for (const method of contactMethods) {
    await prisma.contactMethod.upsert({
      where: { id: contactMethods.indexOf(method) + 1 },
      update: {},
      create: method,
    });
  }

  console.log('Seed data created successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### package.json に追加

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

### ts-node をインストール

```bash
npm install -D ts-node
```

---

## Step 7: Docker起動とマイグレーション

```bash
# Docker起動（初回はビルドも行う）
docker-compose up -d --build

# マイグレーション実行
docker-compose exec app npx prisma migrate dev --name init

# シードデータ投入
docker-compose exec app npx prisma db seed
```

---

## Step 8: 開発サーバー確認

ブラウザで http://localhost:3000 にアクセスして動作確認

---

## コマンド一覧

```bash
# Docker起動
docker-compose up -d

# Docker停止
docker-compose down

# ログ確認
docker-compose logs -f app

# マイグレーション
docker-compose exec app npx prisma migrate dev --name <name>

# シードデータ投入
docker-compose exec app npx prisma db seed

# Prisma Studio（DBビューワー）
docker-compose exec app npx prisma studio

# コンテナ内シェル
docker-compose exec app sh
```

---

## ローカル開発（Docker不使用）の場合

```bash
# PostgreSQLをローカルにインストール（Mac）
brew install postgresql@15
brew services start postgresql@15

# データベース作成
createdb crm_db

# .envを修正
DATABASE_URL="postgresql://localhost:5432/crm_db"

# マイグレーション
npx prisma migrate dev --name init

# シードデータ投入
npx prisma db seed

# 開発サーバー起動
npm run dev
```

---

## 次のタスク

環境構築が完了したら、以下の順番で実装を進めてください:

1. **マスタ管理画面** - 商談ステージ、接触方法
2. **全顧客一覧・詳細・編集** - CRUD
3. **プロジェクト企業一覧・詳細・編集** - CRUD + ステージ変更
4. **接触履歴** - 一覧・登録
5. **ステージ変更履歴** - 一覧表示

詳細な要件は `docs/REQUIREMENTS.md` を参照してください。
