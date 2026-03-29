"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

type Props = {
  data: {
    id: number;
    companyName: string;
    representName: string;
    email: string;
    phone: string;
    submittedAt: string;
  }[];
};

export function SubmissionsTable({ data }: Props) {
  const router = useRouter();

  if (data.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        フォーム回答がまだありません
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">No.</TableHead>
            <TableHead>会社名</TableHead>
            <TableHead>代表者</TableHead>
            <TableHead>メール</TableHead>
            <TableHead>電話番号</TableHead>
            <TableHead>回答日時</TableHead>
            <TableHead className="w-20 sticky right-0 z-30 bg-white shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">操作</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, idx) => (
            <TableRow key={row.id} className="group/row">
              <TableCell>{idx + 1}</TableCell>
              <TableCell className="font-medium">{row.companyName}</TableCell>
              <TableCell>{row.representName}</TableCell>
              <TableCell>{row.email}</TableCell>
              <TableCell>{row.phone}</TableCell>
              <TableCell>
                {new Date(row.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </TableCell>
              <TableCell className="sticky right-0 z-10 bg-white group-hover/row:bg-gray-50 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(`/hojo/form-submissions/${row.id}`)}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
