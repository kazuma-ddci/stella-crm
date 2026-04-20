"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ok, err, type ActionResult } from "@/lib/action-result";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { extractSubmissionMeta } from "@/lib/hojo/form-answer-sections";
import { generateTrainingReportPdf } from "@/lib/hojo/training-report-generator";
import { generateSupportApplicationPdf } from "@/lib/hojo/support-application-generator";
import { generateBusinessPlanPdf } from "@/lib/hojo/business-plan-generator";
import { checkDailyApiCostLimit } from "@/lib/hojo/api-cost-limit";

const ModifiedAnswersSchema = z.record(
  z.string(),
  z.record(z.string(), z.union([z.string(), z.null()])),
);

function revalidateEditPaths() {
  revalidatePath("/hojo/form-submissions");
  revalidatePath("/hojo/application-support");
}

function revalidateConfirmPaths() {
  revalidateEditPaths();
  revalidatePath("/hojo/bbs");
  revalidatePath("/hojo/bbs/form-answers");
}

export async function saveDraftAnswers(
  submissionId: number,
  modifiedAnswers: unknown,
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const parsed = ModifiedAnswersSchema.safeParse(modifiedAnswers);
    if (!parsed.success) return err("編集データの形式が不正です");

    await prisma.hojoFormSubmission.update({
      where: { id: submissionId },
      data: { modifiedAnswers: parsed.data as Prisma.InputJsonValue },
    });

    revalidateEditPaths();
    return ok();
  } catch (e) {
    console.error("[saveDraftAnswers] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

export async function linkSubmissionToApplicationSupport(
  submissionId: number,
  applicationSupportId: number,
): Promise<ActionResult> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);
  try {
    const submission = await prisma.hojoFormSubmission.findUnique({
      where: { id: submissionId },
      select: { id: true, answers: true, deletedAt: true },
    });
    if (!submission || submission.deletedAt) return err("回答が見つかりません");

    const { uid } = extractSubmissionMeta(submission.answers as Record<string, unknown>);
    if (!uid) return err("この回答はUIDが記録されていないため紐付けできません");

    const appSupport = await prisma.hojoApplicationSupport.findUnique({
      where: { id: applicationSupportId },
      select: { id: true, deletedAt: true, lineFriend: { select: { uid: true } } },
    });
    if (!appSupport || appSupport.deletedAt) return err("申請者レコードが見つかりません");
    if (appSupport.lineFriend.uid !== uid) {
      return err("この申請者レコードは回答のUIDと一致しません");
    }

    await prisma.hojoFormSubmission.update({
      where: { id: submissionId },
      data: {
        linkedApplicationSupportId: applicationSupportId,
        linkedAt: new Date(),
      },
    });

    revalidateEditPaths();
    return ok();
  } catch (e) {
    console.error("[linkSubmissionToApplicationSupport] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}

type SelectedDocs = {
  trainingReport: boolean;
  supportApplication: boolean;
  businessPlan: boolean;
};

type DocResultStatus = "ok" | "failed" | "skipped";
type DocResults = Record<keyof SelectedDocs, DocResultStatus>;

/**
 * RPA実行処理：選択された資料のPDFだけを生成する。
 * 未保存編集があれば同トランザクション内で先に modifiedAnswers を保存する。
 * 旧「確定」挙動のうち、formTranscriptDate 設定（BBS共有）は別アクション shareWithBbs に分離。
 * ここでは confirmedAt（RPA実行日時）のみ更新する。
 */
const RPA_STALE_MS = 10 * 60 * 1000; // 10分以上前のフラグは stale として無視

export async function confirmSubmission(
  submissionId: number,
  pendingModifiedAnswers?: unknown,
  selectedDocs: SelectedDocs = { trainingReport: true, supportApplication: true, businessPlan: true },
): Promise<ActionResult<{ warnings: string[]; results: DocResults }>> {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "edit" }]);

  let parsedModified: Prisma.InputJsonValue | undefined;
  if (pendingModifiedAnswers !== undefined) {
    const parsed = ModifiedAnswersSchema.safeParse(pendingModifiedAnswers);
    if (!parsed.success) return err("編集データの形式が不正です");
    parsedModified = parsed.data as Prisma.InputJsonValue;
  }

  const submission = await prisma.hojoFormSubmission.findUnique({
    where: { id: submissionId },
    select: { id: true, deletedAt: true, linkedApplicationSupportId: true },
  });
  if (!submission || submission.deletedAt) return err("回答が見つかりません");
  if (!submission.linkedApplicationSupportId) {
    return err("申請者レコードとの紐付けが必要です。先に紐付けを行ってください");
  }

  const linkedId = submission.linkedApplicationSupportId;

  // 支援制度申請書のチェックがついているが助成金額が未入力ならエラー
  if (selectedDocs.supportApplication) {
    const app = await prisma.hojoApplicationSupport.findUnique({
      where: { id: linkedId },
      select: { subsidyAmount: true },
    });
    if (!app || app.subsidyAmount == null) {
      return err("助成金額が未入力のため支援制度申請書は生成できません");
    }
  }

  // 排他制御：rpa_running_at が null か stale のときだけセット（アトミック）
  const staleBefore = new Date(Date.now() - RPA_STALE_MS);
  const acquired = await prisma.hojoFormSubmission.updateMany({
    where: {
      id: submissionId,
      OR: [{ rpaRunningAt: null }, { rpaRunningAt: { lt: staleBefore } }],
    },
    data: { rpaRunningAt: new Date() },
  });
  if (acquired.count === 0) {
    return err("この回答データはRPA実行中です。完了してから再度お試しください。");
  }

  try {
    // 未保存編集だけ先に保存（PDF失敗とは独立して保存はしたい）
    if (parsedModified !== undefined) {
      await prisma.hojoFormSubmission.update({
        where: { id: submissionId },
        data: { modifiedAnswers: parsedModified },
      });
    }

    const warnings: string[] = [];
    if (selectedDocs.businessPlan && !process.env.ANTHROPIC_API_KEY) {
      warnings.push("ANTHROPIC_API_KEY が未設定のため事業計画書PDFは生成されません");
    }

    // 事業計画書が選択されている場合のみ日次費用上限チェック
    let businessPlanBlocked = false;
    if (selectedDocs.businessPlan) {
      const limit = await checkDailyApiCostLimit();
      if (!limit.allowed) {
        businessPlanBlocked = true;
        warnings.push(
          `本日のAPI費用上限（¥${limit.limitYen.toLocaleString()}）に達したため事業計画書は生成しません。現在: ¥${limit.dailyUsageYen.toLocaleString()}。管理者が「制限解除」を行うと継続できます。`,
        );
      }
    }

    const pdfTasks: Array<{ key: keyof SelectedDocs; label: string; run: () => Promise<unknown> }> = [
      { key: "trainingReport", label: "研修終了報告書", run: () => generateTrainingReportPdf(linkedId) },
      { key: "supportApplication", label: "支援制度申請書", run: () => generateSupportApplicationPdf(linkedId) },
      ...(businessPlanBlocked
        ? []
        : [{ key: "businessPlan" as const, label: "事業計画書", run: () => generateBusinessPlanPdf(linkedId) }]),
    ];

    const results: DocResults = {
      trainingReport: "skipped",
      supportApplication: "skipped",
      businessPlan: "skipped",
    };

    const targets = pdfTasks.filter((t) => selectedDocs[t.key]);
    const settled = await Promise.allSettled(targets.map((t) => t.run()));
    let anyOk = false;
    settled.forEach((r, i) => {
      const task = targets[i];
      if (r.status === "fulfilled") {
        results[task.key] = "ok";
        anyOk = true;
      } else {
        results[task.key] = "failed";
        console.error(`[confirmSubmission] ${task.label}PDF生成失敗:`, r.reason);
        warnings.push(`${task.label}PDFの生成に失敗しました（ログ参照）`);
      }
    });

    // 1件でも成功したときだけ confirmedAt を更新（全滅時は「RPA実行済」バッジを出さない）
    if (anyOk) {
      await prisma.hojoFormSubmission.update({
        where: { id: submissionId },
        data: { confirmedAt: new Date() },
      });
    }

    revalidateConfirmPaths();
    return ok({ warnings, results });
  } catch (e) {
    console.error("[confirmSubmission] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  } finally {
    // 成功/失敗問わずフラグを解放（クラッシュ時は stale タイムアウトで救済）
    await prisma.hojoFormSubmission
      .update({ where: { id: submissionId }, data: { rpaRunningAt: null } })
      .catch((e) => console.error("[confirmSubmission] rpaRunningAt クリア失敗:", e));
  }
}
