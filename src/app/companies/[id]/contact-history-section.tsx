"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ContactHistory = {
  id: number;
  contactDate: string;
  contactMethodName: string | null;
  assignedToNames: string | null;
  customerParticipants: string | null;
  meetingMinutes: string | null;
  note: string | null;
  projectLabels?: string;
};

type StpCompanyWithHistory = {
  id: number;
  companyName: string;
  contactHistories: ContactHistory[];
};

type Props = {
  stpCompanies: StpCompanyWithHistory[];
};

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ContactHistorySection({ stpCompanies }: Props) {
  // 全STP企業の接触履歴を取得
  const allHistories = stpCompanies.flatMap((company) =>
    company.contactHistories.map((h) => ({
      ...h,
      stpCompanyId: company.id,
      stpCompanyName: company.companyName,
    }))
  );

  // 日付でソート（降順）
  allHistories.sort((a, b) => new Date(b.contactDate).getTime() - new Date(a.contactDate).getTime());

  if (allHistories.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>STP接触履歴</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            接触履歴が登録されていません
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>接触履歴</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          この企業の接触履歴です（読み取り専用）
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>接触日時</TableHead>
              <TableHead>プロジェクト</TableHead>
              <TableHead>接触方法</TableHead>
              <TableHead>担当者</TableHead>
              <TableHead>先方参加者</TableHead>
              <TableHead>議事録</TableHead>
              <TableHead>備考</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allHistories.map((history) => (
              <TableRow key={`${history.stpCompanyId}-${history.id}`}>
                <TableCell className="whitespace-nowrap">
                  {formatDateTime(history.contactDate)}
                </TableCell>
                <TableCell className="text-sm">
                  {history.projectLabels || "-"}
                </TableCell>
                <TableCell>{history.contactMethodName || "-"}</TableCell>
                <TableCell>{history.assignedToNames || "-"}</TableCell>
                <TableCell>{history.customerParticipants || "-"}</TableCell>
                <TableCell className="max-w-xs">
                  <div
                    className="overflow-y-auto whitespace-pre-wrap text-sm"
                    style={{ maxHeight: "4.5em", lineHeight: "1.5" }}
                  >
                    {history.meetingMinutes || "-"}
                  </div>
                </TableCell>
                <TableCell className="max-w-xs">
                  <div
                    className="overflow-y-auto whitespace-pre-wrap text-sm"
                    style={{ maxHeight: "4.5em", lineHeight: "1.5" }}
                  >
                    {history.note || "-"}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
