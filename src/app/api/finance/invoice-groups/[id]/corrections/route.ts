import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

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
