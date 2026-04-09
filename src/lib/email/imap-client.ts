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
  /** メール本文の全文（ドキュメントID照合用） */
  rawContent: string;
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
 *
 * @param sinceUid - この UID より新しいメールのみ取得（cron用の増分チェック）
 * @param targetDocumentId - 特定のドキュメントIDを探す場合（アクティブ検索モード）。
 *   指定時は sinceUid を無視し、直近7日分のCloudSignメールから検索する。
 */
export async function fetchCloudSignSigningEmails(
  config: ImapConfig,
  sinceUid: number,
  targetDocumentId?: string
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
      let uids: number[];

      if (targetDocumentId) {
        // アクティブ検索モード: CloudSignからの直近メールを検索
        const sinceDate = new Date();
        sinceDate.setDate(sinceDate.getDate() - 7);
        const searchResult = await client.search(
          {
            from: "cloudsign.jp",
            since: sinceDate,
          },
          { uid: true }
        );
        // 新しい順にソート（最新のメールを優先）
        uids = (searchResult || []).sort((a: number, b: number) => b - a).slice(0, MAX_MESSAGES_PER_BATCH);
      } else {
        // 増分チェックモード（cron用）: sinceUid以降を古い順に処理
        const searchUid = sinceUid + 1;
        const searchResult = await client.search(
          { uid: `${searchUid}:*` },
          { uid: true }
        );
        const allUids = (searchResult || []).filter((uid: number) => uid > sinceUid);
        if (!allUids.length) return results;
        uids = allUids.slice(0, MAX_MESSAGES_PER_BATCH);
      }

      if (!uids.length) return results;

      for (const uid of uids) {
        try {
          const message = await client.fetchOne(
            String(uid),
            { source: true, uid: true },
            { uid: true }
          );
          if (!message || !("source" in message) || !message.source) continue;

          const parsed = await simpleParser(message.source);

          // CloudSignからのメールのみ処理（アクティブ検索では既にフィルタ済みだが念のため）
          const fromAddress = parsed.from?.value?.[0]?.address || "";
          if (!fromAddress.toLowerCase().includes("cloudsign.jp")) continue;

          // HTML本文から署名用URLを抽出
          const html = parsed.html || "";
          const text = parsed.text || "";
          const content = html || text;

          const signingUrl = extractCloudSignSigningUrl(content);
          if (!signingUrl) continue;

          results.push({
            messageId: parsed.messageId || `no-mid_uid-${uid}`,
            uid,
            subject: parsed.subject,
            date: parsed.date || new Date(),
            signingUrl,
            rawContent: content,
          });

          // アクティブ検索: メール本文にドキュメントIDが含まれていたら即座に返す
          if (targetDocumentId && content.includes(targetDocumentId)) {
            return results;
          }
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
 * CloudSignメールのHTML/テキストから署名用URLを抽出。
 * 署名/受信者用のパスを含むURLを優先し、管理画面URLは除外する。
 */
function extractCloudSignSigningUrl(content: string): string | null {
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

  // 署名/受信者用URLを優先（recipient, sign, confirm パス）
  for (const url of urls) {
    if (
      url.includes("/recipient/") ||
      url.includes("/sign") ||
      url.includes("/confirm")
    ) {
      return decodeHtmlEntities(url);
    }
  }

  // 上記パターンがなければ、管理系URL以外の最初のCloudSign URLを返す
  for (const url of urls) {
    if (url.includes("/login") || url.includes("/terms") || url.includes("/privacy")) continue;
    // トップページや静的ページのような短いURLも除外
    const path = new URL(url).pathname;
    if (path.length > 10) {
      return decodeHtmlEntities(url);
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

/**
 * CloudSignからのメール送付失敗（返送）通知メール
 * 件名例: 'kihara@example.com宛のメールが返送されました'
 */
export interface CloudSignBounceEmail {
  messageId: string;
  uid: number;
  /** 送信先メールアドレス（件名から抽出） */
  bouncedEmail: string;
  subject: string;
  date: Date;
}

/**
 * CloudSignからのメール送付失敗通知を取得する。
 * 送信元: support@cloudsign.jp
 * 件名パターン: '<email>宛のメールが返送されました'
 */
export async function fetchCloudSignBounceEmails(
  config: ImapConfig,
  sinceUid: number
): Promise<CloudSignBounceEmail[]> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.tls ?? true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });

  const results: CloudSignBounceEmail[] = [];

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // sinceUid+1 以降を取得
      const searchUid = sinceUid + 1;
      const searchResult = await client.search(
        { uid: `${searchUid}:*`, from: "support@cloudsign.jp" },
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
          const fromAddress = parsed.from?.value?.[0]?.address || "";
          if (fromAddress.toLowerCase() !== "support@cloudsign.jp") continue;

          const subject = parsed.subject || "";
          // 件名: 'XXX@YYY.ZZZ宛のメールが返送されました'
          const match = subject.match(/^(\S+@\S+\.\S+)宛のメールが返送されました/);
          if (!match) continue;

          const bouncedEmail = match[1];
          results.push({
            messageId: parsed.messageId || `bounce_uid-${uid}`,
            uid,
            bouncedEmail,
            subject,
            date: parsed.date || new Date(),
          });
        } catch (err) {
          console.error(`[IMAP/CloudSignBounce] Failed to parse uid=${uid}:`, err);
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
