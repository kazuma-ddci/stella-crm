/*
  Warnings:

  - You are about to drop the column `closingDay` on the `stp_companies` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueDays` on the `stp_companies` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueFixedDay` on the `stp_companies` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueType` on the `stp_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "master_stella_companies" ADD COLUMN     "closingDay" INTEGER,
ADD COLUMN     "paymentDueDays" INTEGER,
ADD COLUMN     "paymentDueFixedDay" INTEGER,
ADD COLUMN     "paymentDueType" VARCHAR(20);

-- AlterTable
ALTER TABLE "stp_companies" DROP COLUMN "closingDay",
DROP COLUMN "paymentDueDays",
DROP COLUMN "paymentDueFixedDay",
DROP COLUMN "paymentDueType";
