-- MasterStellaCompany: インボイス制度対応
ALTER TABLE "master_stella_companies" ADD COLUMN "isInvoiceRegistered" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "master_stella_companies" ADD COLUMN "invoiceRegistrationNumber" VARCHAR(20);
