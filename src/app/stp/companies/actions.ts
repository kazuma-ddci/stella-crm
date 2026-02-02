"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { detectInitialEvents } from "@/lib/stage-transition/event-detector";
import { validateInitialStage } from "@/lib/stage-transition/alert-validator";
import { StageInfo, StageType } from "@/lib/stage-transition/types";

// 配列またはカンマ区切り文字列を文字列に変換するヘルパー関数
function toCommaSeparatedString(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((v) => v).join(",") || null;
  }
  return String(value) || null;
}

export async function addStpCompany(data: Record<string, unknown>) {
  const currentStageId = data.currentStageId ? Number(data.currentStageId) : null;
  const nextTargetStageId = data.nextTargetStageId ? Number(data.nextTargetStageId) : null;
  const nextTargetDate = data.nextTargetDate ? new Date(data.nextTargetDate as string) : null;

  // ステージマスタを取得してバリデーション
  const stages = await prisma.stpStage.findMany({
    where: { isActive: true },
    orderBy: [
      { displayOrder: { sort: "asc", nulls: "last" } },
      { id: "asc" },
    ],
  });
  const stageInfos: StageInfo[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    displayOrder: s.displayOrder,
    stageType: s.stageType as StageType,
    isActive: s.isActive,
  }));

  // バリデーション
  const validation = validateInitialStage(
    currentStageId,
    nextTargetStageId,
    nextTargetDate,
    stageInfos
  );

  if (!validation.isValid) {
    const errorMessages = validation.alerts
      .filter((a) => a.severity === "ERROR")
      .map((a) => a.message)
      .join("\n");
    throw new Error(errorMessages || "バリデーションエラー");
  }

  // トランザクションで企業作成と履歴作成を実行
  await prisma.$transaction(async (tx) => {
    // 請求先担当者IDからメールアドレスを取得
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);
    let billingEmail: string | null = null;
    if (billingContactIds) {
      const contactIdList = billingContactIds.split(",").map((id) => Number(id.trim())).filter((id) => !isNaN(id));
      if (contactIdList.length > 0) {
        const contacts = await tx.stellaCompanyContact.findMany({
          where: { id: { in: contactIdList } },
          select: { id: true, email: true },
        });
        // IDの順序を保持してメールを取得
        const emailMap = new Map(contacts.map((c) => [c.id, c.email]));
        const emails = contactIdList
          .map((id) => emailMap.get(id))
          .filter((email): email is string => !!email);
        billingEmail = emails.length > 0 ? emails.join(",") : null;
      }
    }

    // 1. 企業を作成
    const company = await tx.stpCompany.create({
      data: {
        companyId: Number(data.companyId),
        agentId: data.agentId ? Number(data.agentId) : null,
        currentStageId,
        nextTargetStageId,
        nextTargetDate,
        leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
        meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
        firstKoDate: data.firstKoDate ? new Date(data.firstKoDate as string) : null,
        jobPostingStartDate: (data.jobPostingStartDate as string) || null,
        forecast: (data.forecast as string) || null,
        operationStatus: (data.operationStatus as string) || null,
        industryType: (data.industryType as string) || null,
        plannedHires: data.plannedHires ? Number(data.plannedHires) : null,
        leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
        // 契約情報
        contractPlan: (data.contractPlan as string) || null,
        media: (data.media as string) || null,
        contractStartDate: data.contractStartDate ? new Date(data.contractStartDate as string) : null,
        contractEndDate: data.contractEndDate ? new Date(data.contractEndDate as string) : null,
        initialFee: data.initialFee ? Number(data.initialFee) : null,
        monthlyFee: data.monthlyFee ? Number(data.monthlyFee) : null,
        performanceFee: data.performanceFee ? Number(data.performanceFee) : null,
        salesStaffId: data.salesStaffId ? Number(data.salesStaffId) : null,
        operationStaffList: (data.operationStaffList as string) || null,
        // アカウント情報
        accountId: (data.accountId as string) || null,
        accountPass: (data.accountPass as string) || null,
        // 請求先情報（複数選択はカンマ区切りで保存）
        billingLocationId: data.billingLocationId ? Number(data.billingLocationId) : null,
        billingContactId: data.billingContactId ? Number(data.billingContactId) : null,
        billingAddress: toCommaSeparatedString(data.billingAddress),
        // billingContactIds（担当者ID）をbillingRepresentativeに保存
        billingRepresentative: billingContactIds,
        // billingEmailは担当者IDから自動導出
        billingEmail,
        paymentTerms: (data.paymentTerms as string) || null,
        // 連絡方法
        communicationMethodId: data.communicationMethodId ? Number(data.communicationMethodId) : null,
        // その他
        note: (data.note as string) || null,
        contractNote: (data.contractNote as string) || null,
        pendingReason: (data.pendingReason as string) || null,
        lostReason: (data.lostReason as string) || null,
      },
    });

    // 2. 初回履歴を作成
    const events = detectInitialEvents(currentStageId, nextTargetStageId, nextTargetDate);

    for (const event of events) {
      await tx.stpStageHistory.create({
        data: {
          stpCompanyId: company.id,
          eventType: event.eventType,
          fromStageId: event.fromStageId,
          toStageId: event.toStageId,
          targetDate: event.targetDate,
          note: "新規登録",
          alertAcknowledged: false,
        },
      });
    }
  });

  revalidatePath("/stp/companies");
}

