"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ok, err, wrapAction, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { generateTrainingReportPdf } from "@/lib/hojo/training-report-generator";
import { generateSupportApplicationPdf } from "@/lib/hojo/support-application-generator";
import { generateBusinessPlanPdf } from "@/lib/hojo/business-plan-generator";
import { renderBusinessPlanPdfOnly } from "@/lib/hojo/business-plan-pdf-renderer";
import { BUSINESS_PLAN_SECTIONS, type BusinessPlanSectionKey } from "@/lib/hojo/business-plan-sections";
import { getCurrentAnswer } from "@/lib/hojo/form-answer-sections";
import { parseYmdDate } from "@/lib/hojo/parse-date";
import { type RpaDocKey } from "@/lib/hojo/rpa-document-config";
import { checkDailyApiCostLimit } from "@/lib/hojo/api-cost-limit";
import { acquirePdfGenerationLock, releasePdfGenerationLock } from "@/lib/hojo/pdf-generation-lock";
import {
  APPLICATION_FORM_UPDATE_STATUS,
  calculateGrantPaymentAmounts,
} from "@/lib/hojo/application-support-wholesale";

const REVALIDATE_PATH = "/hojo/application-support";

function revalidateApplicationSupportPaths() {
  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/vendor");
  revalidatePath("/hojo/security-cloud/accounts");
  revalidatePath("/hojo/form-submissions");
  revalidatePath("/hojo/bbs");
  revalidatePath("/hojo/bbs/form-answers");
}

type ChangeEntry = {
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
};

type ChangeHistoryRecord = {
  changedAt: string;
  changedBy: string;
  changes: ChangeEntry[];
};

function flattenAnswers(value: unknown, prefix = ""): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, string> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "_meta") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, flattenAnswers(child, path));
    } else {
      result[path] = child == null ? "" : String(child);
    }
  }
  return result;
}

function mergeAnswers(base: Record<string, unknown>, pending: Record<string, unknown>) {
  return { ...base, ...pending };
}

async function runRegenerator<T>(
  logLabel: string,
  applicationSupportId: number,
  docType: RpaDocKey,
  generator: (id: number) => Promise<T>,
): Promise<ActionResult<T>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  // 事業計画書のみ Claude API を使うので日次費用上限をチェック
  if (docType === "businessPlan") {
    const limit = await checkDailyApiCostLimit();
    if (!limit.allowed) {
      return err(
        `本日のAPI費用上限（¥${limit.limitYen.toLocaleString()}）に達しました。管理者が「制限解除」を行うと継続できます。現在: ¥${limit.dailyUsageYen.toLocaleString()}`,
      );
    }
  }

  // 資料種別ごとの独立ロック（他の資料と並列実行OK、同じ資料の重複はブロック）
  const acquired = await acquirePdfGenerationLock(applicationSupportId, docType);
  if (!acquired) {
    return err("この資料は生成中です。完了してからお試しください。");
  }

  // ポーリング中の他セッションが即座に「生成中」検知できるよう即時 revalidate
  revalidatePath(REVALIDATE_PATH);

  try {
    const result = await generator(applicationSupportId);
    revalidatePath(REVALIDATE_PATH);
    return ok(result);
  } catch (e) {
    console.error(`[${logLabel}] error:`, e);
    return err(e instanceof Error ? e.message : "PDFの生成に失敗しました");
  } finally {
    await releasePdfGenerationLock(applicationSupportId, docType);
    revalidatePath(REVALIDATE_PATH);
  }
}

export async function regenerateTrainingReport(
  applicationSupportId: number,
): Promise<ActionResult<{ filePath: string; fileName: string }>> {
  return runRegenerator("regenerateTrainingReport", applicationSupportId, "trainingReport", generateTrainingReportPdf);
}

export async function regenerateSupportApplication(
  applicationSupportId: number,
): Promise<ActionResult<{ filePath: string; fileName: string }>> {
  return runRegenerator("regenerateSupportApplication", applicationSupportId, "supportApplication", generateSupportApplicationPdf);
}

