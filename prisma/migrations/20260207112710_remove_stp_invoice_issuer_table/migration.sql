/*
  Warnings:

  - You are about to drop the column `issuerId` on the `stp_invoices` table. All the data in the column will be lost.
  - You are about to drop the `stp_invoice_issuers` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "stp_invoices" DROP CONSTRAINT "stp_invoices_issuerId_fkey";

-- AlterTable
ALTER TABLE "stp_invoices" DROP COLUMN "issuerId";

-- DropTable
DROP TABLE "stp_invoice_issuers";
