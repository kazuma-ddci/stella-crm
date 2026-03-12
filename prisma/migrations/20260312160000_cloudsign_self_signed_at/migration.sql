-- AlterTable: MasterContract - 自社署名完了日時フィールド追加
ALTER TABLE "master_contracts" ADD COLUMN "cloudsign_self_signed_at" TIMESTAMP(3);
