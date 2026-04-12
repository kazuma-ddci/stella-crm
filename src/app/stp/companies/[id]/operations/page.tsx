import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { OperationsClient } from "./operations-client";

export default async function OperationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const stpCompanyId = Number(id);

  if (isNaN(stpCompanyId)) notFound();

  const stpCompany = await prisma.stpCompany.findUnique({
    where: { id: stpCompanyId },
    include: { company: { select: { name: true } } },
  });

  if (!stpCompany) notFound();

  return (
    <OperationsClient
      stpCompanyId={stpCompanyId}
      companyName={stpCompany.company.name}
    />
  );
}
