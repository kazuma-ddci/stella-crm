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
    prisma.contactHistory.count({ where: { companyId, deletedAt: null } }),
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
