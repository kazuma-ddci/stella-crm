import { prisma } from "@/lib/prisma";

function normalizeCostCenterName(name: string, fallback: string) {
  const trimmed = name.trim();
  return trimmed || fallback;
}

async function buildAvailableCostCenterName(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  baseName: string,
  projectCode: string,
  projectId: number
) {
  const candidates = [
    baseName,
    `${baseName}（${projectCode}）`,
    `${baseName}（${projectCode}-${projectId}）`,
  ];

  for (const candidate of candidates) {
    const existing = await tx.costCenter.findFirst({
      where: { name: candidate, deletedAt: null },
      select: { id: true },
    });
    if (!existing) return candidate;
  }

  return `${baseName}（${projectCode}-${projectId}-${Date.now()}）`;
}

export async function ensureCostCentersForActiveProjects() {
  await prisma.$transaction(async (tx) => {
    const projects = await tx.masterProject.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true, defaultCostCenterId: true },
      orderBy: { displayOrder: "asc" },
    });

    if (projects.length === 0) return;

    const projectIds = projects.map((project) => project.id);
    const costCenters = await tx.costCenter.findMany({
      where: { projectId: { in: projectIds }, isActive: true, deletedAt: null },
      select: { id: true, projectId: true },
      orderBy: { id: "asc" },
    });

    const costCenterByProjectId = new Map<number, { id: number }>();
    for (const costCenter of costCenters) {
      if (costCenter.projectId && !costCenterByProjectId.has(costCenter.projectId)) {
        costCenterByProjectId.set(costCenter.projectId, costCenter);
      }
    }

    for (const project of projects) {
      let costCenter = costCenterByProjectId.get(project.id);

      if (!costCenter) {
        const baseName = normalizeCostCenterName(project.name, project.code);
        const name = await buildAvailableCostCenterName(tx, baseName, project.code, project.id);
        costCenter = await tx.costCenter.create({
          data: {
            name,
            projectId: project.id,
            isActive: true,
          },
          select: { id: true },
        });
        costCenterByProjectId.set(project.id, costCenter);
      }

      if (project.defaultCostCenterId !== costCenter.id) {
        await tx.masterProject.update({
          where: { id: project.id },
          data: { defaultCostCenterId: costCenter.id },
        });
      }
    }
  });
}

export async function countActiveProjectsWithAccountingProject() {
  const activeProjectIds = await prisma.masterProject.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  if (activeProjectIds.length === 0) return 0;

  const projectIds = activeProjectIds.map((project) => project.id);
  const grouped = await prisma.costCenter.groupBy({
    by: ["projectId"],
    where: {
      projectId: { in: projectIds },
      isActive: true,
      deletedAt: null,
    },
  });

  return grouped.length;
}
