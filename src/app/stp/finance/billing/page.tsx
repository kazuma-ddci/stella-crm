import { getExpenseCategories } from "../transactions/actions";
import { getAvailableMonths } from "./actions";
import { BillingLifecycleView } from "./billing-lifecycle-view";
import { prisma } from "@/lib/prisma";
import { getSystemProjectContext } from "@/lib/project-context";

type CounterpartyOptionSource = {
  id: number;
  name: string;
  displayId: string | null;
  company: { companyCode: string } | null;
  counterpartyType: string;
};

function getCounterpartyCode(counterparty: CounterpartyOptionSource): string | null {
  return counterparty.displayId ?? counterparty.company?.companyCode ?? null;
}

function parseCounterpartyCode(counterparty: CounterpartyOptionSource) {
  const code = getCounterpartyCode(counterparty);
  const match = code?.match(/^([A-Z]+)-(\d+)$/);
  if (!match) {
    return { hasCode: false, prefix: "", number: Number.MAX_SAFE_INTEGER };
  }
  return {
    hasCode: true,
    prefix: match[1],
    number: Number(match[2]),
  };
}

function compareCounterparties(a: CounterpartyOptionSource, b: CounterpartyOptionSource) {
  const codeA = parseCounterpartyCode(a);
  const codeB = parseCounterpartyCode(b);

  if (codeA.hasCode !== codeB.hasCode) {
    return codeA.hasCode ? -1 : 1;
  }
  if (codeA.prefix !== codeB.prefix) {
    return codeA.prefix < codeB.prefix ? -1 : 1;
  }
  if (codeA.number !== codeB.number) {
    return codeA.number - codeB.number;
  }
  if (a.name !== b.name) {
    return a.name < b.name ? -1 : 1;
  }
  return a.id - b.id;
}

export default async function BillingLifecyclePage() {
  const ctx = await getSystemProjectContext("stp");
  if (!ctx) throw new Error("STPプロジェクトのコンテキストが取得できません");

  const [availableMonths, expenseCategories, counterparties] = await Promise.all([
    getAvailableMonths(),
    getExpenseCategories(),
    prisma.counterparty.findMany({
      where: { deletedAt: null, mergedIntoId: null, isActive: true },
      select: {
        id: true,
        name: true,
        displayId: true,
        counterpartyType: true,
        company: { select: { companyCode: true } },
      },
      orderBy: { id: "asc" },
    }),
  ]);

  const counterpartyOptions = counterparties
    .sort(compareCounterparties)
    .map((counterparty) => ({
      id: counterparty.id,
      label: getCounterpartyCode(counterparty)
        ? `${getCounterpartyCode(counterparty)} ${counterparty.name}`
        : counterparty.name,
      counterpartyType: counterparty.counterpartyType,
    }));

  return (
    <BillingLifecycleView
      availableMonths={availableMonths}
      expenseCategories={expenseCategories}
      counterpartyOptions={counterpartyOptions}
    />
  );
}
