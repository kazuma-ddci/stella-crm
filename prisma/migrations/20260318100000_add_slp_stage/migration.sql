-- CreateTable
CREATE TABLE "slp_stages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "stageNumber" INTEGER NOT NULL,
    "phase" TEXT,
    "winRate" INTEGER,
    "autoAction" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_stages_pkey" PRIMARY KEY ("id")
);
