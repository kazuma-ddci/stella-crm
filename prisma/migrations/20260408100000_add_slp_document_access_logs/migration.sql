-- CreateTable
CREATE TABLE "slp_document_access_logs" (
    "id" SERIAL NOT NULL,
    "uid" VARCHAR(255) NOT NULL,
    "snsname" VARCHAR(255) NOT NULL,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slp_document_access_logs_uid_idx" ON "slp_document_access_logs"("uid");

-- CreateIndex
CREATE INDEX "slp_document_access_logs_accessedAt_idx" ON "slp_document_access_logs"("accessedAt");
