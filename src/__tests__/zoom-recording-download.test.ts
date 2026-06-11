import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaffZoomContext: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  prisma: {
    slpZoomRecording: { findMany: vi.fn() },
    hojoZoomRecording: { findMany: vi.fn() },
  },
  fetchAllForSlpRecording: vi.fn(),
  fetchAllForHojoRecording: vi.fn(),
  logAutomationError: vi.fn(),
}));

vi.mock("../lib/zoom/client", () => ({
  requireStaffZoomContext: mocks.requireStaffZoomContext,
}));

vi.mock("fs/promises", () => ({
  default: {
    mkdir: mocks.mkdir,
    writeFile: mocks.writeFile,
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mocks.prisma,
}));

vi.mock("../lib/slp/zoom-recording-processor", () => ({
  fetchAllForRecording: mocks.fetchAllForSlpRecording,
}));

vi.mock("../lib/hojo/zoom-recording-processor", () => ({
  fetchAllForRecording: mocks.fetchAllForHojoRecording,
}));

vi.mock("@/lib/automation-error", () => ({
  logAutomationError: mocks.logAutomationError,
}));

import {
  downloadZoomRecordingFiles,
  fetchRecordingMetadata,
  isFinalZoomTranscriptFailure,
  type ZoomRecordingPayload,
} from "../lib/zoom/recording";
import { runZoomRecordingRetryJob } from "../lib/zoom/recording-retry-job";

describe("Zoom recording downloads", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireStaffZoomContext.mockResolvedValue({
      accessToken: "OAUTH_TOKEN",
      integrationId: 1,
      externalUserId: "zoom-user",
    });
    global.fetch = vi.fn();
  });

  it("uses webhook download_token and continues transcript download after MP4 401", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: false,
            errorCode: 300,
            errorMessage: "Forbidden",
          }),
          { status: 401 }
        )
      )
      .mockResolvedValueOnce(
        new Response("WEBVTT\n\n00:00:00.000 --> 00:00:01.000\nhello", {
          status: 200,
        })
      );

    const result = await downloadZoomRecordingFiles({
      hostStaffId: 10,
      contactHistoryId: 20,
      recordingId: 30,
      downloadToken: "WEBHOOK_DOWNLOAD_TOKEN",
      recording: {
        id: 123456789,
        uuid: "uuid-1",
        host_id: "zoom-user",
        topic: "test",
        recording_files: [
          {
            id: "mp4-file",
            file_type: "MP4",
            file_extension: "MP4",
            download_url: "https://zoom.example/recording.mp4",
            status: "completed",
          },
          {
            id: "vtt-file",
            file_type: "TRANSCRIPT",
            file_extension: "VTT",
            download_url: "https://zoom.example/transcript.vtt",
            status: "completed",
          },
        ],
      },
    });

    expect(result.mp4RelPath).toBeNull();
    expect(result.transcriptText).toBe("hello");
    expect(result.errors[0]).toContain("MP4: Zoom録画DL失敗: 401");
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://zoom.example/recording.mp4",
      expect.objectContaining({
        headers: { Authorization: "Bearer WEBHOOK_DOWNLOAD_TOKEN" },
      })
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://zoom.example/transcript.vtt",
      expect.objectContaining({
        headers: { Authorization: "Bearer WEBHOOK_DOWNLOAD_TOKEN" },
      })
    );
  });

  it("selects the fixed-url occurrence closest to contact date and refetches by UUID with download_access_token", async () => {
    const fetchMock = vi.mocked(global.fetch);
    const oldOccurrence = {
      id: 987654321,
      uuid: "old-uuid",
      host_id: "zoom-user",
      topic: "old",
      start_time: "2026-06-08T01:00:00Z",
      recording_files: [],
    };
    const selectedOccurrence: ZoomRecordingPayload = {
      id: 987654321,
      uuid: "selected-uuid",
      host_id: "zoom-user",
      topic: "selected",
      start_time: "2026-06-10T01:03:00Z",
      recording_files: [
        {
          id: "mp4-file",
          file_type: "MP4",
          file_extension: "MP4",
          download_url: "https://zoom.example/selected.mp4",
          status: "completed",
        },
      ],
      download_access_token: "DOWNLOAD_ACCESS_TOKEN",
    };

    fetchMock
      .mockResolvedValueOnce(
        Response.json({
          meetings: [oldOccurrence, selectedOccurrence],
          next_page_token: "",
        })
      )
      .mockResolvedValueOnce(Response.json(selectedOccurrence));

    const result = await fetchRecordingMetadata({
      hostStaffId: 10,
      meetingId: BigInt("987654321"),
      occurrenceStartedAt: new Date("2026-06-10T01:00:00Z"),
    });

    expect(result?.uuid).toBe("selected-uuid");
    expect(result?.download_access_token).toBe("DOWNLOAD_ACCESS_TOKEN");
    const firstUrl = String(fetchMock.mock.calls[0][0]);
    const secondUrl = String(fetchMock.mock.calls[1][0]);
    expect(firstUrl).toContain("/users/me/recordings");
    expect(firstUrl).toContain("from=2026-06-08");
    expect(firstUrl).toContain("to=2026-06-12");
    expect(secondUrl).toContain("/meetings/selected-uuid/recordings");
    expect(secondUrl).toContain("include_fields=download_access_token");
  });

  it("keeps transcript not_ready retryable", async () => {
    const fetchMock = vi.mocked(global.fetch);
    fetchMock.mockResolvedValue(
      Response.json({
        can_download: false,
        download_restriction_reason: "NOT_READY",
      })
    );

    const result = await downloadZoomRecordingFiles({
      hostStaffId: 10,
      contactHistoryId: 20,
      recordingId: 30,
      recording: {
        id: 123456789,
        uuid: "uuid-1",
        host_id: "zoom-user",
        topic: "test",
        recording_files: [],
      },
    });

    expect(result.transcriptText).toBeNull();
    expect(result.transcriptFallbackStatus).toBe("not_ready");
    expect(result.errors.join("\n")).toContain("文字起こしはZoom側で生成中");
    expect(isFinalZoomTranscriptFailure(result.errors.join("\n"))).toBe(false);
  });

  it("skips final transcript failures and retries SLP/HOJO transcript candidates", async () => {
    const now = new Date("2026-06-11T03:00:00Z");
    mocks.prisma.slpZoomRecording.findMany.mockResolvedValue([
      {
        id: 1,
        scheduledAt: new Date("2026-06-11T02:55:00Z"),
        createdAt: new Date("2026-06-11T02:50:00Z"),
        downloadError: null,
      },
      {
        id: 2,
        scheduledAt: new Date("2026-06-10T03:00:00Z"),
        createdAt: new Date("2026-06-10T02:50:00Z"),
        downloadError: "TRANSCRIPT: Zoom側に文字起こしデータがありません",
      },
      {
        id: 3,
        scheduledAt: new Date("2026-06-10T03:00:00Z"),
        createdAt: new Date("2026-06-10T02:50:00Z"),
        downloadError: "TRANSCRIPT: 文字起こしはZoom側で生成中です。",
      },
    ]);
    mocks.prisma.hojoZoomRecording.findMany.mockResolvedValue([
      {
        id: 4,
        scheduledAt: new Date("2026-06-10T03:00:00Z"),
        createdAt: new Date("2026-06-10T02:50:00Z"),
        downloadError: null,
      },
    ]);
    mocks.fetchAllForSlpRecording.mockResolvedValue({
      files: { transcript: true },
    });
    mocks.fetchAllForHojoRecording.mockResolvedValue({
      files: { transcript: false },
    });

    const result = await runZoomRecordingRetryJob(now);

    expect(mocks.fetchAllForSlpRecording).toHaveBeenCalledWith(3);
    expect(mocks.fetchAllForHojoRecording).toHaveBeenCalledWith(4);
    expect(mocks.fetchAllForSlpRecording).not.toHaveBeenCalledWith(1);
    expect(mocks.fetchAllForSlpRecording).not.toHaveBeenCalledWith(2);
    expect(result.slp).toMatchObject({
      scanned: 3,
      processed: 1,
      succeeded: 1,
      skipped: 2,
    });
    expect(result.hojo).toMatchObject({
      scanned: 1,
      processed: 1,
      succeeded: 0,
      skipped: 0,
    });
  });
});
