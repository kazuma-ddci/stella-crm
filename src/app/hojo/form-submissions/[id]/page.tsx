import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTION_GROUPS = [
  {
    title: "基本情報",
    keys: ["tradeName", "industry", "mainPhone", "contactPerson", "contactPerson2", "businessDescription", "maxMonthlySales", "industryCode", "constructionLicense", "employeeCount"],
  },
  {
    title: "振込先（ゆうちょ銀行）",
    keys: ["bankType", "yuchoAccountType", "yuchoHighValue", "yuchoSymbol", "yuchoBranchNumber", "yuchoNumber", "yuchoHolderName", "yuchoHolderNameKana"],
  },
  {
    title: "振込先（その他の銀行）",
    keys: ["bankCode", "bankName", "branchCode", "branchName", "deliveryCode", "depositType", "accountNumber", "accountHolderName", "accountHolderNameKana"],
  },
  {
    title: "口座確認書類",
    keys: ["accountDocType", "accountDocCreditCard"],
  },
  {
    title: "事業情報",
    keys: ["orderDate", "businessContent", "serviceName", "businessOverview", "developmentTimeline", "previousYearOverview"],
  },
  {
    title: "ITツール情報",
    keys: ["itBudget", "itCategory", "itToolName", "itToolCategory", "accountingSoftware", "futureBusinessPlan"],
  },
  {
    title: "事業実績・財務",
    keys: ["mainClientInfo", "businessEnvironment", "supplierInfo", "expenseInfo", "overseasInfo"],
  },
  {
    title: "事業概要情報",
    keys: ["businessCategory", "publicDisclosure", "systemInfo", "futureManagement"],
  },
  {
    title: "賃金等",
    keys: ["minWage", "wageIncreasePlan", "salary", "salaryOther", "annualIncome", "salaryAdditional"],
  },
  {
    title: "メールアドレス・その他",
    keys: ["businessEmail", "recentBusinessPlan", "personalNotes"],
  },
];

const FIELD_LABELS: Record<string, string> = {
  tradeName: "屋号",
  industry: "業種",
  mainPhone: "電話番号（メイン）",
  contactPerson: "先方",
  contactPerson2: "先方2",
  businessDescription: "事業の内容",
  maxMonthlySales: "最大月商",
  industryCode: "業種コード・類似業種",
  constructionLicense: "建設業の許可",
  employeeCount: "従業員数",
  bankType: "振込先の口座",
  yuchoAccountType: "口座種別（ゆうちょ）",
  yuchoHighValue: "高額手数に係る金融機関",
  yuchoSymbol: "記号",
  yuchoBranchNumber: "本店番号",
  yuchoNumber: "番号",
  yuchoHolderName: "口座名義人",
  yuchoHolderNameKana: "口座名義人（カタカナ）",
  bankCode: "金融機関コード",
  bankName: "金融機関名",
  branchCode: "支店コード",
  branchName: "支店名",
  deliveryCode: "配送コード",
  depositType: "預金種別",
  accountNumber: "口座番号",
  accountHolderName: "口座名義人",
  accountHolderNameKana: "口座名義人（カタカナ）",
  accountDocType: "口座確認書類",
  accountDocCreditCard: "口座情報（クレジット）",
  orderDate: "発注情報",
  businessContent: "事業内容",
  serviceName: "名称・サービス名",
  businessOverview: "事業計画実績",
  developmentTimeline: "開発の見通し",
  previousYearOverview: "前年の事業概要",
  itBudget: "予算・金額情報",
  itCategory: "カテゴリ（ソフトウェア分類）",
  itToolName: "ツール名称・サービス名",
  itToolCategory: "導入するITツール枠",
  accountingSoftware: "会計ソフト等",
  futureBusinessPlan: "今後の事業計画・課題",
  mainClientInfo: "主な顧客先",
  businessEnvironment: "主な経営環境の変化",
  supplierInfo: "主な取引先情報",
  expenseInfo: "経費類・為替情報",
  overseasInfo: "海外取引",
  businessCategory: "事業種別",
  publicDisclosure: "公表情報",
  systemInfo: "システム情報",
  futureManagement: "今後の管理計画",
  minWage: "事業場内最低賃金",
  wageIncreasePlan: "賃上げの計画",
  salary: "報酬（月額）",
  salaryOther: "報酬（その他手当）",
  annualIncome: "年初金",
  salaryAdditional: "賃金（件末年次確認）",
  businessEmail: "事業用メールアドレス",
  recentBusinessPlan: "近々の事業計画",
  personalNotes: "その他備考",
};

export default async function HojoFormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: parseInt(id) },
  });

  if (!submission || submission.deletedAt) {
    notFound();
  }

  const answers = submission.answers as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/hojo/form-submissions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">フォーム回答詳細</h1>
        <Badge variant="outline">
          {new Date(submission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </Badge>
      </div>

      {answers._uid && (
        <div className="rounded-lg border bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-800">UID: {answers._uid}</span>
        </div>
      )}

      {SECTION_GROUPS.map((section) => {
        const hasAnyValue = section.keys.some((k) => answers[k]);
        if (!hasAnyValue) return null;
        return (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {section.keys.map((key) => {
                  const value = answers[key];
                  if (!value) return null;
                  return (
                    <div key={key}>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        {FIELD_LABELS[key] || key}
                      </dt>
                      <dd className="text-sm whitespace-pre-wrap bg-gray-50 rounded p-3">
                        {value}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
