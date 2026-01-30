# 社内CRMシステム 要件定義書

## 1. プロジェクト概要

### 1.1 目的
複数の社内プロジェクトを横断して顧客を一元管理するCRMシステムを構築する。

### 1.2 想定規模
- 顧客数: 約10,000社
- 同時アクセス: 約30人（社内スタッフ）
- プロジェクト数: 4つ（今後増加予定）

### 1.3 開発フェーズ
**Phase 1（今回のスコープ）**
- 全顧客マスタ
- 採用ブーストプロジェクトの企業情報
- 商談ステージ管理
- 接触履歴
- ステータス変更履歴

**Phase 2以降（後回し）**
- 認証機能
- 求職者管理
- 代理店管理
- 契約管理
- 分析ダッシュボード
- 通知自動化

---

## 2. 技術スタック

### 2.1 開発環境
- **Docker / Docker Compose** を使用
- ローカル開発環境で開発

### 2.2 アプリケーション
- フレームワーク: Next.js 14+ (App Router, TypeScript)
- ORM: Prisma
- UIライブラリ: Tailwind CSS + shadcn/ui

### 2.3 データベース
- PostgreSQL 15（Dockerコンテナ）

---

## 3. データベース設計（6テーブル）

### テーブル構成図

```
┌─────────────────┐     ┌─────────────────┐
│ 全顧客マスタ     │     │ 商談ステージ     │
│ (companies)     │     │ (stages)        │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ 1:N                   │ 参照
         ▼                       ▼
┌─────────────────────────────────────────────┐
│ 採用ブーストプロジェクト企業情報              │
│ (project_companies)                         │
└────────┬───────────────────────┬────────────┘
         │                       │
         │ 1:N                   │ 1:N
         ▼                       ▼
┌─────────────────┐     ┌─────────────────────┐
│ 接触履歴         │     │ ステータス変更履歴   │
│ (contacts)      │     │ (stage_histories)   │
└─────────────────┘     └─────────────────────┘
         ▲
         │ 参照
┌────────┴────────┐
│ 接触方法マスタ   │
│ (contact_methods)│
└─────────────────┘
```

---

### 3.1 全顧客マスタ（companies）

全プロジェクト共通の企業基本情報

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| name | VARCHAR(200) | NO | 企業名 |
| industry | VARCHAR(100) | YES | 業種 |
| address | VARCHAR(300) | YES | 住所 |
| phone | VARCHAR(20) | YES | 電話番号 |
| email | VARCHAR(255) | YES | メールアドレス |
| website | VARCHAR(255) | YES | Webサイト |
| note | TEXT | YES | 備考 |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

---

### 3.2 商談ステージマスタ（stages）

ステージの選択肢を管理

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| name | VARCHAR(50) | NO | ステージ名 |
| display_order | INT | NO | 表示順 |
| is_active | BOOLEAN | NO | 有効フラグ（デフォルト：true） |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

**初期データ**

| id | name | display_order |
|----|------|---------------|
| 1 | リード | 1 |
| 2 | 商談化 | 2 |
| 3 | 提案中 | 3 |
| 4 | 見積提示 | 4 |
| 5 | 受注 | 5 |
| 6 | 失注 | 6 |
| 7 | 検討中 | 7 |

---

### 3.3 接触方法マスタ（contact_methods）

接触方法の選択肢を管理

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| name | VARCHAR(50) | NO | 方法名 |
| display_order | INT | NO | 表示順 |
| is_active | BOOLEAN | NO | 有効フラグ |
| created_at | TIMESTAMP | NO | 作成日時 |

**初期データ**

| id | name | display_order |
|----|------|---------------|
| 1 | 電話 | 1 |
| 2 | メール | 2 |
| 3 | 訪問 | 3 |
| 4 | Web会議 | 4 |
| 5 | その他 | 5 |

---

### 3.4 採用ブーストプロジェクト企業情報（project_companies）

プロジェクト固有の商談情報（現在の状態を管理）

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| company_id | INT | NO | 企業ID（外部キー → companies.id） |
| current_stage_id | INT | YES | 現在のステージ（外部キー → stages.id） |
| next_target_stage_id | INT | YES | 次の目標ステージ（外部キー → stages.id） |
| next_target_date | DATE | YES | 目標達成期限 |
| assigned_to | VARCHAR(100) | YES | 担当者名 |
| priority | VARCHAR(10) | YES | 優先度（高/中/低） |
| note | TEXT | YES | 備考 |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

---

### 3.5 接触履歴（contacts）

顧客との接触記録

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| project_company_id | INT | NO | プロジェクト企業ID（外部キー → project_companies.id） |
| contact_date | DATE | NO | 接触日 |
| contact_time | TIME | YES | 接触時刻 |
| contact_method_id | INT | YES | 接触方法（外部キー → contact_methods.id） |
| assigned_to | VARCHAR(100) | YES | 担当者 |
| minutes | TEXT | YES | 議事録 |
| note | TEXT | YES | メモ |
| created_at | TIMESTAMP | NO | 作成日時 |
| updated_at | TIMESTAMP | NO | 更新日時 |

