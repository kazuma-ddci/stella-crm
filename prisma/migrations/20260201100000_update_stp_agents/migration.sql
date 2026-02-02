-- DropIndex
DROP INDEX IF EXISTS "stp_agents_agentCode_key";

-- AlterTable: Drop old columns and add new columns to stp_agents
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "agentCode";
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "name";
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "contactPerson";
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "email";
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "stp_agents" DROP COLUMN IF EXISTS "isActive";

-- Add new columns to stp_agents
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "companyId" INTEGER NOT NULL;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) NOT NULL;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "category1" VARCHAR(20) NOT NULL;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "category2" VARCHAR(20) NOT NULL;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "meetingDate" DATE;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "contractStatus" VARCHAR(20);
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "contractNote" TEXT;
ALTER TABLE "stp_agents" ADD COLUMN IF NOT EXISTS "referrerCompanyId" INTEGER;

-- CreateTable: stp_agent_contracts
CREATE TABLE IF NOT EXISTS "stp_agent_contracts" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "contractUrl" TEXT NOT NULL,
    "signedDate" DATE,
    "title" VARCHAR(200),
    "externalId" VARCHAR(100),
    "externalService" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'signed',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agent_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable: stp_agent_staff
CREATE TABLE IF NOT EXISTS "stp_agent_staff" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_agent_staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stp_agents_companyId_key" ON "stp_agents"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "stp_agent_staff_agentId_staffId_key" ON "stp_agent_staff"("agentId", "staffId");

-- AddForeignKey
ALTER TABLE "stp_agents" ADD CONSTRAINT "stp_agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agents" ADD CONSTRAINT "stp_agents_referrerCompanyId_fkey" FOREIGN KEY ("referrerCompanyId") REFERENCES "master_stella_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_contracts" ADD CONSTRAINT "stp_agent_contracts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_staff" ADD CONSTRAINT "stp_agent_staff_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_staff" ADD CONSTRAINT "stp_agent_staff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
