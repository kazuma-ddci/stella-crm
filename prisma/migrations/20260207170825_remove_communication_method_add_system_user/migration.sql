/*
  Warnings:

  - You are about to drop the column `communicationMethodId` on the `stp_companies` table. All the data in the column will be lost.
  - You are about to drop the `communication_methods` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stp_companies" DROP CONSTRAINT "stp_companies_communicationMethodId_fkey";

-- AlterTable
ALTER TABLE "master_staff" ADD COLUMN     "is_system_user" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "stp_companies" DROP COLUMN "communicationMethodId";

-- DropTable
DROP TABLE "communication_methods";
