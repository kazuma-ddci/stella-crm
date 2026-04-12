"use client";

import { OperationsClient } from "../operations/operations-client";

export function OperationsTab({
  stpCompanyId,
  companyName,
}: {
  stpCompanyId: number;
  companyName: string;
}) {
  return <OperationsClient stpCompanyId={stpCompanyId} companyName={companyName} />;
}
