"use server";

import { prisma } from "@/lib/prisma";

export type SetupCheckStatus = "ok" | "warning" | "error";

export interface SetupCheckItem {
  id: string;
  category: string;
  name: string;
  description: string;
  status: SetupCheckStatus;
  current: number;
  required: number;
  href: string;
}

/**
 * セットアップ状況チェック定義
 *
 * 新しいマスターデータが必要になったら、ここに追加するだけでダッシュボードに反映される。
 * - id: ユニークID
 * - category: グループ表示用カテゴリ
 * - name: 表示名
 * - description: 説明
 * - required: 最低必要件数（0件だとwarning）
 * - href: 設定画面へのリンク
 * - countFn: 現在の件数を返す関数
 */
interface CheckDefinition {
  id: string;
  category: string;
  name: string;
  description: string;
  required: number;
  href: string;
  countFn: () => Promise<number>;
}

const checkDefinitions: CheckDefinition[] = [
  // ========================================
  // 共通
  // ========================================
  {
    id: "staff",
    category: "共通",
    name: "スタッフ",
    description: "システムユーザー以外のスタッフが最低1名必要です",
    required: 1,
    href: "/staff",
    countFn: () =>
      prisma.masterStaff.count({
        where: { isSystemUser: false, isActive: true },
      }),
  },
  {
    id: "contact-methods",
    category: "共通",
    name: "接触方法",
    description: "電話・メール・訪問などの接触方法マスタ",
    required: 1,
    href: "/settings/contact-methods",
    countFn: () =>
      prisma.contactMethod.count({ where: { isActive: true } }),
  },
  {
    id: "contract-statuses",
    category: "共通",
    name: "契約ステータス",
    description: "契約の進捗ステータス（雛形作成中〜締結済み等）",
    required: 1,
    href: "/settings/contract-statuses",
    countFn: () =>
      prisma.masterContractStatus.count({ where: { isActive: true } }),
  },
  {
    id: "staff-role-types",
    category: "共通",
    name: "スタッフ役割種別",
    description: "営業・運用・CSなどの役割定義",
    required: 1,
    href: "/staff/role-types",
    countFn: () =>
      prisma.staffRoleType.count({ where: { isActive: true } }),
  },

  // ========================================
  // STP
  // ========================================
  {
    id: "stp-stages",
    category: "STP",
    name: "商談ステージ",
    description: "商談パイプラインのステージ定義（リード〜受注等）",
    required: 1,
    href: "/stp/settings/stages",
    countFn: () =>
      prisma.stpStage.count({ where: { isActive: true } }),
  },
  {
    id: "stp-lead-sources",
    category: "STP",
    name: "流入経路",
    description: "紹介・Web・テレアポなどのリード流入経路",
    required: 1,
    href: "/settings/lead-sources",
    countFn: () =>
      prisma.stpLeadSource.count({ where: { isActive: true } }),
  },
  {
    id: "stp-customer-types",
    category: "STP",
    name: "顧客種別",
    description: "企業・代理店などの顧客種別（STP用）",
    required: 1,
    href: "/settings/customer-types?project=stp",
    countFn: async () => {
      const project = await prisma.masterProject.findUnique({
        where: { code: "stp" },
      });
      if (!project) return 0;
      return prisma.customerType.count({
        where: { projectId: project.id, isActive: true },
      });
    },
  },
  {
    id: "stp-display-views",
    category: "STP",
    name: "外部ユーザー表示区分",
    description: "クライアント版・代理店版などの表示区分（STP用）",
    required: 1,
    href: "/settings/display-views?project=stp",
    countFn: async () => {
      const project = await prisma.masterProject.findUnique({
        where: { code: "stp" },
      });
      if (!project) return 0;
      return prisma.displayView.count({
        where: { projectId: project.id, isActive: true },
      });
    },
  },
  {
    id: "stp-contact-categories",
    category: "STP",
    name: "接触種別",
    description: "商談・キックオフ・定例MTGなどの接触種別（STP用）",
    required: 1,
    href: "/settings/contact-categories?project=stp",
    countFn: async () => {
      const project = await prisma.masterProject.findUnique({
        where: { code: "stp" },
      });
      if (!project) return 0;
      return prisma.contactCategory.count({
        where: { projectId: project.id, isActive: true },
      });
    },
  },
  {
    id: "stp-contract-types",
    category: "STP",
    name: "契約種別",
    description: "業務委託・秘密保持などの契約種別（STP用）",
    required: 1,
    href: "/settings/contract-types?project=stp",
    countFn: async () => {
      const project = await prisma.masterProject.findUnique({
        where: { code: "stp" },
      });
      if (!project) return 0;
      return prisma.contractType.count({
        where: { projectId: project.id, isActive: true },
      });
    },
  },

  {
    id: "stp-cloudsign-templates",
    category: "STP",
    name: "CloudSignテンプレート",
    description: "クラウドサイン連携で使用する契約書テンプレートの登録",
    required: 0,
    href: "/settings/contract-types",
    countFn: () =>
      prisma.cloudSignTemplate.count({ where: { isActive: true } }),
  },
  {
    id: "stp-cloudsign-config",
    category: "STP",
    name: "CloudSignクライアントID設定",
    description: "運営法人にクラウドサインのクライアントIDが設定されているか",
    required: 0,
    href: "/settings/projects",
    countFn: () =>
      prisma.operatingCompany.count({
        where: { isActive: true, cloudsignClientId: { not: null } },
      }),
  },

  // ========================================
  // 経理
  // ========================================
  {
    id: "accounting-operating-companies",
    category: "経理",
    name: "運営法人",
    description: "請求書発行元となる運営法人の登録",
    required: 1,
    href: "/settings/operating-companies",
    countFn: () =>
      prisma.operatingCompany.count({ where: { isActive: true } }),
  },
  {
    id: "accounting-accounts",
    category: "経理",
    name: "勘定科目",
    description: "仕訳に使用する勘定科目（現金・売掛金・売上等）",
    required: 1,
    href: "/accounting/masters/accounts",
    countFn: () =>
      prisma.account.count({ where: { isActive: true } }),
  },
  {
    id: "accounting-cost-centers",
    category: "経理",
    name: "コストセンター",
    description: "経費按分先となるコストセンター（部門・プロジェクト等）",
    required: 1,
    href: "/accounting/masters/cost-centers",
    countFn: () =>
      prisma.costCenter.count({ where: { isActive: true, deletedAt: null } }),
  },
  {
    id: "accounting-expense-categories",
    category: "経理",
    name: "費目",
    description: "外注費・サブスク費・家賃などの経費種別",
    required: 1,
    href: "/accounting/masters/expense-categories",
    countFn: () =>
      prisma.expenseCategory.count({
        where: { isActive: true, deletedAt: null },
      }),
  },
  {
    id: "accounting-bank-accounts",
    category: "経理",
    name: "銀行口座",
    description: "入出金管理用の銀行口座",
    required: 1,
    href: "/settings/operating-companies",
    countFn: () => prisma.operatingCompanyBankAccount.count(),
  },
  {
    id: "accounting-invoice-templates",
    category: "経理",
    name: "請求書テンプレート",
    description: "請求書送付時のメールテンプレート",
    required: 0,
    href: "/accounting/masters/invoice-templates",
    countFn: () =>
      prisma.invoiceTemplate.count({ where: { deletedAt: null } }),
  },
];

export async function getSetupStatus(): Promise<SetupCheckItem[]> {
  const results = await Promise.all(
    checkDefinitions.map(async (def) => {
      const current = await def.countFn();
      let status: SetupCheckStatus;
      if (def.required > 0 && current === 0) {
        status = "error";
      } else if (def.required > 0 && current < def.required) {
        status = "warning";
      } else if (def.required === 0 && current === 0) {
        status = "warning";
      } else {
        status = "ok";
      }
      return {
        id: def.id,
        category: def.category,
        name: def.name,
        description: def.description,
        status,
        current,
        required: def.required,
        href: def.href,
      };
    })
  );
  return results;
}
