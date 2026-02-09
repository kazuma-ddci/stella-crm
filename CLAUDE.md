# CLAUDE.md - CRMシステム開発ガイド

このファイルはCursor/Claude Codeがプロジェクトを理解するためのガイドです。

> **⚠️ 実装前の必須確認**
>
> 1. このファイルの「確定仕様（変更禁止）」セクションを確認
> 2. 実装内容に応じて、関連するドキュメントを読む（無関係なものは読まない）

## プロジェクト概要

社内CRMシステム - 複数プロジェクトを横断して顧客を一元管理

### プロジェクト構成

| プロジェクト | パス | 説明 |
|-------------|------|------|
| Stella（全顧客マスタ） | `/companies` | 全顧客の基本情報管理 |
| STP（採用ブースト） | `/stp/*` | 採用支援サービスの商談・契約管理 |
| 外部ポータル | `/portal/*` | クライアント・代理店向けポータル |
| 管理画面 | `/admin/*` | 外部ユーザー管理・登録トークン管理 |

## 技術スタック

- Next.js 16+ (App Router, TypeScript)
- PostgreSQL 15
- Prisma ORM
- Tailwind CSS + shadcn/ui
- NextAuth.js（認証）
- Docker / Docker Compose

## 開発環境

```bash
# 起動
docker-compose up -d

# 停止
docker-compose down

# マイグレーション
docker-compose exec app npx prisma migrate dev --name <name>

# シードデータ
docker-compose exec app npx prisma db seed
```

- http://localhost:3000 - アプリケーション
- http://localhost:5555 - Prisma Studio（DB確認用）

## VPSデプロイ手順

VPS（本番・ステージング）はDockerで運用。`docker-entrypoint.sh` が起動時に `prisma generate` + `prisma migrate deploy` を自動実行するため、マイグレーションは手動不要。

> **⚠️ `docker-compose`（v1）ではなく `docker compose`（v2）を使うこと**
>
> VPSの `docker-compose` v1（1.29.2）はDockerエンジンとの互換性問題で `ContainerConfig` エラーが発生する。
> 必ず `docker compose`（ハイフンなし、v2）を使用すること。

### デプロイ手順

```bash
# VPSにSSH接続後
cd ~/stella-crm

# 最新コードを取得（mainブランチ）
git checkout main
git pull origin main

# ステージング再ビルド＆起動
docker compose -f docker-compose.stg.yml up -d --build

# 本番再ビルド＆起動
docker compose -f docker-compose.prod.yml up -d --build

# 起動確認
docker logs stella-stg-app 2>&1 | head -10
docker logs stella-prod-app 2>&1 | head -10
```

### 環境構成

| 環境 | Composeファイル | コンテナ名 | ポート | env |
|------|----------------|-----------|--------|-----|
| ステージング | `docker-compose.stg.yml` | `stella-stg-app` / `stella-stg-db` | 4000 | `.env.stg` |
| 本番 | `docker-compose.prod.yml` | `stella-prod-app` / `stella-prod-db` | 4001 | `.env.prod` |

---

## Claude Code 実装ルール（必須）

このプロジェクトはDocker環境で開発しています。**ローカルではなくDockerコンテナ内でコマンドを実行すること。**

### 実装前の確認事項

**実装内容に関連するドキュメントを読む（複数あれば複数読む、無関係なものは読まない）：**

| 実装内容 | 読むドキュメント |
|---------|-----------------|
| インライン編集 | `docs/components/inline-edit.md` **（⚠️必読・過去ミス多発）** |
| テーブル表示 | `docs/components/crud-table.md` |
| ステージ・認証 | `docs/business-logic.md` |
| DB変更 | `docs/DATABASE.md` |
| UI/モーダル問題 | `docs/troubleshooting.md` |
| 選択肢 | `docs/master-data.md` |

**例**: 「インライン編集でDBカラムも追加」→ inline-edit.md + DATABASE.md の両方を読む

