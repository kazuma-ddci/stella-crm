-- AlterTable
ALTER TABLE "password_reset_tokens" ADD COLUMN     "staffId" INTEGER,
ALTER COLUMN "externalUserId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
