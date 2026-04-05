-- CreateTable
CREATE TABLE "hojo_lender_accounts" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'pending_approval',
    "must_change_password" BOOLEAN NOT NULL DEFAULT false,
    "password_reset_requested_at" TIMESTAMP(3),
    "approved_at" TIMESTAMP(3),
    "approved_by" INTEGER,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_lender_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hojo_lender_accounts_email_key" ON "hojo_lender_accounts"("email");

-- AddForeignKey
ALTER TABLE "hojo_lender_accounts" ADD CONSTRAINT "hojo_lender_accounts_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
