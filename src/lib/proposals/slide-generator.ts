/**
 * Google Slides テンプレートからスライドを生成し、PDFにエクスポートする
 * GAS slide_generator.gs + slide_config.gs の sb_parseCompanyName を移植
 *
 * フロー:
 * 1. generateSlide() - テンプレートコピー → 置換 → Googleスライド作成（編集可能）
 * 2. exportSlideToPdf() - 既存のGoogleスライドからPDFを出力
 * 3. toggleSlidePermission() - 確定時に閲覧専用、編集時に編集可能に切り替え
 * 4. getOrCreateCompanyFolder() - 企業フォルダの取得/作成
 * 5. moveSlideToFolder() - スライドを指定フォルダに移動
 * 6. renameSlideFile() - スライドファイル名の変更（削除済み表記等）
 */

import { getSlidesClient, getDriveClient } from "@/lib/google-slides";
import type { SimulationResult } from "./simulation";

const TEMPLATE_ID = process.env.GOOGLE_SLIDE_TEMPLATE_ID || "";
const OUTPUT_FOLDER_ID = process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID || "";
const UNLINKED_FOLDER_ID = process.env.GOOGLE_DRIVE_UNLINKED_FOLDER_ID || "";

export type SlideGenerationInput = {
  companyName: string;
  jobType: string;
  targetHires: number;
  before: SimulationResult["before"];
  scenario10: SimulationResult["scenario10"];
  scenario20: SimulationResult["scenario20"];
};

export type SlideGenerationResult = {
  fileId: string;
  fileName: string;
  slideUrl: string;
  embedUrl: string;
};

/**
 * 会社名を前株/後株で分割（GAS sb_parseCompanyName 完全移植）
 */
function parseCompanyName(companyName: string): { line1: string; line2: string; full: string } {
  if (!companyName) {
    return { line1: "", line2: "", full: "" };
  }

  const name = companyName.trim();

  const patterns = [
    { prefix: true, keyword: "株式会社" },
    { prefix: false, keyword: "株式会社" },
    { prefix: true, keyword: "有限会社" },
    { prefix: false, keyword: "有限会社" },
    { prefix: true, keyword: "合同会社" },
    { prefix: false, keyword: "合同会社" },
  ];

  for (const p of patterns) {
    if (p.prefix && name.startsWith(p.keyword)) {
      return {
        line1: p.keyword,
        line2: name.replace(new RegExp("^" + p.keyword), "").trim(),
        full: name,
      };
    }
    if (!p.prefix && name.endsWith(p.keyword)) {
      return {
        line1: name.replace(new RegExp(p.keyword + "$"), "").trim(),
        line2: p.keyword,
        full: name,
      };
    }
  }

  return { line1: name, line2: "", full: name };
}

/**
 * 万円表示用フォーマット（GAS toMan 完全移植）
 */
function toMan(val: number): string {
  return Math.round(val / 10000).toLocaleString("ja-JP");
}

/**
 * 置換マッピングを作成（GAS sb_buildReplacementMap 完全移植）
 */
function buildReplacementMap(data: SlideGenerationInput): Record<string, string> {
  const parsedCompany = parseCompanyName(data.companyName);

  return {
    // 表紙
    "{{会社名}}": data.companyName + "様",
    "{{会社名_上}}": parsedCompany.line1,
    "{{会社名_下}}": parsedCompany.line2 || "",
    "{{会社名_フル}}": data.companyName + "様",
    "{{タイトル会社名}}": data.companyName,

    // Before（現状）- 両スライド共通
    "{{年間採用コスト_before}}": toMan(data.before.annualCost),
    "{{採用人数_before}}": String(data.before.annualHires),
    "{{採用単価_before}}": toMan(data.before.costPerHire),
    "{{目標採用人数}}": String(data.targetHires),
    "{{合計採用コスト_before}}": toMan(data.before.totalCostForTarget),
    "{{職種}}": data.jobType,

    // 成果報酬型スライド
    "{{合計採用コスト_成果10}}": toMan(data.scenario10.successFeeCost),
    "{{削減率_成果10}}": String(data.scenario10.reductionSuccess),
    "{{予想期間_成果10}}": String(data.scenario10.months),
    "{{合計採用コスト_成果20}}": toMan(data.scenario20.successFeeCost),
    "{{削減率_成果20}}": String(data.scenario20.reductionSuccess),
    "{{予想期間_成果20}}": String(data.scenario20.months),

    // 月額固定型スライド
    "{{合計採用コスト_固定10}}": toMan(data.scenario10.monthlyFeeCost),
    "{{削減率_固定10}}": String(data.scenario10.reductionMonthly),
    "{{予想期間_固定10}}": String(data.scenario10.months),
    "{{合計採用コスト_固定20}}": toMan(data.scenario20.monthlyFeeCost),
    "{{削減率_固定20}}": String(data.scenario20.reductionMonthly),
    "{{予想期間_固定20}}": String(data.scenario20.months),
  };
}

/**
 * テンプレートからGoogleスライドを生成（コピー → 置換）
 * @param folderId - 保存先フォルダID（省略時は「紐付け前」フォルダ → 共有ドライブルート）
 */
