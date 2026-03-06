import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { canEditCommonMasterDataSync } from "@/lib/auth/master-data-permission";
import { FieldDefinitionsTable } from "./field-definitions-table";
import { Info } from "lucide-react";

export default async function FieldDefinitionsPage() {
  const session = await auth();
  const canEdit = canEditCommonMasterDataSync(session?.user);

  const [fieldDefinitions, projects] = await Promise.all([
    prisma.staffFieldDefinition.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
      include: { projectLinks: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  const fieldDefs = fieldDefinitions.map((fd) => ({
    id: fd.id,
    fieldCode: fd.fieldCode,
    fieldName: fd.fieldName,
    linkedProjectIds: fd.projectLinks.map((pl) => pl.projectId),
  }));

  const projectList = projects.map((p) => ({
    id: p.id,
    name: p.name,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">担当者フィールド出現設定</h1>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">この画面の使い方</p>
            <p>
              各担当者フィールドが<strong>どのプロジェクトの設定画面に出現するか</strong>を管理します。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                チェックを入れたプロジェクトの「担当者フィールド制約」画面にそのフィールドが表示されます。
              </li>
              <li>
                チェックを外すと、そのプロジェクトの制約設定画面からフィールドが非表示になります。
              </li>
            </ul>
          </div>
        </div>
      </div>

      <FieldDefinitionsTable
        fieldDefinitions={fieldDefs}
        projects={projectList}
        canEdit={canEdit}
      />
    </div>
  );
}
