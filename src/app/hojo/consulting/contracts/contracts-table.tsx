"use client";

import Link from "next/link";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

type ContractRow = {
  id: number;
  vendorId: number;
  vendorName: string;
  companyName: string;
  representativeName: string;
  mainContactName: string;
  contractDate: string;
  contractPlan: string;
  contractAmount: number | null;
  serviceType: string;
  caseStatus: string;
  hasScSales: boolean;
  hasSubsidyConsulting: boolean;
  hasBpoSupport: boolean;
  consultingPlan: string;
  startDate: string;
  endDate: string;
  billingStatus: string;
  paymentStatus: string;
  notes: string;
};

type Props = {
  data: ContractRow[];
};

const fmtCurrency = (v: number | null) =>
  v != null ? `\u00a5${v.toLocaleString()}` : "-";

const fmtBool = (v: boolean) => (v ? "あり" : "なし");

export function ContractListTable({ data }: Props) {
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ベンダー名</TableHead>
            <TableHead>企業名</TableHead>
            <TableHead>代表者名</TableHead>
            <TableHead>契約日</TableHead>
            <TableHead>契約プラン</TableHead>
            <TableHead>契約金額</TableHead>
            <TableHead>サービス種別</TableHead>
            <TableHead>ステータス</TableHead>
            <TableHead>セキュリティクラウド販売</TableHead>
            <TableHead>補助金コンサル</TableHead>
            <TableHead>BPO支援</TableHead>
            <TableHead>コンサルプラン</TableHead>
            <TableHead>開始日</TableHead>
            <TableHead>終了日</TableHead>
            <TableHead>請求</TableHead>
            <TableHead>入金</TableHead>
            <TableHead>備考</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={17} className="text-center text-gray-500 py-8">
                契約データがありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="whitespace-nowrap">
                  <Link
                    href={`/hojo/settings/vendors/${r.vendorId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {r.vendorName}
                  </Link>
                </TableCell>
                <TableCell className="whitespace-nowrap">{r.companyName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.representativeName || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.contractDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.contractPlan || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtCurrency(r.contractAmount)}</TableCell>
                <TableCell className="whitespace-nowrap">{r.serviceType || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.caseStatus || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtBool(r.hasScSales)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtBool(r.hasSubsidyConsulting)}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtBool(r.hasBpoSupport)}</TableCell>
                <TableCell className="whitespace-nowrap">{r.consultingPlan || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.startDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.endDate || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.billingStatus || "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{r.paymentStatus || "-"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.notes || "-"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