/** 事業計画書を Claude API で再生成する（編集内容はリセットされ、旧PDFはバックアップされる）。 */
export async function regenerateBusinessPlan(
  applicationSupportId: number,
): Promise<ActionResult<{ filePath: string; fileName: string; costUsd: number }>> {
  return runRegenerator("regenerateBusinessPlan", applicationSupportId, "businessPlan", generateBusinessPlanPdf);
}

/**
 * 資料保管モーダルの「共有確定」ボタン用アクション。
 * formTranscriptDate を今日で上書きし、BBS画面への表示を有効にする。
 * 条件: 資料が1件以上生成済みであること。
 */
export const shareWithBbs = wrapAction(async (applicationSupportId: number) => {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  const documentCount = await prisma.hojoApplicationSupportDocument.count({
    where: { applicationSupportId },
  });
  if (documentCount === 0) {
    throw new Error("共有する資料がありません。先にRPA実行で資料を生成してください");
  }

  const now = new Date();
  await prisma.hojoApplicationSupport.update({
    where: { id: applicationSupportId },
    data: { formTranscriptDate: now },
  });

  revalidatePath(REVALIDATE_PATH);
  revalidatePath("/hojo/form-submissions");
  revalidatePath("/hojo/bbs");
  revalidatePath("/hojo/bbs/form-answers");
  return { sharedAt: now.toISOString() };
});

