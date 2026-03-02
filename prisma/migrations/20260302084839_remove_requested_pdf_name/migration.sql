/*
  Warnings:

  - You are about to drop the column `requestedPdfName` on the `PaymentGroup` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "PaymentGroup" DROP COLUMN "requestedPdfName";
