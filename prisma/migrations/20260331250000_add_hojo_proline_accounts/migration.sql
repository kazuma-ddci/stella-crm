-- CreateTable
CREATE TABLE "hojo_proline_accounts" (
    "id" SERIAL NOT NULL,
    "line_type" VARCHAR(30) NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "login_uid" VARCHAR(100) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hojo_proline_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hojo_proline_accounts_line_type_key" ON "hojo_proline_accounts"("line_type");
