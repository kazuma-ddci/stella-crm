import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Pencil } from "lucide-react";
import { DeleteCompanyButton } from "./delete-button";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const company = await prisma.masterStellaCompany.findUnique({
    where: { id: parseInt(id) },
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/companies">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <p className="text-sm text-muted-foreground">{company.companyCode}</p>
            <h1 className="text-2xl font-bold">{company.name}</h1>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/companies/${company.id}/edit`}>
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              編集
            </Button>
          </Link>
          <DeleteCompanyButton id={company.id} name={company.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本情報</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-muted-foreground">企業ID</dt>
              <dd className="mt-1 text-sm font-mono">{company.companyCode}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">企業名</dt>
              <dd className="mt-1 text-sm">{company.name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">担当者名</dt>
              <dd className="mt-1 text-sm">{company.contactPerson || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">電話番号</dt>
              <dd className="mt-1 text-sm">{company.phone || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">メールアドレス</dt>
              <dd className="mt-1 text-sm">{company.email || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">登録日</dt>
              <dd className="mt-1 text-sm">
                {new Date(company.createdAt).toLocaleDateString("ja-JP")}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">メモ</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">{company.note || "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}
