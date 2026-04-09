-- CreateTable
CREATE TABLE "slp_as" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "proline_account_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_as_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slp_as" ADD CONSTRAINT "slp_as_proline_account_id_fkey" FOREIGN KEY ("proline_account_id") REFERENCES "slp_proline_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
