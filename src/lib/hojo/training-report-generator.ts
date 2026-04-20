import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { TrainingReportPdf, type TrainingReportPdfData } from "./training-report-pdf";
import { getCurrentAnswer } from "./form-answer-sections";
import { loadApplicationSupportWithLatestAnswers } from "./application-support-loader";
import { writeHojoDocumentPdf } from "./document-writer";

const DOC_TYPE = "training_report";
const ADVISOR_COMPANY_NAME = "株式会社ALKES";
const ADVISOR_PERSON_NAME = "飯塚隆之介";

export async function generateTrainingReportPdf(applicationSupportId: number): Promise<{
  filePath: string;
  fileName: string;
}> {
  const { record, submission, answers, modifiedAnswers } =
    await loadApplicationSupportWithLatestAnswers(applicationSupportId);

  const applicantName =
    getCurrentAnswer(answers, modifiedAnswers, "basic", "fullName") || record.applicantName || "";
  const applicantAddress = getCurrentAnswer(answers, modifiedAnswers, "basic", "officeAddress");
  const applicantPhone = getCurrentAnswer(answers, modifiedAnswers, "basic", "phone");
  const formAnswerDate = submission.submittedAt;

  const data: TrainingReportPdfData = {
    applicantName,
    applicantAddress,
    applicantPhone,
    formAnswerDate,
    advisorCompanyName: ADVISOR_COMPANY_NAME,
    advisorPersonName: ADVISOR_PERSON_NAME,
  };

  const buffer = await renderToBuffer(
    React.createElement(TrainingReportPdf, { data }) as React.ReactElement<Record<string, unknown>>,
  );

  return writeHojoDocumentPdf({
    applicationSupportId,
    docType: DOC_TYPE,
    fileNamePrefix: "training_report",
    buffer,
  });
}
