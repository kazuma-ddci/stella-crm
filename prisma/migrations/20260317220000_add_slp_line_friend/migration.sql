-- CreateTable
CREATE TABLE "slp_line_friends" (
    "id" SERIAL NOT NULL,
    "snsname" VARCHAR(200),
    "password" VARCHAR(100),
    "emailLine" VARCHAR(255),
    "emailRenkei" VARCHAR(255),
    "emailLine2" VARCHAR(255),
    "email" VARCHAR(255),
    "uid" VARCHAR(100) NOT NULL,
    "friendAddedDate" TIMESTAMP(3),
    "activeStatus" VARCHAR(50),
    "lastActivityDate" VARCHAR(50),
    "sei" VARCHAR(100),
    "mei" VARCHAR(100),
    "nickname" VARCHAR(100),
    "phone" VARCHAR(50),
    "postcode" VARCHAR(20),
    "address1" VARCHAR(255),
    "address2" VARCHAR(255),
    "address3" VARCHAR(255),
    "nenrei" VARCHAR(20),
    "nendai" VARCHAR(20),
    "seibetu" VARCHAR(20),
    "free1" TEXT,
    "free2" TEXT,
    "free3" TEXT,
    "free4" TEXT,
    "free5" TEXT,
    "free6" TEXT,
    "scenarioPos1" TEXT,
    "scenarioPos2" TEXT,
    "scenarioPos3" TEXT,
    "scenarioPos4" TEXT,
    "scenarioPos5" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "slp_line_friends_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "slp_line_friends_uid_key" ON "slp_line_friends"("uid");
