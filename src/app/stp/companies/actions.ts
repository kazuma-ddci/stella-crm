"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireEdit } from "@/lib/auth";
import { detectInitialEvents } from "@/lib/stage-transition/event-detector";
import { validateInitialStage } from "@/lib/stage-transition/alert-validator";
import { StageInfo, StageType } from "@/lib/stage-transition/types";
import { validateStaffForField } from "@/lib/staff/get-staff-by-field";
import { createFieldChangeLogEntries, FieldChange } from "@/lib/field-change-log.server";
import { logActivity } from "@/lib/activity-log/log";
import { calcChanges } from "@/lib/activity-log/utils";
import { ok, err, type ActionResult } from "@/lib/action-result";

// 配列またはカンマ区切り文字列を文字列に変換するヘルパー関数
function toCommaSeparatedString(value: unknown): string | null {
  if (!value) return null;
  if (Array.isArray(value)) {
    return value.filter((v) => v).join(",") || null;
  }
  return String(value) || null;
}

// 変更履歴管理対象フィールドの定義
const TRACKED_FIELDS: Record<string, { displayName: string; fieldCode?: string }> = {
  salesStaffId: { displayName: "担当営業", fieldCode: "STP_COMPANY_SALES" },
  adminStaffId: { displayName: "担当事務", fieldCode: "STP_COMPANY_ADMIN" },
  plannedHires: { displayName: "採用予定人数" },
  billingContactIds: { displayName: "請求先担当者" },
};

