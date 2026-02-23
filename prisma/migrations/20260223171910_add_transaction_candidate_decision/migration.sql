-- CreateTable
CREATE TABLE "TransactionCandidateDecision" (
    "id" SERIAL NOT NULL,
    "candidateKey" VARCHAR(200) NOT NULL,
    "targetMonth" VARCHAR(7) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reasonType" VARCHAR(50),
    "memo" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "sourceFingerprint" TEXT,
    "overrideAmount" INTEGER,
    "overrideTaxAmount" INTEGER,
    "overrideTaxRate" INTEGER,
    "overrideMemo" TEXT,
    "overrideScheduledPaymentDate" DATE,
    "decidedBy" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TransactionCandidateDecision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionCandidateDecision_candidateKey_targetMonth_key" ON "TransactionCandidateDecision"("candidateKey", "targetMonth");

-- AddForeignKey
ALTER TABLE "TransactionCandidateDecision" ADD CONSTRAINT "TransactionCandidateDecision_decidedBy_fkey" FOREIGN KEY ("decidedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
