import { notFound } from "next/navigation";
import { getProposalWithContent } from "@/app/stp/proposal-actions";
import { ProposalEditor } from "./proposal-editor";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function ProposalEditorPage({ params }: Props) {
  const { id } = await params;
  const proposalId = parseInt(id, 10);

  if (isNaN(proposalId)) {
    notFound();
  }

  const proposal = await getProposalWithContent(proposalId);

  if (!proposal) {
    notFound();
  }

  return (
    <div className="p-6">
      <ProposalEditor proposal={proposal} />
    </div>
  );
}
