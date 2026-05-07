ALTER TABLE "InvoiceGroup"
  ADD COLUMN "return_request_status" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "return_request_reason" TEXT,
  ADD COLUMN "return_requested_at" TIMESTAMP(3),
  ADD COLUMN "return_requested_by" INTEGER,
  ADD COLUMN "return_request_handled_at" TIMESTAMP(3),
  ADD COLUMN "return_request_handled_by" INTEGER;

ALTER TABLE "PaymentGroup"
  ADD COLUMN "return_request_status" TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN "return_request_reason" TEXT,
  ADD COLUMN "return_requested_at" TIMESTAMP(3),
  ADD COLUMN "return_requested_by" INTEGER,
  ADD COLUMN "return_request_handled_at" TIMESTAMP(3),
  ADD COLUMN "return_request_handled_by" INTEGER;
