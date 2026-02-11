/*
  Warnings:

  - Made the column `stpCompanyId` on table `stp_candidates` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "stp_candidates" DROP CONSTRAINT "stp_candidates_stpCompanyId_fkey";

-- AlterTable
ALTER TABLE "stp_candidates" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "sendDate" DATE,
ALTER COLUMN "stpCompanyId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "stp_candidates" ADD CONSTRAINT "stp_candidates_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
