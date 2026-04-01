-- CreateTable
CREATE TABLE "slp_proline_accounts" (
    "id" SERIAL NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL DEFAULT '',
    "password" VARCHAR(255) NOT NULL DEFAULT '',
    "login_url" VARCHAR(500),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_proline_accounts_pkey" PRIMARY KEY ("id")
);

-- Insert default account
INSERT INTO "slp_proline_accounts" ("label", "email", "password", "updated_at")
VALUES ('公的制度教育推進協会', '', '', CURRENT_TIMESTAMP);
