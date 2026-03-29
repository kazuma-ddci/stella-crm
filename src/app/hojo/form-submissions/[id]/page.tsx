import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    title: "基本情報",
    fields: [
      "会社名／屋号", "設立年月日", "代表者氏名", "代表者氏名（カナ)", "役職",
      "本社所在地", "支店・営業所がある場合は所在地", "連絡先（電話番号）",
      "連絡先（メールアドレス）", "資本金", "従業員数", "ホームページURL",
    ],
  },
  {
    title: "事業概要",
    fields: [
      "事業の種類・業種・業態", "主力商品・サービスの内容",
      "事業の特徴や強み（差別化ポイント）", "主要取引先・顧客層",
      "事業開始の経緯や背景", "現状の事業規模（売上高・利益・店舗数など)",
    ],
  },
  {
    title: "市場・競合情報",
    fields: [
      "市場規模・成長性（統計やデータがあれば）",
      "ターゲット顧客層（年齢・性別・地域・嗜好など）",
      "競合企業や競合サービス", "自社の優位性・課題",
    ],
  },
  {
    title: "支援制度申請関連",
    fields: [
      "支援制度の目的", "支援制度を活用して実現したいこと",
      "支援制度による投資・設備導入・採用など具体的計画",
      "期待される成果（売上増、雇用創出、効率化など）",
    ],
  },
  {
    title: "組織・人材",
    fields: [
      "経営陣・主要スタッフの略歴", "担当者ごとの役割・責任",
      "必要な人材・採用予定",
    ],
  },
  {
    title: "事業計画・戦略",
    fields: [
      "短期（1年以内）の目標", "中期（3年）の目標", "長期（5年）の目標",
      "売上・利益計画", "販売戦略・マーケティング戦略",
    ],
  },
  {
    title: "財務情報",
    fields: [
      "過去3年程度の財務諸表（売上・経費・利益）",
      "今後の投資計画と資金調達計画", "借入状況・担保・保証情報",
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

  if (!submission || submission.deletedAt) {
    notFound();
  }

  const answers = submission.answers as Record<string, string>;
  const fileUrls = (submission.fileUrls as Record<string, string>) || {};

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

      {Object.keys(fileUrls).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">添付ファイル</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(fileUrls).map(([key, url]) => {
              const label = key.replace("file_", "");
              return (
                <a
                  key={key}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 hover:underline"
                >
                  <Download className="h-4 w-4" />
                  {label}
                </a>
              );
            })}
          </CardContent>
        </Card>
      )}

      {SECTIONS.map((section) => {
        const hasAnyValue = section.fields.some((f) => answers[f]);
        if (!hasAnyValue) return null;
        return (
          <Card key={section.title}>
            <CardHeader>
              <CardTitle className="text-lg">{section.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-4">
                {section.fields.map((field) => {
                  const value = answers[field];
                  if (!value) return null;
                  return (
                    <div key={field}>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        {field}
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
