/*
  Warnings:

  - You are about to drop the column `defaultPaymentTermDays` on the `operating_companies` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "operating_companies" DROP COLUMN "defaultPaymentTermDays",
ADD COLUMN     "paymentDay" INTEGER,
ADD COLUMN     "paymentMonthOffset" INTEGER;
