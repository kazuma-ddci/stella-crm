import nodemailer from "nodemailer";
import fs from "fs/promises";
import path from "path";
import type { EmailResult } from "../email";

// システム共通のSMTPトランスポート（index.tsと同じ設定）
const systemTransporter =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      })
    : null;

/**
 * 法人ごとのSMTP設定、またはシステム共通設定でtransporterを取得
 */
function getTransporter(senderEmail: {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpUser: string | null;
  smtpPass: string | null;
}): nodemailer.Transporter | null {
  // 法人固有のSMTP設定がある場合
  if (senderEmail.smtpHost && senderEmail.smtpUser && senderEmail.smtpPass) {
    return nodemailer.createTransport({
      host: senderEmail.smtpHost,
      port: senderEmail.smtpPort || 587,
      secure: false,
      auth: {
        user: senderEmail.smtpUser,
        pass: senderEmail.smtpPass,
      },
    });
  }

  // システム共通設定を使用
  return systemTransporter;
}

/**
 * 請求書メールを送信
 */
export async function sendInvoiceEmail(params: {
  senderEmail: {
    email: string;
    smtpHost: string | null;
    smtpPort: number | null;
    smtpUser: string | null;
    smtpPass: string | null;
  };
  recipients: {
    email: string;
    name: string | null;
    type: "to" | "cc" | "bcc";
  }[];
  subject: string;
  body: string;
  pdfPath: string | null;
}): Promise<EmailResult> {
  const { senderEmail, recipients, subject, body, pdfPath } = params;

  const transport = getTransporter(senderEmail);

  // TO/CC/BCCを分離
  const toAddresses = recipients
    .filter((r) => r.type === "to")
    .map((r) => (r.name ? `${r.name} <${r.email}>` : r.email));
  const ccAddresses = recipients
    .filter((r) => r.type === "cc")
    .map((r) => (r.name ? `${r.name} <${r.email}>` : r.email));
  const bccAddresses = recipients
    .filter((r) => r.type === "bcc")
    .map((r) => (r.name ? `${r.name} <${r.email}>` : r.email));

  // 添付ファイルの準備
  const attachments: { filename: string; content: Buffer }[] = [];
  if (pdfPath) {
    try {
      const fullPath = path.join(process.cwd(), "public", pdfPath);
      const content = await fs.readFile(fullPath);
      const filename = path.basename(pdfPath);
      attachments.push({ filename, content });
    } catch (error) {
      console.error("Failed to read PDF attachment:", error);
      return {
        success: false,
        error: `添付ファイルの読み取りに失敗しました: ${pdfPath}`,
      };
    }
  }

  // メール送信が無効な場合の開発フォールバック
  if (!transport) {
    console.log("[DEV] Invoice email would be sent:");
    console.log(`[DEV] From: ${senderEmail.email}`);
    console.log(`[DEV] To: ${toAddresses.join(", ")}`);
    if (ccAddresses.length > 0) {
      console.log(`[DEV] CC: ${ccAddresses.join(", ")}`);
    }
    if (bccAddresses.length > 0) {
      console.log(`[DEV] BCC: ${bccAddresses.join(", ")}`);
    }
    console.log(`[DEV] Subject: ${subject}`);
    console.log(`[DEV] Body: ${body}`);
    if (attachments.length > 0) {
      console.log(
        `[DEV] Attachments: ${attachments.map((a) => a.filename).join(", ")}`
      );
    }
    return { success: true };
  }

  try {
    await transport.sendMail({
      from: senderEmail.email,
      to: toAddresses.join(", "),
      ...(ccAddresses.length > 0 && { cc: ccAddresses.join(", ") }),
      ...(bccAddresses.length > 0 && { bcc: bccAddresses.join(", ") }),
      subject,
      text: body,
      html: body.replace(/\n/g, "<br>"),
      attachments,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send invoice email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "メール送信に失敗しました",
    };
  }
}

