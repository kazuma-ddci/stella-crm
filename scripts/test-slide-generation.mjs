/**
 * スライド生成のテスト
 * GASの sb_testGenerateSlide と同じテストデータを使用
 */

import { google } from "googleapis";
import fs from "fs";
import path from "path";

const KEY_PATH = path.join(process.cwd(), "credentials/google-service-account.json");
const TEMPLATE_ID = "1pHgxhUOrcPX-0EeAowjKd7FuJ2hdWynNuubhN9_181k";
const OUTPUT_FOLDER_ID = "0AJJk3yMuNnf-Uk9PVA";

// GASのテストデータと同じ
const testFormData = {
  companyName: "テスト株式会社",
  industry: "建築系",
  jobType: "施工管理",
  location: "東京",
  recruitmentAgencyCost: 10000000,
  jobAdCost: 5000000,
  referralCost: 1000000,
  otherCost: 500000,
  annualHires: 24,
  targetHires: 24,
  salaryLevel: "平均±10%",
};

// 計算ロジック（simulation.ts と同じ）
function calculateSimulation(input) {
  const annualCost = input.recruitmentAgencyCost + input.jobAdCost + input.referralCost + input.otherCost;
  const annualHires = input.annualHires || 24;
  const costPerHire = annualHires > 0 ? Math.round(annualCost / annualHires) : 0;
  const totalCostForTarget = costPerHire * input.targetHires;

  // 建築系の TARGET_PERFORMANCE: min=5000, max=15000, median=10000
  const median = 10000;
  // 係数: 業界=1.2, 職種=1.2, 給与=1.0, 勤務地=0.9, 人数=0.8(24人→21+) = total=1.0368
  const totalCoef = 1.2 * 1.2 * 1.0 * 0.9 * 0.8;
  const adjustedMedian = median * totalCoef;

  const scenario10 = calculateScenario(adjustedMedian, 10, input.targetHires, totalCostForTarget);
  const scenario20 = calculateScenario(adjustedMedian, 5, input.targetHires, totalCostForTarget);

  return {
    companyName: input.companyName,
    jobType: input.jobType,
    targetHires: input.targetHires,
    before: { annualCost, costPerHire, annualHires, totalCostForTarget },
    scenario10,
    scenario20,
  };
}

function calculateScenario(adjustedMedian, multiplier, targetHires, beforeTotalCost) {
  const PRICING = { INITIAL_FEE: 100000, AD_COST_MONTHLY: 100000, SUCCESS_FEE_PER_HIRE: 150000, MONTHLY_FEE: 150000 };
  const hireCost = adjustedMedian * multiplier;
  const monthlyHires = hireCost > 0 ? PRICING.AD_COST_MONTHLY / hireCost : 0;
  const months = monthlyHires > 0 ? Math.ceil(targetHires / monthlyHires) + 1 : 0;
  const successFeeCost = PRICING.INITIAL_FEE + (months * PRICING.AD_COST_MONTHLY) + (targetHires * PRICING.SUCCESS_FEE_PER_HIRE);
  const monthlyFeeCost = PRICING.INITIAL_FEE + (months * PRICING.AD_COST_MONTHLY) + (months * PRICING.MONTHLY_FEE);
  const reductionSuccess = beforeTotalCost > 0 ? Math.round((beforeTotalCost - successFeeCost) / beforeTotalCost * 100) : 0;
  const reductionMonthly = beforeTotalCost > 0 ? Math.round((beforeTotalCost - monthlyFeeCost) / beforeTotalCost * 100) : 0;
  return { monthlyHires, months, successFeeCost, monthlyFeeCost, reductionSuccess, reductionMonthly };
}

function parseCompanyName(companyName) {
  if (!companyName) return { line1: "", line2: "", full: "" };
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
      return { line1: p.keyword, line2: name.replace(new RegExp("^" + p.keyword), "").trim(), full: name };
    }
    if (!p.prefix && name.endsWith(p.keyword)) {
      return { line1: name.replace(new RegExp(p.keyword + "$"), "").trim(), line2: p.keyword, full: name };
    }
  }
  return { line1: name, line2: "", full: name };
}

function toMan(val) {
  return Math.round(val / 10000).toLocaleString("ja-JP");
}

