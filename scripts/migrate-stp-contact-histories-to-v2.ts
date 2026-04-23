/**
 * STP接触履歴 → 新統一接触履歴（V2）データ移行スクリプト
 *
 * 既存の contact_histories (STP), contact_history_roles, contact_history_files を
 * 新しい contact_histories_v2 系テーブルに移行する。
 *
 * 冪等性:
 *   sourceRefId="stp:<legacyId>" で既存V2行を識別し、delete→insert で差替え。
 *
 * targetType マッピング (role tag から決定):
 *   role=企業   → stp_company (targetId = MasterStellaCompany.id = legacy.companyId)
 *   role=代理店 → stp_agent   (targetId = StpAgent.id, companyIdから解決)
 *   その他     → stp_company (fallback)
 *
 * 本スクリプトで移行しないもの:
 *   - ContactHistoryRole (顧客種別タグ) → targetType が代替 (廃止対象)
 *
 * 使用方法:
 *   docker compose exec app npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-stp-contact-histories-to-v2.ts [--dry-run]
 *
 * 設計書: docs/plans/contact-history-unification-plan.md §10
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

const stats = {
  total: 0,
  migrated: 0,
  errors: 0,
  asCompany: 0,
  asAgent: 0,
  asFallback: 0,
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
  log(`=== STP接触履歴 → V2 移行${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  const stpProject = await prisma.masterProject.findFirst({
    where: { code: "stp" },
    select: { id: true },
  });
  if (!stpProject) {
    error("STPプロジェクト (code=stp) が見つかりません");
    process.exit(1);
  }
  const STP_PROJECT_ID = stpProject.id;
  log(`STPプロジェクトID: ${STP_PROJECT_ID}`);

  const validStaffIds = new Set<number>(
    (await prisma.masterStaff.findMany({ select: { id: true } })).map((s) => s.id),
  );
  log(`検証用スタッフ数: ${validStaffIds.size}`);

  // 代理店(StpAgent) の companyId → agentId マッピングを構築
  // （役割が代理店のときに targetId=agentId に解決するため）
  const agents = await prisma.stpAgent.findMany({
    select: { id: true, companyId: true },
  });
  const companyIdToAgentId = new Map<number, number>();
  for (const a of agents) {
    if (!companyIdToAgentId.has(a.companyId)) {
      companyIdToAgentId.set(a.companyId, a.id);
    }
  }
  log(`StpAgent 登録数: ${agents.length} (ユニーク企業: ${companyIdToAgentId.size})`);

  const legacyHistories = await prisma.contactHistory.findMany({
    include: {
      roles: {
        include: {
          customerType: { select: { id: true, code: true, name: true } },
        },
      },
      files: true,
    },
    orderBy: { id: "asc" },
  });
  stats.total = legacyHistories.length;
  log(`対象レコード数: ${stats.total}`);

  for (const legacy of legacyHistories) {
    try {
      await migrateOne(legacy, STP_PROJECT_ID, validStaffIds, companyIdToAgentId);
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
  log(`  → うち stp_company: ${stats.asCompany}`);
  log(`  → うち stp_agent: ${stats.asAgent}`);
  log(`  → うち fallback (stp_company): ${stats.asFallback}`);
  log(`  先方参加者(個人)作成: ${stats.customerAttendeesCreated}`);
  log(`  スタッフ参加者作成: ${stats.staffParticipantsCreated}`);
  log(`  ファイル作成: ${stats.filesCreated}`);
  if (stats.warnings.length > 0) {
    log(`  警告: ${stats.warnings.length}件`);
  }
}

async function migrateOne(
  legacy: Prisma.ContactHistoryGetPayload<{
    include: {
      roles: { include: { customerType: true } };
      files: true;
    };
  }>,
  stpProjectId: number,
  validStaffIds: Set<number>,
  companyIdToAgentId: Map<number, number>,
) {
  const sourceRefId = `stp:${legacy.id}`;

  if (!DRY_RUN) {
    const existing = await prisma.contactHistoryV2.findFirst({
      where: { projectId: stpProjectId, sourceRefId },
      select: { id: true },
    });
    if (existing) {
      await prisma.contactHistoryV2.delete({ where: { id: existing.id } });
    }
  }

  const now = new Date();
  const status: string = legacy.contactDate > now ? "scheduled" : "completed";

  // role タグから targetType 決定
  // 複数タグがある場合は 代理店 > 企業 > fallback の優先順
  const roleNames = legacy.roles.map((r) => r.customerType?.name).filter(Boolean);
  let targetType: string;
  let targetId: number | null;
  if (roleNames.includes("代理店")) {
    const agentId = companyIdToAgentId.get(legacy.companyId);
    if (agentId !== undefined) {
      targetType = "stp_agent";
      targetId = agentId;
      stats.asAgent++;
    } else {
      warn(`代理店ロールだが StpAgent が見つからない (id=${legacy.id}, companyId=${legacy.companyId}) → stp_company でfallback`);
      targetType = "stp_company";
      targetId = legacy.companyId;
      stats.asFallback++;
    }
  } else if (roleNames.includes("企業")) {
    targetType = "stp_company";
    targetId = legacy.companyId;
    stats.asCompany++;
  } else {
    // role タグが想定外 or なし → stp_company fallback
    warn(`role タグから targetType 決定不能 (id=${legacy.id}, roles=[${roleNames.join(",")}]) → stp_company でfallback`);
    targetType = "stp_company";
    targetId = legacy.companyId;
    stats.asFallback++;
  }

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
        `targetType=${targetType}, targetId=${targetId}, ` +
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
      projectId: stpProjectId,
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
        create: [
          {
            targetType,
            targetId,
            isPrimary: true,
            displayOrder: 0,
          },
        ],
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
