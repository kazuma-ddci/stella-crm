import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  ALLOWED_DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_FILE_SIZE,
  validateCategoryAndType,
  FISCAL_PERIODS,
} from "@/lib/slp/document-types";
import { saveCompanyDocumentFile } from "@/lib/slp/document-storage";

/**
 * SLP公的提出書類アップロードAPI（公開）
 *
 * FormData:
 *   - uid: 提出者の SlpLineFriend.uid
 *   - companyRecordId: 提出先 SlpCompanyRecord.id
 *   - category: "initial" | "additional"
 *   - documentType: 各 categoryに対応する書類タイプ
 *   - fiscalPeriod: 0..4 (initial時のみ)
 *   - file: File
 *
 * 上書き時の挙動:
 *   - initial: 同 (companyRecordId, documentType, fiscalPeriod) で isCurrent=true のレコードは
 *              isCurrent=false にする（履歴として残す）。新規レコードを isCurrent=true で作成。
 *   - additional: 既存レコードはそのまま、新規追加のみ。
 *
 * 提出者検証:
 *   - SlpLineFriend が存在し、その LineFriend が SlpCompanyContact 経由で
 *     対象 companyRecordId の担当者になっていることを確認する
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const uid = (formData.get("uid") as string | null)?.trim();
    const companyRecordIdRaw = formData.get("companyRecordId") as string | null;
    const category = (formData.get("category") as string | null)?.trim();
    const documentType = (formData.get("documentType") as string | null)?.trim();
    const fiscalPeriodRaw = formData.get("fiscalPeriod") as string | null;
    const file = formData.get("file") as File | null;

    // 必須項目チェック
    if (!uid) {
      return NextResponse.json({ error: "uidが指定されていません" }, { status: 400 });
    }
    if (!companyRecordIdRaw) {
      return NextResponse.json(
        { error: "companyRecordIdが指定されていません" },
        { status: 400 },
      );
    }
    const companyRecordId = Number(companyRecordIdRaw);
    if (!Number.isFinite(companyRecordId)) {
      return NextResponse.json({ error: "companyRecordIdが不正です" }, { status: 400 });
    }
    if (!category || !documentType) {
      return NextResponse.json(
        { error: "category/documentTypeが指定されていません" },
        { status: 400 },
      );
    }
    if (!validateCategoryAndType(category, documentType)) {
      return NextResponse.json(
        { error: "category/documentTypeが不正です" },
        { status: 400 },
      );
    }

    // initial の場合は fiscalPeriod 必須
    let fiscalPeriod: number | null = null;
    if (category === "initial") {
      if (fiscalPeriodRaw == null) {
        return NextResponse.json(
          { error: "fiscalPeriodが指定されていません" },
          { status: 400 },
        );
      }
      const n = Number(fiscalPeriodRaw);
      if (!FISCAL_PERIODS.some((p) => p.value === n)) {
        return NextResponse.json(
          { error: "fiscalPeriodが不正です" },
          { status: 400 },
        );
      }
      fiscalPeriod = n;
    }

    // ファイルチェック
    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 },
      );
    }
    if (file.size <= 0) {
      return NextResponse.json(
        { error: "空のファイルはアップロードできません" },
        { status: 400 },
      );
    }
    if (file.size > MAX_DOCUMENT_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `ファイルサイズは${Math.floor(MAX_DOCUMENT_FILE_SIZE / 1024 / 1024)}MB以下にしてください`,
        },
        { status: 400 },
      );
    }
    if (!ALLOWED_DOCUMENT_MIME_TYPES.includes(file.type as (typeof ALLOWED_DOCUMENT_MIME_TYPES)[number])) {
      return NextResponse.json(
        {
          error: "許可されていないファイル形式です（PDF, Word, Excel, 画像のみ）",
        },
        { status: 400 },
      );
    }

    // LINE友達検証 + 企業所属検証
    const lineFriend = await prisma.slpLineFriend.findUnique({
      where: { uid },
      select: { id: true, snsname: true, sei: true, mei: true, deletedAt: true },
    });
    if (!lineFriend || lineFriend.deletedAt) {
      return NextResponse.json(
        { error: "提出者情報が見つかりません" },
        { status: 403 },
      );
    }

    const contact = await prisma.slpCompanyContact.findFirst({
      where: {
        lineFriendId: lineFriend.id,
        companyRecordId,
        companyRecord: { deletedAt: null },
      },
    });
    if (!contact) {
      return NextResponse.json(
        { error: "この企業へ書類を提出する権限がありません" },
        { status: 403 },
      );
    }

    // ファイル保存
    const buffer = Buffer.from(await file.arrayBuffer());
    const { publicPath } = await saveCompanyDocumentFile(
      companyRecordId,
      file.name,
      buffer,
    );

    const uploaderName =
      lineFriend.snsname ??
      [lineFriend.sei, lineFriend.mei].filter(Boolean).join(" ").trim() ??
      null;

    // initial の場合は同スロットの古い current を非current化
    const document = await prisma.$transaction(async (tx) => {
      if (category === "initial") {
        await tx.slpCompanyDocument.updateMany({
          where: {
            companyRecordId,
            category: "initial",
            documentType,
            fiscalPeriod,
            isCurrent: true,
            deletedAt: null,
          },
          data: { isCurrent: false },
        });
      }
      return tx.slpCompanyDocument.create({
        data: {
          companyRecordId,
          category,
          documentType,
          fiscalPeriod,
          fileName: file.name,
          filePath: publicPath,
          fileSize: file.size,
          mimeType: file.type,
          uploadedByUid: uid,
          uploadedByName: uploaderName,
          isCurrent: true,
        },
      });
    });

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        category: document.category,
        documentType: document.documentType,
        fiscalPeriod: document.fiscalPeriod,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        isCurrent: document.isCurrent,
        uploadedByName: document.uploadedByName,
        uploadedByUid: document.uploadedByUid,
        createdAt: document.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error("[SLP_COMPANY_DOC_UPLOAD_ERROR]", error);
    return NextResponse.json(
      { error: "ファイルのアップロードに失敗しました" },
      { status: 500 },
    );
  }
}
