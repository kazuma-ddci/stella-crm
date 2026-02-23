import { Badge } from "@/components/ui/badge";

const transactionStatusLabel: Record<string, string> = {
  unconfirmed: "未確定",
  confirmed: "確定済み",
  awaiting_accounting: "経理処理待ち",
  returned: "差し戻し",
  resubmitted: "再提出",
  journalized: "仕訳済み",
  partially_paid: "一部入金",
  paid: "完了",
  hidden: "非表示",
};

const transactionStatusColor: Record<string, string> = {
  unconfirmed: "bg-gray-100 text-gray-800 border-gray-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  awaiting_accounting: "bg-purple-100 text-purple-800 border-purple-200",
  returned: "bg-red-100 text-red-800 border-red-200",
  resubmitted: "bg-yellow-100 text-yellow-800 border-yellow-200",
  journalized: "bg-cyan-100 text-cyan-800 border-cyan-200",
  partially_paid: "bg-orange-100 text-orange-800 border-orange-200",
  paid: "bg-green-100 text-green-800 border-green-200",
  hidden: "bg-gray-100 text-gray-400 border-gray-200",
};

export function TransactionStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={transactionStatusColor[status] ?? ""}
    >
      {transactionStatusLabel[status] ?? status}
    </Badge>
  );
}

export { transactionStatusLabel };
