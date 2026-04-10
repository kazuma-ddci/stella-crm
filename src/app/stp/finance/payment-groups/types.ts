export type PaymentGroupPaymentItem = {
  id: number;
  paidDate: string;
  amount: number;
  comment: string | null;
  createdByName: string;
  isBankLinked: boolean; // 銀行履歴由来の自動生成記録か
};

export type PaymentStatus = "none" | "partial" | "complete" | "over";

export type ManualPaymentStatus = "unpaid" | "partial" | "completed";

export type PaymentGroupListItem = {
  id: number;
  referenceCode: string | null;
  counterpartyId: number | null;
  counterpartyName: string;
  operatingCompanyId: number;
  operatingCompanyName: string;
  targetMonth: string | null;
  expectedPaymentDate: string | null;
  paymentDueDate: string | null;
  actualPaymentDate: string | null;
  totalAmount: number | null;
  taxAmount: number | null;
  receivedPdfPath: string | null;
  receivedPdfFileName: string | null;
  paymentType: "invoice" | "direct"; // direct は旧データ後方互換用
  isConfidential: boolean;
  status: string;
  confirmedByName: string | null;
  confirmedAt: string | null;
  transactionCount: number;
  allocationItemCount: number;
  expectedInboundEmail: { email: string } | null;
  createdByName: string;
  createdAt: string;
  // 経理側で記録された支払履歴（複数行可）
  payments: PaymentGroupPaymentItem[];
  paymentStatus: PaymentStatus;
  paymentTotal: number;
  // 経理が手動で切り替える支払完了フラグ
  manualPaymentStatus: ManualPaymentStatus;
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
  status: "confirmed" | "unconfirmed";
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
  isConfidential: boolean;
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
