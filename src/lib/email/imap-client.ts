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
  body?: string;
  date: Date;
  attachments: Array<{
    filename: string;
    content: Buffer;
    size: number;
    contentType: string;
  }>;
}

export interface CloudSignEmail {
  messageId: string;
  uid: number;
  subject?: string;
  date: Date;
  /** メール本文から抽出した署名用URL */
  signingUrl: string;
  /** URLから抽出したCloudSignドキュメントID */
  cloudsignDocumentId: string;
}

const MAX_MESSAGES_PER_BATCH = 50;

/**
 * sinceUid より大きいUIDのメールからPDF添付付きのものを取得する。
 * IMAPの既読/未読フラグには依存せず、UIDベースでシステムが未チェックのメールのみ取得。
 */
export async function fetchNewWithPdfAttachments(
  config: ImapConfig,
  sinceUid: number,
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
      // sinceUid+1 以降のメッセージを検索（UIDベース）
      const searchUid = sinceUid + 1;
      const searchResult = await client.search(
        { uid: `${searchUid}:*` },
        { uid: true }
      );
      // IMAPの UID range検索では sinceUid 自体が含まれる場合があるのでフィルタ
      const allUids = (searchResult || []).filter((uid: number) => uid > sinceUid);
      if (!allUids.length) return results;

      // バッチ上限: メモリ圧迫防止。残りは次回cronで処理される
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

          // メール本文を取得（テキスト優先、なければHTMLからタグ除去）
          const emailBody = parsed.text
            || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() : undefined);

          results.push({
            messageId: parsed.messageId || `no-mid_acct-${emailAccountId ?? 0}_uid-${uid}`,
            uid,
            from: { address: fromAddress, name: fromName },
            subject: parsed.subject,
            body: emailBody ? emailBody.substring(0, 10000) : undefined,
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

/**
 * CloudSignからの署名依頼メールを取得し、署名用URLを抽出する。
 * from が cloudsign.jp ドメインのメールのみ対象。
 */
export async function fetchCloudSignSigningEmails(
  config: ImapConfig,
  sinceUid: number
): Promise<CloudSignEmail[]> {
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

  const results: CloudSignEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const searchUid = sinceUid + 1;
      const searchResult = await client.search(
        { uid: `${searchUid}:*` },
        { uid: true }
      );
      const allUids = (searchResult || []).filter((uid: number) => uid > sinceUid);
      if (!allUids.length) return results;

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

          // CloudSignからのメールのみ処理
          const fromAddress = parsed.from?.value?.[0]?.address || "";
          if (!fromAddress.toLowerCase().includes("cloudsign.jp")) continue;

          // HTML本文から署名用URLを抽出
          const html = parsed.html || "";
          const text = parsed.text || "";
          const content = html || text;

          const signingInfo = extractCloudSignSigningUrl(content);
          if (!signingInfo) continue;

          results.push({
            messageId: parsed.messageId || `no-mid_uid-${uid}`,
            uid,
            subject: parsed.subject,
            date: parsed.date || new Date(),
            signingUrl: signingInfo.url,
            cloudsignDocumentId: signingInfo.documentId,
          });
        } catch (err) {
          console.error(`[IMAP/CloudSign] Failed to parse message uid=${uid}:`, err);
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

/**
 * CloudSignメールのHTML/テキストから署名用URLとドキュメントIDを抽出。
 * CloudSignの署名リンクは https://www.cloudsign.jp/... の形式で、
 * ドキュメントIDはUUID形式でURL内に含まれる。
 */
function extractCloudSignSigningUrl(
  content: string
): { url: string; documentId: string } | null {
  // HTMLリンクからCloudSign URLを抽出（href="..." 内のURL）
  const hrefRegex = /href=["']?(https?:\/\/[^"'\s]*cloudsign\.jp[^"'\s]*)["']?/gi;
  const plainUrlRegex = /(https?:\/\/[^\s<>"]*cloudsign\.jp[^\s<>"]*)/gi;

  const urls: string[] = [];

  // HTMLリンクから抽出
  let match;
  while ((match = hrefRegex.exec(content)) !== null) {
    urls.push(match[1]);
  }

  // プレーンテキストURLからも抽出
  while ((match = plainUrlRegex.exec(content)) !== null) {
    if (!urls.includes(match[1])) {
      urls.push(match[1]);
    }
  }

  // CloudSign ドキュメントID（UUID形式）を含むURLを優先
  // 署名URLの典型的パターン:
  //   https://www.cloudsign.jp/recipient/documents/{uuid}
  //   https://www.cloudsign.jp/documents/{uuid}/...
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

  for (const url of urls) {
    // 管理画面URL（/documents/{id} のみ）ではなく、署名/受信者用のURLを優先
    // recipient, sign, confirm 等のパスを含むURLを優先
    if (
      url.includes("/recipient/") ||
      url.includes("/sign") ||
      url.includes("/confirm")
    ) {
      const uuidMatch = url.match(uuidPattern);
      if (uuidMatch) {
        return { url: decodeHtmlEntities(url), documentId: uuidMatch[0] };
      }
    }
  }

  // 優先パターンがなければ、UUIDを含む最初のURLを使用
  for (const url of urls) {
    const uuidMatch = url.match(uuidPattern);
    if (uuidMatch) {
      // ログイン画面や利用規約のURLを除外
      if (url.includes("/login") || url.includes("/terms") || url.includes("/privacy")) continue;
      return { url: decodeHtmlEntities(url), documentId: uuidMatch[0] };
    }
  }

  return null;
}

/** HTML エンティティをデコード */
function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