export async function addStpCompany(data: Record<string, unknown>): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
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
    return err(errorMessages || "バリデーションエラー");
  }

  // 企業IDの重複チェック
  const companyId = Number(data.companyId);
  const existingStpCompany = await prisma.stpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });

  if (existingStpCompany) {
    return err(
      `この企業はすでにSTPプロジェクトに登録されています（プロジェクトNo. ${existingStpCompany.id}）`
    );
  }

  // サーバー側スタッフ権限バリデーション
  if (data.salesStaffId) {
    const isValid = await validateStaffForField("STP_COMPANY_SALES", Number(data.salesStaffId));
    if (!isValid) return err("選択された担当営業はこのフィールドに割り当てできません");
  }
  if (data.adminStaffId) {
    const isValid = await validateStaffForField("STP_COMPANY_ADMIN", Number(data.adminStaffId));
    if (!isValid) return err("選択された担当事務はこのフィールドに割り当てできません");
  }

  // トランザクションで企業作成と履歴作成を実行
  const result = await prisma.$transaction(async (tx) => {
    // 請求先担当者ID
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);

    // 1. 企業を作成
    const company = await tx.stpCompany.create({
      data: {
        companyId,
        agentId: data.agentId ? Number(data.agentId) : null,
        currentStageId,
        nextTargetStageId,
        nextTargetDate,
        leadAcquiredDate: data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null,
        forecast: (data.forecast as string) || null,
        plannedHires: data.plannedHires ? Number(data.plannedHires) : null,
        leadSourceId: data.leadSourceId ? Number(data.leadSourceId) : null,
        salesStaffId: data.salesStaffId ? Number(data.salesStaffId) : null,
        adminStaffId: data.adminStaffId ? Number(data.adminStaffId) : null,
        // 請求先情報（複数選択はカンマ区切りで保存）
        billingLocationId: data.billingLocationId ? Number(data.billingLocationId) : null,
        billingAddress: toCommaSeparatedString(data.billingAddress),
        // billingContactIds（担当者ID）をbillingRepresentativeに保存
        billingRepresentative: billingContactIds,
        // 案件・商材
        hasDeal: (data.hasDeal as string) || null,
        proposedProductIds: toCommaSeparatedString(data.proposedProductIds),
        // その他
        note: (data.note as string) || null,
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

    return company;
  });

  const companyForLog = await prisma.masterStellaCompany.findUnique({ where: { id: companyId }, select: { name: true } });
  await logActivity({
    model: "StpCompany",
    recordId: result.id,
    action: "create",
    summary: `企業「${companyForLog?.name ?? String(companyId)}」を作成`,
    changes: {
      企業ID: { old: null, new: companyId },
      ヨミ: { old: null, new: data.forecast ?? null },
      メモ: { old: null, new: data.note ?? null },
    },
    userId: user.id,
  });
  revalidatePath("/stp/companies", "layout");
  return ok();
 } catch (e) {
  console.error("[addStpCompany] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// updateStpCompany用のフィールドラベルマッピング
const UPDATE_FIELD_LABELS: Record<string, string> = {
  companyId: "企業ID",
  agentId: "代理店",
  leadAcquiredDate: "リード獲得日",
  leadValidity: "有効性",
  forecast: "ヨミ",
  plannedHires: "採用予定人数",
  leadSourceId: "流入経路",
  salesStaffId: "担当営業",
  adminStaffId: "担当事務",
  billingAddress: "請求先住所",
  billingLocationId: "請求先拠点",
  billingRepresentative: "請求先担当者",
  hasDeal: "案件有無",
  proposedProductIds: "提案中の商材",
  note: "メモ",
  pendingReason: "検討理由",
  lostReason: "失注理由",
  progressDetail: "進捗詳細",
  meetingDate: "商談日",
  industryType: "業種",
};

export async function updateStpCompany(id: number, data: Record<string, unknown>): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");

  // __changeNotesを取り出す（変更履歴用メモ）
  const changeNotes = (data.__changeNotes as Record<string, string>) || {};
  delete data.__changeNotes;

  // 更新データを動的に構築（渡されたフィールドのみを更新）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  // 企業ID（companyIdが渡された場合のみ）
  if ("companyId" in data) {
    updateData.companyId = Number(data.companyId);
  }

  // 代理店ID
  if ("agentId" in data) {
    updateData.agentId = data.agentId ? Number(data.agentId) : null;
  }

  // リード獲得日
  if ("leadAcquiredDate" in data) {
    updateData.leadAcquiredDate = data.leadAcquiredDate ? new Date(data.leadAcquiredDate as string) : null;
  }

  // リード有効性
  if ("leadValidity" in data) {
    updateData.leadValidity = (data.leadValidity as string) || null;
  }

  // ヨミ
  if ("forecast" in data) {
    updateData.forecast = (data.forecast as string) || null;
  }

  // 採用予定人数
  if ("plannedHires" in data) {
    updateData.plannedHires = data.plannedHires ? Number(data.plannedHires) : null;
  }

  // 流入経路ID
  if ("leadSourceId" in data) {
    updateData.leadSourceId = data.leadSourceId ? Number(data.leadSourceId) : null;
  }

  // 担当営業ID
  if ("salesStaffId" in data) {
    const staffId = data.salesStaffId ? Number(data.salesStaffId) : null;
    if (staffId) {
      const isValid = await validateStaffForField("STP_COMPANY_SALES", staffId);
      if (!isValid) return err("選択された担当営業はこのフィールドに割り当てできません");
    }
    updateData.salesStaffId = staffId;
  }

  // 担当事務ID
  if ("adminStaffId" in data) {
    const staffId = data.adminStaffId ? Number(data.adminStaffId) : null;
    if (staffId) {
      const isValid = await validateStaffForField("STP_COMPANY_ADMIN", staffId);
      if (!isValid) return err("選択された担当事務はこのフィールドに割り当てできません");
    }
    updateData.adminStaffId = staffId;
  }

  // 請求先住所（複数選択はカンマ区切りで保存）
  if ("billingAddress" in data) {
    updateData.billingAddress = toCommaSeparatedString(data.billingAddress);
  }

  // 請求先拠点ID
  if ("billingLocationId" in data) {
    updateData.billingLocationId = data.billingLocationId ? Number(data.billingLocationId) : null;
  }

  // 請求先担当者IDs（複数）- billingRepresentativeに保存
  if ("billingContactIds" in data) {
    const billingContactIds = toCommaSeparatedString(data.billingContactIds);
    updateData.billingRepresentative = billingContactIds;
  }

  // 案件有無
  if ("hasDeal" in data) {
    updateData.hasDeal = (data.hasDeal as string) || null;
  }

  // 提案中の商材
  if ("proposedProductIds" in data) {
    updateData.proposedProductIds = toCommaSeparatedString(data.proposedProductIds);
  }

  // 企業メモ
  if ("note" in data) {
    updateData.note = (data.note as string) || null;
  }

  // calcChanges用: 更新前のデータを取得（updateDataのキーだけ取得すれば十分）
  const updateKeys = Object.keys(updateData);
  const selectForBefore: Record<string, boolean> = {};
  for (const k of updateKeys) selectForBefore[k] = true;
  const beforeUpdateData: Record<string, unknown> = updateKeys.length > 0
    ? (await prisma.stpCompany.findUnique({ where: { id }, select: selectForBefore })) ?? {}
    : {};

  // 変更履歴管理対象フィールドがあるかチェック
  const trackedFieldKeys = Object.keys(TRACKED_FIELDS).filter((key) => key in data);
  const hasTrackedChanges = trackedFieldKeys.length > 0;

  // 検討理由・失注理由の更新チェック
  const isPendingReasonChanged = "pendingReason" in data;
  const isLostReasonChanged = "lostReason" in data;

  // トランザクションが必要な場合（変更履歴管理対象 or 理由変更）
  if (hasTrackedChanges || isPendingReasonChanged || isLostReasonChanged) {
    // 現在の値を取得（変更比較用）
    const company = await prisma.stpCompany.findUnique({
      where: { id },
      select: {
        pendingReason: true,
        lostReason: true,
        salesStaffId: true,
        adminStaffId: true,
        plannedHires: true,
        billingRepresentative: true,
        salesStaff: { select: { name: true } },
        adminStaff: { select: { name: true } },
      },
    });

    await prisma.$transaction(async (tx) => {
      // 変更履歴ログの作成
      if (hasTrackedChanges && company) {
        const changes: FieldChange[] = [];

        for (const key of trackedFieldKeys) {
          const tracked = TRACKED_FIELDS[key];
          const note = changeNotes[key];
          if (!note) continue; // メモがなければスキップ

          let oldValue: string | null = null;
          let newValue: string | null = null;
          // フィールドごとの値取得
          const dbFieldMapping: Record<string, string> = {
            billingContactIds: "billingRepresentative",
          };
          const dbKey = dbFieldMapping[key] || key;

          if (key === "salesStaffId") {
            oldValue = company.salesStaff?.name || (company.salesStaffId ? String(company.salesStaffId) : null);
            const newStaffId = updateData.salesStaffId;
            if (newStaffId) {
              const staff = await tx.masterStaff.findUnique({ where: { id: newStaffId }, select: { name: true } });
              newValue = staff?.name || String(newStaffId);
            }
          } else if (key === "adminStaffId") {
            oldValue = company.adminStaff?.name || (company.adminStaffId ? String(company.adminStaffId) : null);
            const newStaffId = updateData.adminStaffId;
            if (newStaffId) {
              const staff = await tx.masterStaff.findUnique({ where: { id: newStaffId }, select: { name: true } });
              newValue = staff?.name || String(newStaffId);
            }
          } else if (key === "billingContactIds") {
            oldValue = (company as Record<string, unknown>)[dbKey] as string | null;
            newValue = updateData.billingRepresentative as string | null;
          } else {
            const raw = (company as Record<string, unknown>)[dbKey];
            oldValue = raw != null ? String(raw) : null;
            newValue = updateData[dbKey] != null ? String(updateData[dbKey]) : null;
          }

          // 値が実際に変更された場合のみ記録
          if (oldValue !== newValue) {
            changes.push({
              fieldName: key,
              displayName: tracked.displayName,
              oldValue,
              newValue,
              note,
            });
          }
        }

        if (changes.length > 0) {
          await createFieldChangeLogEntries(tx, "stp_company", id, changes);
        }
      }

      // 検討理由の変更
      if (isPendingReasonChanged) {
        const newValue = (data.pendingReason as string) || null;
        if (company?.pendingReason !== newValue) {
          await tx.stpStageHistory.create({
            data: {
              stpCompanyId: id,
              eventType: "reason_updated",
              fromStageId: null,
              toStageId: null,
              targetDate: null,
              note: null,
              alertAcknowledged: false,
              pendingReason: newValue,
            },
          });
        }
        updateData.pendingReason = newValue;
      }

      // 失注理由の変更
      if (isLostReasonChanged) {
        const newValue = (data.lostReason as string) || null;
        if (company?.lostReason !== newValue) {
          await tx.stpStageHistory.create({
            data: {
              stpCompanyId: id,
              eventType: "reason_updated",
              fromStageId: null,
              toStageId: null,
              targetDate: null,
              note: null,
              alertAcknowledged: false,
              lostReason: newValue,
            },
          });
        }
        updateData.lostReason = newValue;
      }

      // データベースを更新
      await tx.stpCompany.update({
        where: { id },
        data: updateData,
      });
    });
  } else {
    // 変更履歴管理対象でない通常の更新
    await prisma.stpCompany.update({
      where: { id },
      data: updateData,
    });
  }

  // 更新後のデータを取得して変更差分を計算
  const afterData = await prisma.stpCompany.findUnique({ where: { id }, select: { company: { select: { name: true } } } });
  const changes = calcChanges(beforeUpdateData, updateData, UPDATE_FIELD_LABELS);
  await logActivity({
    model: "StpCompany",
    recordId: id,
    action: "update",
    summary: `企業「${afterData?.company?.name ?? String(id)}」を更新`,
    changes,
    userId: user.id,
  });
  revalidatePath("/stp/companies", "layout");
  return ok();
 } catch (e) {
  console.error("[updateStpCompany] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

export async function deleteStpCompany(id: number): Promise<ActionResult> {
 try {
  const user = await requireEdit("stp");
  const companyForLog = await prisma.stpCompany.findUnique({ where: { id }, select: { company: { select: { name: true } } } });
  await logActivity({
    model: "StpCompany",
    recordId: id,
    action: "delete",
    summary: `企業「${companyForLog?.company?.name ?? String(id)}」を削除`,
    userId: user.id,
  });
  await prisma.stpCompany.delete({
    where: { id },
  });
  revalidatePath("/stp/companies", "layout");
  return ok();
 } catch (e) {
  console.error("[deleteStpCompany] error:", e);
  return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
 }
}

// 企業IDの重複チェック（リアルタイム用）
export async function checkDuplicateCompanyId(companyId: number): Promise<{ isDuplicate: boolean; stpCompanyId?: number }> {
  const existing = await prisma.stpCompany.findFirst({
    where: { companyId },
    select: { id: true },
  });

  if (existing) {
    return { isDuplicate: true, stpCompanyId: existing.id };
  }
  return { isDuplicate: false };
}

/**
 * 全顧客マスタ（MasterStellaCompany）の基本情報を更新
 * STP企業詳細ページから全顧客マスタの情報を直接編集するために使用
 */
export async function updateMasterCompanyFromStp(
  masterCompanyId: number,
  data: Record<string, unknown>
): Promise<ActionResult> {
  try {
    await requireEdit("stp");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {};

    if ("name" in data && data.name) updateData.name = data.name;
    if ("nameKana" in data) updateData.nameKana = data.nameKana || null;
    if ("corporateNumber" in data) {
      const val = (data.corporateNumber as string)?.trim() || null;
      if (val) {
        const existing = await prisma.masterStellaCompany.findFirst({
          where: { corporateNumber: val, id: { not: masterCompanyId } },
          select: { id: true, name: true },
        });
        if (existing) {
          return err(`この法人番号は既に「${existing.name}」に登録されています`);
        }
      }
      updateData.corporateNumber = val;
    }
    if ("companyType" in data) updateData.companyType = data.companyType || null;
    if ("websiteUrl" in data) updateData.websiteUrl = data.websiteUrl || null;
    if ("industry" in data) updateData.industry = data.industry || null;
    if ("revenueScale" in data) updateData.revenueScale = data.revenueScale || null;
    if ("employeeCount" in data) updateData.employeeCount = data.employeeCount ? Number(data.employeeCount) : null;
    if ("note" in data) updateData.note = data.note || null;
    if ("closingDay" in data) updateData.closingDay = data.closingDay !== null && data.closingDay !== undefined && data.closingDay !== "" ? Number(data.closingDay) : null;
    if ("paymentMonthOffset" in data) updateData.paymentMonthOffset = data.paymentMonthOffset !== null && data.paymentMonthOffset !== undefined && data.paymentMonthOffset !== "" ? Number(data.paymentMonthOffset) : null;
    if ("paymentDay" in data) updateData.paymentDay = data.paymentDay !== null && data.paymentDay !== undefined && data.paymentDay !== "" ? Number(data.paymentDay) : null;

    if (Object.keys(updateData).length > 0) {
      await prisma.masterStellaCompany.update({
        where: { id: masterCompanyId },
        data: updateData,
      });
    }

    revalidatePath("/stp/companies", "layout");
    revalidatePath(`/companies/${masterCompanyId}`);
    return ok();
  } catch (e) {
    console.error("[updateMasterCompanyFromStp] error:", e);
    return err(e instanceof Error ? e.message : "予期しないエラーが発生しました");
  }
}