**注意**: インライン編集は過去に何度も同じミスが発生。必ずドキュメントを読んでから実装すること。

### 実装完了時のまとめ出力（必須）

実装が完了したら、**必ず日本語で何をやったかのまとめを出力すること。**

出力内容：
- 変更したファイルと変更内容
- 追加・修正した機能の概要
- 注意点や補足事項（あれば）

### 実装後の記録

重要な決定、エラー修正、仕様確定があった場合は `/record` で記録する。

### npmパッケージ追加時

```bash
docker-compose exec app npm install <パッケージ名>
```

**ローカルで `npm install` を実行しても、Dockerコンテナには反映されません。**

### Prismaスキーマ変更時

```bash
# Prisma Client再生成（必須）
docker-compose exec app npx prisma generate

# マイグレーション作成（新しいテーブル/カラム追加時）
docker-compose exec app npx prisma migrate dev --name <変更内容>
```

> **⚠️ `prisma db push` は使用禁止**
>
> `prisma db push` はマイグレーションファイルを生成しないため、`migrate reset` が壊れる原因になる。
> スキーマ変更時は必ず `prisma migrate dev` を使うこと。

### shadcn/uiコンポーネント追加時

```bash
docker-compose exec app npx shadcn@latest add <コンポーネント名>
```

### 変更が反映されない場合

```bash
docker-compose restart app
```

### ドキュメント追記ルール（重要）

実装完了後にドキュメントを追記する際は、**関連する全ての重要ポイントを最初から網羅的に含めること。**

**❌ やってはいけないこと：**
- 基本的な内容だけ書いて、ユーザーに「これは追加した？」と何度も確認させる
- 指摘されてから追記する（後出し）

**✅ やるべきこと：**
- 実装中に起きた問題・ミス・修正内容を**全て**記載する
- 具体的なコード例（❌間違い例と✅正しい例の両方）を含める
- 「なぜその実装が必要か」の理由を含める

### 日付入力フィールドの実装

日付入力フィールドは、HTMLの`<input type="date">`ではなく、**react-datepicker**を使用すること。

```tsx
import DatePicker, { registerLocale } from "react-datepicker";
import { ja } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { toLocalDateString } from "@/lib/utils";

registerLocale("ja", ja);

<DatePicker
  selected={value ? new Date(value) : null}
  onChange={(date) => setValue(date ? toLocalDateString(date) : null)}
  dateFormat="yyyy/MM/dd"
  locale="ja"
  placeholderText="日付を選択"
  isClearable
/>
```

> **⚠️ `toISOString()` を日付変換に使用しない**
>
> `date.toISOString()` はUTC変換するため、JST(UTC+9)では日付が1日ずれる。
> 日付型(date)のフィールドには必ず `toLocalDateString(date)` を使うこと。
> datetime型のフィールドのみ `toISOString()` を使用してよい。

### Playwrightのスクリーンショット保存

Playwright MCPツールでスクリーンショットを撮る際は、**必ず `playwright/screenshots/` ディレクトリに保存すること。**

```typescript
// ✅ 正しい例
await mcp__playwright__browser_take_screenshot({
  filename: "playwright/screenshots/feature-name.png",
  type: "png"
});

// ❌ 間違い例（ルートディレクトリに保存される）
await mcp__playwright__browser_take_screenshot({
  filename: "screenshot.png",
  type: "png"
});
```

**保存先ルール:**
- スクリーンショット: `playwright/screenshots/`
- テスト結果: `playwright/test-results/`
- これらのファイルは `.gitignore` に含まれており、Gitにコミットされません

---

## 確定仕様（変更禁止）

> **📍 単一情報源（Source of Truth）**
>
> 確定仕様の詳細は **[docs/specs/](docs/specs/index.md)** を参照してください。
> このセクションは参照用サマリーです。

以下の仕様はユーザー承認済みの確定仕様です。**ユーザーから明示的な変更要望がない限り、勝手に変更しないでください。**

