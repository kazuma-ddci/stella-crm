import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cloudsignClient } from "@/lib/cloudsign";
import { syncContractStatus } from "@/lib/cloudsign-sync";

/**
 * CloudSign APIステータスマッピング
 * status: 0→draft, 10/20→sent, 30→completed, 40→canceled_by_recipient, 50→canceled_by_sender
 */
function mapCloudsignApiStatus(apiStatus: number): string | null {
  switch (apiStatus) {
    case 0:
      return "draft";
    case 10:
    case 20:
      return "sent";
    case 30:
      return "completed";
    case 40:
      return "canceled_by_recipient";
    case 50:
      return "canceled_by_sender";
    default:
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
        }
      } catch (err) {
        console.error(
          `[Cron] Token取得失敗 (projectId=${projectId}):`,
          err
        );
      }
    }

    // clientIdマップも作成
    const clientIdMap = new Map<number, string>();
    for (const projectId of projectIds) {
      const project = await prisma.masterProject.findUnique({
        where: { id: projectId },
        include: {
          operatingCompany: {
            select: { cloudsignClientId: true },
          },
        },
      });
      if (project?.operatingCompany?.cloudsignClientId) {
        clientIdMap.set(projectId, project.operatingCompany.cloudsignClientId);
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
        const mappedStatus = mapCloudsignApiStatus(doc.status);

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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
