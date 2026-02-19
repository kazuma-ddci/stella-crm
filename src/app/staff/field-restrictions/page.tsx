import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldRestrictionsEditor } from "./field-restrictions-editor";
import { auth } from "@/auth";
import { canEditMasterDataSync } from "@/lib/auth/master-data-permission";
import { ASSIGNABLE_FIELDS, type AssignableFieldCode } from "@/lib/staff/assignable-fields";

export default async function FieldRestrictionsPage() {
  const session = await auth();
  const canEdit = canEditMasterDataSync(session?.user);

  const [restrictions, projects, roleTypes] = await Promise.all([
    prisma.staffFieldRestriction.findMany(),
    prisma.masterProject.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
    prisma.staffRoleType.findMany({
      where: { isActive: true },
      orderBy: { displayOrder: "asc" },
    }),
  ]);

  // フィールドごとの制約をまとめる
  const fieldData: Record<string, { projectIds: number[]; roleTypeIds: number[] }> = {};
  for (const code of Object.keys(ASSIGNABLE_FIELDS) as AssignableFieldCode[]) {
    fieldData[code] = { projectIds: [], roleTypeIds: [] };
  }
  for (const r of restrictions) {
    if (fieldData[r.fieldCode]) {
      if (r.projectId != null) fieldData[r.fieldCode].projectIds.push(r.projectId);
      if (r.roleTypeId != null) fieldData[r.fieldCode].roleTypeIds.push(r.roleTypeId);
    }
  }

  const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
  const roleTypeOptions = roleTypes.map((r) => ({ value: r.id, label: r.name }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">担当者フィールド制約</h1>
      <Card>
        <CardHeader>
          <CardTitle>フィールドごとの担当者制約設定</CardTitle>
        </CardHeader>
        <CardContent>
          <FieldRestrictionsEditor
            fieldData={fieldData}
            projectOptions={projectOptions}
            roleTypeOptions={roleTypeOptions}
            canEdit={canEdit}
          />
        </CardContent>
      </Card>
    </div>
  );
}
