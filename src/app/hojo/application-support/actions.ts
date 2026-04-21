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

const REVALIDATE_PATH = "/hojo/application-support";

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
      "paymentReceivedDate", "bbsTransferDate", "subsidyReceivedDate",
    ];
    for (const field of dateFields) {
      if (data[field] !== undefined) {
        updateData[field] = parseYmdDate(data[field] as string | null | undefined);
      }
    }

    const numberFields = ["paymentReceivedAmount", "bbsTransferAmount"];
    for (const field of numberFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field] ? Number(data[field]) : null;
      }
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

/** 同一LINEアカウントの新規レコードを追加（複製） */
export async function addApplicationSupportRecord(lineFriendId: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    await prisma.hojoApplicationSupport.create({
      data: { lineFriendId },
    });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[addApplicationSupportRecord] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 申請者管理レコードの論理削除 */
export async function deleteApplicationSupportRecord(id: number): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    // 同一lineFriendIdのレコードが他にあるか確認
    const record = await prisma.hojoApplicationSupport.findUnique({
      where: { id },
      select: { lineFriendId: true },
    });
    if (!record) return ok();

    const siblingCount = await prisma.hojoApplicationSupport.count({
      where: { lineFriendId: record.lineFriendId, deletedAt: null, id: { not: id } },
    });

    if (siblingCount === 0) {
      return err("最後の1レコードは削除できません。最低1レコードは必要です。");
    }

    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[deleteApplicationSupportRecord] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 紹介元ベンダーの不一致を解決する */
export async function resolveVendorMismatch(
  id: number,
  action: "accept" | "keep"
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    if (action === "accept") {
      // free1から解決されたベンダーを受け入れる → vendorIdManualをfalseに戻してsyncに任せる
      // resolvedVendorIdはクライアントから受け取る
      // ここでは単にvendorIdManualをfalseにリセットし、syncが次回拾う
      await prisma.hojoApplicationSupport.update({
        where: { id },
        data: { vendorIdManual: false, vendorId: null },
      });
    } else {
      // 現在のベンダーを維持 → vendorIdManualをtrueにして今後の自動変更を防ぐ
      await prisma.hojoApplicationSupport.update({
        where: { id },
        data: { vendorIdManual: true },
      });
    }
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[resolveVendorMismatch] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

/** 紹介元ベンダーの不一致を解決する（新しいベンダーを指定して受け入れ） */
export async function acceptResolvedVendor(id: number, newVendorId: number | null): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    await prisma.hojoApplicationSupport.update({
      where: { id },
      data: { vendorId: newVendorId, vendorIdManual: false },
    });
    revalidatePath(REVALIDATE_PATH);
    return ok();
  } catch (e) {
    console.error("[acceptResolvedVendor] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