---

### 3.6 ステータス変更履歴（stage_histories）

ステージ変更・コミットの履歴を記録

| カラム名 | 型 | NULL | 説明 |
|---------|-----|------|------|
| id | INT | NO | 主キー（自動採番） |
| project_company_id | INT | NO | プロジェクト企業ID（外部キー → project_companies.id） |
| event_type | VARCHAR(20) | NO | イベント種別 |
| from_stage_id | INT | YES | 変更前ステージ（外部キー → stages.id） |
| to_stage_id | INT | YES | 変更後ステージ（外部キー → stages.id） |
| target_date | DATE | YES | 目標日（commit/recommit時） |
| recorded_at | TIMESTAMP | NO | 記録日時 |
| changed_by | VARCHAR(100) | YES | 変更者 |
| note | TEXT | YES | 変更理由・備考 |

**event_typeの値**

| 値 | 意味 |
|----|------|
| commit | 新規目標設定 |
| achieved | 目標達成 |
| recommit | 目標変更 |
| back | 後退 |

---

## 4. テーブル関係まとめ

| 親テーブル | 子テーブル | 関係 |
|-----------|-----------|------|
| companies | project_companies | 1:N |
| stages | project_companies（current_stage_id） | 1:N |
| stages | project_companies（next_target_stage_id） | 1:N |
| stages | stage_histories（from_stage_id） | 1:N |
| stages | stage_histories（to_stage_id） | 1:N |
| contact_methods | contacts | 1:N |
| project_companies | contacts | 1:N |
| project_companies | stage_histories | 1:N |

---

## 5. 画面一覧

### Phase 1 で実装する画面

```
/                                    → ダッシュボード（トップ）

/companies                           → 全顧客一覧
/companies/new                       → 全顧客新規登録
/companies/[id]                      → 全顧客詳細
/companies/[id]/edit                 → 全顧客編集

/saiyo-boost                         → 採用ブースト トップ
/saiyo-boost/companies               → プロジェクト企業一覧
/saiyo-boost/companies/new           → プロジェクト企業新規登録
/saiyo-boost/companies/[id]          → プロジェクト企業詳細
/saiyo-boost/companies/[id]/edit     → プロジェクト企業編集
/saiyo-boost/companies/[id]/contacts → 接触履歴一覧・登録
/saiyo-boost/companies/[id]/history  → ステージ変更履歴

/settings/stages                     → 商談ステージマスタ管理
/settings/contact-methods            → 接触方法マスタ管理
```

---

## 6. 想定される画面と使うテーブル

| 画面 | 使うテーブル |
|------|-------------|
| 全顧客一覧 | companies |
| 全顧客詳細 | companies |
| プロジェクト企業一覧 | project_companies + companies + stages |
| プロジェクト企業詳細 | project_companies + companies + stages + contacts + stage_histories |
| 接触記録の登録 | contacts + contact_methods |
| ステージ変更 | project_companies + stage_histories（自動記録） |
| ステージマスタ管理 | stages |
| 接触方法マスタ管理 | contact_methods |

---

## 7. 選択肢の定義

```typescript
// 優先度
export const PRIORITIES = ['高', '中', '低'] as const;

// イベント種別
export const EVENT_TYPES = ['commit', 'achieved', 'recommit', 'back'] as const;
```

---

## 8. 実装の優先順位

### Step 1: 環境構築
1. Docker環境のセットアップ
2. Next.jsプロジェクト作成
3. PostgreSQL接続設定
4. Prismaスキーマ作成・マイグレーション
5. 初期データ投入（stages, contact_methods）

### Step 2: マスタ管理
1. 商談ステージマスタ管理画面
2. 接触方法マスタ管理画面

### Step 3: 全顧客マスタ
1. 一覧画面
2. 新規登録
3. 詳細画面
4. 編集画面

### Step 4: プロジェクト企業
1. 一覧画面（企業名・現在ステージ・担当者など表示）
2. 新規登録（全顧客マスタから選択 or 新規作成）
3. 詳細画面
4. 編集画面
5. ステージ変更機能（→ stage_historiesに自動記録）

### Step 5: 接触履歴
1. 接触履歴一覧
2. 接触記録の登録
3. 接触記録の編集・削除

### Step 6: ステージ変更履歴
1. 変更履歴一覧表示

---

## 9. 将来の拡張性

| 拡張内容 | 方法 |
|---------|------|
| 別プロジェクト追加 | projectsテーブルを追加し、project_companiesにproject_idを追加 |
| 認証機能 | usersテーブルを追加、NextAuth.js導入 |
| 担当者管理を厳密に | usersテーブルを追加し、assigned_toを外部キーに変更 |
| 商談金額の管理 | project_companiesにamountカラムを追加 |
| 求職者管理 | candidatesテーブルを追加 |
| 代理店管理 | agentsテーブルを追加 |
| 契約管理 | contractsテーブルを追加 |
