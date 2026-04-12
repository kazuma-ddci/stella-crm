import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, stat, unlink } from "fs/promises";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import { authorizeApi } from "@/lib/api-auth";

const execAsync = promisify(exec);

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * PDF を ghostscript で圧縮する
 * - /ebook (150 DPI) で画面閲覧向けに最適化
 * - 圧縮後のサイズが元より小さい場合のみ圧縮版を採用
 * - ghostscript がない/失敗した場合は元のファイルをそのまま使う（フォールバック）
 *
 * @param inputPath 元のPDFファイルのパス
 * @param outputPath 圧縮後のPDFファイルのパス
 * @returns 圧縮に成功したら true、失敗またはサイズ増加なら false
 */
async function compressPdf(
  inputPath: string,
  outputPath: string,
): Promise<boolean> {
  try {
    // ghostscript コマンド
    // -dPDFSETTINGS=/ebook: 150 DPI, 画面閲覧に最適
    // -dNOPAUSE: 対話なし
    // -dQUIET: ログ抑制
    // -dBATCH: 処理後に終了
    // -dCompatibilityLevel=1.4: 互換性レベル
    // タイムアウト: 60秒
    const cmd = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`;
    await execAsync(cmd, { timeout: 60_000 });

    // サイズ比較（圧縮後の方が大きければ失敗扱い）
    const [originalStat, compressedStat] = await Promise.all([
      stat(inputPath),
      stat(outputPath),
    ]);
    if (compressedStat.size >= originalStat.size) {
      // 圧縮しても小さくならなかった → 圧縮版を削除
      try {
        await unlink(outputPath);
      } catch {
        // ignore
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error("[PDF_COMPRESS_ERROR]", err);
    // 圧縮失敗時は圧縮版ファイルを削除
    try {
      await unlink(outputPath);
    } catch {
      // ignore
    }
    return false;
  }
}

export async function POST(request: NextRequest) {
  // SLP編集権限以上のスタッフのみ
  const authz = await authorizeApi([{ project: "slp", level: "edit" }]);
  if (!authz.ok) return authz.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const note = formData.get("note") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "ファイルが選択されていません" },
        { status: 400 },
      );
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "PDFファイルのみアップロード可能です" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは50MB以下にしてください" },
        { status: 400 },
      );
    }

    // ファイル保存
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileName = `${timestamp}_${sanitizedName}`;
    const uploadDir = path.join(
      process.cwd(),
      "public",
      "uploads",
      "documents",
      "slp",
    );
    await mkdir(uploadDir, { recursive: true });

    // 1. 元ファイルを一時パスに保存
    const tmpOriginalPath = path.join(uploadDir, `tmp_${fileName}`);
    const finalPath = path.join(uploadDir, fileName);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(tmpOriginalPath, buffer);

    // 2. ghostscript で圧縮を試みる
    //    圧縮成功 → 圧縮版を finalPath に配置
    //    圧縮失敗 → 元ファイルを finalPath に配置
    const compressed = await compressPdf(tmpOriginalPath, finalPath);
    let finalSize: number;
    let compressionInfo: {
      compressed: boolean;
      originalSize: number;
      finalSize: number;
      ratio: number;
    };

    if (compressed) {
      // 圧縮成功: 元ファイルを削除
      try {
        await unlink(tmpOriginalPath);
      } catch {
        // ignore
      }
      const compressedStat = await stat(finalPath);
      finalSize = compressedStat.size;
      compressionInfo = {
        compressed: true,
        originalSize: file.size,
        finalSize,
        ratio: finalSize / file.size,
      };
      console.log(
        `[PDF_COMPRESS] ${file.name}: ${file.size} → ${finalSize} bytes (${(
          (1 - finalSize / file.size) *
          100
        ).toFixed(1)}% 削減)`,
      );
    } else {
      // 圧縮失敗またはサイズ増加: 元ファイルを finalPath にリネーム
      try {
        // tmpOriginalPath → finalPath に移動
        // fs.rename を使いたいところだが writeFile で再保存が安全
        await writeFile(finalPath, buffer);
        await unlink(tmpOriginalPath);
      } catch (err) {
        console.error("[PDF_RENAME_ERROR]", err);
      }
      finalSize = file.size;
      compressionInfo = {
        compressed: false,
        originalSize: file.size,
        finalSize,
        ratio: 1,
      };
      console.log(
        `[PDF_COMPRESS] ${file.name}: 圧縮スキップ（元サイズ ${file.size} bytes をそのまま使用）`,
      );
    }

    const publicPath = `/uploads/documents/slp/${fileName}`;

    // 既存のアクティブな資料を全て非アクティブにして、新しい資料をアクティブに
    await prisma.$transaction([
      prisma.slpDocument.updateMany({
        where: { isActive: true, deletedAt: null },
        data: { isActive: false },
      }),
      prisma.slpDocument.create({
        data: {
          fileName: file.name,
          filePath: publicPath,
          fileSize: finalSize,
          isActive: true,
          uploadedById: authz.user.id,
          note: note?.trim() || null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      compression: compressionInfo,
    });
  } catch (error) {
    console.error("SLP document upload error:", error);
    return NextResponse.json(
      { error: "アップロードに失敗しました" },
      { status: 500 },
    );
  }
}
