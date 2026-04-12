import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

const GROUPS = [
  {
    title: "基本情報",
    path: "basic",
    keys: [
      ["tradeName", "屋号"],
      ["openingDate", "開業年月日"],
      ["fullName", "氏名"],
      ["officeAddress", "事業所の所在地"],
      ["phone", "連絡先（電話番号）"],
      ["email", "連絡先（メールアドレス）"],
      ["employeeCount", "従業員数"],
      ["homepageUrl", "ホームページURL"],
    ],
  },
  {
    title: "口座情報",
    path: "bankAccount",
    keys: [
      ["bankType", "金融機関"],
      ["yuchoSymbol", "記号"],
      ["yuchoPassbookNumber", "通帳番号"],
      ["yuchoAccountHolder", "口座名義人"],
      ["yuchoAccountHolderKana", "口座名義人（フリガナ）"],
      ["otherBankName", "金融機関名"],
      ["otherBankCode", "金融機関コード"],
      ["otherBranchName", "支店名"],
      ["otherBranchCode", "支店コード"],
      ["otherAccountType", "口座種別"],
      ["otherAccountNumber", "口座番号"],
      ["otherAccountHolder", "口座名義人"],
      ["otherAccountHolderKana", "口座名義人（フリガナ）"],
    ],
  },
  {
    title: "事業概要",
    path: "businessOverview",
    keys: [
      ["businessContent", "事業内容"],
      ["mainProductService", "主力商品・サービスの内容"],
      ["businessStrength", "事業の特徴や強み（差別化ポイント）"],
      ["openingBackground", "開業の経緯や想い"],
      ["businessScale", "現状の事業規模"],
    ],
  },
  {
    title: "市場・競合情報",
    path: "marketCompetition",
    keys: [
      ["targetMarket", "ターゲット市場"],
      ["targetCustomerProfile", "ターゲット顧客層"],
      ["competitors", "競合する相手"],
      ["strengthsAndChallenges", "強みと今後の課題"],
    ],
  },
  {
    title: "支援制度申請関連",
    path: "supportApplication",
    keys: [
      ["supportPurpose", "支援制度の目的"],
      ["supportGoal", "実現したいこと"],
      ["investmentPlan", "具体的計画"],
      ["expectedOutcome", "期待される成果"],
    ],
  },
  {
    title: "事業体制とご経歴",
    path: "businessStructure",
    keys: [
      ["ownerCareer", "経歴・スキル・資格"],
      ["staffRoles", "スタッフの役割"],
      ["futureHiring", "必要な人材（採用予定）"],
    ],
  },
  {
    title: "事業計画",
    path: "businessPlan",
    keys: [
      ["shortTermGoal", "短期（1年以内）の目標"],
      ["midTermGoal", "中期（3年）の目標"],
      ["longTermGoal", "長期（5年）の目標"],
      ["salesStrategy", "販売戦略やPR計画"],
    ],
  },
  {
    title: "財務情報",
    path: "financial",
    keys: [
      ["futureInvestmentPlan", "今後の投資計画と必要な資金"],
      ["debtInfo", "借入状況・担保・保障情報"],
    ],
  },
];

type FileInfo = {
  filePath: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
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

  if (!submission || submission.deletedAt) notFound();

  const answers = submission.answers as Record<string, unknown>;
  const meta = (answers?._meta as Record<string, string>) ?? {};
  const fileUrls = (submission.fileUrls as Record<string, FileInfo> | null) ?? {};

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

      {meta.uid && (
        <div className="rounded-lg border bg-blue-50 p-3">
          <span className="text-sm font-medium text-blue-800">UID: {meta.uid}</span>
        </div>
      )}

      {GROUPS.map((g) => {
        const sectionData = answers[g.path] as Record<string, string> | undefined;
        if (!sectionData) return null;
        const hasValue = g.keys.some(([k]) => sectionData[k]);
        if (!hasValue) return null;
        return (
          <Card key={g.title}>
            <CardHeader><CardTitle className="text-lg">{g.title}</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3">
                {g.keys.map(([key, label]) => {
                  const v = sectionData[key];
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

      {/* 添付ファイル */}
      {Object.keys(fileUrls).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-lg">添付ファイル</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(fileUrls).map(([key, file]) => (
                <a
                  key={key}
                  href={file.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-gray-50 transition-colors"
                >
                  <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{file.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {key === "bankAccountScreenshot" ? "口座情報スクリーンショット" : "過去の事業実績"}
                      {" / "}
                      {(file.fileSize / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