async function main() {
  const keyFile = JSON.parse(fs.readFileSync(KEY_PATH, "utf-8"));

  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: keyFile.client_email, private_key: keyFile.private_key },
    scopes: ["https://www.googleapis.com/auth/presentations", "https://www.googleapis.com/auth/drive"],
  });

  const authClient = await auth.getClient();
  const drive = google.drive({ version: "v3", auth: authClient });
  const slides = google.slides({ version: "v1", auth: authClient });

  // シミュレーション計算
  const result = calculateSimulation(testFormData);
  console.log("=== シミュレーション結果 ===");
  console.log(JSON.stringify(result, null, 2));

  // 置換マップ構築
  const parsedCompany = parseCompanyName(result.companyName);
  const replacements = {
    "{{会社名}}": result.companyName + "様",
    "{{会社名_上}}": parsedCompany.line1,
    "{{会社名_下}}": parsedCompany.line2 || "",
    "{{会社名_フル}}": result.companyName + "様",
    "{{タイトル会社名}}": result.companyName,
    "{{年間採用コスト_before}}": toMan(result.before.annualCost),
    "{{採用人数_before}}": String(result.before.annualHires),
    "{{採用単価_before}}": toMan(result.before.costPerHire),
    "{{目標採用人数}}": String(result.targetHires),
    "{{合計採用コスト_before}}": toMan(result.before.totalCostForTarget),
    "{{職種}}": result.jobType,
    "{{合計採用コスト_成果10}}": toMan(result.scenario10.successFeeCost),
    "{{削減率_成果10}}": String(result.scenario10.reductionSuccess),
    "{{予想期間_成果10}}": String(result.scenario10.months),
    "{{合計採用コスト_成果20}}": toMan(result.scenario20.successFeeCost),
    "{{削減率_成果20}}": String(result.scenario20.reductionSuccess),
    "{{予想期間_成果20}}": String(result.scenario20.months),
    "{{合計採用コスト_固定10}}": toMan(result.scenario10.monthlyFeeCost),
    "{{削減率_固定10}}": String(result.scenario10.reductionMonthly),
    "{{予想期間_固定10}}": String(result.scenario10.months),
    "{{合計採用コスト_固定20}}": toMan(result.scenario20.monthlyFeeCost),
    "{{削減率_固定20}}": String(result.scenario20.reductionMonthly),
    "{{予想期間_固定20}}": String(result.scenario20.months),
  };

  console.log("\n=== 置換マップ ===");
  for (const [key, val] of Object.entries(replacements)) {
    console.log(`  ${key} → "${val}"`);
  }

  // テンプレートをコピー
  console.log("\n=== テンプレートコピー ===");
  const now = new Date();
  const timestamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 15);
  const fileName = `テスト株式会社_提案資料_${timestamp}`;

  const copiedFile = await drive.files.copy({
    fileId: TEMPLATE_ID,
    requestBody: { name: fileName, parents: [OUTPUT_FOLDER_ID] },
    supportsAllDrives: true,
  });
  const newFileId = copiedFile.data.id;
  console.log(`コピー完了: ${newFileId}`);

  // プレースホルダー置換
  console.log("\n=== プレースホルダー置換 ===");
  const replaceRequests = Object.entries(replacements).map(([placeholder, value]) => ({
    replaceAllText: {
      containsText: { text: placeholder, matchCase: true },
      replaceText: value,
    },
  }));

  const batchResult = await slides.presentations.batchUpdate({
    presentationId: newFileId,
    requestBody: { requests: replaceRequests },
  });
  console.log(`置換完了: ${batchResult.data.replies?.length} 件`);

  // PDF出力
  console.log("\n=== PDF出力 ===");
  const pdfResponse = await drive.files.export(
    { fileId: newFileId, mimeType: "application/pdf" },
    { responseType: "arraybuffer" },
  );

  const pdfBuffer = Buffer.from(pdfResponse.data);
  const outputPath = path.join(process.cwd(), `test-output-${Date.now()}.pdf`);
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`PDF保存: ${outputPath} (${pdfBuffer.length} bytes)`);

  const slideUrl = `https://docs.google.com/presentation/d/${newFileId}/edit`;
  console.log(`\nスライドURL: ${slideUrl}`);
  console.log("\n=== テスト完了 ===");
}

main().catch((err) => {
  console.error("エラー:", err.message);
  if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
});
