export type InvoiceGroupListItem = {
  id: number;
  counterpartyId: number;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  bankAccountId: number | null;
  bankAccountLabel: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  paymentDueDate: string | null;
  expectedPaymentDate: string | null;
  actualPaymentDate: string | null;
  subtotal: number | null;
  taxAmount: number | null;
  totalAmount: number | null;
  pdfPath: string | null;
  status: string;
  correctionType: string | null;
  originalInvoiceGroupId: number | null;
  originalInvoiceNumber: string | null;
  transactionCount: number;
  allocationItemCount: number;
  createdByName: string;
  createdAt: string;
};

export type UngroupedAllocationItem = {
  transactionId: number;
  counterpartyId: number;
  counterpartyName: string;
  expenseCategoryName: string;
  costCenterId: number;
  costCenterName: string;
  allocationRate: number;
  allocatedAmount: number;
  allocatedTaxAmount: number;
  ownerCostCenterName: string | null;
  isOwnerProject: boolean;
  periodFrom: string;
  periodTo: string;
  note: string | null;
  // 他PJの処理状況
  otherItems: { costCenterName: string; groupLabel: string | null; isProcessed: boolean }[];
};

export type UngroupedTransaction = {
  id: number;
  type: string;
  counterpartyId: number;
  counterpartyName: string;
  expenseCategoryName: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
};
