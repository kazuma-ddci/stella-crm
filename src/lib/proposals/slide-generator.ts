/**
 * Google Slides テンプレートからスライドを生成し、PDFにエクスポートする
 * GAS slide_generator.gs + slide_config.gs の sb_parseCompanyName を移植
 *
 * フロー:
 * 1. generateSlide() - テンプレートコピー → 置換 → Googleスライド作成（編集可能）
 * 2. exportSlideToPdf() - 既存のGoogleスライドからPDFを出力
 */

import { getSlidesClient, getDriveClient } from "@/lib/google-slides";
import type { SimulationResult } from "./simulation";

const TEMPLATE_ID = process.env.GOOGLE_SLIDE_TEMPLATE_ID || "";
const OUTPUT_FOLDER_ID = process.env.GOOGLE_DRIVE_OUTPUT_FOLDER_ID || "";

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
 * スライドはDriveに保持される（編集用）
 */
export async function generateSlide(input: SlideGenerationInput): Promise<SlideGenerationResult> {
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

  const copyParams: { name: string; parents?: string[] } = { name: fileName };
  if (OUTPUT_FOLDER_ID) {
    copyParams.parents = [OUTPUT_FOLDER_ID];
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
 * Googleスライド上で手動編集した後にPDFを出力するときに使う
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
