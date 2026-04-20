-- ============================================
-- HOJO 接触履歴 v2: BBS/貸金業社はアカウント紐付けを廃止し、顧客種別タグで分類
-- + 接触種別マスタ seed（定例・キックオフ・商談）
-- + 事業計画書プロンプトテーブル新設
-- ============================================

-- ============================================
-- 1. HojoContactHistory から bbs_account_id / lender_account_id を削除
-- ============================================
ALTER TABLE "hojo_contact_histories"
  DROP CONSTRAINT IF EXISTS "hojo_contact_histories_bbs_account_id_fkey";
ALTER TABLE "hojo_contact_histories"
  DROP CONSTRAINT IF EXISTS "hojo_contact_histories_lender_account_id_fkey";

DROP INDEX IF EXISTS "hojo_contact_histories_bbs_account_id_deleted_at_idx";
DROP INDEX IF EXISTS "hojo_contact_histories_lender_account_id_deleted_at_idx";

ALTER TABLE "hojo_contact_histories" DROP COLUMN IF EXISTS "bbs_account_id";
ALTER TABLE "hojo_contact_histories" DROP COLUMN IF EXISTS "lender_account_id";

-- ============================================
-- 2. 接触種別マスタ（HOJO用）に初期データを投入
-- ============================================
INSERT INTO "contact_categories" ("project_id", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", '定例', 1, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

INSERT INTO "contact_categories" ("project_id", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", 'キックオフ', 2, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

INSERT INTO "contact_categories" ("project_id", "name", "display_order", "is_active", "created_at", "updated_at")
SELECT mp."id", '商談', 3, TRUE, NOW(), NOW()
FROM "master_projects" mp WHERE mp."code" = 'hojo'
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. HojoBusinessPlanPrompt テーブル作成
-- ============================================
CREATE TABLE "hojo_business_plan_prompts" (
  "id"                  SERIAL         NOT NULL,
  "prompt_body"         TEXT           NOT NULL,
  "model"               VARCHAR(80)    NOT NULL DEFAULT 'claude-sonnet-4-6',
  "max_tokens"          INTEGER        NOT NULL DEFAULT 32000,
  "updated_by_staff_id" INTEGER,
  "created_at"          TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3)   NOT NULL,
  CONSTRAINT "hojo_business_plan_prompts_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "hojo_business_plan_prompts"
  ADD CONSTRAINT "hojo_business_plan_prompts_updated_by_staff_id_fkey"
  FOREIGN KEY ("updated_by_staff_id") REFERENCES "master_staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- デフォルトプロンプトを投入（id=1 固定）
INSERT INTO "hojo_business_plan_prompts" ("prompt_body", "model", "max_tokens", "created_at", "updated_at")
VALUES (
'あなたは日本の中小企業向け事業計画書の作成専門家です。
以下のルールに従い、事業計画書を「申請者の記入内容」に基づいて執筆してください。

## 出力フォーマット
厳密に以下の JSON のみを出力してください。前後に説明文や ``` のコードフェンスを付けないこと。

{
  "sections": {
    "executiveSummary": "本文…",
    "companyProfile": "本文…",
    ... 以下20セクション全て
  }
}

## 執筆ルール
- 全セクションの合計で日本語15〜20ページ相当（約 {{totalChars}} 字前後）を目指す。
- 各セクションの目安字数を大きく下回らない／上回らないこと。
- 申請者の記入内容を尊重し、誇張や虚偽は書かない。記入不足の箇所は一般論で自然に補う。
- です・ます調の丁寧な文語体。見出しは付けず本文のみ。段落で論理構造を示す。
- 数字・固有名詞は申請者情報をそのまま使う。
- ビジネス的に前向きで、審査者が納得しやすい論拠と流れを意識する。

## セクション定義
{{sectionSpec}}

## 出力の JSON キー
セクション key は上記の20個。漏れや追加は禁止。',
  'claude-sonnet-4-6',
  32000,
  NOW(),
  NOW()
)
ON CONFLICT DO NOTHING;
