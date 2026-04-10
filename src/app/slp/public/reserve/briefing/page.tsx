import {
  resolveContactCompanies,
  buildBookingHistoryUrl,
} from "@/lib/slp/reserve/resolver";
import { BriefingReserveClient } from "./briefing-reserve-client";
import { KoutekiPageShell } from "@/components/kouteki";
import { UidRescueClient } from "@/lib/slp/uid-rescue-client";

type Props = {
  searchParams: Promise<{ uid?: string }>;
};

export default async function SlpReserveBriefingPage({ searchParams }: Props) {
  const { uid } = await searchParams;
  const result = await resolveContactCompanies(uid ?? null);

  // uid なし or LINE友達が見つからない場合
  if (!result.found) {
    return (
      <>
        {/* リロード時に sessionStorage から uid を復元してURLを書き換える */}
        <UidRescueClient />
        <KoutekiPageShell
          title="概要案内のご予約"
          subtitle="このページからご予約手続きを進めていただけます"
        >
          <div className="text-center py-8">
            <p className="text-base text-slate-700 mb-4">
              {result.reason === "uid_missing"
                ? "URLに不備があります。公式LINEのリッチメニューからもう一度お試しください。"
                : "ご利用情報が見つかりませんでした。公式LINEから再度アクセスしてください。"}
            </p>
          </div>
        </KoutekiPageShell>
      </>
    );
  }

  const bookingHistoryUrl = buildBookingHistoryUrl(uid!);

  return (
    <>
      {/* uid を sessionStorage に保存（次回リロードに備える） */}
      <UidRescueClient />
      <KoutekiPageShell
        title="概要案内のご予約"
        subtitle={result.snsname ? `${result.snsname} 様` : undefined}
      >
        <BriefingReserveClient
          uid={uid!}
          snsname={result.snsname}
          companies={result.companies.map((c) => ({
            recordId: c.recordId,
            companyName: c.companyName,
            briefingStatus: c.briefingStatus,
            briefingDate: c.briefingDate?.toISOString() ?? null,
            briefingHasReservation: c.briefingHasReservation,
            briefingCompleted: c.briefingCompleted,
          }))}
          bookingHistoryUrl={bookingHistoryUrl}
        />
      </KoutekiPageShell>
    </>
  );
}
