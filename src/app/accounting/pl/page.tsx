import { getPlPageData } from "./actions";
import { PlPageClient } from "./pl-page-client";

type Props = {
  searchParams: Promise<{
    reportMode?: string;
    aggregationUnit?: string;
    allocationView?: string;
    periodType?: string;
    amountBasis?: string;
    operatingCompanyId?: string;
    projectId?: string;
    year?: string;
    month?: string;
  }>;
};

export default async function PlPage({ searchParams }: Props) {
  const params = await searchParams;
  const data = await getPlPageData(params);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">P/L</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          仕訳明細から、社内用と決算提出用の損益を確認します。
        </p>
      </div>
      <PlPageClient initialParams={params} data={data} />
    </div>
  );
}
