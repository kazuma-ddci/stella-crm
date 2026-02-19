import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getProposalWithContent } from "@/app/stp/proposal-actions";
import { toggleSlidePermission } from "@/lib/proposals/slide-generator";
import type { ProposalContent } from "@/lib/proposals/simulation";
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

  // 編集権限が解除されたままのスライドを自動リバート
  if (proposal.proposalContent?.slides) {
    const slidesToRevert = proposal.proposalContent.slides.filter(
      (s) => s.editUnlockedAt && !s.deletedAt,
    );

    if (slidesToRevert.length > 0) {
      // 権限を閲覧専用に戻す
      for (const slide of slidesToRevert) {
        try {
          await toggleSlidePermission(slide.slideFileId, "reader");
        } catch (e) {
          console.error(`スライド権限リバートエラー (ver.${slide.version}):`, e);
        }
      }

      // editUnlockedAt をクリアしてDB更新
      const updatedSlides = proposal.proposalContent.slides.map((s) =>
        s.editUnlockedAt ? { ...s, editUnlockedAt: null } : s,
      );
      const updatedContent: ProposalContent = {
        ...proposal.proposalContent,
        slides: updatedSlides,
      };
      await prisma.stpProposal.update({
        where: { id: proposalId },
        data: {
          proposalContent: JSON.parse(JSON.stringify(updatedContent)) as Prisma.InputJsonValue,
        },
      });

      // ローカルの proposal オブジェクトも更新
      proposal.proposalContent = updatedContent;
    }
  }

  return (
    <div className="p-6">
      <ProposalEditor proposal={proposal} />
    </div>
  );
}