/** 直前の再生成でバックアップされた事業計画書の編集内容・PDFを復元する。 */
export async function restorePreviousBusinessPlan(
  applicationSupportId: number,
): Promise<ActionResult<{ filePath: string; fileName: string }>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const doc = await prisma.hojoApplicationSupportDocument.findUnique({
      where: { applicationSupportId_docType: { applicationSupportId, docType: "business_plan" } },
    });
    if (!doc) return err("事業計画書が存在しません");
    if (!doc.previousFilePath || !doc.previousFileName) {
      return err("復元できる以前のバージョンがありません");
    }

    // 現在のPDFは破棄せず、previous→current に入れ替える（履歴は1世代のみ保持）
    await prisma.hojoApplicationSupportDocument.update({
      where: { applicationSupportId_docType: { applicationSupportId, docType: "business_plan" } },
      data: {
        filePath: doc.previousFilePath,
        fileName: doc.previousFileName,
        editedSections: doc.previousEditedSections ?? Prisma.JsonNull,
        previousFilePath: null,
        previousFileName: null,
        previousEditedSections: Prisma.JsonNull,
        generatedAt: new Date(),
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok({ filePath: doc.previousFilePath, fileName: doc.previousFileName });
  } catch (e) {
    console.error("[restorePreviousBusinessPlan] error:", e);
    return err(e instanceof Error ? e.message : "復元に失敗しました");
  }
}

const SectionKeySchema = z.enum(
  BUSINESS_PLAN_SECTIONS.map((s) => s.key) as [BusinessPlanSectionKey, ...BusinessPlanSectionKey[]],
);
const EditedSectionsSchema = z.record(SectionKeySchema, z.string().min(1, "空のセクションは保存できません"));

/**
 * 編集後の事業計画書テキストを保存し、PDFを再生成する。Claude API は呼ばない。
 */
export async function saveBusinessPlanEdits(
  applicationSupportId: number,
  editedSections: unknown,
): Promise<ActionResult<{ filePath: string; fileName: string }>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const parsed = EditedSectionsSchema.safeParse(editedSections);
    if (!parsed.success) return err("編集内容の形式が不正です");

    const doc = await prisma.hojoApplicationSupportDocument.findUnique({
      where: {
        applicationSupportId_docType: {
          applicationSupportId,
          docType: "business_plan",
        },
      },
    });
    if (!doc) return err("事業計画書が生成されていません。先に確定または再生成してください");

    const generated = (doc.generatedSections as Record<string, string> | null) ?? {};
    // PDF 生成用にはマージ、DB には「generated と異なるキーのみ」を保存する
    const merged: Record<string, string> = { ...generated, ...parsed.data };
    for (const def of BUSINESS_PLAN_SECTIONS) {
      if (!merged[def.key]) return err(`セクション "${def.title}" が空です`);
    }
    // generated と一致するキーは編集扱いしない
    const diffOnly: Record<string, string> = {};
    for (const [k, v] of Object.entries(parsed.data)) {
      if (generated[k] !== v) diffOnly[k] = v;
    }

    // 申請者の屋号と氏名を取り直す
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
      include: {
        linkedFormSubmissions: {
          where: { deletedAt: null, formType: "business-plan" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    });
    const submission = record?.linkedFormSubmissions[0];
    const answers = (submission?.answers as Record<string, unknown>) ?? {};
    const modifiedAnswers = (submission?.modifiedAnswers as Record<string, unknown> | null) ?? null;
    const tradeName = getCurrentAnswer(answers, modifiedAnswers, "basic", "tradeName");
    const fullName = getCurrentAnswer(answers, modifiedAnswers, "basic", "fullName");

    const result = await renderBusinessPlanPdfOnly({
      applicationSupportId,
      tradeName,
      fullName,
      sections: merged as Record<BusinessPlanSectionKey, string>,
    });

    await prisma.hojoApplicationSupportDocument.update({
      where: {
        applicationSupportId_docType: {
          applicationSupportId,
          docType: "business_plan",
        },
      },
      data: {
        editedSections:
          Object.keys(diffOnly).length > 0
            ? (diffOnly as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok(result);
  } catch (e) {
    console.error("[saveBusinessPlanEdits] error:", e);
    return err(e instanceof Error ? e.message : "保存に失敗しました");
  }
}

export async function updateApplicationSupport(id: number, data: Record<string, unknown>): Promise<ActionResult> {
  // 認証: 補助金プロジェクトの編集権限以上
  // 注: getSession() の redirect を伝播させるため try/catch の外で呼ぶ
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const updateData: Record<string, unknown> = {};

    if (data.vendorId !== undefined) {
      const newVendorId = data.vendorId ? Number(data.vendorId) : null;
      updateData.vendorId = newVendorId;
      // ベンダーを手動で変更した場合はフラグを立てる
      updateData.vendorIdManual = true;
    }
    if (data.statusId !== undefined) {
      updateData.statusId = data.statusId ? Number(data.statusId) : null;
    }
    if (data.applicantName !== undefined) {
      updateData.applicantName = data.applicantName ? String(data.applicantName).trim() : null;
    }
    if (data.detailMemo !== undefined) {
      updateData.detailMemo = data.detailMemo ? String(data.detailMemo).trim() : null;
    }
    if (data.alkesMemo !== undefined) {
      updateData.alkesMemo = data.alkesMemo ? String(data.alkesMemo).trim() : null;
    }

    const dateFields = [
      "formAnswerDate", "formTranscriptDate",
      "paymentReceivedDate", "bbsTransferDate",
    ];
    for (const field of dateFields) {
      if (data[field] !== undefined) {
        updateData[field] = parseYmdDate(data[field] as string | null | undefined);
      }
    }

    const numberFields = ["paymentReceivedAmount", "bbsTransferAmount", "subsidyAmount"];
    for (const field of numberFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field] !== null && data[field] !== "" ? Number(data[field]) : null;
      }
    }

    if (data.subsidyAmount !== undefined) {
      Object.assign(
        updateData,
        calculateGrantPaymentAmounts(updateData.subsidyAmount as number | null),
      );
    }

    if (data.documentStorageUrl !== undefined) {
      updateData.documentStorageUrl = data.documentStorageUrl ? String(data.documentStorageUrl).trim() : null;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.hojoApplicationSupport.update({
        where: { id },
        data: updateData,
      });
    }

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[updateApplicationSupport] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function approveGrantUsageChange(applicationSupportId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
      include: { wholesaleAccount: true },
    });
    if (!record || !record.grantUsagePending || !record.wholesaleAccountId) {
      return err("承認待ちの変更が見つかりません");
    }

    const nextUsage = record.grantUsagePending;
    await prisma.$transaction(async (tx) => {
      await tx.hojoWholesaleAccount.update({
        where: { id: record.wholesaleAccountId! },
        data: { grantUsage: nextUsage },
      });
      await tx.hojoApplicationSupport.update({
        where: { id: record.id },
        data: {
          grantUsageApproved: nextUsage,
          grantUsagePending: null,
          grantUsageChangeRequestedAt: null,
          deletedAt: nextUsage === "有" ? null : new Date(),
        },
      });
    });

    revalidateApplicationSupportPaths();
    return ok();
  } catch (e) {
    console.error("[approveGrantUsageChange] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function rejectGrantUsageChange(applicationSupportId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
    });
    if (!record || !record.grantUsagePending || !record.wholesaleAccountId) {
      return err("却下できる変更が見つかりません");
    }

    const approvedUsage = record.grantUsageApproved ?? (record.deletedAt ? "無" : "有");
    await prisma.$transaction(async (tx) => {
      await tx.hojoWholesaleAccount.update({
        where: { id: record.wholesaleAccountId! },
        data: { grantUsage: approvedUsage },
      });
      await tx.hojoApplicationSupport.update({
        where: { id: record.id },
        data: {
          grantUsagePending: null,
          grantUsageChangeRequestedAt: null,
          deletedAt: approvedUsage === "有" ? null : new Date(),
        },
      });
    });

    revalidateApplicationSupportPaths();
    return ok();
  } catch (e) {
    console.error("[rejectGrantUsageChange] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function applyPendingBusinessPlanSubmission(applicationSupportId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
      include: {
        linkedFormSubmissions: {
          where: { deletedAt: null, formType: "business-plan" },
          orderBy: { submittedAt: "desc" },
          take: 1,
        },
      },
    });
    const submission = record?.linkedFormSubmissions[0];
    if (!record || !record.pendingAnswers || !submission) {
      return err("反映できる修正申請がありません");
    }

    const pendingAnswers = record.pendingAnswers as Record<string, unknown>;
    const currentAnswers = (submission.modifiedAnswers ?? submission.answers) as Record<string, unknown>;
    const before = flattenAnswers(currentAnswers);
    const after = flattenAnswers(pendingAnswers);
    const changes: ChangeEntry[] = [];
    for (const [field, newValue] of Object.entries(after)) {
      const oldValue = before[field] ?? "";
      if (oldValue !== newValue) {
        changes.push({ field, fieldLabel: field, oldValue, newValue });
      }
    }

    const existingHistory = (submission.changeHistory as ChangeHistoryRecord[] | null) ?? [];
    const historyEntry: ChangeHistoryRecord = {
      changedAt: new Date().toISOString(),
      changedBy: "弊社スタッフ",
      changes,
    };

    await prisma.$transaction(async (tx) => {
      await tx.hojoFormSubmission.update({
        where: { id: submission.id },
        data: {
          modifiedAnswers: mergeAnswers(currentAnswers, pendingAnswers) as Prisma.InputJsonValue,
          fileUrls: record.pendingFileUrls ?? submission.fileUrls ?? Prisma.JsonNull,
          changeHistory: (changes.length > 0 ? [...existingHistory, historyEntry] : existingHistory) as Prisma.InputJsonValue,
        },
      });
      await tx.hojoApplicationSupport.update({
        where: { id: record.id },
        data: {
          pendingAnswers: Prisma.DbNull,
          pendingFileUrls: Prisma.DbNull,
          formUpdateStatus: APPLICATION_FORM_UPDATE_STATUS.APPLIED,
        },
      });
    });

    revalidateApplicationSupportPaths();
    return ok();
  } catch (e) {
    console.error("[applyPendingBusinessPlanSubmission] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function rejectPendingBusinessPlanSubmission(applicationSupportId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
    });
    if (!record || !record.pendingAnswers) {
      return err("却下できる修正申請がありません");
    }

    await prisma.hojoApplicationSupport.update({
      where: { id: record.id },
      data: {
        pendingAnswers: Prisma.DbNull,
        pendingFileUrls: Prisma.DbNull,
        formUpdateStatus: APPLICATION_FORM_UPDATE_STATUS.REJECTED,
      },
    });

    revalidateApplicationSupportPaths();
    return ok();
  } catch (e) {
    console.error("[rejectPendingBusinessPlanSubmission] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
