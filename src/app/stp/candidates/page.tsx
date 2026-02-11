import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CandidatesTable } from "./candidates-table";

type ContractMatchStatus = "ok" | "no_contract" | "multiple_contracts" | "incomplete";

export default async function CandidatesPage() {
  const [candidates, stpCompanies, contractHistories] = await Promise.all([
    prisma.stpCandidate.findMany({
      include: {
        stpCompany: {
          include: {
            company: true,
          },
        },
      },
      orderBy: { id: "asc" },
    }),
    prisma.stpCompany.findMany({
      include: {
        company: true,
      },
      orderBy: { company: { id: "desc" } },
    }),
    prisma.stpContractHistory.findMany({
      where: {
        status: "active",
        deletedAt: null,
      },
      select: {
        companyId: true,
        industryType: true,
        jobMedia: true,
      },
    }),
  ]);

  // STP企業の選択肢を作成
  const stpCompanyOptions = stpCompanies.map((sc) => ({
    value: String(sc.id),
    label: `${sc.company.companyCode} ${sc.company.name}`,
  }));

  // stpCompanyId → companyId のマッピング
  const stpToCompanyMap: Record<string, number> = {};
  for (const sc of stpCompanies) {
    stpToCompanyMap[String(sc.id)] = sc.companyId;
  }

  // 契約オプションをstpCompanyId単位で構築
  const contractOptionsByStpCompany: Record<string, { industryType: string; jobMedia: string | null }[]> = {};
  for (const sc of stpCompanies) {
    const companyContracts = contractHistories.filter((ch) => ch.companyId === sc.companyId);
    const seen = new Set<string>();
    const options: { industryType: string; jobMedia: string | null }[] = [];
    for (const ch of companyContracts) {
      const key = `${ch.industryType}::${ch.jobMedia ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        options.push({ industryType: ch.industryType, jobMedia: ch.jobMedia });
      }
    }
    contractOptionsByStpCompany[String(sc.id)] = options;
  }

  // 日付をフォーマットするヘルパー
  const formatDate = (date: Date | null): string | null => {
    if (!date) return null;
    return date.toISOString().split("T")[0];
  };

  // 各求職者の契約マッチング状態を計算
  const data = await Promise.all(
    candidates.map(async (c) => {
      let contractMatchStatus: ContractMatchStatus = "incomplete";
      let contractMatchCount = 0;

      if (c.joinDate && c.stpCompanyId && c.stpCompany) {
        // 検索条件を構築
        const contractWhere: Record<string, unknown> = {
          companyId: c.stpCompany.companyId,
          contractStartDate: { lte: c.joinDate },
          OR: [
            { contractEndDate: null },
            { contractEndDate: { gte: c.joinDate } },
          ],
          performanceFee: { gt: 0 },
          status: "active",
          deletedAt: null,
        };

        if (c.industryType) {
          contractWhere.industryType = c.industryType;
        }
        if (c.jobMedia) {
          contractWhere.jobMedia = c.jobMedia;
        }

        contractMatchCount = await prisma.stpContractHistory.count({
          where: contractWhere,
        });

        if (contractMatchCount === 1) {
          contractMatchStatus = "ok";
        } else if (contractMatchCount === 0) {
          contractMatchStatus = "no_contract";
        } else {
          contractMatchStatus = "multiple_contracts";
        }
      }

      return {
        id: c.id,
        lastName: c.lastName,
        firstName: c.firstName,
        candidateName: `${c.lastName} ${c.firstName}`,
        interviewDate: formatDate(c.interviewDate),
        interviewAttendance: c.interviewAttendance,
        selectionStatus: c.selectionStatus,
        offerDate: formatDate(c.offerDate),
        joinDate: formatDate(c.joinDate),
        sendDate: formatDate(c.sendDate),
        joinConfirmed: c.joinDate !== null,
        industryType: c.industryType,
        jobMedia: c.jobMedia,
        note: c.note,
        stpCompanyId: String(c.stpCompanyId),
        stpCompanyCode: c.stpCompany?.company?.companyCode || null,
        stpCompanyDisplay: c.stpCompany?.company?.name || null,
        contractMatchStatus,
        contractMatchCount,
        deletedAt: c.deletedAt?.toISOString() || null,
      };
    })
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">STP 求職者情報</h1>
      <Card>
        <CardHeader>
          <CardTitle>求職者一覧</CardTitle>
        </CardHeader>
        <CardContent>
          <CandidatesTable
            data={data}
            stpCompanyOptions={stpCompanyOptions}
            contractOptionsByStpCompany={contractOptionsByStpCompany}
          />
        </CardContent>
      </Card>
    </div>
  );
}
