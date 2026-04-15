import { prisma } from "@/lib/prisma";
import { loadContactHistoryMasters } from "@/app/slp/contact-histories/loaders";
import { listSlpContactHistories } from "@/app/slp/contact-histories/actions";
import { ContactHistoriesClient } from "./contact-histories-client";

export default async function SlpContactHistoriesRecordsPage() {
  const [histories, masters, lineFriends] = await Promise.all([
    listSlpContactHistories(),
    loadContactHistoryMasters(),
    prisma.slpLineFriend.findMany({
      where: { deletedAt: null },
      select: { id: true, snsname: true, uid: true },
      orderBy: { id: "asc" },
    }),
  ]);

  const lineFriendOptions = lineFriends.map((lf) => ({
    id: lf.id,
    label: `${lf.id} ${lf.snsname ?? ""}`.trim(),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">接触履歴</h1>
      <p className="text-sm text-gray-600">
        SLPプロジェクトで記録された接触履歴の一覧です。事業者・代理店・LINEユーザー別にフィルタできます。
      </p>
      <ContactHistoriesClient
        histories={histories}
        lineFriendOptions={lineFriendOptions}
        contactMethodOptions={masters.contactMethodOptions}
        staffOptions={masters.staffOptions}
        customerTypes={masters.customerTypes}
        contactCategories={masters.contactCategories}
      />
    </div>
  );
}
