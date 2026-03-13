import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchCloudSignSigningEmails,
  type ImapConfig,
} from "@/lib/email/imap-client";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron/CloudSign] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    emailAddress: string;
    matched: number;
    errors: string[];
  }> = [];

  try {
    // 署名URL未取得の契約がある場合のみ処理
    const pendingContracts = await prisma.masterContract.findMany({
      where: {
        cloudsignSelfSigningEmailId: { not: null },
        cloudsignSelfSigningUrl: null,
        cloudsignStatus: "sent",
        cloudsignSentAt: {
          // 24時間以内に送信された契約のみ対象
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        cloudsignDocumentId: true,
        cloudsignSelfSigningEmailId: true,
      },
    });

    if (pendingContracts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No pending contracts",
        results: [],
        totalMatched: 0,
      });
    }

    // 対象のメールアカウントを取得
    const emailIds = [...new Set(pendingContracts.map((c) => c.cloudsignSelfSigningEmailId!))];
    const emailAccounts = await prisma.operatingCompanyEmail.findMany({
      where: {
        id: { in: emailIds },
        deletedAt: null,
        imapHost: { not: null },
        imapUser: { not: null },
        imapPass: { not: null },
      },
    });

    // 契約をメールアカウントID別にグループ化（本文内のdocId照合用）
    const contractsByEmail = new Map<number, Array<{ docId: string; contractId: number }>>();
    for (const c of pendingContracts) {
      if (!c.cloudsignDocumentId || !c.cloudsignSelfSigningEmailId) continue;
      if (!contractsByEmail.has(c.cloudsignSelfSigningEmailId)) {
        contractsByEmail.set(c.cloudsignSelfSigningEmailId, []);
      }
      contractsByEmail.get(c.cloudsignSelfSigningEmailId)!.push({
        docId: c.cloudsignDocumentId,
        contractId: c.id,
      });
    }

    for (const emailAccount of emailAccounts) {
      const accountResult = {
        emailAddress: emailAccount.email,
        matched: 0,
        errors: [] as string[],
      };

      try {
        const imapConfig: ImapConfig = {
          host: emailAccount.imapHost!,
          port: emailAccount.imapPort || 993,
          user: emailAccount.imapUser!,
          pass: emailAccount.imapPass!,
          tls: true,
        };

        const emails = await fetchCloudSignSigningEmails(
          imapConfig,
          emailAccount.lastCheckedCloudsignUid
        );

        let maxUid = emailAccount.lastCheckedCloudsignUid;
        const contracts = contractsByEmail.get(emailAccount.id);

        for (const email of emails) {
          if (email.uid > maxUid) maxUid = email.uid;

          if (!contracts) continue;

          // メール本文にドキュメントIDが含まれているかで照合
          for (const { docId, contractId } of contracts) {
            if (email.rawContent.includes(docId)) {
              try {
                await prisma.masterContract.update({
                  where: { id: contractId },
                  data: { cloudsignSelfSigningUrl: email.signingUrl },
                });
                accountResult.matched++;
                console.log(
                  `[Cron/CloudSign] Matched signing URL for contract ${contractId}, docId=${docId}`
                );
              } catch (err) {
                const errMsg = err instanceof Error ? err.message : "Unknown error";
                accountResult.errors.push(`Contract ${contractId}: ${errMsg}`);
              }
            }
          }
        }

        // lastCheckedCloudsignUid を更新
        if (maxUid > emailAccount.lastCheckedCloudsignUid) {
          await prisma.operatingCompanyEmail.update({
            where: { id: emailAccount.id },
            data: { lastCheckedCloudsignUid: maxUid },
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        accountResult.errors.push(`Connection error: ${errMsg}`);
        console.error(
          `[Cron/CloudSign] Failed to process email account ${emailAccount.email}:`,
          err
        );
      }

      results.push(accountResult);
    }

    return NextResponse.json({
      success: true,
      results,
      totalMatched: results.reduce((sum, r) => sum + r.matched, 0),
    });
  } catch (err) {
    console.error("[Cron/CloudSign] check-cloudsign-signing failed:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
