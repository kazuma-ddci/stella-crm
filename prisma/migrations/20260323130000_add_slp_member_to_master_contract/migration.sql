-- MasterContract: companyIdをNULL許容に変更（SLPは企業なし）
ALTER TABLE "master_contracts" ALTER COLUMN "company_id" DROP NOT NULL;

-- MasterContract: slpMemberId FK追加
ALTER TABLE "master_contracts" ADD COLUMN "slp_member_id" INTEGER;
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_slp_member_id_fkey"
  FOREIGN KEY ("slp_member_id") REFERENCES "slp_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "idx_master_contracts_slp_member_id" ON "master_contracts"("slp_member_id");

-- 既存SLPメンバーの契約書データをMasterContractに移行
INSERT INTO master_contracts (
  "company_id",
  "slp_member_id",
  "project_id",
  "contract_type",
  "title",
  "cloudsign_document_id",
  "cloudsign_url",
  "cloudsign_status",
  "cloudsign_auto_sync",
  "signing_method",
  "cloudsign_sent_at",
  "cloudsign_completed_at",
  "signed_date",
  "current_status_id",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  NULL,
  sm.id,
  3,  -- SLPプロジェクトID
  '組合員契約書',
  '組合員契約書（' || sm.name || '）',
  sm."documentId",
  sm."cloudsignUrl",
  CASE sm.status
    WHEN '組合員契約書締結' THEN 'completed'
    WHEN '契約書送付済'     THEN 'sent'
    WHEN '契約破棄'         THEN 'canceled_by_recipient'
    ELSE 'sent'
  END,
  true,
  'cloudsign',
  sm."contractSentDate",
  CASE WHEN sm.status = '組合員契約書締結' THEN sm."contractSignedDate" ELSE NULL END,
  sm."contractSignedDate",
  CASE sm.status
    WHEN '組合員契約書締結' THEN 7   -- 締結済みステータスID
    WHEN '契約書送付済'     THEN 6   -- 送付済みステータスID
    WHEN '契約破棄'         THEN 10  -- 先方破棄ステータスID
    ELSE 6
  END,
  CASE WHEN sm.status = '組合員契約書締結' THEN true ELSE false END,
  sm."createdAt",
  sm."updatedAt"
FROM slp_members sm
WHERE sm."documentId" IS NOT NULL
  AND sm."deletedAt" IS NULL;
