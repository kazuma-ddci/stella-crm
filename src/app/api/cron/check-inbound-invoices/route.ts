import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  fetchUnreadWithPdfAttachments,
  markAsRead,
  type ImapConfig,
} from "@/lib/email/imap-client";
import { matchInboundInvoice } from "@/lib/email/inbound-invoice-matcher";
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

        // 未読+PDF添付メールを取得
        const emails = await fetchUnreadWithPdfAttachments(imapConfig, emailAccount.id);

        for (const email of emails) {
          let allAttachmentsOk = true;

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
              allAttachmentsOk = false;
              const errMsg =
                err instanceof Error ? err.message : "Unknown error";
              accountResult.errors.push(
                `Attachment ${attachment.filename}: ${errMsg}`
              );
              console.error(
                `[Cron] Error processing attachment ${attachment.filename} from ${email.messageId}:`,
                err
              );
            }
          }

          // 既読化: 全添付が成功 or 既処理スキップの場合のみ
          if (allAttachmentsOk) {
            try {
              await markAsRead(imapConfig, email.uid);
            } catch (err) {
              console.error(
                `[Cron] Failed to mark message uid=${email.uid} as read:`,
                err
              );
            }
          }
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        accountResult.errors.push(`Connection error: ${errMsg}`);
        console.error(
          `[Cron] Failed to process email account ${emailAccount.email}:`,
          err
        );
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
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
