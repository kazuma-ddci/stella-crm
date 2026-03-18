import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { syncContractStatus } from "@/lib/cloudsign-sync";
import { logAutomationError } from "@/lib/automation-error";

/**
 * CloudSign APIステータスマッピング
 * CloudSign API v0.33.2 公式ステータス:
 *   0=下書き, 1=先方確認中, 2=締結完了, 3=取消/却下, 4=テンプレート, 13=インポート書類
 */
function mapCloudsignApiStatus(
  apiStatus: number,
  doc?: { participants?: { status?: number; order?: number }[] }
): string | null {
  switch (apiStatus) {
    case 0:
      return "draft";
    case 1:
      return "sent";
    case 2:
      return "completed";
    case 3: {
      // participant status 9=却下(受信者), 10=取消(送信者)
      if (doc?.participants) {
        const hasRejected = doc.participants.some(
          (p) => p.order !== undefined && p.order >= 1 && p.status === 9
        );
        if (hasRejected) {
          return "canceled_by_recipient";
        }
      }
      return "canceled_by_sender";
    }
    case 4:
    case 13:
      return null;
    default:
      console.warn(`[CloudSign Cron] 未知のAPIステータス: ${apiStatus}`);
      return null;
  }
}

type SyncResult = {
  contractId: number;
  previousStatus: string | null;
  newStatus: string | null;
  error?: string;
};

export async function GET(request: Request) {
  // CRON_SECRET認証
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured");
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 対象: cloudsignAutoSync=true, status IN (sent, draft), cloudsignDocumentId IS NOT NULL
    const contracts = await prisma.masterContract.findMany({
      where: {
        cloudsignAutoSync: true,
        cloudsignStatus: { in: ["sent", "draft"] },
        cloudsignDocumentId: { not: null },
      },
      select: {
        id: true,
        currentStatusId: true,
        cloudsignStatus: true,
        cloudsignTitle: true,
        cloudsignDocumentId: true,
        projectId: true,
      },
    });

    if (contracts.length === 0) {
      return NextResponse.json({
        success: true,
        results: [],
        totalSynced: 0,
      });
    }

    // 運営法人ごとにグループ化してトークン取得を効率化
    const projectIds = [...new Set(contracts.map((c) => c.projectId).filter(Boolean))] as number[];
    const tokenMap = new Map<number, string>(); // projectId → token
    const clientIdMap = new Map<number, string>(); // projectId → clientId

    for (const projectId of projectIds) {
      try {
        const project = await prisma.masterProject.findUnique({
          where: { id: projectId },
          include: {
            operatingCompany: {
              select: { cloudsignClientId: true },
            },
          },
        });
        const clientId = project?.operatingCompany?.cloudsignClientId;
        if (clientId) {
          const token = await cloudsignClient.getToken(clientId);
          tokenMap.set(projectId, token);
          clientIdMap.set(projectId, clientId);
        }
      } catch (err) {
        console.error(
          `[Cron] Token取得失敗 (projectId=${projectId}):`,
          err
        );
        await logAutomationError({
          source: "cron/sync-cloudsign-status",
          message: `CloudSign Token取得失敗 (projectId=${projectId})`,
          detail: { projectId, error: String(err) },
        });
      }
    }

    const results: SyncResult[] = [];
    let totalSynced = 0;

    for (const contract of contracts) {
      const token = contract.projectId
        ? tokenMap.get(contract.projectId)
        : undefined;

      if (!token || !contract.cloudsignDocumentId) {
        results.push({
          contractId: contract.id,
          previousStatus: contract.cloudsignStatus,
          newStatus: null,
          error: "トークン未取得またはdocumentID未設定",
        });
        continue;
      }

      try {
        const doc = await cloudsignClient.getDocument(
          token,
          contract.cloudsignDocumentId
        );
        const mappedStatus = mapCloudsignApiStatus(doc.status, doc);

        if (!mappedStatus) {
          results.push({
            contractId: contract.id,
            previousStatus: contract.cloudsignStatus,
            newStatus: null,
            error: `未知のAPIステータス: ${doc.status}`,
          });
          continue;
        }

        if (mappedStatus === contract.cloudsignStatus) {
          // 変更なし — スキップ
          continue;
        }

        const clientId = contract.projectId
          ? clientIdMap.get(contract.projectId) || null
          : null;

        await syncContractStatus(
          {
            id: contract.id,
            currentStatusId: contract.currentStatusId,
            cloudsignStatus: contract.cloudsignStatus,
            cloudsignTitle: contract.cloudsignTitle,
            cloudsignDocumentId: contract.cloudsignDocumentId,
          },
          clientId,
          mappedStatus,
          "CloudSign Cron同期"
        );

        results.push({
          contractId: contract.id,
          previousStatus: contract.cloudsignStatus,
          newStatus: mappedStatus,
        });
        totalSynced++;
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error";

        // CloudSign側で削除済み（404）の下書きはCRM側も削除
        if (
          contract.cloudsignStatus === "draft" &&
          errorMsg.includes("404")
        ) {
          try {
            await prisma.masterContractStatusHistory.deleteMany({
              where: { contractId: contract.id },
            });
            await prisma.masterContract.delete({
              where: { id: contract.id },
            });
            console.log(
              `[Cron] CloudSign側で削除済みの下書きをCRMから削除 (contract #${contract.id})`
            );
            results.push({
              contractId: contract.id,
              previousStatus: contract.cloudsignStatus,
              newStatus: "deleted",
            });
            totalSynced++;
            continue;
          } catch (deleteErr) {
            console.error(
              `[Cron] 下書き削除失敗 (contract #${contract.id}):`,
              deleteErr
            );
          }
        }

        console.error(
          `[Cron] 同期失敗 (contract #${contract.id}):`,
          err
        );
        await logAutomationError({
          source: "cron/sync-cloudsign-status",
          message: `契約書同期失敗 (contract #${contract.id})`,
          detail: { contractId: contract.id, documentId: contract.cloudsignDocumentId, error: errorMsg },
        });
        results.push({
          contractId: contract.id,
          previousStatus: contract.cloudsignStatus,
          newStatus: null,
          error: errorMsg,
        });
      }
    }

    console.log(
      `[Cron] CloudSign sync: ${totalSynced} updated / ${contracts.length} checked`
    );

    return NextResponse.json({
      success: true,
      results,
      totalSynced,
    });
  } catch (err) {
    console.error("[Cron] sync-cloudsign-status failed:", err);
    await logAutomationError({
      source: "cron/sync-cloudsign-status",
      message: err instanceof Error ? err.message : "不明なエラー",
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
