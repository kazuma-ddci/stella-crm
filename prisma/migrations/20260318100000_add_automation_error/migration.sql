-- CreateTable
CREATE TABLE "automation_errors" (
    "id" SERIAL NOT NULL,
    "source" VARCHAR(100) NOT NULL,
    "message" VARCHAR(2000) NOT NULL,
    "detail" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_errors_pkey" PRIMARY KEY ("id")
);
