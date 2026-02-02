import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Star } from "lucide-react";
import { ContactHistorySection } from "./contact-history-section";
import { BackButton } from "./back-button";

// 契約履歴の表示用選択肢
const industryTypeLabels: Record<string, string> = {
  general: "一般",
  dispatch: "派遣",
};

const contractPlanLabels: Record<string, string> = {
  monthly: "月額",
  performance: "成果報酬",
};

const statusLabels: Record<string, string> = {
  active: "契約中",
  cancelled: "解約",
  dormant: "休眠",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const companyId = parseInt(id);

  const [company, contactHistories, staff, contractHistories] = await Promise.all([
    prisma.masterStellaCompany.findUnique({
      where: { id: companyId },
      include: {
        locations: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
        contacts: {
          where: { deletedAt: null },
          orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
        },
      },
    }),
    // この企業の全接触履歴を取得（プロジェクト・顧客種別に関わらず）
    prisma.contactHistory.findMany({
      where: {
        companyId: companyId,
        deletedAt: null,
      },
      include: {
        contactMethod: true,
        roles: {
          include: {
            customerType: {
              include: {
                project: true,
              },
            },
          },
        },
      },
      orderBy: { contactDate: "desc" },
    }),
    // スタッフマスタを取得（担当者名の変換用）
    prisma.masterStaff.findMany({
      where: { isActive: true },
    }),
    // 契約履歴を取得（deletedAt: null のみ）
    prisma.stpContractHistory.findMany({
      where: {
        companyId: companyId,
        deletedAt: null,
      },
      include: {
        salesStaff: true,
        operationStaff: true,
      },
      orderBy: { contractStartDate: "desc" },
    }),
  ]);

  if (!company) {
    notFound();
  }

  // 接触履歴データの整形（全プロジェクトをまとめて表示）
  const formattedContactHistories = contactHistories.map((h) => {
    // スタッフIDからスタッフ名を取得
    const assignedToNames = h.assignedTo
      ? h.assignedTo.split(",").filter(Boolean).map((staffId) => {
          const s = staff.find((st) => st.id === Number(staffId));
          return s?.name || staffId;
        }).join(", ")
      : null;

    // プロジェクト・顧客種別のラベル
    const projectLabels = h.roles.map((r) =>
      `${r.customerType.project?.name || "不明"}:${r.customerType.name}`
    ).join(", ");

    return {
      id: h.id,
      contactDate: h.contactDate.toISOString(),
      contactMethodName: h.contactMethod?.name || null,
      assignedToNames,
      customerParticipants: h.customerParticipants,
      meetingMinutes: h.meetingMinutes,
      note: h.note,
      projectLabels,
    };
  });

  // ContactHistorySection用のデータ形式に変換
  const stpCompaniesWithHistory = [{
    id: companyId,
    companyName: company.name,
    contactHistories: formattedContactHistories,
  }];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <p className="text-sm text-muted-foreground">{company.companyCode}</p>
          <h1 className="text-2xl font-bold">{company.name}</h1>
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
              <dt className="text-sm font-medium text-muted-foreground">業界</dt>
              <dd className="mt-1 text-sm">{company.industry || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">売上規模</dt>
              <dd className="mt-1 text-sm">{company.revenueScale || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">企業HP</dt>
              <dd className="mt-1 text-sm">
                {company.websiteUrl ? (
                  <a
                    href={company.websiteUrl.startsWith("http") ? company.websiteUrl : `https://${company.websiteUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {company.websiteUrl}
                  </a>
                ) : (
                  "-"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">登録日</dt>
              <dd className="mt-1 text-sm">
                {new Date(company.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-muted-foreground">メモ</dt>
              <dd className="mt-1 text-sm whitespace-pre-wrap">{company.note || "-"}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>拠点一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {company.locations.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              拠点が登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>拠点名</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>住所</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell>
                      {location.isPrimary && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>{location.phone || "-"}</TableCell>
                    <TableCell>
                      {location.email ? (
                        <a
                          href={`mailto:${location.email}`}
                          className="hover:underline"
                        >
                          {location.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {location.address || "-"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {location.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>担当者一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {company.contacts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              担当者が登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>担当者名</TableHead>
                  <TableHead>部署</TableHead>
                  <TableHead>電話番号</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      {contact.isPrimary && (
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.department || "-"}</TableCell>
                    <TableCell>{contact.phone || "-"}</TableCell>
                    <TableCell>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {contact.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* STP接触履歴（読み取り専用） */}
      {stpCompaniesWithHistory.length > 0 && (
        <ContactHistorySection stpCompanies={stpCompaniesWithHistory} />
      )}

      {/* 契約履歴（読み取り専用・プロジェクトごと） */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>契約履歴</CardTitle>
            <Badge variant="secondary">STP（採用ブースト）</Badge>
          </div>
          <CardDescription>
            STPプロジェクトの契約履歴です。編集はSTP企業一覧から行ってください。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {contractHistories.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              STPプロジェクトの契約履歴が登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>業種区分</TableHead>
                  <TableHead>契約プラン</TableHead>
                  <TableHead>契約開始日</TableHead>
                  <TableHead>契約終了日</TableHead>
                  <TableHead className="text-right">初期費用</TableHead>
                  <TableHead className="text-right">月額</TableHead>
                  <TableHead className="text-right">成果報酬単価</TableHead>
                  <TableHead>担当営業</TableHead>
                  <TableHead>担当運用</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>備考</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contractHistories.map((history) => (
                  <TableRow key={history.id}>
                    <TableCell>{industryTypeLabels[history.industryType] || history.industryType}</TableCell>
                    <TableCell>{contractPlanLabels[history.contractPlan] || history.contractPlan}</TableCell>
                    <TableCell>
                      {history.contractStartDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </TableCell>
                    <TableCell>
                      {history.contractEndDate
                        ? history.contractEndDate.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {history.initialFee.toLocaleString()}円
                    </TableCell>
                    <TableCell className="text-right">
                      {history.monthlyFee.toLocaleString()}円
                    </TableCell>
                    <TableCell className="text-right">
                      {history.performanceFee.toLocaleString()}円
                    </TableCell>
                    <TableCell>{history.salesStaff?.name || "-"}</TableCell>
                    <TableCell>{history.operationStaff?.name || "-"}</TableCell>
                    <TableCell>{statusLabels[history.status] || history.status}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {history.note || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
