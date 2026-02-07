-- RenameTable (moved from 20260208000000)
ALTER TABLE "stp_communication_methods" RENAME TO "communication_methods";

-- AlterTable
ALTER TABLE "communication_methods" RENAME CONSTRAINT "stp_communication_methods_pkey" TO "communication_methods_pkey";

-- AlterTable
ALTER TABLE "master_staff" ADD COLUMN     "canEditMasterData" BOOLEAN NOT NULL DEFAULT false;
