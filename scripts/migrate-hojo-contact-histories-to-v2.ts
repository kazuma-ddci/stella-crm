/**
 * HOJO接触履歴 → 新統一接触履歴（V2）データ移行スクリプト
 *
 * 既存の hojo_contact_histories, hojo_contact_history_files を
 * 新しい contact_histories_v2 系テーブルに移行する。
 *
 * 冪等性:
 *   sourceRefId="hojo:<legacyId>" で既存V2行を識別し、delete→insert で差替え。
 *
 * 本スクリプトで移行しないもの:
 *   - HojoContactHistoryTag (顧客種別タグ) → targetType が代替
 *   - HojoZoomRecording → scripts/migrate-hojo-zoom-recordings-to-v2.ts (今後作成)
 *
 * 使用方法:
 *   docker compose exec app npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-hojo-contact-histories-to-v2.ts [--dry-run]
 *
 * targetType マッピング:
 *   "vendor" → slp_other 相当の hojo_vendor (vendorId を使う)
 *   "bbs"    → hojo_bbs (targetId=null)
 *   "lender" → hojo_lender (targetId=null)
 *   "other"  → hojo_other (targetId=null)
 *
 * 設計書: docs/plans/contact-history-unification-plan.md §3.2
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const stats = {
  total: 0,
  migrated: 0,
  errors: 0,
  customerParticipantsCreated: 0,
  customerAttendeesCreated: 0,
  staffParticipantsCreated: 0,
  filesCreated: 0,
  warnings: [] as string[],
};

function log(msg: string) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}
function warn(msg: string) {
  console.warn(`[${new Date().toISOString()}] ⚠ ${msg}`);
  stats.warnings.push(msg);
}
function error(msg: string) {
  console.error(`[${new Date().toISOString()}] ✖ ${msg}`);
}

function splitAttendeeNames(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,、，\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function parseAssignedToStaffIds(csv: string | null): number[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));
}

function buildCustomerParticipantsData(
  legacy: Prisma.HojoContactHistoryGetPayload<Record<string, never>>,
): { targetType: string; targetId: number | null }[] {
  const result: { targetType: string; targetId: number | null }[] = [];

  if (legacy.targetType === "vendor") {
    if (legacy.vendorId) {
      result.push({ targetType: "hojo_vendor", targetId: legacy.vendorId });
    } else {
      warn(`vendor target だが vendorId が null (id=${legacy.id})`);
    }
  } else if (legacy.targetType === "bbs") {
    result.push({ targetType: "hojo_bbs", targetId: null });
  } else if (legacy.targetType === "lender") {
    result.push({ targetType: "hojo_lender", targetId: null });
  } else if (legacy.targetType === "other") {
    result.push({ targetType: "hojo_other", targetId: null });
  } else {
    warn(`未知の targetType: "${legacy.targetType}" (id=${legacy.id})`);
  }

  return result;
}

function buildStaffParticipantsData(
  legacy: { id: number; staffId: number | null; assignedTo: string | null },
  validStaffIds: Set<number>,
): { staffId: number; isHost: boolean }[] {
  const result: { staffId: number; isHost: boolean }[] = [];
  const seen = new Set<number>();

  if (legacy.staffId !== null && validStaffIds.has(legacy.staffId)) {
    result.push({ staffId: legacy.staffId, isHost: true });
    seen.add(legacy.staffId);
  } else if (legacy.staffId !== null) {
    warn(`staffId=${legacy.staffId} が master_staff に存在しない (id=${legacy.id})`);
  }

  const assignedIds = parseAssignedToStaffIds(legacy.assignedTo);
  for (const id of assignedIds) {
    if (seen.has(id)) continue;
    if (!validStaffIds.has(id)) {
      warn(`assignedTo に存在しないスタッフID=${id} (id=${legacy.id})`);
      continue;
    }
    result.push({ staffId: id, isHost: false });
    seen.add(id);
  }

  return result;
}

async function main() {
  log(`=== HOJO接触履歴 → V2 移行${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  const hojoProject = await prisma.masterProject.findFirst({
    where: { code: "hojo" },
    select: { id: true },
  });
  if (!hojoProject) {
    error("HOJOプロジェクト (code=hojo) が見つかりません");
    process.exit(1);
  }
  const HOJO_PROJECT_ID = hojoProject.id;
  log(`HOJOプロジェクトID: ${HOJO_PROJECT_ID}`);

  const validStaffIds = new Set<number>(
    (await prisma.masterStaff.findMany({ select: { id: true } })).map((s) => s.id),
  );
  log(`検証用スタッフ数: ${validStaffIds.size}`);

  const legacyHistories = await prisma.hojoContactHistory.findMany({
    include: { files: true },
    orderBy: { id: "asc" },
  });
  stats.total = legacyHistories.length;
  log(`対象レコード数: ${stats.total}`);

  for (const legacy of legacyHistories) {
    try {
      await migrateOne(legacy, HOJO_PROJECT_ID, validStaffIds);
      stats.migrated++;
    } catch (e) {
      error(`移行失敗 (id=${legacy.id}): ${e instanceof Error ? e.message : String(e)}`);
      stats.errors++;
    }
  }

  log("=== 統計 ===");
  log(`  合計レコード: ${stats.total}`);
  log(`  移行完了: ${stats.migrated}`);
  log(`  エラー: ${stats.errors}`);
  log(`  顧客参加エンティティ作成: ${stats.customerParticipantsCreated}`);
  log(`  先方参加者(個人)作成: ${stats.customerAttendeesCreated}`);
  log(`  スタッフ参加者作成: ${stats.staffParticipantsCreated}`);
  log(`  ファイル作成: ${stats.filesCreated}`);
  if (stats.warnings.length > 0) {
    log(`  警告: ${stats.warnings.length}件`);
  }
}

async function migrateOne(
  legacy: Prisma.HojoContactHistoryGetPayload<{ include: { files: true } }>,
  hojoProjectId: number,
  validStaffIds: Set<number>,
) {
  const sourceRefId = `hojo:${legacy.id}`;

  if (!DRY_RUN) {
    const existing = await prisma.contactHistoryV2.findFirst({
      where: { projectId: hojoProjectId, sourceRefId },
      select: { id: true },
    });
    if (existing) {
      await prisma.contactHistoryV2.delete({ where: { id: existing.id } });
    }
  }

  const now = new Date();
  const status: string = legacy.contactDate > now ? "scheduled" : "completed";

  const customerParticipantsData = buildCustomerParticipantsData(legacy);
  const attendeeNames = splitAttendeeNames(legacy.customerParticipants);
  const staffParticipantsData = buildStaffParticipantsData(legacy, validStaffIds);
  const filesData = legacy.files.map((f) => ({
    filePath: f.filePath,
    fileName: f.fileName,
    fileSize: f.fileSize,
    mimeType: f.mimeType,
    url: f.url,
    createdAt: f.createdAt,
  }));

  if (DRY_RUN) {
    log(
      `[DRY] id=${legacy.id}: status=${status}, ` +
        `顧客=${customerParticipantsData.length}, ` +
        `先方参加者=${attendeeNames.length}名, ` +
        `スタッフ=${staffParticipantsData.length}, ` +
        `ファイル=${filesData.length}`,
    );
    return;
  }

  const createdByStaffId =
    legacy.staffId !== null && validStaffIds.has(legacy.staffId)
      ? legacy.staffId
      : null;

  const v2 = await prisma.contactHistoryV2.create({
    data: {
      projectId: hojoProjectId,
      status,
      scheduledStartAt: legacy.contactDate,
      actualStartAt: status === "completed" ? legacy.contactDate : null,
      displayTimezone: "Asia/Tokyo",
      contactMethodId: legacy.contactMethodId,
      contactCategoryId: legacy.contactCategoryId,
      meetingMinutes: legacy.meetingMinutes,
      note: legacy.note,
      sourceType: "manual",
      sourceRefId,
      createdByStaffId,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      deletedAt: legacy.deletedAt,
      customerParticipants: {
        create: customerParticipantsData.map((cp, idx) => ({
          targetType: cp.targetType,
          targetId: cp.targetId,
          isPrimary: idx === 0,
          displayOrder: idx,
        })),
      },
      staffParticipants: {
        create: staffParticipantsData.map((sp) => ({
          staffId: sp.staffId,
          isHost: sp.isHost,
          createdAt: legacy.createdAt,
          updatedAt: legacy.updatedAt,
        })),
      },
      files: {
        create: filesData,
      },
    },
    include: { customerParticipants: true },
  });

  stats.customerParticipantsCreated += v2.customerParticipants.length;
  stats.staffParticipantsCreated += staffParticipantsData.length;
  stats.filesCreated += filesData.length;

  if (attendeeNames.length > 0 && v2.customerParticipants.length > 0) {
    const primary =
      v2.customerParticipants.find((cp) => cp.isPrimary) ??
      v2.customerParticipants[0];
    await prisma.contactCustomerAttendee.createMany({
      data: attendeeNames.map((name, idx) => ({
        customerParticipantId: primary.id,
        name: name.slice(0, 100),
        sourceType: "manual",
        savedToMaster: false,
        displayOrder: idx,
        createdAt: legacy.createdAt,
      })),
    });
    stats.customerAttendeesCreated += attendeeNames.length;
  }
}

main()
  .then(async () => {
    log("完了");
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    error(String(e));
    await prisma.$disconnect();
    process.exit(1);
  });
