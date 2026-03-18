-- CreateTable
CREATE TABLE "slp_members" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "status" VARCHAR(50),
    "contractSentDate" DATE,
    "contractSignedDate" DATE,
    "position" VARCHAR(100),
    "company" VARCHAR(200),
    "memberCategory" VARCHAR(50),
    "lineName" VARCHAR(100),
    "uid" VARCHAR(100) NOT NULL,
    "phone" VARCHAR(50),
    "address" TEXT,
    "referrerUid" VARCHAR(100),
    "note" TEXT,
    "memo" TEXT,
    "documentId" VARCHAR(255),
    "cloudsignUrl" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "slp_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_members_uid_key" ON "slp_members"("uid");

-- CreateIndex
CREATE INDEX "slp_members_referrerUid_idx" ON "slp_members"("referrerUid");

-- AddForeignKey
ALTER TABLE "slp_members" ADD CONSTRAINT "slp_members_referrerUid_fkey" FOREIGN KEY ("referrerUid") REFERENCES "slp_members"("uid") ON DELETE SET NULL ON UPDATE CASCADE;