export async function updateStpCompany(id: number, data: Record<string, unknown>) {
  // 請求先担当者IDからメールアドレスを取得
  const billingContactIds = toCommaSeparatedString(data.billingContactIds);
  let billingEmail: string | null = null;
  if (billingContactIds) {
    const contactIdList = billingContactIds.split(",").map((id) => Number(id.trim())).filter((id) => !isNaN(id));
    if (contactIdList.length > 0) {
      const contacts = await prisma.stellaCompanyContact.findMany({
        where: { id: { in: contactIdList } },
        select: { id: true, email: true },
      });
      // IDの順序を保持してメールを取得
      const emailMap = new Map(contacts.map((c) => [c.id, c.email]));
      const emails = contactIdList
        .map((id) => emailMap.get(id))
        .filter((email): email is string => !!email);
      billingEmail = emails.length > 0 ? emails.join(",") : null;
    }
  }

  // ステージ関連フィールドは除外（ステージ管理モーダルから更新）
  await prisma.stpCompany.update({
    where: { id },
    data: {
      companyId: Number(data.companyId),
      agentId: data.agentId ? Number(data.agentId) : null,
      // currentStageId, nextTargetStageId, nextTargetDate は更新しない
      leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
      meetingDate: data.meetingDate ? new Date(data.meetingDate as string) : null,
      firstKoDate: data.firstKoDate ? new Date(data.firstKoDate as string) : null,
      jobPostingStartDate: (data.jobPostingStartDate as string) || null,
      forecast: (data.forecast as string) || null,
      operationStatus: (data.operationStatus as string) || null,
      industryType: (data.industryType as string) || null,
      plannedHires: data.plannedHires ? Number(data.plannedHires) : null,
      leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
      // 契約情報
      contractPlan: (data.contractPlan as string) || null,
      media: (data.media as string) || null,
      contractStartDate: data.contractStartDate ? new Date(data.contractStartDate as string) : null,
      contractEndDate: data.contractEndDate ? new Date(data.contractEndDate as string) : null,
      initialFee: data.initialFee ? Number(data.initialFee) : null,
      monthlyFee: data.monthlyFee ? Number(data.monthlyFee) : null,
      performanceFee: data.performanceFee ? Number(data.performanceFee) : null,
      salesStaffId: data.salesStaffId ? Number(data.salesStaffId) : null,
      operationStaffList: (data.operationStaffList as string) || null,
      // アカウント情報
      accountId: (data.accountId as string) || null,
      accountPass: (data.accountPass as string) || null,
      // 請求先情報（複数選択はカンマ区切りで保存）
      billingLocationId: data.billingLocationId ? Number(data.billingLocationId) : null,
      billingContactId: data.billingContactId ? Number(data.billingContactId) : null,
      billingAddress: toCommaSeparatedString(data.billingAddress),
      // billingContactIds（担当者ID）をbillingRepresentativeに保存
      billingRepresentative: billingContactIds,
      // billingEmailは担当者IDから自動導出
      billingEmail,
      paymentTerms: (data.paymentTerms as string) || null,
      // 連絡方法
      communicationMethodId: data.communicationMethodId ? Number(data.communicationMethodId) : null,
      // その他
      note: (data.note as string) || null,
      contractNote: (data.contractNote as string) || null,
      pendingReason: (data.pendingReason as string) || null,
      lostReason: (data.lostReason as string) || null,
    },
  });
  revalidatePath("/stp/companies");
}

export async function deleteStpCompany(id: number) {
  await prisma.stpCompany.delete({
    where: { id },
  });
  revalidatePath("/stp/companies");
}
