import { prisma } from "@/lib/prisma";
import { loadContactHistoryMasters } from "@/app/slp/contact-histories/loaders";
import { listSlpContactHistories } from "@/app/slp/contact-histories/actions";
import { ContactHistoriesClient } from "./contact-histories-client";

export default async function SlpContactHistoriesRecordsPage() {
  const [histories, masters, lineFriends, companies, agencies, sessions] = await Promise.all([
    listSlpContactHistories(),
    loadContactHistoryMasters(),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, snsname: true, uid: true },
      orderBy: { id: "asc" },
    }),
    prisma.slpCompanyRecord.findMany({
      where: { deletedAt: null },
      select: { id: true, companyName: true },
      orderBy: { id: "asc" },
    }),
    prisma.slpAgency.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }),
    prisma.slpMeetingSession.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        companyRecordId: true,
        category: true,
        roundNumber: true,
        scheduledAt: true,
      },
      orderBy: [{ companyRecordId: "asc" }, { id: "asc" }],
    }),
  ]);

  const lineFriendOptions = lineFriends.map((lf) => ({
    id: lf.id,
    label: `${lf.id} ${lf.snsname ?? ""}`.trim(),
  }));
  const companyRecordOptions = companies.map((c) => ({
    value: String(c.id),
    label: c.companyName ?? `事業者#${c.id}`,
  }));
  const agencyOptions = agencies.map((a) => ({
    value: String(a.id),
    label: a.name ?? `代理店#${a.id}`,
  }));

  // 事業者IDごとの打ち合わせ選択肢
  const sessionOptionsByCompany: Record<number, { value: string; label: string }[]> = {};
  for (const s of sessions) {
    if (!sessionOptionsByCompany[s.companyRecordId]) {
      sessionOptionsByCompany[s.companyRecordId] = [];
    }
    const categoryLabel =
      s.category === "briefing" ? "概要案内" :
      s.category === "consultation" ? "導入希望商談" :
      s.category;
    const dateLabel = s.scheduledAt
      ? new Date(s.scheduledAt).toLocaleString("ja-JP", {
          year: "numeric", month: "2-digit", day: "2-digit",
          hour: "2-digit", minute: "2-digit",
        })
      : "日時未定";
    sessionOptionsByCompany[s.companyRecordId].push({
      value: String(s.id),
      label: `${categoryLabel} 第${s.roundNumber}回 / ${dateLabel}`,
    });
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">接触履歴</h1>
      <p className="text-sm text-gray-600">
        SLPプロジェクトで記録された接触履歴の一覧です。顧客種別タグに応じて事業者・代理店・LINEユーザー・その他を管理します。
      </p>
      <ContactHistoriesClient
        histories={histories}
        lineFriendOptions={lineFriendOptions}
        contactMethodOptions={masters.contactMethodOptions}
        staffOptions={masters.staffOptions}
        customerTypes={masters.customerTypes}
        staffByProject={masters.staffByProject}
        contactCategories={masters.contactCategories}
        companyRecordOptions={companyRecordOptions}
        agencyOptions={agencyOptions}
        sessionOptionsByCompany={sessionOptionsByCompany}
        slpCompanyCustomerTypeId={masters.slpCompanyCustomerTypeId}
        slpAgencyCustomerTypeId={masters.slpAgencyCustomerTypeId}
        slpLineUsersCustomerTypeId={masters.slpLineUsersCustomerTypeId}
        slpOtherCustomerTypeId={masters.slpOtherCustomerTypeId}
      />
    </div>
  );
}
