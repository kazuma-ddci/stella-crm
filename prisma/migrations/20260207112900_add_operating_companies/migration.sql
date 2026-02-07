/*
  Warnings:

  - You are about to drop the column `address` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `bank_info` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `company_name` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `postal_code` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `registration_number` on the `master_projects` table. All the data in the column will be lost.
  - You are about to drop the column `representative_name` on the `master_projects` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "master_projects" DROP COLUMN "address",
DROP COLUMN "bank_info",
DROP COLUMN "company_name",
DROP COLUMN "phone",
DROP COLUMN "postal_code",
DROP COLUMN "registration_number",
DROP COLUMN "representative_name",
ADD COLUMN     "operating_company_id" INTEGER;

-- CreateTable
CREATE TABLE "operating_companies" (
    "id" SERIAL NOT NULL,
    "companyName" VARCHAR(200) NOT NULL,
    "registrationNumber" VARCHAR(20),
    "postalCode" VARCHAR(10),
    "address" TEXT,
    "representativeName" VARCHAR(100),
    "phone" VARCHAR(50),
    "bankInfo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_companies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operating_companies_registrationNumber_key" ON "operating_companies"("registrationNumber");

-- AddForeignKey
ALTER TABLE "master_projects" ADD CONSTRAINT "master_projects_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
