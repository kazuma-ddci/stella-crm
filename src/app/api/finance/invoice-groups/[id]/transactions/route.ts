import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";

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

  const transactions = await prisma.transaction.findMany({
    where: {
      invoiceGroupId: groupId,
      deletedAt: null,
    },
    include: {
      expenseCategory: true,
    },
    orderBy: [{ periodFrom: "asc" }, { id: "asc" }],
  });

  const data = transactions.map((t) => ({
    id: t.id,
    expenseCategoryName: t.expenseCategory?.name ?? "（未設定）",
    amount: t.amount,
    taxAmount: t.taxAmount,
    taxRate: t.taxRate,
    taxType: t.taxType,
    periodFrom: toLocalDateString(t.periodFrom),
    periodTo: toLocalDateString(t.periodTo),
    note: t.note,
  }));

  return NextResponse.json(data);
}
