-- CreateTable: ベンダー（補助金）
CREATE TABLE "hojo_vendors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ステータス（補助金申請）
CREATE TABLE "hojo_application_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_application_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable: 申請サポートセンター用管理
CREATE TABLE "hojo_application_supports" (
    "id" SERIAL NOT NULL,
    "lineFriendId" INTEGER NOT NULL,
    "vendorId" INTEGER,
    "statusId" INTEGER,
    "applicantName" VARCHAR(200),
    "detailMemo" TEXT,
    "formAnswerDate" TIMESTAMP(3),
    "formTranscriptDate" TIMESTAMP(3),
    "applicationFormDate" TIMESTAMP(3),
    "documentStorageUrl" VARCHAR(2000),
    "paymentReceivedDate" TIMESTAMP(3),
    "paymentReceivedAmount" INTEGER,
    "bbsTransferAmount" INTEGER,
    "bbsTransferDate" TIMESTAMP(3),
    "subsidyReceivedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hojo_application_supports_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "hojo_application_supports" ADD CONSTRAINT "hojo_application_supports_lineFriendId_fkey" FOREIGN KEY ("lineFriendId") REFERENCES "hojo_line_friends_shinsei_support"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_application_supports" ADD CONSTRAINT "hojo_application_supports_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "hojo_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hojo_application_supports" ADD CONSTRAINT "hojo_application_supports_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "hojo_application_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
