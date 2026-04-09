-- CreateTable
CREATE TABLE "slp_documents" (
    "id" SERIAL NOT NULL,
    "fileName" VARCHAR(255) NOT NULL,
    "filePath" VARCHAR(500) NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "uploadedById" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "slp_documents_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slp_documents" ADD CONSTRAINT "slp_documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
