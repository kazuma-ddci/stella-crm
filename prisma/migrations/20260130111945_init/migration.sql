-- CreateTable
CREATE TABLE "master_stella_companies" (
    "id" SERIAL NOT NULL,
    "companyCode" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contactPerson" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_stella_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_agents" (
    "id" SERIAL NOT NULL,
    "agentCode" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "contactPerson" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_stages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_contact_methods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "displayOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_contact_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_companies" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "note" TEXT,
    "leadAcquiredDate" DATE,
    "meetingDate" DATE,
    "currentStageId" INTEGER,
    "nextTargetStageId" INTEGER,
    "nextTargetDate" DATE,
    "agentId" INTEGER,
    "assignedTo" VARCHAR(100),
    "priority" VARCHAR(10),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_contact_histories" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER,
    "agentId" INTEGER,
    "contactDate" TIMESTAMP(3) NOT NULL,
    "contactMethodId" INTEGER,
    "assignedTo" VARCHAR(100),
    "meetingMinutes" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_contact_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_stage_histories" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "eventType" VARCHAR(20) NOT NULL,
    "fromStageId" INTEGER,
    "toStageId" INTEGER,
    "targetDate" DATE,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" VARCHAR(100),
    "note" TEXT,

    CONSTRAINT "stp_stage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_stella_companies_companyCode_key" ON "master_stella_companies"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "stp_agents_agentCode_key" ON "stp_agents"("agentCode");

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_nextTargetStageId_fkey" FOREIGN KEY ("nextTargetStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contact_histories" ADD CONSTRAINT "stp_contact_histories_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contact_histories" ADD CONSTRAINT "stp_contact_histories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contact_histories" ADD CONSTRAINT "stp_contact_histories_contactMethodId_fkey" FOREIGN KEY ("contactMethodId") REFERENCES "stp_contact_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
