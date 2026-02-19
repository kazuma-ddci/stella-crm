-- AlterTable
ALTER TABLE "stp_proposals" ADD COLUMN     "slideVersion" INTEGER,
ADD COLUMN     "sourceProposalId" INTEGER;

-- CreateIndex
CREATE INDEX "stp_proposals_sourceProposalId_idx" ON "stp_proposals"("sourceProposalId");

-- AddForeignKey
ALTER TABLE "stp_proposals" ADD CONSTRAINT "stp_proposals_sourceProposalId_fkey" FOREIGN KEY ("sourceProposalId") REFERENCES "stp_proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
