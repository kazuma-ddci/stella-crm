export type PaymentGroupListItem = {
  id: number;
  counterpartyId: number;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  targetMonth: string | null;
  expectedPaymentDate: string | null;
  paymentDueDate: string | null;
  actualPaymentDate: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  requestedPdfName: string | null;
  receivedPdfPath: string | null;
  receivedPdfFileName: string | null;
  status: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
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
  otherItems: { costCenterName: string; groupLabel: string | null; isProcessed: boolean }[];
};

export type UngroupedExpenseTransaction = {
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

export type PaymentGroupTransaction = {
  id: number;
  expenseCategoryName: string;
  amount: number;
  taxAmount: number;
  taxRate: number;
  taxType: string;
  periodFrom: string;
  periodTo: string;
  note: string | null;
};
