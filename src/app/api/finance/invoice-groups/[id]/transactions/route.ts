import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toLocalDateString } from "@/lib/utils";
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
