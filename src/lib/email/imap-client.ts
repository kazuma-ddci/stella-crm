import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  tls?: boolean;
}

export interface InboundEmail {
  messageId: string;
  uid: number;
  from: { address: string; name?: string };
  subject?: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
    size: number;
    contentType: string;
  }>;
}

const MAX_MESSAGES_PER_BATCH = 50;

export async function fetchUnreadWithPdfAttachments(
  config: ImapConfig,
  emailAccountId?: number
): Promise<InboundEmail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls ?? true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
  });

  const results: InboundEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      // UNSEEN メッセージを検索
      const searchResult = await client.search({ seen: false }, { uid: true });
      const allUids = searchResult || [];
      if (!allUids.length) return results;

      // バッチ上限: メモリ圧迫防止。残りは次回cronで処理される（未読のまま）
      const uids = allUids.slice(0, MAX_MESSAGES_PER_BATCH);

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(
            String(uid),
            { source: true, uid: true },
            { uid: true }
          );
          if (!message || !("source" in message) || !message.source) continue;

          const parsed = await simpleParser(message.source);

          // PDF添付ファイルをフィルタ
          const pdfAttachments = (parsed.attachments || []).filter((att) => {
            const filename = att.filename?.toLowerCase() || "";
            return (
              att.contentType === "application/pdf" || filename.endsWith(".pdf")
            );
          });

          if (pdfAttachments.length === 0) continue;

          const fromAddress =
            parsed.from?.value?.[0]?.address || "unknown@unknown.com";
          const fromName = parsed.from?.value?.[0]?.name;

          results.push({
            messageId: parsed.messageId || `no-mid_acct-${emailAccountId ?? 0}_uid-${uid}`,
            uid,
            from: { address: fromAddress, name: fromName },
            subject: parsed.subject,
            date: parsed.date || new Date(),
            attachments: pdfAttachments.map((att) => ({
              filename: att.filename || "attachment.pdf",
              content: att.content,
              size: att.size,
              contentType: att.contentType,
            })),
          });
        } catch (err) {
          console.error(`[IMAP] Failed to parse message uid=${uid}:`, err);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  return results;
}

export async function markAsRead(
  config: ImapConfig,
  uid: number
): Promise<void> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls ?? true,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      await client.messageFlagsAdd(String(uid), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
