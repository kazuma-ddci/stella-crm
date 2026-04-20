import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  SupportApplicationPdf,
  type SupportApplicationPdfData,
} from "./support-application-pdf";
import { getCurrentAnswer } from "./form-answer-sections";
import { loadApplicationSupportWithLatestAnswers } from "./application-support-loader";
import { writeHojoDocumentPdf } from "./document-writer";

const DOC_TYPE = "support_application";

export async function generateSupportApplicationPdf(
  applicationSupportId: number,
): Promise<{ filePath: string; fileName: string }> {
  const { record, submission, answers, modifiedAnswers } =
    await loadApplicationSupportWithLatestAnswers(applicationSupportId);

  // 申請者情報
  const companyName = getCurrentAnswer(answers, modifiedAnswers, "basic", "tradeName");
  const representativeName =
    getCurrentAnswer(answers, modifiedAnswers, "basic", "fullName") ||
    record.applicantName ||
    "";
  const officeAddress = getCurrentAnswer(answers, modifiedAnswers, "basic", "officeAddress");
  const phone = getCurrentAnswer(answers, modifiedAnswers, "basic", "phone");
  const email = getCurrentAnswer(answers, modifiedAnswers, "basic", "email");
  const homepageUrl = getCurrentAnswer(answers, modifiedAnswers, "basic", "homepageUrl");

  // 口座情報
  const bankTypeRaw = getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "bankType");
  const bankType: SupportApplicationPdfData["bankType"] =
    bankTypeRaw === "ゆうちょ銀行"
      ? "ゆうちょ銀行"
      : bankTypeRaw === "他の金融機関"
        ? "他の金融機関"
        : null;

  const yucho = {
    symbol: getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "yuchoSymbol"),
    passbookNumber: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "yuchoPassbookNumber",
    ),
    accountHolderKana: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "yuchoAccountHolderKana",
    ),
    accountHolder: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "yuchoAccountHolder",
    ),
  };

  const otherAccountTypeRaw = getCurrentAnswer(
    answers,
    modifiedAnswers,
    "bankAccount",
    "otherAccountType",
  );
  const other = {
    bankName: getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "otherBankName"),
    bankCode: getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "otherBankCode"),
    branchName: getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "otherBranchName"),
    branchCode: getCurrentAnswer(answers, modifiedAnswers, "bankAccount", "otherBranchCode"),
    accountType:
      otherAccountTypeRaw === "普通（総合）"
        ? ("普通（総合）" as const)
        : otherAccountTypeRaw === "当座"
          ? ("当座" as const)
          : null,
    accountNumber: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "otherAccountNumber",
    ),
    accountHolderKana: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "otherAccountHolderKana",
    ),
    accountHolder: getCurrentAnswer(
      answers,
      modifiedAnswers,
      "bankAccount",
      "otherAccountHolder",
    ),
  };

  // お申し込み年月日: 情報回収フォームの回答日（送信日）を使用
  const applicationDate = submission.submittedAt;

  const data: SupportApplicationPdfData = {
    applicationDate,
    companyName,
    representativeName,
    officeAddress,
    phone,
    email,
    homepageUrl,
    remarks: "",
    subsidyAmount: record.subsidyAmount ?? null,
    bankType,
    yucho,
    other,
  };

  const buffer = await renderToBuffer(
    React.createElement(SupportApplicationPdf, { data }) as React.ReactElement<
      Record<string, unknown>
    >,
  );

  return writeHojoDocumentPdf({
    applicationSupportId,
    docType: DOC_TYPE,
    fileNamePrefix: "support_application",
    buffer,
  });
}
