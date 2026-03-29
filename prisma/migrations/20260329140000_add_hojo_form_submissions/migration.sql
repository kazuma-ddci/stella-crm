-- CreateTable: 補助金プロジェクト フォーム回答
CREATE TABLE "hojo_form_submissions" (
    "id" SERIAL NOT NULL,
    "formType" VARCHAR(100) NOT NULL,
    "companyName" VARCHAR(255),
    "representName" VARCHAR(255),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "answers" JSONB NOT NULL,
    "fileUrls" JSONB,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "hojo_form_submissions_pkey" PRIMARY KEY ("id")
);
