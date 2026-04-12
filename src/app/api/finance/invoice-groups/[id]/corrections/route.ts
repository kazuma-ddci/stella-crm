import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authorizeApi } from "@/lib/api-auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // STP編集 or 経理編集 のスタッフのみ
  const authz = await authorizeApi([
    { project: "stp", level: "edit" },
    { project: "accounting", level: "edit" },
  ]);
  if (!authz.ok) return authz.response;

  const { id } = await params;
  const groupId = Number(id);

  if (isNaN(groupId)) {
    return NextResponse.json(
      { error: "Invalid group ID" },
      { status: 400 }
    );
  }

  // このグループを訂正元とする訂正請求を検索
  const corrections = await prisma.invoiceGroup.findMany({
    where: {
      originalInvoiceGroupId: groupId,
      deletedAt: null,
    },
    select: {
      id: true,
      invoiceNumber: true,
    },
    orderBy: { id: "asc" },
  });

  return NextResponse.json(corrections);
}
