import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractReferenceCode, matchInboundInvoice } from "@/lib/email/inbound-invoice-matcher";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    paymentGroup: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const paymentGroupMock = vi.mocked(prisma.paymentGroup);

describe("extractReferenceCode", () => {
  it("PDFファイル名からPG形式の参照コードを抽出する", () => {
    expect(
      extractReferenceCode("【御請求書】Stella_Talent_Partners株式会社御中_初期費用紹介報酬_PG-0002.pdf")
    ).toBe("PG-0002");
  });

  it("4桁未満や全角表記は抽出しない", () => {
    expect(extractReferenceCode("請求書_PG-29.pdf")).toBeNull();
    expect(extractReferenceCode("請求書_ＰＧ－００２９.pdf")).toBeNull();
  });
});

describe("matchInboundInvoice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("参照コードが完全一致する場合は受信先メールIDが違ってもマッチする", async () => {
    paymentGroupMock.findFirst.mockResolvedValue({
      id: 2,
      referenceCode: "PG-0002",
      counterparty: {
        company: {
          contacts: [{ email: "contact@nexive.jp" }],
        },
      },
    } as never);

    const result = await matchInboundInvoice({
      receivedByEmailId: 99,
      attachmentFileName:
        "【御請求書】Stella_Talent_Partners株式会社御中_初期費用紹介報酬_PG-0002.pdf",
      fromEmail: "contact@nexive.jp",
    });

    expect(paymentGroupMock.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          referenceCode: "PG-0002",
          status: { in: ["requested", "re_requested"] },
          deletedAt: null,
        },
      })
    );
    expect(paymentGroupMock.findMany).not.toHaveBeenCalled();
    expect(result).toEqual({
      paymentGroupId: 2,
      matchConfidence: "high",
      referenceCode: "PG-0002",
      status: "pending",
    });
  });

  it("参照コードがない場合は従来通り受信先メールIDと送信元ドメインで推定する", async () => {
    paymentGroupMock.findMany.mockResolvedValue([
      {
        id: 5,
        counterparty: {
          company: {
            contacts: [{ email: "billing@example.jp" }],
          },
        },
      },
    ] as never);

    const result = await matchInboundInvoice({
      receivedByEmailId: 10,
      attachmentFileName: "請求書.pdf",
      fromEmail: "billing@example.jp",
    });

    expect(paymentGroupMock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          expectedInboundEmailId: 10,
          status: { in: ["requested", "re_requested"] },
          deletedAt: null,
        },
      })
    );
    expect(result).toEqual({
      paymentGroupId: 5,
      matchConfidence: "low",
      referenceCode: null,
      status: "pending",
    });
  });
});
