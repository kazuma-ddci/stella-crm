-- AlterTable
ALTER TABLE "master_staff" ADD COLUMN     "organization_role" VARCHAR(20) NOT NULL DEFAULT 'member';

-- CreateTable
CREATE TABLE "staff_sidebar_preferences" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "hiddenItems" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_sidebar_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_sidebar_preferences_staffId_key" ON "staff_sidebar_preferences"("staffId");

-- AddForeignKey
ALTER TABLE "staff_sidebar_preferences" ADD CONSTRAINT "staff_sidebar_preferences_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
