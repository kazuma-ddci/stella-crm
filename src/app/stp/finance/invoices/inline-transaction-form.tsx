"use client";

import { InlineTransactionForm as BaseInlineTransactionForm } from "@/components/inline-transaction-form";

type Props = {
  onClose: () => void;
  onCreated: (transactionId: number) => void | Promise<void>;
  counterpartyId: number;
  projectId?: number;
  expenseCategories: { id: number; name: string; type: string }[];
};

export function InlineTransactionForm(props: Props) {
  return <BaseInlineTransactionForm {...props} transactionType="revenue" />;
}
