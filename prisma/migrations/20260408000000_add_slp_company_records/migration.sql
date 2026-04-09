-- CreateTable
CREATE TABLE "slp_company_records" (
    "id" SERIAL NOT NULL,
    "briefing_status" VARCHAR(50),
    "briefing_booked_at" TIMESTAMP(3),
    "briefing_date" TIMESTAMP(3),
    "briefing_staff" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "slp_company_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "slp_company_contacts" (
    "id" SERIAL NOT NULL,
    "company_record_id" INTEGER NOT NULL,
    "name" VARCHAR(200),
    "role" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "line_friend_id" INTEGER,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slp_company_contacts_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "slp_company_contacts" ADD CONSTRAINT "slp_company_contacts_company_record_id_fkey" FOREIGN KEY ("company_record_id") REFERENCES "slp_company_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slp_company_contacts" ADD CONSTRAINT "slp_company_contacts_line_friend_id_fkey" FOREIGN KEY ("line_friend_id") REFERENCES "slp_line_friends"("id") ON DELETE SET NULL ON UPDATE CASCADE;
