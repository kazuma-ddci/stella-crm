"use server";

import { prisma } from "@/lib/prisma";
import { addBusinessDays, isBusinessDay } from "@/lib/business-days";
import { getDashboardKgiData } from "@/app/stp/dashboard/actions";
import { MONTHLY_KPI_KEYS, KPI_LABELS } from "@/lib/kpi/constants";
import { revalidatePath } from "next/cache";
import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";

// ============================================
// 型定義
// ============================================

export type AlertSeverity = "urgent" | "warning";
export type AlertType =
  | "unpaid_invoice"
  | "unsigned_contract"
  | "kpi_behind"
  | "zero_applications"; // 将来用

export type AlertItem = {
  id: string; // alertKey
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  relatedUrl?: string;
  detectedAt: string; // ISO string
  isAcknowledged: boolean;
  acknowledgedAt?: string;
};

// ============================================
// ヘルパー
// ============================================

/** Date → "YYYY-MM" */
function toYearMonth(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** 月末までの営業日数をカウント */
function businessDaysUntilMonthEnd(today: Date): number {
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  let count = 0;
  const d = new Date(today);
  d.setDate(d.getDate() + 1); // 今日は含めない
  while (d <= lastDay) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

/** 金額フォーマット */
function formatAmount(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}

/** 営業日差分を計算（startDateから今日まで何営業日経過したか） */
function businessDaysSince(startDate: Date, today: Date): number {
  let count = 0;
  const d = new Date(startDate);
  d.setDate(d.getDate() + 1);
  while (d <= today) {
    if (isBusinessDay(d)) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

// ============================================
// STPプロジェクトID取得
// ============================================

async function getStpProjectId(): Promise<number> {
  const project = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  if (!project) throw new Error("STPプロジェクトが見つかりません");
  return project.id;
}

// ============================================
// アラート検知
// ============================================

export async function getAlerts(): Promise<AlertItem[]> {
  // 認証: STPプロジェクトの閲覧権限以上
  await requireStaffWithProjectPermission([{ project: "stp", level: "view" }]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const projectId = await getStpProjectId();

  // 対応済み記録を一括取得
  const acknowledgments = await prisma.alertAcknowledgment.findMany();
  const ackMap = new Map(
    acknowledgments.map((a) => [
      `${a.alertType}:${a.alertKey}`,
      a.createdAt.toISOString(),
    ])
  );

  const alerts: AlertItem[] = [];

  // ----- 1. 未入金アラート（緊急）-----
  const unpaidInvoices = await prisma.invoiceGroup.findMany({
    where: {
      projectId,
      status: { in: ["sent", "awaiting_accounting", "partially_paid"] },
      paymentDueDate: { not: null },
      actualPaymentDate: null,
      deletedAt: null,
    },
    include: {
      counterparty: {
        include: {
          company: { select: { name: true } },
        },
      },
    },
  });

  for (const inv of unpaidInvoices) {
    if (!inv.paymentDueDate) continue;
    const deadline = addBusinessDays(inv.paymentDueDate, 5);
    if (deadline > today) continue;

    const alertKey = `invoice_group:${inv.id}`;
    const companyName =
      inv.counterparty?.company?.name ?? inv.counterparty?.name ?? "不明";
    const overdueDays = businessDaysSince(inv.paymentDueDate, today);

    alerts.push({
      id: alertKey,
      type: "unpaid_invoice",
      severity: "urgent",
      title: `未入金: ${companyName}`,
      description: `請求書 ${inv.invoiceNumber ?? `#${inv.id}`} — ${formatAmount(inv.totalAmount ?? 0)}（支払期限: ${inv.paymentDueDate.toLocaleDateString("ja-JP")}、${overdueDays}営業日超過）`,
      relatedUrl: `/stp/finance/invoices?highlight=${inv.id}`,
      detectedAt: deadline.toISOString(),
      isAcknowledged: ackMap.has(`unpaid_invoice:${alertKey}`),
      acknowledgedAt: ackMap.get(`unpaid_invoice:${alertKey}`),
    });
  }

  // ----- 2. 契約書未締結アラート（注意）-----
  const unsignedContracts = await prisma.masterContract.findMany({
    where: {
      projectId,
      cloudsignSentAt: { not: null },
      cloudsignCompletedAt: null,
      currentStatus: { statusType: "progress" },
    },
    include: {
      company: { select: { name: true } },
      currentStatus: { select: { name: true } },
    },
  });

  for (const contract of unsignedContracts) {
    if (!contract.cloudsignSentAt) continue;
    const deadline = addBusinessDays(contract.cloudsignSentAt, 2);
    if (deadline > today) continue;

    const alertKey = `contract:${contract.id}`;
    const companyName = contract.company?.name ?? "不明";
    const daysSince = businessDaysSince(contract.cloudsignSentAt, today);

    alerts.push({
      id: alertKey,
      type: "unsigned_contract",
      severity: "warning",
      title: `契約書未締結: ${companyName}`,
      description: `${contract.title}（送付日: ${contract.cloudsignSentAt.toLocaleDateString("ja-JP")}、${daysSince}営業日経過）`,
      relatedUrl: `/stp/contracts?highlight=${contract.id}`,
      detectedAt: deadline.toISOString(),
      isAcknowledged: ackMap.has(`unsigned_contract:${alertKey}`),
      acknowledgedAt: ackMap.get(`unsigned_contract:${alertKey}`),
    });
  }

  // ----- 3. KPI未達アラート（注意）-----
  const daysRemaining = businessDaysUntilMonthEnd(today);
  if (daysRemaining <= 5) {
    const yearMonth = toYearMonth(today);

    try {
      const kgiData = await getDashboardKgiData(yearMonth);

      // 売上
      if (
        kgiData.revenue.target > 0 &&
        kgiData.revenue.actual / kgiData.revenue.target < 0.5
      ) {
        const alertKey = `kpi:${MONTHLY_KPI_KEYS.MONTHLY_REVENUE}:${yearMonth}`;
        const rate = Math.round(
          (kgiData.revenue.actual / kgiData.revenue.target) * 100
        );
        alerts.push({
          id: alertKey,
          type: "kpi_behind",
          severity: "warning",
          title: `KPI未達: ${KPI_LABELS[MONTHLY_KPI_KEYS.MONTHLY_REVENUE]}`,
          description: `進捗率 ${rate}%（実績 ${formatAmount(kgiData.revenue.actual)} / 目標 ${formatAmount(kgiData.revenue.target)}）— 月末まで残り${daysRemaining}営業日`,
          relatedUrl: "/stp/dashboard",
          detectedAt: today.toISOString(),
          isAcknowledged: ackMap.has(`kpi_behind:${alertKey}`),
          acknowledgedAt: ackMap.get(`kpi_behind:${alertKey}`),
        });
      }

      // 粗利
      if (
        kgiData.grossProfit.target > 0 &&
        kgiData.grossProfit.actual / kgiData.grossProfit.target < 0.5
      ) {
        const alertKey = `kpi:${MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT}:${yearMonth}`;
        const rate = Math.round(
          (kgiData.grossProfit.actual / kgiData.grossProfit.target) * 100
        );
        alerts.push({
          id: alertKey,
          type: "kpi_behind",
          severity: "warning",
          title: `KPI未達: ${KPI_LABELS[MONTHLY_KPI_KEYS.MONTHLY_GROSS_PROFIT]}`,
          description: `進捗率 ${rate}%（実績 ${formatAmount(kgiData.grossProfit.actual)} / 目標 ${formatAmount(kgiData.grossProfit.target)}）— 月末まで残り${daysRemaining}営業日`,
          relatedUrl: "/stp/dashboard",
          detectedAt: today.toISOString(),
          isAcknowledged: ackMap.has(`kpi_behind:${alertKey}`),
          acknowledgedAt: ackMap.get(`kpi_behind:${alertKey}`),
        });
      }

      // 新規契約
      if (
        kgiData.newContracts.target > 0 &&
        kgiData.newContracts.actual / kgiData.newContracts.target < 0.5
      ) {
        const alertKey = `kpi:${MONTHLY_KPI_KEYS.NEW_CONTRACTS}:${yearMonth}`;
        const rate = Math.round(
          (kgiData.newContracts.actual / kgiData.newContracts.target) * 100
        );
        alerts.push({
          id: alertKey,
          type: "kpi_behind",
          severity: "warning",
          title: `KPI未達: ${KPI_LABELS[MONTHLY_KPI_KEYS.NEW_CONTRACTS]}`,
          description: `進捗率 ${rate}%（実績 ${kgiData.newContracts.actual}社 / 目標 ${kgiData.newContracts.target}社）— 月末まで残り${daysRemaining}営業日`,
          relatedUrl: "/stp/dashboard",
          detectedAt: today.toISOString(),
          isAcknowledged: ackMap.has(`kpi_behind:${alertKey}`),
          acknowledgedAt: ackMap.get(`kpi_behind:${alertKey}`),
        });
      }
    } catch {
      // KPIデータ取得に失敗した場合はスキップ
    }
  }

  // 緊急 → 注意の順、未対応 → 対応済みの順にソート
  alerts.sort((a, b) => {
    const severityOrder = { urgent: 0, warning: 1 };
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    if (a.isAcknowledged !== b.isAcknowledged) {
      return a.isAcknowledged ? 1 : -1;
    }
    return 0;
  });

  return alerts;
}

// ============================================
// 対応済み操作
// ============================================

export async function acknowledgeAlert(
  alertType: string,
  alertKey: string,
  note?: string
): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  await prisma.alertAcknowledgment.upsert({
    where: {
      alertType_alertKey: { alertType, alertKey },
    },
    create: { alertType, alertKey, note },
    update: { note },
  });
  revalidatePath("/stp/alerts");
}

export async function removeAcknowledgment(
  alertType: string,
  alertKey: string
): Promise<void> {
  await requireStaffWithProjectPermission([{ project: "stp", level: "edit" }]);
  await prisma.alertAcknowledgment.deleteMany({
    where: { alertType, alertKey },
  });
  revalidatePath("/stp/alerts");
}
