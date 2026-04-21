import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { BusinessPlanPdf, type BusinessPlanPdfData } from "./business-plan-pdf";
import {
  loadBusinessPlanSections,
  type BusinessPlanSectionKey,
} from "./business-plan-sections";
import { writeHojoDocumentPdf } from "./document-writer";

const DOC_TYPE = "business_plan";

/**
 * 事業計画書の PDF ファイルのみを書き出して DB のファイルパスを更新する。
 * Claude API は呼ばない（編集保存時に利用）。
 * セクション定義（目次・見出し）は DB から最新を読み込む。
 */
export async function renderBusinessPlanPdfOnly(params: {
  applicationSupportId: number;
  tradeName: string;
  fullName: string;
  sections: Record<BusinessPlanSectionKey, string>;
}): Promise<{ filePath: string; fileName: string }> {
  const { applicationSupportId, tradeName, fullName, sections } = params;
  const sectionDefs = await loadBusinessPlanSections();

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

  return writeHojoDocumentPdf({
    applicationSupportId,
    docType: DOC_TYPE,
    fileNamePrefix: "business_plan",
    buffer,
  });
}
