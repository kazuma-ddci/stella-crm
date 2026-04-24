import { requireStaffWithProjectPermission } from "@/lib/auth/staff-action";
import { EmbeddedContactHistoryV2Section } from "@/components/contact-history-v2/embedded-section";

/**
 * 貸金業社接触履歴ページ（V2）。
 * hojo_lender targetType (targetId=null) の接触履歴をまとめて表示・管理。
 */
export default async function LenderContactHistoriesPage() {
  await requireStaffWithProjectPermission([{ project: "hojo", level: "view" }]);

  return (
    <div className="space-y-4 p-4">
      <div>
        <h1 className="text-2xl font-bold">貸金業社接触履歴</h1>
        <p className="text-sm text-muted-foreground mt-1">
          貸金業社との接触履歴を記録・管理します。
        </p>
      </div>

      <EmbeddedContactHistoryV2Section
        projectCode="hojo"
        targetType="hojo_lender"
        targetId={null}
        entityName="貸金業社"
        basePath="/hojo/records/contact-histories-v2"
        limit={100}
      />
    </div>
  );
}
