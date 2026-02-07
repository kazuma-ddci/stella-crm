/*
  Warnings:

  - You are about to drop the column `paymentDueDays` on the `master_stella_companies` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueFixedDay` on the `master_stella_companies` table. All the data in the column will be lost.
  - You are about to drop the column `paymentDueType` on the `master_stella_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "master_stella_companies" DROP COLUMN "paymentDueDays",
DROP COLUMN "paymentDueFixedDay",
DROP COLUMN "paymentDueType",
ADD COLUMN     "paymentDay" INTEGER,
ADD COLUMN     "paymentMonthOffset" INTEGER;
