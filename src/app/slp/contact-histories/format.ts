import type { Prisma } from "@prisma/client";

export type SlpContactTargetType = "company_record" | "agency" | "line_users";

/**
 * 接触履歴取得用のincludeオブジェクト（表示・レスポンス整形で共通利用）
 */
export const contactHistoryIncludeForDisplay = {
  contactMethod: true,
  contactCategory: true,
  staff: { select: { id: true, name: true } },
  companyRecord: { select: { id: true, companyName: true } },
  agency: { select: { id: true, name: true } },
  tags: {
    include: {
      customerType: {
        include: { project: { select: { id: true, code: true, name: true } } },
      },
    },
  },
  lineFriends: {
    include: {
      lineFriend: {
        select: { id: true, snsname: true, uid: true },
      },
    },
  },
  files: true,
} satisfies Prisma.SlpContactHistoryInclude;

export type SlpContactHistoryWithRelations = Prisma.SlpContactHistoryGetPayload<{
  include: typeof contactHistoryIncludeForDisplay;
}>;

/**
 * 接触履歴をクライアント表示用の JSON 形式に整形する。
 * Server Action でも Server Component の loader でも利用。
 */
export function formatSlpContactHistory(history: SlpContactHistoryWithRelations) {
  return {
    id: history.id,
    contactDate: history.contactDate.toISOString(),
    contactMethodId: history.contactMethodId,
    contactMethodName: history.contactMethod?.name ?? null,
    contactCategoryId: history.contactCategoryId,
    contactCategoryName: history.contactCategory?.name ?? null,
    assignedTo: history.assignedTo,
    customerParticipants: history.customerParticipants,
    meetingMinutes: history.meetingMinutes,
    note: history.note,
    staffId: history.staffId,
    targetType: history.targetType as SlpContactTargetType,
    companyRecordId: history.companyRecordId,
    companyRecordName: history.companyRecord?.companyName ?? null,
    agencyId: history.agencyId,
    agencyName: history.agency?.name ?? null,
    masterCompanyId: history.masterCompanyId,
    createdAt: history.createdAt.toISOString(),
    updatedAt: history.updatedAt.toISOString(),
    customerTypeIds: history.tags.map((t) => t.customerTypeId),
    customerTypes: history.tags.map((t) => ({
      id: t.customerType.id,
      name: t.customerType.name,
      code: t.customerType.code,
      projectId: t.customerType.projectId,
      projectName: t.customerType.project?.name ?? null,
      projectCode: t.customerType.project?.code ?? null,
    })),
    lineFriends: history.lineFriends.map((lf) => ({
      id: lf.lineFriend.id,
      snsname: lf.lineFriend.snsname,
      uid: lf.lineFriend.uid,
    })),
    files: history.files.map((f) => ({
      id: f.id,
      filePath: f.filePath,
      fileName: f.fileName,
      fileSize: f.fileSize,
      mimeType: f.mimeType,
      url: f.url,
    })),
  };
}
