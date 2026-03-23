-- CreateTable
CREATE TABLE "stp_products" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_products_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "stp_companies" ADD COLUMN "has_deal" VARCHAR(10);
ALTER TABLE "stp_companies" ADD COLUMN "proposed_product_ids" VARCHAR(500);
