-- AlterTable
ALTER TABLE "operating_company_bank_accounts" ADD COLUMN     "paymentMethodId" INTEGER;

-- AddForeignKey
ALTER TABLE "operating_company_bank_accounts" ADD CONSTRAINT "operating_company_bank_accounts_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
