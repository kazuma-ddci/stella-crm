import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldRestrictionsEditor } from "./field-restrictions-editor";
import { auth } from "@/auth";
import { canEditProjectMasterDataSync } from "@/lib/auth/master-data-permission";
import { ASSIGNABLE_FIELDS, type AssignableFieldCode } from "@/lib/staff/assignable-fields";
import { Info } from "lucide-react";

export default async function FieldRestrictionsPage() {
  const session = await auth();
  const canEdit = canEditProjectMasterDataSync(session?.user);

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

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="space-y-2 text-sm text-blue-900">
            <p className="font-semibold">この画面の使い方</p>
            <p>
              各担当者フィールド（STP企業の担当営業、契約履歴の担当運用など）に対して、
              <strong>どのプロジェクト・どの役割のスタッフだけを選択肢に表示するか</strong>を設定できます。
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>プロジェクト制約</strong>：指定したプロジェクトに所属するスタッフのみ、そのフィールドの担当者候補に表示されます。
              </li>
              <li>
                <strong>役割制約</strong>：指定した役割を持つスタッフのみ、そのフィールドの担当者候補に表示されます。
              </li>
              <li>
                プロジェクト・役割の両方を設定した場合、<strong>両方の条件を満たす</strong>スタッフのみが候補に表示されます。
              </li>
              <li>
                何も設定しない場合（制約なし）は、<strong>全スタッフ</strong>が候補として表示されます。
              </li>
            </ul>
            <p className="text-blue-700">
              例：「STP企業 担当営業」にプロジェクト「STP」と役割「営業」を設定すると、STPプロジェクトに所属し、かつ営業の役割を持つスタッフだけが選択肢に表示されます。
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>フィールドごとの担当者制約設定</CardTitle>
          <CardDescription>
            各フィールドの「+」ボタンからプロジェクトや役割を追加し、「保存」ボタンで反映してください。
          </CardDescription>
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
