import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync, canViewProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { redirect } from "next/navigation";
import { DocumentManagement } from "./document-management";

export default async function SlpDocumentsSettingsPage() {
  const session = await auth();
  const user = session?.user;

  if (!canViewProjectMasterDataSync(user, "slp")) {
    redirect("/slp/dashboard");
  }

  const canEdit = canEditProjectMasterDataSync(user, "slp");

  const [documents, videos, accessLogs] = await Promise.all([
    prisma.slpDocument.findMany({
      where: { deletedAt: null },
      include: {
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.slpVideo.findMany({
      where: { deletedAt: null },
      include: {
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.slpDocumentAccessLog.findMany({
      orderBy: { accessedAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">資料管理</h1>
      <DocumentManagement
        documents={documents.map((doc) => ({
          id: doc.id,
          fileName: doc.fileName,
          fileSize: doc.fileSize,
          isActive: doc.isActive,
          note: doc.note,
          uploadedByName: doc.uploadedBy.name,
          createdAt: doc.createdAt.toISOString(),
        }))}
        videos={videos.map((v) => ({
          id: v.id,
          fileName: v.fileName,
          fileSize: v.fileSize,
          isActive: v.isActive,
          note: v.note,
          uploadedByName: v.uploadedBy.name,
          createdAt: v.createdAt.toISOString(),
        }))}
        accessLogs={accessLogs.map((log) => ({
          id: log.id,
          uid: log.uid,
          snsname: log.snsname,
          resourceType: log.resourceType,
          ipAddress: log.ipAddress,
          accessedAt: log.accessedAt.toISOString(),
        }))}
        canEdit={canEdit}
      />
    </div>
  );
}
