-- Add indexes used by accounting workflow, STP payment-date sync, inbound invoice
-- matching, and automation error listing. These are non-destructive and intended
-- to reduce production DB wait time under normal app traffic.

CREATE INDEX IF NOT EXISTS "stp_rev_contract_type_month_deleted_idx"
ON "stp_revenue_records"("contractHistoryId", "revenueType", "targetMonth", "deletedAt");

CREATE INDEX IF NOT EXISTS "transaction_invoice_group_idx"
ON "Transaction"("invoiceGroupId");

CREATE INDEX IF NOT EXISTS "transaction_payment_group_idx"
ON "Transaction"("paymentGroupId");

CREATE INDEX IF NOT EXISTS "transaction_stp_contract_history_idx"
ON "Transaction"("stpContractHistoryId");

CREATE INDEX IF NOT EXISTS "transaction_invoice_group_deleted_idx"
ON "Transaction"("invoiceGroupId", "deletedAt");

CREATE INDEX IF NOT EXISTS "transaction_payment_group_deleted_idx"
ON "Transaction"("paymentGroupId", "deletedAt");

CREATE INDEX IF NOT EXISTS "journal_entry_invoice_group_idx"
ON "JournalEntry"("invoiceGroupId");

CREATE INDEX IF NOT EXISTS "journal_entry_payment_group_idx"
ON "JournalEntry"("paymentGroupId");

CREATE INDEX IF NOT EXISTS "journal_entry_transaction_idx"
ON "JournalEntry"("transactionId");

CREATE INDEX IF NOT EXISTS "inbound_invoice_email_received_idx"
ON "InboundInvoice"("receivedByEmailId", "receivedAt");

CREATE INDEX IF NOT EXISTS "inbound_invoice_payment_group_idx"
ON "InboundInvoice"("paymentGroupId");

CREATE INDEX IF NOT EXISTS "inbound_invoice_status_idx"
ON "InboundInvoice"("status");

CREATE INDEX IF NOT EXISTS "automation_errors_source_created_idx"
ON "automation_errors"("source", "createdAt");

CREATE INDEX IF NOT EXISTS "automation_errors_resolved_created_idx"
ON "automation_errors"("resolved", "createdAt");
