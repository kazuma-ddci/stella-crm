"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type UserInfoRow = {
  id: number;
  displayNo: number;
  snsname: string | null;
  referrer: string;
  memberStatus: string;
};

type Props = {
  data: UserInfoRow[];
};

function MemberStatusBadge({ status }: { status: string }) {
  if (!status) return null;

  const variant =
    status === "組合員登録済み"
      ? "default"
      : status === "締結待ち"
        ? "secondary"
        : "outline";

  return <Badge variant={variant}>{status}</Badge>;
}

export function UserInfoTable({ data }: Props) {
  return (
    <div className="border rounded-lg overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[80px]">番号</TableHead>
            <TableHead>LINE名</TableHead>
            <TableHead>紹介者</TableHead>
            <TableHead>組合員</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                ユーザー情報がありません
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.displayNo}</TableCell>
                <TableCell>{row.snsname ?? ""}</TableCell>
                <TableCell>{row.referrer}</TableCell>
                <TableCell>
                  <MemberStatusBadge status={row.memberStatus} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
