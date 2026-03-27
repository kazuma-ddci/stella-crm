"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Prismaモデル名 → DBテーブル名の明示的マッピング
const MODEL_TO_TABLE: Record<string, string> = {
  StpCompany: "stp_companies",
  StpAgent: "stp_agents",
  StpCandidate: "stp_candidates",
  MasterContract: "master_contracts",
  ContactHistory: "contact_histories",
  StpStageHistory: "stp_stage_histories",
  StpContractHistory: "stp_contract_histories",
  StpLeadFormSubmission: "stp_lead_form_submissions",
  StpProposal: "stp_proposals",
  StpRevenueRecord: "stp_revenue_records",
  StpExpenseRecord: "stp_expense_records",
  StpInvoice: "stp_invoices",
  InvoiceGroup: "invoice_groups",
  PaymentGroup: "payment_groups",
  Transaction: "transactions",
  StpKpiSheet: "stp_kpi_sheets",
  StpKpiWeeklyData: "stp_kpi_weekly_data",
  AlertAcknowledgment: "alert_acknowledgments",
};

function resolveTableName(model: string): string {
  return MODEL_TO_TABLE[model] ?? model;
}

type LogActivityParams = {
  model: string;
  recordId: number;
  action: "create" | "update" | "delete";
  /** 人が読める要約（例: "株式会社ABCの企業情報を更新"） */
  summary?: string;
  /** 変更差分（フィールド名 → { old, new }） */
  changes?: Record<string, unknown> | null;
  /** 操作者のスタッフID（必須） */
  userId: number;
};

export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const tableName = resolveTableName(params.model);

    const changesData: Record<string, unknown> = {};
    if (params.summary) {
      changesData._summary = params.summary;
    }
    if (params.changes) {
      Object.assign(changesData, params.changes);
    }

    await prisma.activityLog.create({
      data: {
        tableName,
        recordId: params.recordId,
        action: params.action,
        changes:
          Object.keys(changesData).length > 0
            ? (changesData as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        userId: params.userId,
      },
    });
  } catch (error) {
    console.error("[ActivityLog] 書き込みエラー:", error);
  }
}
