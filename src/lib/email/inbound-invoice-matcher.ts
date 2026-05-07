import { prisma } from "@/lib/prisma";

export interface MatchResult {
  paymentGroupId: number | null;
  matchConfidence: "high" | "medium" | "low" | null;
  referenceCode: string | null;
  status: "pending" | "unmatched";
}

/**
 * ファイル名からPG-XXXX形式の参照コードを抽出
 */
export function extractReferenceCode(filename: string): string | null {
  const match = filename.match(/PG-(\d{4,})/i);
  if (!match) return null;
  return `PG-${match[1]}`;
}

/**
 * 送信元メールアドレスからドメインを抽出
 */
function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

/**
 * 受信請求書のマッチングを実行
 *
 * マッチングアルゴリズム:
 * 1. 参照コード抽出: filename.match(/PG-(\d{4,})/i)
 * 2. マッチング:
 *    (a) 参照コードあり → referenceCodeで完全一致検索
 *      - status IN ('requested', 're_requested')
 *      - deletedAt IS NULL
 *      → 見つかった: 送信元ドメイン == 取引先コンタクトメールドメイン? high : medium
 *      → 見つからない: unmatched
 *    (b) 参照コードなし → 受信メールアドレスと送信元ドメインで候補内検索
 *      - expectedInboundEmailId = receivedByEmailId (必須)
 *      - status IN ('requested', 're_requested')
 *      - deletedAt IS NULL
 *      - fromEmailのドメイン → StellaCompanyContact.email → companyId → Counterparty.companyId → PaymentGroup
 *      → 1件のみ: low
 *      → 複数/0件: unmatched
 */
export async function matchInboundInvoice(params: {
  receivedByEmailId: number;
  attachmentFileName: string;
  fromEmail: string;
}): Promise<MatchResult> {
  const { receivedByEmailId, attachmentFileName, fromEmail } = params;
  const referenceCode = extractReferenceCode(attachmentFileName);
  const fromDomain = extractDomain(fromEmail);

  const paymentGroupInclude = {
    counterparty: {
      include: {
        company: {
          include: {
            contacts: {
              where: { deletedAt: null },
            },
          },
        },
      },
    },
  } as const;

  /** 候補からコンタクトメールドメインのリストを取得するヘルパー */
  function getContactEmails(pg: {
    counterparty?: {
      company?: {
        contacts: Array<{ email: string | null }>;
      } | null;
    } | null;
  }): string[] {
    return (
      pg.counterparty?.company?.contacts
        .map((c: { email: string | null }) => c.email)
        .filter((e): e is string => e !== null) || []
    );
  }

  // 参照コードはPaymentGroupで一意。返信先メールが変わっても完全一致なら優先して照合する。
  if (referenceCode) {
    const matched = await prisma.paymentGroup.findFirst({
      where: {
        referenceCode,
        status: { in: ["requested", "re_requested"] },
        deletedAt: null,
      },
      include: paymentGroupInclude,
    });

    if (!matched) {
      return {
        paymentGroupId: null,
        matchConfidence: null,
        referenceCode,
        status: "unmatched",
      };
    }

    // 送信元ドメインと取引先コンタクトのメールドメインを比較
    const contactEmails = getContactEmails(matched);
    const domainMatch = contactEmails.some(
      (email) => extractDomain(email) === fromDomain
    );

    return {
      paymentGroupId: matched.id,
      matchConfidence: domainMatch ? "high" : "medium",
      referenceCode,
      status: "pending",
    };
  }

  // 参照コードなしの場合だけ、受信先メールアドレスで候補を絞る
  const baseCandidates = await prisma.paymentGroup.findMany({
    where: {
      expectedInboundEmailId: receivedByEmailId,
      status: { in: ["requested", "re_requested"] },
      deletedAt: null,
    },
    include: paymentGroupInclude,
  });

  if (baseCandidates.length === 0) {
    return {
      paymentGroupId: null,
      matchConfidence: null,
      referenceCode,
      status: "unmatched",
    };
  }

  // (b) 参照コードなし → 送信元ドメインで候補内検索
  const domainMatchedCandidates = baseCandidates.filter((pg) => {
    const contactEmails = getContactEmails(pg);
    return contactEmails.some((email) => extractDomain(email) === fromDomain);
  });

  if (domainMatchedCandidates.length === 1) {
    return {
      paymentGroupId: domainMatchedCandidates[0].id,
      matchConfidence: "low",
      referenceCode: null,
      status: "pending",
    };
  }

  // 複数 or 0件 → unmatched
  return {
    paymentGroupId: null,
    matchConfidence: null,
    referenceCode: null,
    status: "unmatched",
  };
}
