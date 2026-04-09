import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchCloudSignBounceEmails,
  type ImapConfig,
} from "@/lib/email/imap-client";
import { logAutomationError } from "@/lib/automation-error";

/**
 * CloudSign送付失敗（メール返送）通知メールを定期チェックするCron。
 *
 * 動作:
 *   1. enableInbound=true の OperatingCompanyEmail を取得
 *   2. 各メールアドレスから「support@cloudsign.jp」発の返送通知メールを取得
 *   3. 件名から失敗したメールアドレスを抽出
 *   4. そのメールアドレスを持つ SlpMember に cloudsignBounced=true をセット
 *   5. automation_errors に記録
 *
 * 推奨実行頻度: 5分に1度
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron/CloudSignBounces] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    emailAddress: string;
    found: number;
    matched: number;
    errors: string[];
  }> = [];

  try {
    // enableInbound=true のメールアカウントを取得
    const emailAccounts = await prisma.operatingCompanyEmail.findMany({
      where: {
        enableInbound: true,
        deletedAt: null,
        imapHost: { not: null },
        imapUser: { not: null },
        imapPass: { not: null },
      },
    });

    if (emailAccounts.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No email accounts configured",
        results: [],
      });
    }

    for (const account of emailAccounts) {
      const accountResult = {
        emailAddress: account.email,
        found: 0,
        matched: 0,
        errors: [] as string[],
      };

      try {
        const imapConfig: ImapConfig = {
          host: account.imapHost!,
          port: account.imapPort ?? 993,
          user: account.imapUser!,
          pass: account.imapPass!,
          tls: true,
        };

        const bounces = await fetchCloudSignBounceEmails(
          imapConfig,
          account.lastCheckedCloudsignBounceUid
        );
        accountResult.found = bounces.length;

        let maxUid = account.lastCheckedCloudsignBounceUid;

        for (const bounce of bounces) {
          if (bounce.uid > maxUid) maxUid = bounce.uid;

          // 該当する SlpMember を検索（メールアドレス一致）
          const member = await prisma.slpMember.findFirst({
            where: {
              email: bounce.bouncedEmail,
              deletedAt: null,
            },
          });

          if (member) {
            await prisma.slpMember.update({
              where: { id: member.id },
              data: {
                cloudsignBounced: true,
                cloudsignBouncedAt: bounce.date,
                cloudsignBouncedEmail: bounce.bouncedEmail,
              },
            });
            accountResult.matched++;

            // 自動化エラーログにも記録
            await logAutomationError({
              source: "cloudsign-bounce",
              message: `CloudSignメール送信失敗: ${member.name} (${bounce.bouncedEmail})`,
              detail: {
                memberId: member.id,
                memberName: member.name,
                bouncedEmail: bounce.bouncedEmail,
                bouncedAt: bounce.date.toISOString(),
                subject: bounce.subject,
                retryAction: "slp-resend-cloudsign",
              },
            });
          } else {
            // 該当組合員が見つからない場合もログに残す
            await logAutomationError({
              source: "cloudsign-bounce",
              message: `CloudSignメール送信失敗（該当組合員なし）: ${bounce.bouncedEmail}`,
              detail: {
                bouncedEmail: bounce.bouncedEmail,
                bouncedAt: bounce.date.toISOString(),
                subject: bounce.subject,
              },
            });
          }
        }

        // 最終チェックUIDを更新
        if (maxUid > account.lastCheckedCloudsignBounceUid) {
          await prisma.operatingCompanyEmail.update({
            where: { id: account.id },
            data: { lastCheckedCloudsignBounceUid: maxUid },
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        accountResult.errors.push(errMsg);
        await logAutomationError({
          source: "cron/check-cloudsign-bounces",
          message: `CloudSign返送メールチェック失敗: ${account.email}`,
          detail: {
            emailAccountId: account.id,
            email: account.email,
            error: errMsg,
          },
        });
      }

      results.push(accountResult);
    }

    return NextResponse.json({
      success: true,
      results,
      totalMatched: results.reduce((sum, r) => sum + r.matched, 0),
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error("[Cron/CloudSignBounces] Failed:", err);
    await logAutomationError({
      source: "cron/check-cloudsign-bounces",
      message: "CloudSign返送メールチェックCron全体失敗",
      detail: { error: errMsg },
    });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
