"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import Link from "next/link";

type ReferredCompany = {
  id: number;
  companyId: number;
  companyName: string;
  companyCode: string;
  currentStageName: string;
  hasSignedContract: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  companies: ReferredCompany[];
  filterContracted?: boolean;
};

export function ReferredCompaniesModal({
  open,
  onOpenChange,
  agentName,
  companies,
  filterContracted = false,
}: Props) {
  const filteredCompanies = filterContracted
    ? companies.filter((c) => c.hasSignedContract)
    : companies;

  const title = filterContracted
    ? `契約済み企業一覧 - ${agentName}`
    : `紹介企業一覧 - ${agentName}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {filteredCompanies.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {filterContracted
              ? "契約済みの企業はありません"
              : "紹介した企業はありません"}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>企業コード</TableHead>
                <TableHead>企業名</TableHead>
                <TableHead>ステージ</TableHead>
                <TableHead>契約状況</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCompanies.map((company) => (
                <TableRow key={company.id}>
                  <TableCell className="font-mono text-sm">
                    {company.companyCode}
                  </TableCell>
                  <TableCell>
                    <Link
                      href={`/stp/companies?id=${company.id}`}
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {company.companyName}
                    </Link>
                  </TableCell>
                  <TableCell>{company.currentStageName}</TableCell>
                  <TableCell>
                    {company.hasSignedContract ? (
                      <span className="text-green-600 font-medium">契約済み</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
