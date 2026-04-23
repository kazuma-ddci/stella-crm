/**
 * SLP接触履歴 → 新統一接触履歴（V2）データ移行スクリプト
 *
 * 既存の slp_contact_histories, slp_contact_history_line_friends, slp_contact_history_files を
 * 新しい contact_histories_v2 系テーブルに移行する。
 *
 * 冪等性:
 *   sourceRefId="slp:<legacyId>" で既存の移行済みV2行を識別し、再実行時は
 *   delete→insert で差し替える。カスケードにより参加者・ファイル等も全て再作成。
 *
 * 本スクリプトで移行しないもの（Phase 2以降で扱う）:
 *   - SlpContactHistoryTag (顧客種別タグ) → 新設計では targetType が代替
 *   - SlpZoomRecording / Zoom URL情報 → Phase 2 で会議テーブルに移行
 *   - SlpMeetingSession との紐付け (sessionId) → Phase 2 で検討
 *
 * 実データで発見した targetType の扱い (2026-04-23):
 *   - "company_record" / "company" (旧称) → slp_company_record（同等扱い）
 *   - "agency"                             → slp_agency
 *   - "line_users"                         → slp_line_friend（複数展開）
 *   - "other"                              → slp_other (targetId=null)
 *
 * 使用方法:
 *   docker compose exec app npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-slp-contact-histories-to-v2.ts [--dry-run]
 *
 * オプション:
 *   --dry-run  実際のDB書き込みを行わず、件数と内訳のみ出力
 *
 * 設計書: docs/plans/contact-history-unification-plan.md
 */

import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");

// ============================================================
// 統計
// ============================================================
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

// ============================================================
// ロガー
// ============================================================
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

// ============================================================
// ヘルパー
// ============================================================

/**
 * 先方参加者テキスト（例: "田中さん、吉田さん"）を個人名の配列に分割する。
 * 氏名にはスペースを含む可能性があるため、区切り文字はカンマ・全角カンマ・改行のみ。
 */
function splitAttendeeNames(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[,、，\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * assignedTo カラム（カンマ区切りのスタッフID）を数値IDの配列に変換。
 */
function parseAssignedToStaffIds(csv: string | null): number[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n));
}

/**
 * 顧客側参加エンティティのデータ構築。
 * targetType に応じて CustomerParticipant 行を組み立てる。
 */
function buildCustomerParticipantsData(
  legacy: Prisma.SlpContactHistoryGetPayload<{ include: { lineFriends: true } }>,
): { targetType: string; targetId: number | null }[] {
  const result: { targetType: string; targetId: number | null }[] = [];

  // "company_record" と旧称 "company" は同等扱い（どちらも事業者に紐づく）
  if (legacy.targetType === "company_record" || legacy.targetType === "company") {
    if (legacy.companyRecordId) {
      result.push({
        targetType: "slp_company_record",
        targetId: legacy.companyRecordId,
      });
    } else {
      warn(
        `${legacy.targetType} target だが companyRecordId が null (id=${legacy.id})`,
      );
    }
  } else if (legacy.targetType === "agency") {
    if (legacy.agencyId) {
      result.push({ targetType: "slp_agency", targetId: legacy.agencyId });
    } else {
      warn(`agency target だが agencyId が null (id=${legacy.id})`);
    }
  } else if (legacy.targetType === "line_users") {
    const seenIds = new Set<number>();
    for (const lf of legacy.lineFriends) {
      if (!seenIds.has(lf.lineFriendId)) {
        result.push({ targetType: "slp_line_friend", targetId: lf.lineFriendId });
        seenIds.add(lf.lineFriendId);
      }
    }
    if (result.length === 0) {
      warn(`line_users target だが紐付けLINE友達が0件 (id=${legacy.id})`);
    }
  } else if (legacy.targetType === "other") {
    // 特定マスタに紐づかない接触。先方参加者テキストを保持するための器として
    // targetId=null の slp_other 行を1件作る。
    result.push({ targetType: "slp_other", targetId: null });
  } else {
    warn(`未知の targetType: "${legacy.targetType}" (id=${legacy.id})`);
  }

  return result;
}

