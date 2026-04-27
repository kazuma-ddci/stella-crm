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
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import { PortalCard, PortalLoginWrapper } from "@/components/hojo-portal";
import { BbsPortalLayout } from "@/components/hojo/bbs-portal-layout";
import type { FileInfo, ModifiedAnswers } from "@/components/hojo/form-answer-editor";
import { BbsFormAnswerViewerModal } from "@/components/hojo/bbs-form-answer-viewer-modal";

type Row = {
  id: number;
  applicationSupportId: number;
  applicantName: string;
  tradeName: string;
  formTranscriptDate: string;
  submittedAt: string;
  answers: Record<string, unknown>;
  modifiedAnswers: ModifiedAnswers | null;
  fileUrls: Record<string, FileInfo> | null;
};

type Props = {
  authenticated: boolean;
  isBbs: boolean;
  data: Row[];
  userName?: string;
};

function LoginStub() {
  return (
    <PortalLoginWrapper title="BBS社様専用ページ" subtitle="ログインが必要です">
      <div className="text-center text-sm text-gray-600 py-4">
        支援制度申請フォームのご確認には、
        <a href="/hojo/bbs" className="text-[#3b9d9d] hover:underline">こちらからログイン</a>
        してください。
      </div>
    </PortalLoginWrapper>
  );
}

function FormAnswersTable({ data }: { data: Row[] }) {
  const [viewRow, setViewRow] = useState<Row | null>(null);

  const handleDownloadCsv = () => {
    window.location.href = "/api/hojo/bbs/form-answers/csv";
  };

  return (
    <>
      <PortalCard>
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-600">
            確定済みの支援制度申請フォーム回答 <span className="font-semibold">{data.length}</span> 件
          </div>
          <Button onClick={handleDownloadCsv} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            CSV ダウンロード
          </Button>
        </div>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-14">No.</TableHead>
                <TableHead>申請者名</TableHead>
                <TableHead>屋号</TableHead>
                <TableHead>フォーム転記日</TableHead>
                <TableHead>回答日時</TableHead>
                <TableHead className="w-24 text-right">回答内容</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                    確定済みのフォーム回答はまだありません
                  </TableCell>
                </TableRow>
              ) : (
                data.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-gray-500">{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.applicantName}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.tradeName}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.formTranscriptDate}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(r.submittedAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setViewRow(r)}>
                        <Eye className="h-4 w-4 mr-1" />
                        確認
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </PortalCard>

      {viewRow && (
        <BbsFormAnswerViewerModal
          open
          onClose={() => setViewRow(null)}
          answers={viewRow.answers}
          modifiedAnswers={viewRow.modifiedAnswers}
          fileUrls={viewRow.fileUrls}
          description={`申請者: ${viewRow.applicantName} / 共有日: ${viewRow.formTranscriptDate}`}
        />
      )}
    </>
  );
}

export function BbsClientFormAnswersPage({ authenticated, isBbs, data, userName }: Props) {
  if (!authenticated) return <LoginStub />;

  return (
    <BbsPortalLayout userName={userName} isBbs={isBbs} pageTitle="支援制度申請フォーム">
      <FormAnswersTable data={data} />
    </BbsPortalLayout>
  );
}
