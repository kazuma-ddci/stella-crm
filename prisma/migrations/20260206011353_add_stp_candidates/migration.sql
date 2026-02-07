-- CreateTable
CREATE TABLE "stp_candidates" (
    "id" SERIAL NOT NULL,
    "lastName" VARCHAR(50) NOT NULL,
    "firstName" VARCHAR(50) NOT NULL,
    "interviewDate" DATE,
    "interviewAttendance" VARCHAR(20),
    "selectionStatus" VARCHAR(20),
    "offerDate" DATE,
    "joinDate" DATE,
    "note" TEXT,
    "stpCompanyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stp_candidates_stpCompanyId_idx" ON "stp_candidates"("stpCompanyId");

-- AddForeignKey
ALTER TABLE "stp_candidates" ADD CONSTRAINT "stp_candidates_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
