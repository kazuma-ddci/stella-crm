# アーキテクチャ

このドキュメントはstella-crmのディレクトリ構成と画面一覧を記述したものです。

---

## 目次

1. [ディレクトリ構成](#ディレクトリ構成)
2. [画面一覧](#画面一覧)

---

## ディレクトリ構成

```
stella-crm/
├── docker-compose.yml
├── Dockerfile
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx                        # ダッシュボード
│   │   │
│   │   ├── companies/                      # 全顧客マスタ
│   │   │   ├── page.tsx
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │
│   │   ├── stp/                            # STPプロジェクト
│   │   │   ├── dashboard/                  # STPダッシュボード
│   │   │   │   └── page.tsx
│   │   │   ├── companies/                  # STP企業管理
│   │   │   │   ├── page.tsx
│   │   │   │   ├── stage-management/
│   │   │   │   └── [id]/
│   │   │   │       └── kpi/                # 運用KPIシート
│   │   │   ├── agents/                     # 代理店管理
│   │   │   ├── candidates/                 # 求職者（候補者）管理
│   │   │   ├── contracts/                  # 契約管理
│   │   │   ├── lead-submissions/           # リード獲得フォーム回答管理
│   │   │   ├── records/                    # 履歴管理
│   │   │   │   ├── company-contacts/
│   │   │   │   ├── agent-contacts/
│   │   │   │   └── stage-histories/
│   │   │   └── settings/                   # STPマスタ管理
│   │   │       ├── stages/
│   │   │       └── contact-methods/
│   │   │
│   │   ├── settings/                       # 全体設定
│   │   │   ├── contact-methods/            # 接触方法マスタ
│   │   │   ├── contract-statuses/          # 契約ステータスマスタ
│   │   │   ├── customer-types/             # 顧客種別マスタ
│   │   │   └── projects/                   # プロジェクトマスタ
│   │   │
│   │   ├── staff/                          # スタッフ管理
│   │   │   └── role-types/                 # 役割種別マスタ
│   │   │
│   │   ├── admin/                          # 管理画面
│   │   │   ├── users/                      # 外部ユーザー一覧
│   │   │   ├── pending-users/              # 承認待ちユーザー
│   │   │   └── registration-tokens/        # 登録トークン管理
│   │   │
│   │   ├── portal/                         # 外部ユーザー向けポータル
│   │   │   └── stp/
│   │   │       ├── client/                 # クライアント向け
│   │   │       └── agent/                  # 代理店向け
│   │   │
│   │   ├── form/                           # 公開フォーム
│   │   │   └── stp-lead/[token]/           # STPリード獲得フォーム
│   │   │
│   │   ├── login/                          # ログイン
│   │   ├── register/[token]/               # 外部ユーザー登録
│   │   ├── forgot-password/                # パスワードリセット申請
│   │   ├── reset-password/[token]/         # パスワードリセット
│   │   ├── verify-email/[token]/           # メール認証
│   │   │
│   │   ├── s/
│   │   │   ├── [code]/                     # 短縮URL
│   │   │   └── kpi/[token]/                # KPIシート共有ページ（公開）
│   │   │
│   │   └── api/                            # APIエンドポイント
│   │       ├── auth/[...nextauth]/         # NextAuth
│   │       ├── companies/                  # 企業API
│   │       ├── contracts/                  # 契約書API
│   │       ├── admin/                      # 管理API
│   │       ├── portal/                     # ポータルAPI
│   │       ├── public/                     # 公開API（リード獲得フォーム等）
│   │       ├── registration/               # 外部ユーザー登録API
│   │       ├── forgot-password/            # パスワードリセットAPI
│   │       ├── reset-password/             # パスワード再設定API
│   │       ├── verify-email/               # メール認証API
│   │       └── internal/                   # 内部API（短縮URL等）
│   │
│   ├── components/
│   │   ├── ui/                             # shadcn/ui
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── header.tsx
│   │   │   └── user-menu.tsx
│   │   ├── providers/                      # React Context Providers
│   │   ├── crud-table.tsx                  # 汎用CRUDテーブル
│   │   ├── data-table.tsx                  # 読み取り専用テーブル
│   │   ├── file-upload.tsx                 # ファイルアップロード
│   │   ├── company-search-combobox.tsx     # 企業検索コンボボックス
│   │   ├── contract-add-modal.tsx          # 契約書追加モーダル
│   │   ├── master-contract-modal.tsx       # 契約書管理モーダル
│   │   ├── text-preview-cell.tsx           # テキストプレビューセル
│   │   └── stage-management/               # ステージ管理モーダル
│   │
│   ├── lib/
│   │   ├── prisma.ts
│   │   ├── utils.ts
│   │   ├── auth/                           # 認証関連ユーティリティ
│   │   ├── contracts/                      # 契約書関連ユーティリティ
│   │   ├── email/                          # メール送信関連
│   │   └── stage-transition/               # ステージ遷移ロジック
│   │
│   ├── types/                              # TypeScript型定義
│   │
│   ├── auth.ts                             # NextAuth設定
│   └── middleware.ts                       # ミドルウェア（認証チェック等）
│
├── docs/
│   ├── REQUIREMENTS.md
│   ├── SETUP.md
│   ├── DATABASE.md
│   ├── architecture.md                     # このファイル
│   ├── business-logic.md
│   ├── components/
│   │   ├── crud-table.md
│   │   └── inline-edit.md
│   ├── troubleshooting.md
│   └── master-data.md
└── CLAUDE.md
```

---

## 画面一覧

```
/                                        → ダッシュボード

# 全顧客マスタ
/companies                               → 全顧客一覧
/companies/new                           → 全顧客新規登録
/companies/[id]                          → 全顧客詳細
/companies/[id]/edit                     → 全顧客編集

# STPプロジェクト - ダッシュボード
/stp/dashboard                           → STPダッシュボード

# STPプロジェクト - 企業管理
/stp/companies                           → STP企業一覧（ステージ管理ボタン付き）
/stp/companies/[id]/kpi                  → 運用KPIシート管理
/stp/contracts                           → STP契約管理
/stp/lead-submissions                    → リード獲得フォーム回答一覧

# STPプロジェクト - 代理店・求職者管理
/stp/agents                              → 代理店一覧
/stp/candidates                          → 求職者（候補者）一覧

# STPプロジェクト - 履歴管理
/stp/records/company-contacts            → 企業接触履歴一覧
/stp/records/agent-contacts              → 代理店接触履歴一覧
/stp/records/stage-histories             → ステージ変更履歴一覧

# STPプロジェクト - マスタ管理
/stp/settings/stages                     → 商談ステージマスタ
/stp/settings/contact-methods            → 接触方法マスタ（STP専用）

# 全体設定
/settings/contact-methods                → 接触方法マスタ（全体共通）
/settings/contract-statuses              → 契約書ステータスマスタ
/settings/customer-types                 → 顧客種別マスタ
/settings/projects                       → プロジェクトマスタ
/settings/operating-companies            → 運営法人マスタ

# スタッフ管理
/staff                                   → スタッフ一覧
/staff/role-types                        → 役割種別マスタ

# 管理画面（外部ユーザー管理）
/admin/users                             → 外部ユーザー一覧
/admin/pending-users                     → 承認待ちユーザー
/admin/registration-tokens               → 登録トークン管理

# 外部ユーザー向けポータル
/portal/stp/client                       → クライアント向けポータル
/portal/stp/client/kpi                   → 運用KPIシート
/portal/stp/client/candidates            → 求職者情報（CRUD）
/portal/stp/agent                        → 代理店向けポータル

# 公開フォーム
/form/stp-lead/[token]                   → STPリード獲得フォーム

# 認証関連
/login                                   → ログイン
/register/[token]                        → 外部ユーザー登録
/forgot-password                         → パスワードリセット申請
/reset-password/[token]                  → パスワードリセット
/verify-email/[token]                    → メール認証

# その他
/s/[code]                                → 短縮URLリダイレクト
/s/kpi/[token]                           → KPIシート共有ページ（公開・時間制限付き）
```
