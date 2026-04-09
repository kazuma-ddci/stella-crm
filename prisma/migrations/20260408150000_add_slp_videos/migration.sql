-- CreateTable
CREATE TABLE "slp_videos" (
    "id" SERIAL NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "slp_videos_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slp_videos" ADD CONSTRAINT "slp_videos_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: アクセスログにリソース種別カラム追加（既存行はdocumentとして扱う）
ALTER TABLE "slp_document_access_logs" ADD COLUMN "resourceType" VARCHAR(20) NOT NULL DEFAULT 'document';

-- CreateIndex
CREATE INDEX "slp_document_access_logs_resourceType_idx" ON "slp_document_access_logs"("resourceType");
