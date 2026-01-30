-- CreateTable
CREATE TABLE "staff" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "loginId" VARCHAR(100),
    "passwordHash" VARCHAR(255),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_permissions" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "projectCode" VARCHAR(50) NOT NULL,
    "permissionLevel" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stella_contracts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "industryType" VARCHAR(20) NOT NULL,
    "contractPlan" VARCHAR(20) NOT NULL,
    "contractStartDate" DATE NOT NULL,
    "contractEndDate" DATE,
    "initialFee" INTEGER NOT NULL,
    "monthlyFee" INTEGER NOT NULL,
    "performanceFee" INTEGER NOT NULL,
    "salesStaffId" INTEGER,
    "operationStaffId" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stella_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "staff_loginId_key" ON "staff"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_permissions_staffId_projectCode_key" ON "staff_permissions"("staffId", "projectCode");

-- AddForeignKey
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stella_contracts" ADD CONSTRAINT "stella_contracts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stella_contracts" ADD CONSTRAINT "stella_contracts_salesStaffId_fkey" FOREIGN KEY ("salesStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stella_contracts" ADD CONSTRAINT "stella_contracts_operationStaffId_fkey" FOREIGN KEY ("operationStaffId") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
