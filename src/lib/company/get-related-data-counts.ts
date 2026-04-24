import { prisma } from "@/lib/prisma";
import type { CompanyRelatedData } from "@/types/company-merge";

/** 企業の関連データ件数を取得 */
export async function getRelatedDataCounts(companyId: number): Promise<CompanyRelatedData> {
  const [
    locations,
    contacts,
    bankAccounts,
    stpCompanies,
    stpAgents,
    contractHistories,
    contactHistories,
    contracts,
    externalUsers,
    registrationTokens,
    referredAgents,
    leadFormSubmissions,
  ] = await Promise.all([
    prisma.stellaCompanyLocation.count({ where: { companyId, deletedAt: null } }),
    prisma.stellaCompanyContact.count({ where: { companyId, deletedAt: null } }),
    prisma.stellaCompanyBankAccount.count({ where: { companyId, deletedAt: null } }),
    prisma.stpCompany.count({ where: { companyId } }),
    prisma.stpAgent.count({ where: { companyId } }),
    prisma.stpContractHistory.count({ where: { companyId, deletedAt: null } }),
    // V2接触履歴: STP stp_company target (targetId = MasterStellaCompany.id) で突合
    // ※ SLP/HOJO は中間マスタ経由の target なのでここでは除外 (企業マージ画面の件数表示用)
    prisma.contactHistoryV2.count({
      where: {
        deletedAt: null,
        customerParticipants: {
          some: { targetType: "stp_company", targetId: companyId },
        },
      },
    }),
    prisma.masterContract.count({ where: { companyId } }),
    prisma.externalUser.count({ where: { companyId } }),
    prisma.registrationToken.count({ where: { companyId } }),
    prisma.stpAgent.count({ where: { referrerCompanyId: companyId } }),
    prisma.stpLeadFormSubmission.count({ where: { masterCompanyId: companyId } }),
  ]);

  return {
    locations,
    contacts,
    bankAccounts,
    stpCompanies,
    stpAgents,
    contractHistories,
    contactHistories,
    contracts,
    externalUsers,
    registrationTokens,
    referredAgents,
    leadFormSubmissions,
  };
}
