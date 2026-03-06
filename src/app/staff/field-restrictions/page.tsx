import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldRestrictionsEditor } from "./field-restrictions-editor";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { ASSIGNABLE_FIELDS } from "@/lib/staff/assignable-fields";
import { Info } from "lucide-react";

type Props = {
  searchParams: Promise<{ project?: string }>;
};

export default async function FieldRestrictionsPage({ searchParams }: Props) {
  const params = await searchParams;
  const projectFilter = params.project;
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

  const [fieldDefinitions, fieldDefProjects, restrictions, projects, roleTypes] = await Promise.all([
    prisma.staffFieldDefinition.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.staffFieldDefinitionProject.findMany({
      include: { fieldDefinition: true },
    }),
    prisma.staffFieldRestriction.findMany({
      include: { fieldDefinition: true },
    }),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.staffRoleType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  // フィールド定義一覧
  const fields = fieldDefinitions.map((fd) => ({
    code: fd.fieldCode,
    label: fd.fieldName || ASSIGNABLE_FIELDS[fd.fieldCode as keyof typeof ASSIGNABLE_FIELDS]?.label || fd.fieldCode,
  }));

  // フィールド × PJ の出現マッピング
  const fieldProjectMap: Record<string, number[]> = {};
  for (const fdp of fieldDefProjects) {
    const code = fdp.fieldDefinition.fieldCode;
    if (!fieldProjectMap[code]) fieldProjectMap[code] = [];
    fieldProjectMap[code].push(fdp.projectId);
  }

  // PJごと × フィールドごとの制約データ
  // key: `${managingProjectId}:${fieldCode}`
  const fieldData: Record<string, Record<string, { sourceProjectIds: number[]; roleTypeIds: number[] }>> = {};
  for (const p of projects) {
    fieldData[String(p.id)] = {};
    for (const fd of fieldDefinitions) {
      fieldData[String(p.id)][fd.fieldCode] = { sourceProjectIds: [], roleTypeIds: [] };
    }
  }
  for (const r of restrictions) {
    const code = r.fieldDefinition.fieldCode;
    const pId = String(r.managingProjectId);
    if (fieldData[pId]?.[code]) {
      if (r.sourceProjectId != null) fieldData[pId][code].sourceProjectIds.push(r.sourceProjectId);
      if (r.roleTypeId != null) fieldData[pId][code].roleTypeIds.push(r.roleTypeId);
    }
  }

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const roleTypeOptions = roleTypes.map((r) => ({ value: r.id, label: r.name }));

  // プロジェクトフィルタ: codeが一致するプロジェクトのみ表示
  const filteredProject = projectFilter
    ? projects.find((p) => p.code === projectFilter)
    : null;
  const displayProjects = filteredProject ? [filteredProject] : projects;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {filteredProject ? `${filteredProject.name} の担当者フィールド制約` : "担当者フィールド制約"}
      </h1>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">この画面の使い方</p>
            <p>
              各担当者フィールドに対して、プロジェクトごとに
              <strong>どのプロジェクト・どの役割のスタッフを選択肢に表示するか</strong>を設定できます。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>ソースプロジェクト</strong>：指定したプロジェクトに所属するスタッフが候補に表示されます。
              </li>
              <li>
                <strong>役割</strong>：指定した役割を持つスタッフが候補に表示されます。
              </li>
              <li>
                両方を設定した場合、<strong>いずれかの条件を満たす</strong>スタッフが候補に表示されます（OR結合）。
              </li>
              <li>
                何も設定しない場合は、<strong>全スタッフ</strong>が候補として表示されます。
              </li>
            </ul>
          </div>
        </div>
      </div>

      {displayProjects.map((project) => (
        <Card key={project.id}>
          <CardHeader>
            <CardTitle>{project.name} の担当者制約設定</CardTitle>
            <CardDescription>
              {project.name}のページで入力する際の担当者候補を絞り込みます。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FieldRestrictionsEditor
              fields={fields}
              fieldData={fieldData[String(project.id)] ?? {}}
              projectOptions={projectOptions}
              roleTypeOptions={roleTypeOptions}
              canEdit={canEdit}
              managingProjectId={project.id}
              fieldProjectMap={fieldProjectMap}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