| SPEC ID | タイトル | 概要 |
|---------|----------|------|
| [SPEC-STP-001](docs/specs/SPEC-STP-001.md) | 顧問の区分表示形式 | `顧問（件数 / 金額）` 形式で統一 |
| [SPEC-STP-002](docs/specs/SPEC-STP-002.md) | ヒアリングフォーム職種連動 | ページ1→2自動反映・必須・読み取り専用 |
| [SPEC-UI-001](docs/specs/SPEC-UI-001.md) | Textarea/モーダル長文編集 | 高さ制限とスクロール設定 |
| [SPEC-UI-002](docs/specs/SPEC-UI-002.md) | 企業選択UI/UXパターン | ラベル形式・検索可能Combobox・displayToEditMapping |

<!--
  旧記載は docs/specs/SPEC-STP-001.md に移行済み。
  詳細は上記の一覧リンクから参照してください。
-->

---

## カスタムコマンド

このプロジェクト専用のコマンドが利用可能です。

### /quick - 通常実装モード

最小限の調査で実装へ進みます（重大変更時は確認あり）。
Playwrightは原則実行しないが、UI変更が大きい場合は提案する。

```
/quick                     # 通常モードに切り替え
```

### /deep - 厳密実装モード

調査 → 計画 → 承認 → 実装の順で進めます。

```
/deep                      # 厳密モード開始（要望入力を待つ）
/deep ステージ表示を変更したい  # 厳密モードで即座に調査開始
```

**厳密モードのフロー:**
1. 要望を分解
2. 影響ファイル候補を列挙（理由つき）
3. 候補ファイルごとに確定仕様チェック
4. 関連SPECと禁止事項を整理
5. 実装計画を提示
6. E2E実行判定（必要/不要と理由・確認観点を提示）
7. **承認待ち**
8. **ユーザー承認後に実装**
9. `docker-compose exec app npm run test:specs` 実行
10. Playwright実行（判定が「必要」の場合のみ）
11. 最終報告（テスト結果 + Playwright実行/未実行と理由）
12. `/record --dry-run` を提案

### /record - 決定事項の記録

実装中の重要な決定やエラー修正を適切なドキュメントに記録します。

```
/record                    # 直前の会話から記録内容を提案
/record 確定仕様: ○○の表示形式は△△で統一  # 指定内容を記録
```

### /check-specs - 確定仕様の確認

ファイルや機能に関連する確定仕様を確認します。**変更前に必ず確認すること。**

```
/check-specs src/app/stp/agents/agents-table.tsx  # ファイル関連の仕様確認
/check-specs 顧問表示                               # 機能関連の仕様確認
/check-specs                                        # 全確定仕様の一覧
```

### 使い分けガイド

| 状況 | 使うコマンド |
|------|-------------|
| 普通の開発 | `/quick` |
| 確定仕様に関わりそうな変更 | `/deep` → 要望入力 → 計画確認 → 承認 → 実装 |
| セッション終了前 | `/record`（必要なら「セッション全体を対象に」と明示）|

---

## 参照ドキュメント

詳細情報は以下のドキュメントを参照してください：

| ドキュメント | 内容 |
|-------------|------|
| **`docs/specs/index.md`** | **確定仕様一覧（Source of Truth）** |
| `docs/DATABASE.md` | データベース設計詳細（テーブル一覧、ER図、カラム定義） |
| `docs/architecture.md` | ディレクトリ構成、画面一覧 |
| `docs/business-logic.md` | ステージ遷移ロジック、認証フロー、設計パターン |
| `docs/components/crud-table.md` | CrudTable使用方法 |
| `docs/components/inline-edit.md` | **インライン編集詳細（⚠️実装前に必読）** |
| `docs/troubleshooting.md` | 既知の問題と解決方法 |
| `docs/master-data.md` | 初期データ、選択肢定義 |
| `docs/REQUIREMENTS.md` | 詳細な要件定義 |
| `docs/SETUP.md` | セットアップ手順 |
| `prisma/schema.prisma` | DBスキーマ |
