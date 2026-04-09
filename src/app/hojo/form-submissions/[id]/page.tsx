import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const GROUPS = [
  {
    title: "基本情報",
    keys: [
      ["tradeName", "屋号"],
      ["industry", "業種"],
      ["mainPhone", "電話番号（メイン）"],
      ["contactPerson", "先方"],
      ["contactPerson2", "先方2"],
      ["businessDescription", "事業の内容"],
      ["maxMonthlySales", "最大月商"],
      ["industryCode", "業種コード・類似業種"],
      ["constructionLicense", "建設業"],
      ["employeeCount", "従業員数"],
    ],
  },
  {
    title: "振込先（ゆうちょ銀行）",
    keys: [
      ["bankType", "振込先の口座"],
      ["yuchoAccountType", "口座種別"],
      ["yuchoHighValue", "高額手数に係る金融機関"],
      ["yuchoBank", "ゆうちょ銀行"],
      ["yuchoSymbol", "記号"],
      ["yuchoBranchNumber", "本店番号"],
      ["yuchoNumber", "番号"],
      ["yuchoHolderName", "口座名義人"],
      ["yuchoHolderNameKana", "口座名義人（カタカナ）"],
    ],
  },
  {
    title: "振込先（その他の銀行）",
    keys: [
      ["otherBankCode", "金融機関コード"],
      ["otherBankName", "金融機関名"],
      ["otherBranchCode", "支店機関コード"],
      ["otherBranchName", "支店名"],
      ["otherDeliveryCode", "配送コード"],
      ["otherDepositType", "預金種別"],
      ["otherAccountNumber", "口座番号"],
      ["otherHolderName", "口座名義人"],
      ["otherHolderNameKana", "口座名義人（カタカナ）"],
    ],
  },
  {
    title: "口座確認書類",
    keys: [
      ["accountDocDate", "口座情報（日付）"],
      ["accountDocDesc", "口座確認書類備考"],
      ["accountDocCredit", "口座情報（クレジット）"],
    ],
  },
  {
    title: "事業情報",
    keys: [
      ["orderInfo", "発注情報"],
      ["businessContent", "事業内容"],
      ["serviceName", "名称・サービス名"],
      ["developmentTimeline", "開発の見通し"],
      ["previousYearOverview", "前年の事業概要"],
    ],
  },
  {
    title: "ITツール情報",
    keys: [
      ["itBudget", "予算・金額情報"],
      ["itCategory", "カテゴリ（ソフトウェア分類）"],
      ["itToolTarget", "ツール又は通信名"],
      ["itToolType", "ターゲット又はカテゴリ"],
      ["accountingSoftware", "会計ソフト等"],
      ["futureBusinessPlan", "今後の事業計画・課題"],
    ],
  },
  {
    title: "事業実績・財務",
    keys: [
      ["financeDate", "顧客先情報（日付）"],
      ["businessEnvironment", "主な経営環境の変化"],
      ["supplierInfo", "主な取引先情報"],
      ["expenseInfo", "経費類・為替情報"],
      ["overseasInfo", "海外取引"],
    ],
  },
  {
    title: "事業概要情報",
    keys: [
      ["bizOverviewDate", "事業種別（日付）"],
      ["publicDisclosure", "公表情報"],
      ["systemInfo", "システム情報"],
      ["futureManagement", "今後の管理計画"],
    ],
  },
  {
    title: "賃金等",
    keys: [
      ["wageDate", "選択（日付）"],
      ["wage", "賃金"],
      ["procedureOther", "手順（以外）"],
      ["wageAdditional", "賃金（以外）追加"],
      ["annualIncome", "年初金"],
      ["wageOtherAdditional", "手順（以外の）追加"],
      ["wageYearEnd", "賃金（件末年次の確認）"],
      ["dataSubmissionNote", "通知備考"],
    ],
  },
  {
    title: "メールアドレス・その他",
    keys: [
      ["businessEmail", "事業用メールアドレス"],
      ["recentBusinessPlan", "近々の事業計画"],
      ["futurePlan", "今後の事業について"],
      ["personalAnnual", "個人の計・年初・実績"],
    ],
  },
];

export default async function HojoFormSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: parseInt(id) },
  });

  if (!submission || submission.deletedAt) notFound();

  const answers = submission.answers as Record<string, string>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/hojo/form-submissions">
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />一覧に戻る</Button>
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

      {GROUPS.map((g) => {
        const hasValue = g.keys.some(([k]) => answers[k]);
        if (!hasValue) return null;
        return (
          <Card key={g.title}>
            <CardHeader><CardTitle className="text-lg">{g.title}</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {g.keys.map(([key, label]) => {
                  const v = answers[key];
                  if (!v) return null;
                  return (
                    <div key={key}>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">{label}</dt>
                      <dd className="text-sm whitespace-pre-wrap bg-gray-50 rounded p-3">{v}</dd>
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