/**
 * 弊社スタッフ参加者のデータ構築。
 * staffId（ホスト）+ assignedTo CSV のユニオン、重複除去、存在するスタッフのみ。
 */
function buildStaffParticipantsData(
  legacy: { id: number; staffId: number | null; assignedTo: string | null },
  validStaffIds: Set<number>,
): { staffId: number; isHost: boolean }[] {
  const result: { staffId: number; isHost: boolean }[] = [];
  const seen = new Set<number>();

  // 作成スタッフ = ホスト扱い
  if (legacy.staffId !== null && validStaffIds.has(legacy.staffId)) {
    result.push({ staffId: legacy.staffId, isHost: true });
    seen.add(legacy.staffId);
  } else if (legacy.staffId !== null) {
    warn(`staffId=${legacy.staffId} が master_staff に存在しない (id=${legacy.id})`);
  }

  // assignedTo CSV
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

// ============================================================
// メイン処理
// ============================================================

async function main() {
  log(`=== SLP接触履歴 → V2 移行${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  // SLPプロジェクトIDを解決
  const slpProject = await prisma.masterProject.findFirst({
    where: { code: "slp" },
    select: { id: true },
  });
  if (!slpProject) {
    error("SLPプロジェクト (code=slp) が見つかりません");
    process.exit(1);
  }
  const SLP_PROJECT_ID = slpProject.id;
  log(`SLPプロジェクトID: ${SLP_PROJECT_ID}`);

  // 有効スタッフIDセット（FK違反を避けるため事前検証）
  const validStaffIds = new Set<number>(
    (await prisma.masterStaff.findMany({ select: { id: true } })).map((s) => s.id),
  );
  log(`検証用スタッフ数: ${validStaffIds.size}`);

  // 対象レコード取得（論理削除含む）
  const legacyHistories = await prisma.slpContactHistory.findMany({
    include: {
      lineFriends: true,
      files: true,
    },
    orderBy: { id: "asc" },
  });
  stats.total = legacyHistories.length;
  log(`対象レコード数: ${stats.total}`);

  for (const legacy of legacyHistories) {
    try {
      await migrateOne(legacy, SLP_PROJECT_ID, validStaffIds);
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
  legacy: Prisma.SlpContactHistoryGetPayload<{
    include: { lineFriends: true; files: true };
  }>,
  slpProjectId: number,
  validStaffIds: Set<number>,
) {
  const sourceRefId = `slp:${legacy.id}`;

  // 冪等性: 既存の移行済みV2行を削除 (カスケードで子テーブルも消える)
  if (!DRY_RUN) {
    const existing = await prisma.contactHistoryV2.findFirst({
      where: { projectId: slpProjectId, sourceRefId },
      select: { id: true },
    });
    if (existing) {
      await prisma.contactHistoryV2.delete({ where: { id: existing.id } });
    }
  }

  // ステータス判定: contactDateが未来なら予定、過去なら実施済み
  const now = new Date();
  const status: string = legacy.contactDate > now ? "scheduled" : "completed";

  // 構造データを構築
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
      projectId: slpProjectId,
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

  // 先方参加者(個人)を primary CustomerParticipant にぶら下げる
  // (旧 customerParticipants テキストは customer entity と明示的に紐づいていないため、
  //  主顧客（またはその1件目）にまとめて紐付ける)
  if (attendeeNames.length > 0 && v2.customerParticipants.length > 0) {
    const primary =
      v2.customerParticipants.find((cp) => cp.isPrimary) ??
      v2.customerParticipants[0];
    await prisma.contactCustomerAttendee.createMany({
      data: attendeeNames.map((name, idx) => ({
        customerParticipantId: primary.id,
        name: name.slice(0, 100), // varchar(100) 制約対策
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
