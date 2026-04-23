/**
 * SLP Zoom録画 (SlpZoomRecording) → 新V2会議テーブル移行スクリプト
 *
 * slp_zoom_recordings を以下3テーブルに分離して移行する:
 *   - contact_history_meetings          : 会議カード(URL/パスコード/ホスト等)
 *   - contact_history_meeting_records   : 実施後データ(録画・議事録・AI要約)
 *   - meeting_record_summaries          : AI要約のバージョン履歴(Zoom AI + Claude)
 *
 * 事前条件:
 *   scripts/migrate-slp-contact-histories-to-v2.ts を先に実行済みであること。
 *   sourceRefId="slp:<legacy_id>" で legacy → v2 の対応を解決する。
 *
 * 冪等性:
 *   provider="zoom" + externalMeetingId の unique 制約で既存行を識別し、
 *   再実行時は delete→create で差し替える(カスケードで records/summaries も再作成)。
 *
 * 使用方法:
 *   docker compose exec app npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-slp-zoom-recordings-to-v2.ts [--dry-run]
 *
 * 設計書: docs/plans/contact-history-unification-plan.md §4
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
  skipped: 0,
  errors: 0,
  meetingsCreated: 0,
  recordsCreated: 0,
  summariesCreated: 0,
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

// ============================================================
// JSON パース (失敗時は null)
// ============================================================
function safeJsonParse(text: string | null): Prisma.JsonValue | null {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// ============================================================
// メイン処理
// ============================================================

async function main() {
  log(`=== SLP Zoom録画 → V2会議テーブル移行${DRY_RUN ? " (DRY RUN)" : ""} ===`);

  // 有効スタッフIDセット (FK違反を避けるため)
  const validStaffIds = new Set<number>(
    (await prisma.masterStaff.findMany({ select: { id: true } })).map((s) => s.id),
  );
  log(`検証用スタッフ数: ${validStaffIds.size}`);

  // SLP移行済みV2接触履歴のID対応表を構築
  // sourceRefId="slp:<legacy_id>" から legacy_id → v2_id へのマッピング
  const v2Histories = await prisma.contactHistoryV2.findMany({
    where: { sourceRefId: { startsWith: "slp:" } },
    select: { id: true, sourceRefId: true },
  });
  const legacyToV2Map = new Map<number, number>();
  for (const h of v2Histories) {
    if (h.sourceRefId) {
      const legacyId = parseInt(h.sourceRefId.replace("slp:", ""), 10);
      if (!isNaN(legacyId)) {
        legacyToV2Map.set(legacyId, h.id);
      }
    }
  }
  log(`SLP→V2 接触履歴対応表: ${legacyToV2Map.size}件`);

  if (legacyToV2Map.size === 0) {
    error(
      "SLP移行済みV2接触履歴が見つかりません。先に migrate-slp-contact-histories-to-v2.ts を実行してください。",
    );
    process.exit(1);
  }

  // 対象 Zoom レコード取得
  const legacyRecordings = await prisma.slpZoomRecording.findMany({
    orderBy: { id: "asc" },
  });
  stats.total = legacyRecordings.length;
  log(`対象レコード数: ${stats.total}`);

  for (const legacy of legacyRecordings) {
    try {
      await migrateOne(legacy, legacyToV2Map, validStaffIds);
      stats.migrated++;
    } catch (e) {
      error(
        `移行失敗 (id=${legacy.id}): ${e instanceof Error ? e.message : String(e)}`,
      );
      stats.errors++;
    }
  }

  log("=== 統計 ===");
  log(`  合計レコード: ${stats.total}`);
  log(`  移行完了: ${stats.migrated}`);
  log(`  スキップ: ${stats.skipped}`);
  log(`  エラー: ${stats.errors}`);
  log(`  会議(meetings)作成: ${stats.meetingsCreated}`);
  log(`  会議記録(records)作成: ${stats.recordsCreated}`);
  log(`  AI要約バージョン作成: ${stats.summariesCreated}`);
  if (stats.warnings.length > 0) {
    log(`  警告: ${stats.warnings.length}件`);
  }
}

async function migrateOne(
  legacy: Prisma.SlpZoomRecordingGetPayload<Record<string, never>>,
  legacyToV2Map: Map<number, number>,
  validStaffIds: Set<number>,
) {
  // 対応するV2接触履歴IDを解決
  const v2ContactHistoryId = legacyToV2Map.get(legacy.contactHistoryId);
  if (!v2ContactHistoryId) {
    warn(
      `V2接触履歴が未移行 (legacy zoom id=${legacy.id}, legacy contact_history_id=${legacy.contactHistoryId})`,
    );
    stats.skipped++;
    throw new Error(`V2接触履歴が見つからない: contact_history_id=${legacy.contactHistoryId}`);
  }

  const externalMeetingId = String(legacy.zoomMeetingId);

  if (DRY_RUN) {
    const hasRecord =
      legacy.mp4Path !== null ||
      legacy.transcriptText !== null ||
      legacy.aiCompanionSummary !== null ||
      legacy.claudeSummary !== null;
    const summaryVersions =
      (legacy.aiCompanionSummary ? 1 : 0) + (legacy.claudeSummary ? 1 : 0);
    log(
      `[DRY] zoom id=${legacy.id} → v2 contact=${v2ContactHistoryId}: ` +
        `state=${legacy.state}, URL=${legacy.joinUrl ? "○" : "—"}, ` +
        `録画=${legacy.mp4Path ? "○" : "—"}, ` +
        `record=${hasRecord ? "作成" : "なし"}, 要約版数=${summaryVersions}`,
    );
    return;
  }

  // 冪等性: 既存の同一会議を削除 (cascade で records/summaries も消える)
  await prisma.contactHistoryMeeting.deleteMany({
    where: { provider: "zoom", externalMeetingId },
  });

  // ホストスタッフID検証
  const hostStaffId =
    legacy.hostStaffId !== null && validStaffIds.has(legacy.hostStaffId)
      ? legacy.hostStaffId
      : null;

  // urlSource / apiIntegrationStatus 判定
  // 旧SLPのZoom URLは Zoom API 経由で自動生成されていたので auto_generated
  // 現時点では staff_zoom_auth テーブルが未実装のため、URLありなら available を仮置き
  // (Phase 3 でスタッフ認証情報を持った時点で再計算される想定)
  const urlSource = legacy.joinUrl ? "auto_generated" : "empty";
  const apiIntegrationStatus = legacy.joinUrl ? "available" : "no_url_yet";

  // Zoom固有の付帯情報は providerMetadata JSON に保持
  const providerMetadata: Record<string, unknown> = {
    category: legacy.category, // "briefing" | "consultation"
  };
  if (legacy.confirmSentAt !== null) providerMetadata.confirmSentAt = legacy.confirmSentAt;
  if (legacy.remindDaySentAt !== null) providerMetadata.remindDaySentAt = legacy.remindDaySentAt;
  if (legacy.remindHourSentAt !== null) providerMetadata.remindHourSentAt = legacy.remindHourSentAt;

  // 会議カード本体を作成
  const meeting = await prisma.contactHistoryMeeting.create({
    data: {
      contactHistoryId: v2ContactHistoryId,
      provider: "zoom",
      isPrimary: legacy.isPrimary,
      label: legacy.label,
      displayOrder: 0,
      externalMeetingId,
      externalMeetingUuid: legacy.zoomMeetingUuid,
      joinUrl: legacy.joinUrl,
      startUrl: legacy.startUrl,
      passcode: legacy.password,
      hostStaffId,
      urlSource,
      urlSetAt: legacy.joinUrl ? legacy.createdAt : null,
      apiIntegrationStatus,
      scheduledStartAt: legacy.scheduledAt,
      state: legacy.state,
      apiError: legacy.zoomApiError,
      apiErrorAt: legacy.zoomApiErrorAt,
      providerMetadata: providerMetadata as Prisma.InputJsonValue,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
      deletedAt: legacy.deletedAt,
    },
  });
  stats.meetingsCreated++;

  // 実施後データがあれば meeting_record を作成
  const hasPostMeetingData =
    legacy.mp4Path !== null ||
    legacy.transcriptText !== null ||
    legacy.aiCompanionSummary !== null ||
    legacy.claudeSummary !== null ||
    legacy.chatLogText !== null ||
    legacy.recordingStartAt !== null;

  if (!hasPostMeetingData) {
    return;
  }

  // 現行版AI要約の決定: Claude要約があればそれを現行版に、なければZoom AI要約
  const hasClaude = legacy.claudeSummary !== null;
  const hasZoomAi = legacy.aiCompanionSummary !== null;
  const currentSummary = hasClaude
    ? legacy.claudeSummary
    : hasZoomAi
      ? legacy.aiCompanionSummary
      : null;
  const currentSource = hasClaude
    ? "claude"
    : hasZoomAi
      ? "zoom_ai_companion"
      : null;
  const currentModel = hasClaude ? legacy.claudeSummaryModel : null;
  const currentGeneratedAt = hasClaude
    ? legacy.claudeSummaryGeneratedAt
    : legacy.aiCompanionFetchedAt;

  // minutesAppendedAt: Claude版優先、なければ Zoom AI版
  const minutesAppendedAt = hasClaude
    ? legacy.claudeMinutesAppendedAt
    : legacy.minutesAppendedAt;

  // Zoom固有の生データは providerRawData JSON に保持
  const providerRawData: Record<string, unknown> = {};
  if (legacy.summaryNextSteps) providerRawData.summaryNextSteps = legacy.summaryNextSteps;
  if (legacy.participantsFetchedAt) providerRawData.participantsFetchedAt = legacy.participantsFetchedAt;
  if (legacy.chatFetchedAt) providerRawData.chatFetchedAt = legacy.chatFetchedAt;
  if (legacy.zoomCloudDeletedAt) providerRawData.zoomCloudDeletedAt = legacy.zoomCloudDeletedAt;
  if (legacy.participantsExtracted) providerRawData.participantsExtracted = legacy.participantsExtracted;

  const record = await prisma.contactHistoryMeetingRecord.create({
    data: {
      meetingId: meeting.id,
      recordingStartAt: legacy.recordingStartAt,
      recordingEndAt: legacy.recordingEndAt,
      recordingPath: legacy.mp4Path,
      recordingSizeBytes: legacy.mp4SizeBytes,
      transcriptUrl: legacy.transcriptPath,
      transcriptText: legacy.transcriptText,
      chatLogUrl: legacy.chatLogPath,
      chatLogText: legacy.chatLogText,
      attendanceJson: (safeJsonParse(legacy.participantsJson) ?? undefined) as Prisma.InputJsonValue | undefined,
      aiSummary: currentSummary,
      aiSummarySource: currentSource,
      aiSummaryModel: currentModel,
      aiSummaryGeneratedAt: currentGeneratedAt,
      minutesAppendedAt,
      downloadStatus: legacy.downloadStatus,
      downloadError: legacy.downloadError,
      providerRawData: Object.keys(providerRawData).length > 0
        ? (providerRawData as Prisma.InputJsonValue)
        : undefined,
      createdAt: legacy.createdAt,
      updatedAt: legacy.updatedAt,
    },
  });
  stats.recordsCreated++;

  // AI要約のバージョン履歴を作成
  let version = 1;

  // Zoom AI Companion版 (常に最古側)
  if (hasZoomAi) {
    await prisma.meetingRecordSummary.create({
      data: {
        meetingRecordId: record.id,
        version,
        summaryText: legacy.aiCompanionSummary!,
        source: "zoom_ai_companion",
        generatedAt: legacy.aiCompanionFetchedAt ?? legacy.createdAt,
        isCurrent: !hasClaude, // Claude版がなければこれが現行
        createdAt: legacy.createdAt,
      },
    });
    version++;
    stats.summariesCreated++;
  }

  // Claude版 (Zoom AIの後、現行)
  if (hasClaude) {
    await prisma.meetingRecordSummary.create({
      data: {
        meetingRecordId: record.id,
        version,
        summaryText: legacy.claudeSummary!,
        source: "claude",
        model: legacy.claudeSummaryModel,
        promptSnapshot: legacy.claudeSummaryPromptSnapshot,
        generatedAt: legacy.claudeSummaryGeneratedAt ?? legacy.createdAt,
        isCurrent: true,
        createdAt: legacy.createdAt,
      },
    });
    stats.summariesCreated++;
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
