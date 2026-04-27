import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { Prisma } from "@prisma/client";
import { callClaude } from "@/lib/anthropic/client";
import {
  BUSINESS_PLAN_SECTION_KEYS,
  buildSystemPrompt,
  buildUserMessage,
  loadBusinessPlanSections,
  parseSectionsJson,
  type BusinessPlanSectionKey,
} from "./business-plan-sections";
import { computeCostUsd } from "./anthropic-pricing";
import { BusinessPlanPdf, type BusinessPlanPdfData } from "./business-plan-pdf";
import { getCurrentAnswer } from "./form-answer-sections";
import { loadApplicationSupportWithLatestAnswers } from "./application-support-loader";
import { writeHojoDocumentPdf } from "./document-writer";
import { prisma } from "@/lib/prisma";

const DOC_TYPE = "business_plan";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 32_000;
const TIMEOUT_MS = 10 * 60 * 1000;

// フォーム回答をClaudeに渡すためのフラット化マッピング
const KEYS_MAP: Record<string, { path: string; key: string }> = {
  tradeName: { path: "basic", key: "tradeName" },
  openingDate: { path: "basic", key: "openingDate" },
  fullName: { path: "basic", key: "fullName" },
  officeAddress: { path: "basic", key: "officeAddress" },
  phone: { path: "basic", key: "phone" },
  email: { path: "basic", key: "email" },
  employeeCount: { path: "basic", key: "employeeCount" },
  homepageUrl: { path: "basic", key: "homepageUrl" },
  businessContent: { path: "businessOverview", key: "businessContent" },
  mainProductService: { path: "businessOverview", key: "mainProductService" },
  businessStrength: { path: "businessOverview", key: "businessStrength" },
  openingBackground: { path: "businessOverview", key: "openingBackground" },
  businessScale: { path: "businessOverview", key: "businessScale" },
  targetMarket: { path: "marketCompetition", key: "targetMarket" },
  targetCustomerProfile: { path: "marketCompetition", key: "targetCustomerProfile" },
  competitors: { path: "marketCompetition", key: "competitors" },
  strengthsAndChallenges: { path: "marketCompetition", key: "strengthsAndChallenges" },
  supportPurpose: { path: "supportApplication", key: "supportPurpose" },
  supportGoal: { path: "supportApplication", key: "supportGoal" },
  investmentPlan: { path: "supportApplication", key: "investmentPlan" },
  expectedOutcome: { path: "supportApplication", key: "expectedOutcome" },
  ownerCareer: { path: "businessStructure", key: "ownerCareer" },
  staffRoles: { path: "businessStructure", key: "staffRoles" },
  futureHiring: { path: "businessStructure", key: "futureHiring" },
  shortTermGoal: { path: "businessPlan", key: "shortTermGoal" },
  midTermGoal: { path: "businessPlan", key: "midTermGoal" },
  longTermGoal: { path: "businessPlan", key: "longTermGoal" },
  salesStrategy: { path: "businessPlan", key: "salesStrategy" },
  pastBusinessRecord: { path: "financial", key: "pastBusinessRecord" },
  futureInvestmentPlan: { path: "financial", key: "futureInvestmentPlan" },
  debtInfo: { path: "financial", key: "debtInfo" },
};

/**
 * Claude API を呼び出して事業計画書を生成し、PDF化して DB に保存する。
 * 再生成時は既存の editedSections / filePath を previous* にバックアップする（1世代保持）。
 */
export async function generateBusinessPlanPdf(applicationSupportId: number): Promise<{
  filePath: string;
  fileName: string;
  costUsd: number;
}> {
  const { answers, modifiedAnswers } = await loadApplicationSupportWithLatestAnswers(applicationSupportId);

  const applicantData: Record<string, string> = {};
  for (const [flatKey, { path, key }] of Object.entries(KEYS_MAP)) {
    applicantData[flatKey] = getCurrentAnswer(answers, modifiedAnswers, path, key);
  }

  const systemPrompt = await buildSystemPrompt();
  const userMessage = buildUserMessage(applicantData);

  const { text, raw } = await callClaude({
    model: MODEL,
    systemPrompt,
    userMessage,
    maxTokens: MAX_TOKENS,
    temperature: 0.3,
    timeoutMs: TIMEOUT_MS,
  });

  // max_tokens で切れた場合は JSON が壊れている可能性が高い → 明示エラー
  if (raw.stop_reason === "max_tokens") {
    throw new Error(
      `Claudeの応答がmax_tokens(${MAX_TOKENS})で切り捨てられました。max_tokensを増やすか、セクションを分割してください。`,
    );
  }
  if (raw.stop_reason && raw.stop_reason !== "end_turn") {
    console.warn(`[generateBusinessPlanPdf] 想定外のstop_reason: ${raw.stop_reason}`);
  }

  const sections = parseSectionsJson(text);
  const sectionDefs = await loadBusinessPlanSections();

  const tradeName = applicantData.tradeName;
  const fullName = applicantData.fullName;

  const data: BusinessPlanPdfData = {
    tradeName,
    fullName,
    generatedAt: new Date(),
    sections,
    sectionDefs,
  };
  const buffer = await renderToBuffer(
    React.createElement(BusinessPlanPdf, { data }) as React.ReactElement<Record<string, unknown>>,
  );

  const usage = raw.usage ?? {};
  const costUsd = computeCostUsd(MODEL, usage);

  // 再生成時のバックアップ：既存の editedSections / filePath / fileName を previous* に退避する
  const existing = await prisma.hojoApplicationSupportDocument.findUnique({
    where: { applicationSupportId_docType: { applicationSupportId, docType: DOC_TYPE } },
  });

  const aiFields = {
    generatedSections: sections as unknown as Prisma.InputJsonValue,
    editedSections: Prisma.JsonNull,
    modelName: MODEL,
    inputTokens: usage.input_tokens ?? null,
    outputTokens: usage.output_tokens ?? null,
    cacheReadTokens: usage.cache_read_input_tokens ?? null,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? null,
    costUsd: new Prisma.Decimal(costUsd.toFixed(6)),
  };

  const backupFields = existing
    ? {
        previousEditedSections: existing.editedSections ?? Prisma.JsonNull,
        previousFilePath: existing.filePath,
        previousFileName: existing.fileName,
      }
    : {};

  const { filePath, fileName } = await writeHojoDocumentPdf({
    applicationSupportId,
    docType: DOC_TYPE,
    fileNamePrefix: "business_plan",
    buffer,
    extraCreate: aiFields,
    extraUpdate: { ...aiFields, ...backupFields },
  });

  return { filePath, fileName, costUsd };
}

export const EXPECTED_SECTION_KEYS: readonly BusinessPlanSectionKey[] = BUSINESS_PLAN_SECTION_KEYS;
