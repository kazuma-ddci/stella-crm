import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * ユニークなウォーターマークコードを生成（XXXX-XXXX形式）
 * 衝突時はリトライして一意性を保証
 */
export async function generateWatermarkCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const bytes = crypto.randomBytes(4);
    const hex = bytes.toString("hex").toUpperCase();
    const code = `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;

    const existing = await prisma.slpMember.findUnique({
      where: { watermarkCode: code },
      select: { id: true },
    });

    if (!existing) {
      return code;
    }
  }

  throw new Error("ウォーターマークコードの生成に失敗しました（衝突回避リトライ上限）");
}
