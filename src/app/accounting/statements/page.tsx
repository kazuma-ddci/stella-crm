import {
  listStatementCompanyOptions,
  listStatementEntries,
} from "./actions";
import { StatementsTable } from "./statements-table";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  company?: string;
  account?: string;
  page?: string;
  filter?: string;
  from?: string;
  to?: string;
  q?: string;
}>;

export default async function StatementsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const companies = await listStatementCompanyOptions();

  const requestedCompanyId = sp.company ? parseInt(sp.company, 10) : NaN;
  let selectedCompany = Number.isFinite(requestedCompanyId)
    ? companies.find((c) => c.id === requestedCompanyId) ?? null
    : null;
  if (!selectedCompany && companies.length > 0) {
    selectedCompany = companies[0];
  }

  let selectedBankAccountId: number | null = null;
  if (selectedCompany) {
    const requestedAccountId = sp.account ? parseInt(sp.account, 10) : NaN;
    const fromUrl = Number.isFinite(requestedAccountId)
      ? selectedCompany.bankAccounts.find((b) => b.id === requestedAccountId)
      : undefined;
    if (fromUrl) {
      selectedBankAccountId = fromUrl.id;
    } else if (selectedCompany.bankAccounts.length > 0) {
      selectedBankAccountId = selectedCompany.bankAccounts[0].id;
    }
  }

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 100;
  const filterRaw = sp.filter ?? "all";
  const filter: "all" | "unlinked" | "partial" | "complete" | "excluded" =
    filterRaw === "unlinked" ||
    filterRaw === "partial" ||
    filterRaw === "complete" ||
    filterRaw === "excluded"
      ? filterRaw
      : "all";

  const from = sp.from && /^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from : null;
  const to = sp.to && /^\d{4}-\d{2}-\d{2}$/.test(sp.to) ? sp.to : null;
  const q = sp.q && sp.q.trim().length > 0 ? sp.q.trim() : null;

  const entries = selectedBankAccountId
    ? await listStatementEntries({
        operatingCompanyBankAccountId: selectedBankAccountId,
        page,
        pageSize,
        linkStatus: filter,
        from,
        to,
        q,
      })
    : {
        rows: [],
        total: 0,
        page: 1,
        pageSize,
        counts: { all: 0, unlinked: 0, partial: 0, complete: 0, excluded: 0 },
      };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">入出金履歴</h1>
      </div>

      <StatementsTable
        companies={companies}
        selectedCompanyId={selectedCompany?.id ?? null}
        selectedBankAccountId={selectedBankAccountId}
        page={page}
        pageSize={pageSize}
        total={entries.total}
        rows={entries.rows}
        counts={entries.counts}
        filter={filter}
        from={from}
        to={to}
        q={q}
      />
    </div>
  );
}
