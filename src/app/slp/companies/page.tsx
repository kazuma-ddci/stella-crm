import { prisma } from "@/lib/prisma";
import { CompanyRecordsTable } from "./company-records-table";
import {
  resolveCompaniesData,
  type ContactForResolution,
} from "@/lib/slp/company-resolution";

// JST(UTC+9)の日付・時刻文字列を返す
function toJstDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(0, 10);
}
function toJstTime(d: Date | null | undefined): string | null {
  if (!d) return null;
  const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  return jst.toISOString().slice(11, 16);
}
function toJstDisplay(d: Date | null | undefined): string | null {
  const date = toJstDate(d);
  const time = toJstTime(d);
  if (!date) return null;
  return `${date} ${time ?? ""}`.trim();
}

export default async function SlpCompaniesPage() {
  // 一覧ページでは「パッと見る」のに必要な項目に加え、
  // AS担当・紹介者・代理店の自動解決に必要な担当者・LINE情報も取得する。
  const records = await prisma.slpCompanyRecord.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      companyName: true,
      briefingStatus: true,
      briefingDate: true,
      consultationStatus: true,
      consultationDate: true,
      salesStaff: { select: { id: true, name: true } },
      status1: { select: { id: true, name: true } },
      status2: { select: { id: true, name: true } },
      contacts: {
        select: {
          id: true,
          name: true,
          lineFriendId: true,
          manualAsId: true,
          manualAsReason: true,
          manualAsChangedAt: true,
          manualAsChangedBy: { select: { name: true } },
          manualAs: { select: { id: true, name: true } },
          lineFriend: {
            select: {
              id: true,
              uid: true,
              snsname: true,
              free1: true,
            },
          },
        },
        orderBy: [{ isPrimary: "desc" }, { id: "asc" }],
      },
    },
    orderBy: { id: "asc" },
  });

  // 解決ロジックに渡す形に整形
  const companiesForResolution = records.map((r) => ({
    id: r.id,
    contacts: r.contacts.map<ContactForResolution>((c) => ({
      id: c.id,
      name: c.name,
      lineFriendId: c.lineFriendId,
      manualAsId: c.manualAsId,
      manualAsReason: c.manualAsReason,
      manualAsChangedAt: c.manualAsChangedAt,
      manualAsChangedByName: c.manualAsChangedBy?.name ?? null,
      manualAs: c.manualAs,
      lineFriend: c.lineFriend,
    })),
  }));

  const resolutionMap = await resolveCompaniesData(companiesForResolution);

  const data = records.map((r) => {
    const resolution = resolutionMap.get(r.id);
    // 主担当（または最初の担当者）のLINE友達情報を「{LINE_id} {snsname}」の形で抽出
    // → 企業名未登録時に「何から作成されたレコードか」を識別するために使う
    const primaryContact =
      r.contacts.find((c) => c.lineFriend) ?? null;
    const primaryContactLineLabel = primaryContact?.lineFriend
      ? `${primaryContact.lineFriend.id} ${primaryContact.lineFriend.snsname ?? ""}`.trim()
      : null;
    return {
      id: r.id,
      companyNo: r.id,
      companyName: r.companyName,
      primaryContactLineLabel,
      briefingStatus: r.briefingStatus,
      briefingDate: toJstDisplay(r.briefingDate),
      consultationStatus: r.consultationStatus,
      consultationDate: toJstDisplay(r.consultationDate),
      salesStaffName: r.salesStaff?.name ?? null,
      status1Name: r.status1?.name ?? null,
      status2Name: r.status2?.name ?? null,
      asEntries:
        resolution?.aggregated.as.map((a) => ({
          label: a.label,
          contacts: a.contacts,
          isManual: a.isManual,
          manualAsReason: a.manualAsReason,
          autoAsName: a.autoAsName,
        })) ?? [],
      referrerEntries:
        resolution?.aggregated.referrer.map((r) => ({
          label: r.label,
          contacts: r.contacts,
        })) ?? [],
      agencyEntries:
        resolution?.aggregated.agency.map((a) => ({
          label: a.label,
          contacts: a.contacts,
        })) ?? [],
      multipleAgencyWarnings:
        resolution?.aggregated.multipleAgencyWarnings ?? [],
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">企業名簿</h1>
      <CompanyRecordsTable data={data} />
    </div>
  );
}
