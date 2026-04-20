import fs from "fs/promises";
import path from "path";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * 補助金関連の資料PDFをディスクに書き出し、HojoApplicationSupportDocument を upsert する。
 * 旧ファイルがある場合は upsert 後に削除（レース条件回避）。
 * `extraCreate` / `extraUpdate` で AI 系カラム（generatedSections 等）を併せて保存できる。
 */
export async function writeHojoDocumentPdf(params: {
  applicationSupportId: number;
  docType: string;
  fileNamePrefix: string;
  buffer: Uint8Array | Buffer;
  extraCreate?: Omit<
    Prisma.HojoApplicationSupportDocumentUncheckedCreateInput,
    "applicationSupportId" | "docType" | "filePath" | "fileName"
  >;
  extraUpdate?: Prisma.HojoApplicationSupportDocumentUncheckedUpdateInput;
}): Promise<{ filePath: string; fileName: string }> {
  const { applicationSupportId, docType, fileNamePrefix, buffer, extraCreate, extraUpdate } = params;

  const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 17);
  const dirRel = `/uploads/hojo/documents/${applicationSupportId}`;
  const dirAbs = path.join(process.cwd(), "public", dirRel);
  await fs.mkdir(dirAbs, { recursive: true });
  const fileName = `${fileNamePrefix}_${timestamp}.pdf`;
  const fileAbs = path.join(dirAbs, fileName);
  await fs.writeFile(fileAbs, buffer);
  const filePath = `${dirRel}/${fileName}`;

  const existing = await prisma.hojoApplicationSupportDocument.findUnique({
    where: { applicationSupportId_docType: { applicationSupportId, docType } },
  });

  await prisma.hojoApplicationSupportDocument.upsert({
    where: { applicationSupportId_docType: { applicationSupportId, docType } },
    create: {
      applicationSupportId,
      docType,
      filePath,
      fileName,
      ...(extraCreate ?? {}),
    },
    update: {
      filePath,
      fileName,
      generatedAt: new Date(),
      ...(extraUpdate ?? {}),
    },
  });

  // 旧ファイルを非同期削除（失敗は無視）
  if (existing && existing.filePath !== filePath) {
    const oldAbs = path.join(process.cwd(), "public", existing.filePath);
    await fs.unlink(oldAbs).catch(() => {
      /* noop */
    });
  }

  return { filePath, fileName };
}
