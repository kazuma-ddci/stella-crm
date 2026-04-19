"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AgencyHierarchyModal } from "./agency-hierarchy-modal";
import type { AgencyTreeNode } from "@/lib/slp/company-resolution";

type UserInfoRow = {
  id: number;
  displayNo: number;
  snsname: string | null;
  referrer: string;
  agencyPrimary: string;
  agencyTrees: AgencyTreeNode[];
  agencyClickable: boolean;
  agencyWarning: boolean;
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

function AgencyCell({
  row,
  onOpen,
}: {
  row: UserInfoRow;
  onOpen: (row: UserInfoRow) => void;
}) {
  if (!row.agencyPrimary) {
    return <span className="text-muted-foreground">—</span>;
  }

  const content = (
    <span
      className={
        row.agencyClickable
          ? "underline underline-offset-2 cursor-pointer text-blue-600 hover:text-blue-800"
          : ""
      }
    >
      {row.agencyPrimary}
    </span>
  );

  return (
    <div className="flex items-center gap-1.5">
      {row.agencyWarning && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <AlertTriangle
                className="text-red-600 shrink-0"
                size={14}
              />
            </TooltipTrigger>
            <TooltipContent>
              複数の1次代理店にヒットしています（要確認）
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
      {row.agencyClickable ? (
        <button
          type="button"
          onClick={() => onOpen(row)}
          className="text-left"
        >
          {content}
        </button>
      ) : (
        content
      )}
    </div>
  );
}

export function UserInfoTable({ data }: Props) {
  const [modalRow, setModalRow] = useState<UserInfoRow | null>(null);

  return (
    <>
      <div className="border rounded-lg overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[80px]">番号</TableHead>
              <TableHead>LINE名</TableHead>
              <TableHead>紹介者</TableHead>
              <TableHead className="min-w-[180px]">代理店</TableHead>
              <TableHead>組合員</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="text-center text-muted-foreground py-8"
                >
                  ユーザー情報がありません
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    row.agencyWarning ? "bg-red-50 hover:bg-red-100" : undefined
                  }
                >
                  <TableCell>{row.displayNo}</TableCell>
                  <TableCell>{row.snsname ?? ""}</TableCell>
                  <TableCell>{row.referrer}</TableCell>
                  <TableCell>
                    <AgencyCell row={row} onOpen={setModalRow} />
                  </TableCell>
                  <TableCell>
                    <MemberStatusBadge status={row.memberStatus} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AgencyHierarchyModal
        open={modalRow !== null}
        onOpenChange={(v) => {
          if (!v) setModalRow(null);
        }}
        lineFriendLabel={
          modalRow
            ? `${modalRow.displayNo} ${modalRow.snsname ?? ""}`.trim()
            : ""
        }
        trees={modalRow?.agencyTrees ?? []}
      />
    </>
  );
}
