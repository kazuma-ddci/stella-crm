export const TRANSACTION_LOG_FIELDS = [
  "type",
  "counterpartyId",
  "expenseCategoryId",
  "amount",
  "taxAmount",
  "taxRate",
  "taxType",
  "periodFrom",
  "periodTo",
  "allocationTemplateId",
  "costCenterId",
  "contractId",
  "projectId",
  "paymentMethodId",
  "paymentDueDate",
  "note",
  "status",
  "isWithholdingTarget",
  "withholdingTaxRate",
  "withholdingTaxAmount",
  "netPaymentAmount",
] as const;

export const CANDIDATE_DECISION_LOG_FIELDS = [
  "status",
  "reasonType",
  "memo",
  "needsReview",
  "overrideAmount",
  "overrideTaxAmount",
  "overrideTaxRate",
  "overrideMemo",
  "overrideScheduledPaymentDate",
] as const;

export const JOURNAL_ENTRY_LOG_FIELDS = [
  "journalDate",
  "description",
  "status",
  "transactionId",
  "invoiceGroupId",
  "paymentGroupId",
] as const;
