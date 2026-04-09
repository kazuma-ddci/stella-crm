-- CreateTable
CREATE TABLE "slp_agency_contract_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_agency_contract_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slp_agencies" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "corporate_name" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "address" TEXT,
    "contract_status_id" INTEGER,
    "contract_start_date" DATE,
    "contract_end_date" DATE,
    "notes" TEXT,
    "parent_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "slp_agencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slp_agency_contacts" (
    "id" SERIAL NOT NULL,
    "agency_id" INTEGER NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "role" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "line_friend_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "slp_agency_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slp_agencies" ADD CONSTRAINT "slp_agencies_contract_status_id_fkey" FOREIGN KEY ("contract_status_id") REFERENCES "slp_agency_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_agencies" ADD CONSTRAINT "slp_agencies_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "slp_agencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_agency_contacts" ADD CONSTRAINT "slp_agency_contacts_agency_id_fkey" FOREIGN KEY ("agency_id") REFERENCES "slp_agencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_agency_contacts" ADD CONSTRAINT "slp_agency_contacts_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "slp_line_friends"("id") ON DELETE SET NULL ON UPDATE CASCADE;
