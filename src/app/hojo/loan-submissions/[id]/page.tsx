import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// セクション定義（表示用）
// ---------------------------------------------------------------------------

const INDIVIDUAL_SECTIONS = [
  {
    title: "ご契約者様の情報",
    fields: [
      { key: "ind_email", label: "メールアドレス" },
      { key: "ind_name", label: "氏名(正式名称)" },
      { key: "ind_name_kana", label: "氏名(カナ)" },
      { key: "ind_postal_code", label: "郵便番号" },
      { key: "ind_address", label: "住所" },
      { key: "ind_phone", label: "電話番号" },
      { key: "ind_birthday", label: "生年月日" },
      { key: "ind_gender", label: "性別" },
    ],
  },
  {
    title: "事業者情報",
    fields: [
      { key: "ind_business_name", label: "屋号(正式名称)" },
      { key: "ind_business_type", label: "事業内容" },
      { key: "ind_business_start", label: "事業開始年月" },
      { key: "ind_income_type", label: "所得区分" },
      { key: "ind_office_address", label: "事業所住所" },
      { key: "ind_office_phone", label: "事業所電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "ind_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "振込先金融機関の口座情報",
    fields: [
      { key: "ind_bank_name", label: "金融機関名" },
      { key: "ind_branch_name", label: "支店名" },
      { key: "ind_account_type", label: "口座種別" },
      { key: "ind_account_number", label: "口座番号" },
      { key: "ind_account_holder", label: "口座名義人カナ" },
    ],
  },
];

const CORPORATE_SECTIONS = [
  {
    title: "御社の情報",
    fields: [
      { key: "corp_email", label: "メールアドレス" },
      { key: "corp_company_name", label: "法人名称(正式名称)" },
      { key: "corp_company_name_kana", label: "法人名称(カナ)" },
      { key: "corp_postal_code", label: "法人郵便番号" },
      { key: "corp_address", label: "法人本店所在地" },
      { key: "corp_phone", label: "法人電話番号" },
    ],
  },
  {
    title: "代表者の情報",
    fields: [
      { key: "corp_rep_name", label: "代表者氏名(正式名称)" },
      { key: "corp_rep_name_kana", label: "代表者氏名(カナ)" },
      { key: "corp_rep_birthday", label: "代表者生年月日" },
      { key: "corp_rep_gender", label: "性別" },
      { key: "corp_rep_postal_code", label: "代表者郵便番号" },
      { key: "corp_rep_address", label: "代表者住所" },
      { key: "corp_rep_phone", label: "代表者電話番号" },
    ],
  },
  {
    title: "借入希望金額",
    fields: [{ key: "corp_loan_amount", label: "借入希望金額" }],
  },
  {
    title: "振込先金融機関の口座情報",
    fields: [
      { key: "corp_bank_name", label: "金融機関名" },
      { key: "corp_branch_name", label: "支店名" },
      { key: "corp_account_type", label: "口座種別" },
      { key: "corp_account_number", label: "口座番号" },
      { key: "corp_account_holder", label: "口座名義人(カナ)" },
    ],
  },
];

// 実質的支配者セクションを動的に生成
function getBOSections(answers: Record<string, string>) {
  const sections = [];
  for (let i = 1; ; i++) {
    const nameKey = `corp_bo${i}_name`;
    if (!answers[nameKey]) break;
    sections.push({
      title: `実質的支配者${i}人目`,
      fields: [
        { key: `corp_bo${i}_name`, label: "氏名称" },
        { key: `corp_bo${i}_name_kana`, label: "氏名称フリガナ" },
        { key: `corp_bo${i}_address`, label: "住所" },
        { key: `corp_bo${i}_share`, label: "議決権等保有割合" },
        { key: `corp_bo${i}_birthday`, label: "生年月日" },
        { key: `corp_bo${i}_gender`, label: "性別" },
      ],
    });
  }
  return sections;
}

export default async function LoanSubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: parseInt(id) },
  });

  if (
    !submission ||
    submission.deletedAt ||
    (submission.formType !== "loan-corporate" &&
      submission.formType !== "loan-individual")
  ) {
    notFound();
  }

  const originalAnswers = submission.answers as Record<string, string>;
  const modifiedAnswers = submission.modifiedAnswers as Record<string, string> | null;
  const changeHistory = submission.changeHistory as { changedAt: string; changedBy: string; changes: { field: string; fieldLabel: string; oldValue: string; newValue: string }[] }[] | null;
  const currentAnswers = modifiedAnswers ?? originalAnswers;
  const hasModifications = !!modifiedAnswers;
  const isCorporate = submission.formType === "loan-corporate";
  const baseSections = isCorporate ? CORPORATE_SECTIONS : INDIVIDUAL_SECTIONS;
  const boSections = isCorporate ? getBOSections(currentAnswers) : [];
  const sections = [...baseSections, ...boSections];

  function renderSections(data: Record<string, string>, showChanged?: boolean) {
    return sections.map((section) => {
      const hasAnyValue = section.fields.some((f) => data[f.key]);
      if (!hasAnyValue) return null;
      return (
        <Card key={section.title}>
          <CardHeader>
            <CardTitle className="text-lg">{section.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-4">
              {section.fields.map((field) => {
                const value = data[field.key];
                if (!value) return null;
                const isChanged = showChanged && originalAnswers[field.key] !== value;
                return (
                  <div key={field.key}>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">
                      {field.label}
                      {isChanged && (
                        <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">変更済</Badge>
                      )}
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
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Link href="/hojo/loan-submissions">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            一覧に戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">借入申込 回答詳細</h1>
        <Badge variant={isCorporate ? "default" : "secondary"}>
          {isCorporate ? "法人" : "個人事業主"}
        </Badge>
        {hasModifications && (
          <Badge variant="outline" className="text-orange-600 border-orange-300">変更あり</Badge>
        )}
        <Badge variant="outline">
          {new Date(submission.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
        </Badge>
      </div>

      {originalAnswers._vendorName && (
        <Card>
          <CardContent className="py-3">
            <span className="text-sm text-muted-foreground">ベンダー: </span>
            <span className="text-sm font-medium">{originalAnswers._vendorName}</span>
          </CardContent>
        </Card>
      )}

      {hasModifications ? (
        <Tabs defaultValue="modified">
          <TabsList>
            <TabsTrigger value="modified">最新データ</TabsTrigger>
            <TabsTrigger value="original">元の回答</TabsTrigger>
            <TabsTrigger value="history">変更履歴</TabsTrigger>
          </TabsList>

          <TabsContent value="modified" className="space-y-6 mt-4">
            {renderSections(currentAnswers, true)}
          </TabsContent>

          <TabsContent value="original" className="space-y-6 mt-4">
            {renderSections(originalAnswers)}
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">変更履歴</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!changeHistory || changeHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">変更履歴はありません</p>
                ) : (
                  [...changeHistory].reverse().map((record, idx) => (
                    <div key={idx} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="font-medium text-gray-700">{record.changedBy}</span>
                        <span>{new Date(record.changedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</span>
                      </div>
                      <div className="space-y-1">
                        {record.changes.map((c, ci) => (
                          <div key={ci} className="text-sm bg-gray-50 rounded px-3 py-2">
                            <span className="font-medium">{c.fieldLabel}</span>
                            <div className="flex items-center gap-2 mt-1 text-xs">
                              <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded line-through">
                                {c.oldValue || "（空）"}
                              </span>
                              <span>→</span>
                              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded">
                                {c.newValue || "（空）"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : (
        renderSections(originalAnswers)
      )}
    </div>
  );
}