export async function generateSlide(
  input: SlideGenerationInput,
  folderId?: string,
): Promise<SlideGenerationResult> {
  if (!TEMPLATE_ID) {
    throw new Error("GOOGLE_SLIDE_TEMPLATE_ID が設定されていません");
  }

  const drive = await getDriveClient();
  const slides = await getSlidesClient();

  // 1. テンプレートをコピー
  const safeName = (input.companyName || "御社").replace(/[/\\:*?"<>|]/g, "_");
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const fileName = `${safeName}_提案資料_${timestamp}`;

  const targetFolder = folderId || UNLINKED_FOLDER_ID || OUTPUT_FOLDER_ID;
  const copyParams: { name: string; parents?: string[] } = { name: fileName };
  if (targetFolder) {
    copyParams.parents = [targetFolder];
  }

  const copiedFile = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: copyParams,
    supportsAllDrives: true,
  });

  const newFileId = copiedFile.data.id!;

  // 2. リンクを知っている全員が編集可能に設定
  await drive.permissions.create({
    fileId: newFileId,
    supportsAllDrives: true,
    requestBody: {
      role: "writer",
      type: "anyone",
    },
  });

  // 3. プレースホルダー置換
  const replacements = buildReplacementMap(input);

  const replaceRequests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: {
        text: placeholder,
        matchCase: true,
      },
      replaceText: value,
    },
  }));

  await slides.presentations.batchUpdate({
    presentationId: newFileId,
    requestBody: {
      requests: replaceRequests,
    },
  });

  const slideUrl = `https://docs.google.com/presentation/d/${newFileId}/edit`;
  const embedUrl = `https://docs.google.com/presentation/d/${newFileId}/embed?start=false&loop=false&delayms=3000`;

  return {
    fileId: newFileId,
    fileName,
    slideUrl,
    embedUrl,
  };
}

/**
 * 既存のGoogleスライドからPDFをエクスポート
 */
export async function exportSlideToPdf(slideFileId: string): Promise<Buffer> {
  const drive = await getDriveClient();

  const pdfResponse = await drive.files.export(
    {
      fileId: slideFileId,
      mimeType: "application/pdf",
    },
    { responseType: "arraybuffer" },
  );

  return Buffer.from(pdfResponse.data as ArrayBuffer);
}

/**
 * スライドの公開権限を切り替え
 * @param mode - "reader" で閲覧専用、"writer" で編集可能
 */
export async function toggleSlidePermission(
  slideFileId: string,
  mode: "reader" | "writer",
): Promise<void> {
  const drive = await getDriveClient();

  // "anyone" タイプの既存権限を検索
  const permsList = await drive.permissions.list({
    fileId: slideFileId,
    supportsAllDrives: true,
    fields: "permissions(id,type,role)",
  });

  const anyonePerm = permsList.data.permissions?.find((p) => p.type === "anyone");

  if (anyonePerm?.id) {
    // 既存権限を更新
    await drive.permissions.update({
      fileId: slideFileId,
      permissionId: anyonePerm.id,
      supportsAllDrives: true,
      requestBody: { role: mode },
    });
  } else {
    // 権限が見つからない場合は新規作成
    await drive.permissions.create({
      fileId: slideFileId,
      supportsAllDrives: true,
      requestBody: {
        role: mode,
        type: "anyone",
      },
    });
  }
}

/**
 * 企業フォルダを取得または作成
 * フォルダ名: "{企業コード} {企業名}"
 * @returns フォルダID
 */
export async function getOrCreateCompanyFolder(
  companyCode: string,
  companyName: string,
): Promise<string> {
  const drive = await getDriveClient();
  const folderName = `${companyCode} ${companyName}`;

  // 既存フォルダを検索（OUTPUT_FOLDER_ID の直下）
  const searchResult = await drive.files.list({
    q: `name = '${folderName.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.folder' and '${OUTPUT_FOLDER_ID}' in parents and trashed = false`,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
    fields: "files(id,name)",
  });

  if (searchResult.data.files && searchResult.data.files.length > 0) {
    return searchResult.data.files[0].id!;
  }

  // フォルダを新規作成
  const newFolder = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [OUTPUT_FOLDER_ID],
    },
  });

  return newFolder.data.id!;
}

/**
 * スライドファイルを別フォルダに移動
 */
export async function moveSlideToFolder(
  slideFileId: string,
  targetFolderId: string,
): Promise<void> {
  const drive = await getDriveClient();

  // 現在の親フォルダを取得
  const file = await drive.files.get({
    fileId: slideFileId,
    fields: "parents",
    supportsAllDrives: true,
  });

  const previousParents = file.data.parents?.join(",") || "";

  // 移動
  await drive.files.update({
    fileId: slideFileId,
    addParents: targetFolderId,
    removeParents: previousParents,
    supportsAllDrives: true,
  });
}

/**
 * スライドファイル名を変更
 */
export async function renameSlideFile(
  slideFileId: string,
  newName: string,
): Promise<void> {
  const drive = await getDriveClient();

  await drive.files.update({
    fileId: slideFileId,
    supportsAllDrives: true,
    requestBody: { name: newName },
  });
}

/**
 * スライドファイルの現在の名前を取得
 */
export async function getSlideFileName(slideFileId: string): Promise<string> {
  const drive = await getDriveClient();

  const file = await drive.files.get({
    fileId: slideFileId,
    fields: "name",
    supportsAllDrives: true,
  });

  return file.data.name || "";
}
