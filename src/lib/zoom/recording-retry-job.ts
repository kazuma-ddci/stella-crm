import { prisma } from "@/lib/prisma";
import { fetchAllForRecording as fetchAllForSlpRecording } from "@/lib/slp/zoom-recording-processor";
import { fetchAllForRecording as fetchAllForHojoRecording } from "@/lib/hojo/zoom-recording-processor";
import { logAutomationError } from "@/lib/automation-error";
import { isFinalZoomTranscriptFailure } from "@/lib/zoom/recording";

const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_AGE_MS = 10 * 60 * 1000;
const MAX_PER_PROJECT = 20;
const CANDIDATE_TAKE = 80;

type RetryResult = {
  scanned: number;
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
};

type RetryJobResult = {
  slp: RetryResult;
  hojo: RetryResult;
};

function emptyResult(): RetryResult {
  return { scanned: 0, processed: 0, succeeded: 0, failed: 0, skipped: 0 };
}

function isTooRecent(scheduledAt: Date | null, createdAt: Date, now: Date): boolean {
  const base = scheduledAt ?? createdAt;
  return now.getTime() - base.getTime() < MIN_AGE_MS;
}

function shouldSkipFinalError(error: string | null): boolean {
  return (
    isFinalZoomTranscriptFailure(error) ||
    /Zoom再連携が必要な可能性があります/.test(error ?? "")
  );
}

export async function runZoomRecordingRetryJob(
  now = new Date()
): Promise<RetryJobResult> {
  const cutoff = new Date(now.getTime() - LOOKBACK_MS);
  const [slp, hojo] = await Promise.all([
    runSlpZoomRecordingRetry(now, cutoff),
    runHojoZoomRecordingRetry(now, cutoff),
  ]);
  return { slp, hojo };
}

async function runSlpZoomRecordingRetry(
  now: Date,
  cutoff: Date
): Promise<RetryResult> {
  const result = emptyResult();
  const candidates = await prisma.slpZoomRecording.findMany({
    where: {
      deletedAt: null,
      hostStaffId: { not: null },
      transcriptText: null,
      downloadStatus: { not: "in_progress" },
      OR: [{ scheduledAt: { gte: cutoff } }, { createdAt: { gte: cutoff } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: CANDIDATE_TAKE,
    select: {
      id: true,
      scheduledAt: true,
      createdAt: true,
      downloadError: true,
    },
  });
  result.scanned = candidates.length;

  for (const rec of candidates) {
    if (result.processed >= MAX_PER_PROJECT) break;
    if (
      isTooRecent(rec.scheduledAt, rec.createdAt, now) ||
      shouldSkipFinalError(rec.downloadError)
    ) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;
    try {
      const fetched = await fetchAllForSlpRecording(rec.id);
      if (fetched.files.transcript) result.succeeded += 1;
    } catch (err) {
      result.failed += 1;
      await logAutomationError({
        source: "cron/zoom-recording-retry/slp",
        message: "SLP Zoom文字起こし再取得失敗",
        detail: {
          recordingId: rec.id,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return result;
}

async function runHojoZoomRecordingRetry(
  now: Date,
  cutoff: Date
): Promise<RetryResult> {
  const result = emptyResult();
  const candidates = await prisma.hojoZoomRecording.findMany({
    where: {
      deletedAt: null,
      hostStaffId: { not: null },
      transcriptText: null,
      downloadStatus: { not: "in_progress" },
      OR: [{ scheduledAt: { gte: cutoff } }, { createdAt: { gte: cutoff } }],
    },
    orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
    take: CANDIDATE_TAKE,
    select: {
      id: true,
      scheduledAt: true,
      createdAt: true,
      downloadError: true,
    },
  });
  result.scanned = candidates.length;

  for (const rec of candidates) {
    if (result.processed >= MAX_PER_PROJECT) break;
    if (
      isTooRecent(rec.scheduledAt, rec.createdAt, now) ||
      shouldSkipFinalError(rec.downloadError)
    ) {
      result.skipped += 1;
      continue;
    }

    result.processed += 1;
    try {
      const fetched = await fetchAllForHojoRecording(rec.id);
      if (fetched.files.transcript) result.succeeded += 1;
    } catch (err) {
      result.failed += 1;
      await logAutomationError({
        source: "cron/zoom-recording-retry/hojo",
        message: "HOJO Zoom文字起こし再取得失敗",
        detail: {
          recordingId: rec.id,
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  return result;
}
