import { prisma } from "@/lib/prisma";
import { callClaude } from "@/lib/anthropic/client";
import { renderTemplate, formatJstDateTime } from "@/lib/zoom/templates";

/**
 * V2 単独レコード (V1 slpZoomRecording / hojoZoomRecording 併走なし) 向けの
 * Claude 議事録要約生成。
 *
 * 既存の slpZoomAiPromptTemplate (projectCode: null / slp / hojo) を流用し、
 * V2 MeetingRecord.transcriptText から要約を生成して MeetingRecordSummary
 * version=2 (source="claude") に保存する。
 *
 * 既に version=2 があれば同 version を上書き更新 (再生成)。
 */

async function getClaudePromptTemplate(
  projectCode: "stp" | "slp" | "hojo",
): Promise<{ promptBody: string; model: string; maxTokens: number }> {
  // プロジェクト別 → 見つからなければ共通 (null) を採用
  const codeForTemplate = projectCode === "stp" ? null : projectCode;

  if (codeForTemplate) {
    const tpl = await prisma.slpZoomAiPromptTemplate.findUnique({
      where: {
        projectCode_templateKey: {
          projectCode: codeForTemplate,
          templateKey: "summary",
        },
      },
    });
    if (tpl) {
      return {
        promptBody: tpl.promptBody,
        model: tpl.model,
        maxTokens: tpl.maxTokens,
      };
    }
  }

  // 共通テンプレート
  const shared = await prisma.slpZoomAiPromptTemplate.findFirst({
    where: { projectCode: null, templateKey: "summary" },
  });
  if (shared) {
    return {
      promptBody: shared.promptBody,
      model: shared.model,
      maxTokens: shared.maxTokens,
    };
  }

  throw new Error(
    "Claude 要約用プロンプトテンプレート (templateKey='summary') が登録されていません",
  );
}

export async function generateClaudeSummaryForV2Record(params: {
  meetingRecordId: number;
  projectCode: "stp" | "slp" | "hojo";
}): Promise<{ summaryText: string; model: string; promptSnapshot: string }> {
  const record = await prisma.contactHistoryMeetingRecord.findUnique({
    where: { id: params.meetingRecordId },
    include: {
      meeting: {
        include: {
          hostStaff: { select: { name: true } },
          contactHistory: {
            include: {
              contactCategory: { select: { name: true } },
              customerParticipants: {
                orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!record) throw new Error("MeetingRecord が見つかりません");
  if (!record.transcriptText || record.transcriptText.trim().length === 0) {
    throw new Error("文字起こしが無いため Claude 要約を生成できません");
  }

  const tpl = await getClaudePromptTemplate(params.projectCode);

  // プロンプト変数の解決
  const primary = record.meeting.contactHistory.customerParticipants[0];
  const customerName = await resolveCustomerName(
    primary?.targetType ?? null,
    primary?.targetId ?? null,
  );
  const categoryName =
    record.meeting.contactHistory.contactCategory?.name ?? "";
  const dateRef =
    record.meeting.contactHistory.scheduledStartAt ??
    record.meeting.scheduledStartAt ??
    null;
  const hostName = record.meeting.hostStaff?.name ?? "";

  const systemPrompt = renderTemplate(tpl.promptBody, {
    事業者名: customerName ?? "",
    商談種別: categoryName,
    日時: dateRef ? formatJstDateTime(dateRef) : "",
    担当者: hostName,
  });

  const { text } = await callClaude({
    model: tpl.model,
    systemPrompt,
    userMessage: `以下が今回の商談の文字起こしです。これをもとに議事録を作成してください。\n\n---\n${record.transcriptText}\n---`,
    maxTokens: tpl.maxTokens,
    temperature: 0.3,
  });

  // MeetingRecordSummary version=2 (claude) を upsert。他バージョンの
  // isCurrent を落として、claude 版を現行版にする。
  await prisma.$transaction(async (tx) => {
    await tx.meetingRecordSummary.updateMany({
      where: {
        meetingRecordId: params.meetingRecordId,
        isCurrent: true,
      },
      data: { isCurrent: false },
    });

    await tx.meetingRecordSummary.upsert({
      where: {
        meetingRecordId_version: {
          meetingRecordId: params.meetingRecordId,
          version: 2,
        },
      },
      create: {
        meetingRecordId: params.meetingRecordId,
        version: 2,
        summaryText: text,
        source: "claude",
        model: tpl.model,
        promptSnapshot: systemPrompt,
        generatedAt: new Date(),
        isCurrent: true,
      },
      update: {
        summaryText: text,
        source: "claude",
        model: tpl.model,
        promptSnapshot: systemPrompt,
        generatedAt: new Date(),
        isCurrent: true,
      },
    });

    // MeetingRecord 側の「現行版キャッシュ」を更新
    await tx.contactHistoryMeetingRecord.update({
      where: { id: params.meetingRecordId },
      data: {
        aiSummary: text,
        aiSummarySource: "claude",
        aiSummaryModel: tpl.model,
        aiSummaryGeneratedAt: new Date(),
      },
    });
  });

  return { summaryText: text, model: tpl.model, promptSnapshot: systemPrompt };
}

// ============================================================================
// 顧客名の resolve (loaders.ts と共通化してもよいが、循環依存回避のため個別実装)
// ============================================================================
async function resolveCustomerName(
  targetType: string | null,
  targetId: number | null,
): Promise<string | null> {
  if (!targetType || targetId == null) return null;

  switch (targetType) {
    case "stp_company": {
      const row = await prisma.stpCompany.findUnique({
        where: { id: targetId },
        include: { company: { select: { name: true } } },
      });
      return row?.company?.name ?? null;
    }
    case "stp_agent": {
      const row = await prisma.stpAgent.findUnique({
        where: { id: targetId },
        include: { company: { select: { name: true } } },
      });
      return row?.company?.name ?? null;
    }
    case "slp_company_record": {
      const row = await prisma.slpCompanyRecord.findUnique({
        where: { id: targetId },
        select: { companyName: true },
      });
      return row?.companyName ?? null;
    }
    case "slp_agency": {
      const row = await prisma.slpAgency.findUnique({
        where: { id: targetId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
    case "hojo_vendor": {
      const row = await prisma.hojoVendor.findUnique({
        where: { id: targetId },
        select: { name: true },
      });
      return row?.name ?? null;
    }
  }
  return null;
}
