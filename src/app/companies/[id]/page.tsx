import React from "react";
import { notFound, redirect } from "next/navigation";
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
import { Star, UserCheck, UserX, Clock, Mail, ShieldCheck, ClipboardList } from "lucide-react";
import { ContactHistorySection } from "./contact-history-section";
import { BackButton } from "./back-button";
import { MergeCompanyModal } from "./merge-company-modal";

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

// 外部ユーザーステータスのラベルと色
const externalUserStatusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }> = {
  pending_email: { label: "メール認証待ち", variant: "secondary", icon: <Mail className="h-3 w-3" /> },
  pending_approval: { label: "承認待ち", variant: "outline", icon: <Clock className="h-3 w-3" /> },
  active: { label: "有効", variant: "default", icon: <UserCheck className="h-3 w-3" /> },
  suspended: { label: "停止", variant: "destructive", icon: <UserX className="h-3 w-3" /> },
};

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CompanyDetailPage({ params }: Props) {
  const { id } = await params;
  const companyId = parseInt(id);

  const [company, contactHistories, staff, contractHistories, externalUsers, leadFormSubmissions] = await Promise.all([
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
        bankAccounts: {
          where: { deletedAt: null },
          orderBy: { id: "asc" },
        },
        mergedInto: {
          select: { id: true },
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
      where: { isActive: true, isSystemUser: false },
      orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
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
    // 外部ユーザーを取得
    prisma.externalUser.findMany({
      where: { companyId: companyId },
      include: {
        contact: true,
        approver: true,
        displayPermissions: {
          include: {
            displayView: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // リード獲得フォーム回答を取得（この企業に紐付けられたもの）
    prisma.stpLeadFormSubmission.findMany({
      where: { masterCompanyId: companyId },
      include: {
        token: {
          include: {
            agent: {
              include: {
                company: true,
              },
            },
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    }),
  ]);

  if (!company) {
    notFound();
  }

  // マージ済み企業は統合先にリダイレクト
  if (company.mergedIntoId) {
    redirect(`/companies/${company.mergedIntoId}`);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <p className="text-sm text-muted-foreground">{company.companyCode}</p>
            {company.nameKana && (
              <p className="text-xs text-muted-foreground">{company.nameKana}</p>
            )}
            <h1 className="text-2xl font-bold">{company.name}</h1>
          </div>
        </div>
        <MergeCompanyModal
          companyId={companyId}
          companyName={company.name}
          companyCode={company.companyCode}
        />
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
              <dt className="text-sm font-medium text-muted-foreground">フリガナ</dt>
              <dd className="mt-1 text-sm">{company.nameKana || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">法人番号</dt>
              <dd className="mt-1 text-sm font-mono">{company.corporateNumber || "-"}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">区分</dt>
              <dd className="mt-1 text-sm">{company.companyType || "-"}</dd>
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
              <dt className="text-sm font-medium text-muted-foreground">流入経路</dt>
              <dd className="mt-1 text-sm">{company.leadSource || "-"}</dd>
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
            <div>
              <dt className="text-sm font-medium text-muted-foreground">締め日</dt>
              <dd className="mt-1 text-sm">
                {company.closingDay != null
                  ? company.closingDay === 0 ? "月末" : `${company.closingDay}日`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">支払月</dt>
              <dd className="mt-1 text-sm">
                {company.paymentMonthOffset != null
                  ? company.paymentMonthOffset === 1 ? "翌月" : company.paymentMonthOffset === 2 ? "翌々月" : `${company.paymentMonthOffset}ヶ月後`
                  : "-"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-muted-foreground">支払日</dt>
              <dd className="mt-1 text-sm">
                {company.paymentDay != null
                  ? company.paymentDay === 0 ? "末日" : `${company.paymentDay}日`
                  : "-"}
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

      <Card>
        <CardHeader>
          <CardTitle>銀行情報一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {company.bankAccounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              銀行情報が登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>銀行名</TableHead>
                  <TableHead>銀行コード</TableHead>
                  <TableHead>支店名</TableHead>
                  <TableHead>支店コード</TableHead>
                  <TableHead>口座番号</TableHead>
                  <TableHead>口座名義人</TableHead>
                  <TableHead>メモ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {company.bankAccounts.map((bankAccount) => (
                  <TableRow key={bankAccount.id}>
                    <TableCell className="font-medium">{bankAccount.bankName}</TableCell>
                    <TableCell className="font-mono">{bankAccount.bankCode}</TableCell>
                    <TableCell>{bankAccount.branchName}</TableCell>
                    <TableCell className="font-mono">{bankAccount.branchCode}</TableCell>
                    <TableCell className="font-mono">{bankAccount.accountNumber}</TableCell>
                    <TableCell>{bankAccount.accountHolderName}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {bankAccount.note || "-"}
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

      {/* 外部ユーザー（ポータルアカウント） */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              外部ユーザー（ポータルアカウント）
            </CardTitle>
            {externalUsers.length > 0 && (
              <Badge variant="secondary">{externalUsers.length}名登録</Badge>
            )}
          </div>
          <CardDescription>
            この企業に紐づくポータルサイトのログインアカウントです。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {externalUsers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              外部ユーザーが登録されていません
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ユーザー名</TableHead>
                  <TableHead>役職</TableHead>
                  <TableHead>メールアドレス</TableHead>
                  <TableHead>ステータス</TableHead>
                  <TableHead>表示権限</TableHead>
                  <TableHead>最終ログイン</TableHead>
                  <TableHead>登録日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {externalUsers.map((user) => {
                  const statusConfig = externalUserStatusConfig[user.status] || {
                    label: user.status,
                    variant: "secondary" as const,
                    icon: null,
                  };
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col">
                          <span>{user.name}</span>
                          {user.contact && (
                            <span className="text-xs text-muted-foreground">
                              担当者: {user.contact.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{user.position || "-"}</TableCell>
                      <TableCell>
                        <a
                          href={`mailto:${user.email}`}
                          className="hover:underline"
                        >
                          {user.email}
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusConfig.variant} className="flex items-center gap-1 w-fit">
                          {statusConfig.icon}
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.displayPermissions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {user.displayPermissions.map((perm) => (
                              <Badge key={perm.id} variant="outline" className="text-xs">
                                {perm.displayView.viewName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {new Date(user.createdAt).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* リード獲得フォーム回答 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              リード獲得フォーム回答
            </CardTitle>
            {leadFormSubmissions.length > 0 && (
              <Badge variant="secondary">{leadFormSubmissions.length}件</Badge>
            )}
          </div>
          <CardDescription>
            代理店経由で送信されたリード獲得フォームの回答履歴です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {leadFormSubmissions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              リード獲得フォームの回答はありません
            </p>
          ) : (
            <div className="space-y-6">
              {leadFormSubmissions.map((submission) => {
                // JSON文字列を配列にパース
                const parseJsonArray = (json: string | null): string[] => {
                  if (!json) return [];
                  try {
                    const parsed = JSON.parse(json);
                    return Array.isArray(parsed) ? parsed : [];
                  } catch {
                    return [];
                  }
                };

                const pastJobTypes = parseJsonArray(submission.pastHiringJobTypes);
                const desiredJobTypes = parseJsonArray(submission.desiredJobTypes);
                const hiringAreas = parseJsonArray(submission.hiringAreas);

                return (
                  <div key={submission.id} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Badge variant={submission.status === "processed" ? "default" : "secondary"}>
                          {submission.status === "pending" ? "未処理" : submission.status === "processed" ? "処理済" : "却下"}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(submission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                        </span>
                      </div>
                      <span className="text-sm">
                        代理店: <span className="font-medium">{submission.token.agent?.company.name ?? "直接"}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      {/* 基本情報 */}
                      <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">回答者情報</h4>
                        <dl className="space-y-1">
                          <div className="flex">
                            <dt className="w-24 text-muted-foreground">会社名</dt>
                            <dd>{submission.companyName}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-24 text-muted-foreground">担当者</dt>
                            <dd>{submission.contactName}</dd>
                          </div>
                          <div className="flex">
                            <dt className="w-24 text-muted-foreground">メール</dt>
                            <dd>{submission.contactEmail}</dd>
                          </div>
                          {submission.contactPhone && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">電話</dt>
                              <dd>{submission.contactPhone}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* 採用実績 */}
                      <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">採用実績</h4>
                        <dl className="space-y-1">
                          {pastJobTypes.length > 0 && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">職種</dt>
                              <dd>{pastJobTypes.join(", ")}</dd>
                            </div>
                          )}
                          {submission.pastHiringCount && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">採用人数</dt>
                              <dd>{submission.pastHiringCount}人</dd>
                            </div>
                          )}
                          {(submission.pastRecruitingCostAgency || submission.pastRecruitingCostAds || submission.pastRecruitingCostReferral || submission.pastRecruitingCostOther) && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">採用費用</dt>
                              <dd>
                                {[
                                  submission.pastRecruitingCostAgency && `紹介: ${submission.pastRecruitingCostAgency.toLocaleString()}円`,
                                  submission.pastRecruitingCostAds && `広告: ${submission.pastRecruitingCostAds.toLocaleString()}円`,
                                  submission.pastRecruitingCostReferral && `リファラル: ${submission.pastRecruitingCostReferral.toLocaleString()}円`,
                                  submission.pastRecruitingCostOther && `その他: ${submission.pastRecruitingCostOther.toLocaleString()}円`,
                                ].filter(Boolean).join(", ")}
                              </dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* 希望情報 */}
                      <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">採用計画</h4>
                        <dl className="space-y-1">
                          {desiredJobTypes.length > 0 && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">希望職種</dt>
                              <dd>{desiredJobTypes.join(", ")}</dd>
                            </div>
                          )}
                          {submission.annualBudget && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">年間予算</dt>
                              <dd>{submission.annualBudget.toLocaleString()}円</dd>
                            </div>
                          )}
                          {submission.annualHiringTarget && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">採用予定</dt>
                              <dd>{submission.annualHiringTarget}人</dd>
                            </div>
                          )}
                          {hiringAreas.length > 0 && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">採用エリア</dt>
                              <dd>{hiringAreas.join(", ")}</dd>
                            </div>
                          )}
                          {submission.hiringTimeline && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">希望時期</dt>
                              <dd>{submission.hiringTimeline}</dd>
                            </div>
                          )}
                        </dl>
                      </div>

                      {/* 条件 */}
                      <div>
                        <h4 className="font-semibold mb-2 text-muted-foreground">採用条件</h4>
                        <dl className="space-y-1">
                          {(submission.ageRangeMin || submission.ageRangeMax) && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">年齢</dt>
                              <dd>{submission.ageRangeMin || ""}〜{submission.ageRangeMax || ""}歳</dd>
                            </div>
                          )}
                          {submission.requiredConditions && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">必須条件</dt>
                              <dd className="whitespace-pre-wrap">{submission.requiredConditions}</dd>
                            </div>
                          )}
                          {submission.preferredConditions && (
                            <div className="flex">
                              <dt className="w-24 text-muted-foreground">希望条件</dt>
                              <dd className="whitespace-pre-wrap">{submission.preferredConditions}</dd>
                            </div>
                          )}
                        </dl>
                      </div>
                    </div>

                    {submission.processingNote && (
                      <div className="pt-2 border-t">
                        <span className="text-sm text-muted-foreground">処理メモ: </span>
                        <span className="text-sm">{submission.processingNote}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
