import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchNewWithPdfAttachments,
  type ImapConfig,
} from "@/lib/email/imap-client";
import { matchInboundInvoice } from "@/lib/email/inbound-invoice-matcher";
import { logAutomationError } from "@/lib/automation-error";
import fs from "fs/promises";
import path from "path";

export async function GET(request: Request) {
  // CRON_SECRET認証
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[Cron] CRON_SECRET is not configured");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: Array<{
    emailAddress: string;
    processed: number;
    errors: string[];
  }> = [];

  try {
    // enableInbound=true の OperatingCompanyEmail を取得
    const inboundEmails = await prisma.operatingCompanyEmail.findMany({
      where: {
        enableInbound: true,
        deletedAt: null,
        imapHost: { not: null },
        imapUser: { not: null },
        imapPass: { not: null },
      },
    });

    for (const emailAccount of inboundEmails) {
      const accountResult = {
        emailAddress: emailAccount.email,
        processed: 0,
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

        // lastCheckedImapUid より新しいメールのみ取得（システム未チェック分）
        const emails = await fetchNewWithPdfAttachments(
          imapConfig,
          emailAccount.lastCheckedImapUid,
          emailAccount.id
        );

        let maxUid = emailAccount.lastCheckedImapUid;

        for (const email of emails) {
          // 処理したメールの最大UIDを追跡
          if (email.uid > maxUid) maxUid = email.uid;

          for (let i = 0; i < email.attachments.length; i++) {
            const attachment = email.attachments[i];

            try {
              // (messageId, attachmentIndex) で重複チェック
              const existing = await prisma.inboundInvoice.findUnique({
                where: {
                  messageId_attachmentIndex: {
                    messageId: email.messageId,
                    attachmentIndex: i,
                  },
                },
              });

              if (existing) continue; // 既処理スキップはOK扱い

              // public/uploads/inbound-invoices/YYYY/MM/ にPDF仮保存
              const now = new Date();
              const year = now.getFullYear().toString();
              const month = (now.getMonth() + 1).toString().padStart(2, "0");
              const uploadDir = path.join(
                process.cwd(),
                "public",
                "uploads",
                "inbound-invoices",
                year,
                month
              );
              await fs.mkdir(uploadDir, { recursive: true });

              // ファイル名のサニタイズ: 安全な文字のみ残す
              const safeFilename = attachment.filename
                .replace(/[^a-zA-Z0-9._\-\u3000-\u9fff]/g, "_")
                .substring(0, 200);
              const uniqueFilename = `${Date.now()}_${i}_${safeFilename}`;
              const filePath = path.join(uploadDir, uniqueFilename);

              await fs.writeFile(filePath, attachment.content);

              // マッチング実行
              const matchResult = await matchInboundInvoice({
                receivedByEmailId: emailAccount.id,
                attachmentFileName: attachment.filename,
                fromEmail: email.from.address,
              });

              // InboundInvoice レコード作成
              await prisma.inboundInvoice.create({
                data: {
                  messageId: email.messageId,
                  attachmentIndex: i,
                  receivedByEmailId: emailAccount.id,
                  fromEmail: email.from.address,
                  fromName: email.from.name,
                  subject: email.subject,
                  emailBody: email.body ?? null,
                  receivedAt: email.date,
                  paymentGroupId: matchResult.paymentGroupId,
                  matchConfidence: matchResult.matchConfidence,
                  referenceCode: matchResult.referenceCode,
                  attachmentFileName: attachment.filename,
                  attachmentPath: `/uploads/inbound-invoices/${year}/${month}/${uniqueFilename}`,
                  attachmentSize: attachment.size,
                  attachmentMimeType: attachment.contentType,
                  status: matchResult.status,
                },
              });

              accountResult.processed++;
            } catch (err) {
              const errMsg =
                err instanceof Error ? err.message : "Unknown error";
              accountResult.errors.push(
                `Attachment ${attachment.filename}: ${errMsg}`
              );
              console.error(
                `[Cron] Error processing attachment ${attachment.filename} from ${email.messageId}:`,
                err
              );
              await logAutomationError({
                source: "cron/check-inbound-invoices",
                message: `添付ファイル処理失敗: ${attachment.filename}`,
                detail: { messageId: email.messageId, filename: attachment.filename, error: errMsg },
              });
            }
          }
        }

        // lastCheckedImapUid を更新（次回はこのUID以降だけチェック）
        if (maxUid > emailAccount.lastCheckedImapUid) {
          await prisma.operatingCompanyEmail.update({
            where: { id: emailAccount.id },
            data: { lastCheckedImapUid: maxUid },
          });
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        accountResult.errors.push(`Connection error: ${errMsg}`);
        console.error(
          `[Cron] Failed to process email account ${emailAccount.email}:`,
          err
        );
        await logAutomationError({
          source: "cron/check-inbound-invoices",
          message: `メールアカウント接続失敗: ${emailAccount.email}`,
          detail: { emailAddress: emailAccount.email, error: errMsg },
        });
      }

      results.push(accountResult);
    }

    return NextResponse.json({
      success: true,
      results,
      totalProcessed: results.reduce((sum, r) => sum + r.processed, 0),
    });
  } catch (err) {
    console.error("[Cron] check-inbound-invoices failed:", err);
    await logAutomationError({
      source: "cron/check-inbound-invoices",
      message: err instanceof Error ? err.message : "不明なエラー",
      detail: { error: String(err) },
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
