import { notFound } from "next/navigation";
import { getWorkflowGroupDetail } from "../actions";
import { getJournalFormData } from "../../journal/actions";
import { GroupDetailClient } from "./group-detail-client";

type Props = {
  searchParams: Promise<{ type?: string; id?: string }>;
};

export default async function GroupDetailPage({ searchParams }: Props) {
  const params = await searchParams;
  const groupType = params.type as "invoice" | "payment" | undefined;
  const groupId = params.id ? Number(params.id) : null;

  if (!groupType || !groupId || !["invoice", "payment"].includes(groupType)) {
    notFound();
  }

  const [detail, journalFormData] = await Promise.all([
    getWorkflowGroupDetail(groupType, groupId),
    getJournalFormData(),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <div className="p-6 space-y-6">
      <GroupDetailClient detail={detail} journalFormData={journalFormData} />
    </div>
  );
}
