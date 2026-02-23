import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
    expenseCategoryName: t.expenseCategory.name,
    amount: t.amount,
    taxAmount: t.taxAmount,
    taxRate: t.taxRate,
    taxType: t.taxType,
    periodFrom: t.periodFrom.toISOString().split("T")[0],
    periodTo: t.periodTo.toISOString().split("T")[0],
    note: t.note,
  }));

  return NextResponse.json(data);
}
