"use client";

import dynamic from "next/dynamic";

// KPIページは "use client" コンポーネントで useParams() を使用しており、
// /stp/companies/[id] ルート内から呼ばれてもパラメータ id が正しく取得される
const KpiPageContent = dynamic(() => import("../kpi/page"), { ssr: false });

export function KpiTab() {
  return (
    <div className="min-h-[400px]">
      <KpiPageContent />
    </div>
  );
}
