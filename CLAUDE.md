# CLAUDE.md - CRMシステム開発ガイド

このファイルはCursor/Claude Codeがプロジェクトを理解するためのガイドです。

## プロジェクト概要

社内CRMシステム - 複数プロジェクトを横断して顧客を一元管理

## 技術スタック

- Next.js 14+ (App Router, TypeScript)
- PostgreSQL 15
- Prisma ORM
- Tailwind CSS + shadcn/ui
- Docker / Docker Compose

## 開発環境

```bash
# 起動
docker-compose up -d

# 停止
docker-compose down

# ログ
docker-compose logs -f app

# マイグレーション
docker-compose exec app npx prisma migrate dev --name <name>

# シードデータ
docker-compose exec app npx prisma db seed

# Prisma Studio
docker-compose exec app npx prisma studio
```

http://localhost:3000 でアクセス

---

## データベース構成（6テーブル）

```
companies（全顧客マスタ）
    │
    │ 1:N
    ▼
project_companies（プロジェクト企業）
    │
    ├── 1:N → contacts（接触履歴）
    │              │
    │              └── N:1 → contact_methods（接触方法マスタ）
    │
    └── 1:N → stage_histories（ステージ変更履歴）
                   │
                   └── N:1 → stages（商談ステージマスタ）
```

### テーブル説明

| テーブル | 説明 |
|---------|------|
| companies | 全顧客の基本情報 |
| stages | 商談ステージの選択肢（リード、商談化、提案中...） |
| contact_methods | 接触方法の選択肢（電話、メール、訪問...） |
| project_companies | プロジェクト固有の商談情報 |
| contacts | 接触履歴 |
| stage_histories | ステージ変更の履歴 |

---

## ディレクトリ構成

```
crm/
├── docker-compose.yml
├── Dockerfile
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── companies/           # 全顧客マスタ
│   │   ├── saiyo-boost/         # 採用ブースト
│   │   │   └── companies/
│   │   ├── settings/            # マスタ管理
│   │   │   ├── stages/
│   │   │   └── contact-methods/
│   │   └── api/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui
│   │   └── layout/
│   ├── lib/
│   │   ├── prisma.ts
│   │   └── utils.ts
│   └── types/
├── docs/
│   ├── REQUIREMENTS.md
│   └── SETUP.md
└── CLAUDE.md
```

---

## 画面一覧

```
/                                    → ダッシュボード

/companies                           → 全顧客一覧
/companies/new                       → 全顧客新規登録
/companies/[id]                      → 全顧客詳細
/companies/[id]/edit                 → 全顧客編集

/saiyo-boost/companies               → プロジェクト企業一覧
/saiyo-boost/companies/new           → プロジェクト企業新規登録
/saiyo-boost/companies/[id]          → プロジェクト企業詳細
/saiyo-boost/companies/[id]/edit     → プロジェクト企業編集
/saiyo-boost/companies/[id]/contacts → 接触履歴
/saiyo-boost/companies/[id]/history  → ステージ変更履歴

/settings/stages                     → 商談ステージマスタ
/settings/contact-methods            → 接触方法マスタ
```

---

## 重要なロジック

### ステージ変更時の履歴記録

ステージを変更したら、自動的に `stage_histories` に記録する:

```typescript
async function updateStage(
  projectCompanyId: number,
  newStageId: number,
  changedBy: string
) {
  const current = await prisma.projectCompany.findUnique({
    where: { id: projectCompanyId },
  });

  await prisma.$transaction([
    // 1. ステージ更新
    prisma.projectCompany.update({
      where: { id: projectCompanyId },
      data: { currentStageId: newStageId },
    }),
    // 2. 履歴記録
    prisma.stageHistory.create({
      data: {
        projectCompanyId,
        eventType: 'commit', // or 'achieved', 'recommit', 'back'
        fromStageId: current?.currentStageId,
        toStageId: newStageId,
        changedBy,
      },
    }),
  ]);
}
```

### event_type の意味

| 値 | 意味 |
|----|------|
| commit | 新規目標設定 |
| achieved | 目標達成 |
| recommit | 目標変更 |
| back | 後退 |

---

## 選択肢

```typescript
// 優先度
const PRIORITIES = ['高', '中', '低'] as const;

// イベント種別
const EVENT_TYPES = ['commit', 'achieved', 'recommit', 'back'] as const;

// 商談ステージ（DBから取得）
// stages テーブル

// 接触方法（DBから取得）
// contact_methods テーブル
```

---

## 初期データ

### stages（商談ステージ）

| id | name | display_order |
|----|------|---------------|
| 1 | リード | 1 |
| 2 | 商談化 | 2 |
| 3 | 提案中 | 3 |
| 4 | 見積提示 | 4 |
| 5 | 受注 | 5 |
| 6 | 失注 | 6 |
| 7 | 検討中 | 7 |

### contact_methods（接触方法）

| id | name | display_order |
|----|------|---------------|
| 1 | 電話 | 1 |
| 2 | メール | 2 |
| 3 | 訪問 | 3 |
| 4 | Web会議 | 4 |
| 5 | その他 | 5 |

---

## 実装順序

1. **環境構築** - Docker, Next.js, Prisma
2. **マスタ管理** - stages, contact_methods の CRUD
3. **全顧客マスタ** - companies の CRUD
4. **プロジェクト企業** - project_companies の CRUD + ステージ変更
5. **接触履歴** - contacts の CRUD
6. **ステージ変更履歴** - stage_histories の表示

---

## 参照ドキュメント

- `docs/REQUIREMENTS.md` - 詳細な要件定義
- `docs/SETUP.md` - セットアップ手順
- `prisma/schema.prisma` - DBスキーマ
