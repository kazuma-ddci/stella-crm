-- CreateTable
CREATE TABLE "master_stella_companies" (
    "id" SERIAL NOT NULL,
    "companyCode" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "websiteUrl" VARCHAR(500),
    "industry" VARCHAR(100),
    "revenueScale" VARCHAR(100),
    "staffId" INTEGER,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_stella_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stella_company_locations" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(50),
    "email" VARCHAR(255),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stella_company_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stella_company_contacts" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "department" VARCHAR(100),
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stella_company_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_agents" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "category1" VARCHAR(20) NOT NULL,
    "contractStatus" VARCHAR(20),
    "referrerCompanyId" INTEGER,
    "note" TEXT,
    "minimumCases" INTEGER,
    "monthlyFee" INTEGER,
    "hearingUrl" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_agent_contracts" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "contractUrl" TEXT NOT NULL,
    "signedDate" DATE,
    "title" VARCHAR(200),
    "externalId" VARCHAR(100),
    "externalService" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'signed',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_agent_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_agent_staff" (
    "id" SERIAL NOT NULL,
    "agentId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stp_agent_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_stages" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "displayOrder" INTEGER,
    "stageType" VARCHAR(20) NOT NULL DEFAULT 'progress',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_stages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_methods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contact_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_lead_sources" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_lead_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_communication_methods" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_communication_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_companies" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "agentId" INTEGER,
    "currentStageId" INTEGER,
    "nextTargetStageId" INTEGER,
    "nextTargetDate" DATE,
    "leadAcquiredDate" DATE,
    "meetingDate" DATE,
    "firstKoDate" DATE,
    "jobPostingStartDate" VARCHAR(100),
    "progressDetail" TEXT,
    "forecast" VARCHAR(20),
    "operationStatus" VARCHAR(20),
    "lostReason" TEXT,
    "industryType" VARCHAR(20),
    "industry" VARCHAR(100),
    "plannedHires" INTEGER,
    "leadSourceId" INTEGER,
    "contractPlan" VARCHAR(50),
    "media" VARCHAR(100),
    "contractStartDate" DATE,
    "contractEndDate" DATE,
    "initialFee" INTEGER,
    "monthlyFee" INTEGER,
    "performanceFee" INTEGER,
    "salesStaffId" INTEGER,
    "operationStaffList" VARCHAR(100),
    "accountId" VARCHAR(100),
    "accountPass" VARCHAR(100),
    "jobInfoFolderLink" TEXT,
    "operationReportLink" TEXT,
    "proposalLink" TEXT,
    "billingLocationId" INTEGER,
    "billingCompanyName" VARCHAR(200),
    "billingAddress" TEXT,
    "billingRepresentative" VARCHAR(100),
    "paymentTerms" VARCHAR(100),
    "communicationMethodId" INTEGER,
    "note" TEXT,
    "contractNote" TEXT,
    "pendingReason" TEXT,
    "pendingResponseDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_company_contracts" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "contractUrl" TEXT,
    "signedDate" DATE,
    "title" VARCHAR(200),
    "externalId" VARCHAR(100),
    "externalService" VARCHAR(50),
    "status" VARCHAR(50) NOT NULL DEFAULT 'draft',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_company_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_histories" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "contact_date" TIMESTAMP(3) NOT NULL,
    "contact_method_id" INTEGER,
    "staff_id" INTEGER,
    "assigned_to" VARCHAR(255),
    "customer_participants" VARCHAR(500),
    "meeting_minutes" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "contact_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_history_files" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "file_path" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(200) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_history_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contact_history_roles" (
    "id" SERIAL NOT NULL,
    "contact_history_id" INTEGER NOT NULL,
    "customer_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contact_history_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_types" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_stage_histories" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "eventType" VARCHAR(20) NOT NULL,
    "fromStageId" INTEGER,
    "toStageId" INTEGER,
    "targetDate" DATE,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedBy" VARCHAR(100),
    "note" TEXT,
    "isCorrected" BOOLEAN NOT NULL DEFAULT false,
    "alertAcknowledged" BOOLEAN NOT NULL DEFAULT false,
    "lostReason" TEXT,
    "pendingReason" TEXT,
    "subType" VARCHAR(20),
    "isVoided" BOOLEAN NOT NULL DEFAULT false,
    "voidedAt" TIMESTAMP(3),
    "voidedBy" VARCHAR(100),
    "voidReason" TEXT,

    CONSTRAINT "stp_stage_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_staff" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "nameKana" VARCHAR(100),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "contractType" VARCHAR(50),
    "loginId" VARCHAR(100),
    "passwordHash" VARCHAR(255),
    "inviteToken" VARCHAR(64),
    "inviteTokenExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_role_types" (
    "id" SERIAL NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_role_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_role_assignments" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "roleTypeId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_project_assignments" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_project_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_permissions" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "projectCode" VARCHAR(50) NOT NULL,
    "permissionLevel" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_contract_histories" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "industryType" VARCHAR(20) NOT NULL,
    "contractPlan" VARCHAR(20) NOT NULL,
    "jobMedia" VARCHAR(50),
    "contractStartDate" DATE NOT NULL,
    "contractEndDate" DATE,
    "initialFee" INTEGER NOT NULL,
    "monthlyFee" INTEGER NOT NULL,
    "performanceFee" INTEGER NOT NULL,
    "salesStaffId" INTEGER,
    "operationStaffId" INTEGER,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT,
    "operationStatus" VARCHAR(20),
    "accountId" VARCHAR(100),
    "accountPass" VARCHAR(100),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "stp_contract_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_projects" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_contract_statuses" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_terminal" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_contract_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_contracts" (
    "id" SERIAL NOT NULL,
    "company_id" INTEGER NOT NULL,
    "project_id" INTEGER NOT NULL,
    "contract_number" VARCHAR(50),
    "parent_contract_id" INTEGER,
    "contract_type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "current_status_id" INTEGER,
    "target_date" DATE,
    "signed_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "signing_method" VARCHAR(20),
    "cloudsign_document_id" VARCHAR(100),
    "cloudsign_status" VARCHAR(30),
    "cloudsign_sent_at" TIMESTAMP(3),
    "cloudsign_completed_at" TIMESTAMP(3),
    "cloudsign_url" VARCHAR(500),
    "file_path" VARCHAR(500),
    "file_name" VARCHAR(200),
    "assigned_to" VARCHAR(100),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_contract_status_histories" (
    "id" SERIAL NOT NULL,
    "contract_id" INTEGER NOT NULL,
    "event_type" VARCHAR(30) NOT NULL,
    "from_status_id" INTEGER,
    "to_status_id" INTEGER,
    "target_date" DATE,
    "changed_by" VARCHAR(100),
    "note" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_contract_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_users" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "registrationTokenId" INTEGER,
    "contactId" INTEGER,
    "name" VARCHAR(100) NOT NULL,
    "position" VARCHAR(100),
    "email" VARCHAR(255) NOT NULL,
    "passwordHash" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending_email',
    "emailVerifiedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedBy" INTEGER,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "display_views" (
    "id" SERIAL NOT NULL,
    "viewKey" VARCHAR(50) NOT NULL,
    "viewName" VARCHAR(100) NOT NULL,
    "projectCode" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "display_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_user_display_permissions" (
    "id" SERIAL NOT NULL,
    "externalUserId" INTEGER NOT NULL,
    "displayViewId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "external_user_display_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "companyId" INTEGER NOT NULL,
    "name" VARCHAR(100),
    "note" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "issuedBy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registration_token_default_views" (
    "id" SERIAL NOT NULL,
    "registrationTokenId" INTEGER NOT NULL,
    "displayViewId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registration_token_default_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_verification_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "externalUserId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "externalUserId" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_histories" (
    "id" SERIAL NOT NULL,
    "externalUserId" INTEGER NOT NULL,
    "loginAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" VARCHAR(45),
    "userAgent" TEXT,
    "result" VARCHAR(20) NOT NULL,
    "failureReason" VARCHAR(50),

    CONSTRAINT "login_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_lead_form_tokens" (
    "id" SERIAL NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "agentId" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_lead_form_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_lead_form_submissions" (
    "id" SERIAL NOT NULL,
    "tokenId" INTEGER NOT NULL,
    "stpCompanyId" INTEGER,
    "masterCompanyId" INTEGER,
    "companyName" VARCHAR(200) NOT NULL,
    "contactName" VARCHAR(100) NOT NULL,
    "contactEmail" VARCHAR(255) NOT NULL,
    "contactPhone" VARCHAR(50),
    "pastHiringJobTypes" TEXT,
    "pastRecruitingCostAgency" INTEGER,
    "pastRecruitingCostAds" INTEGER,
    "pastRecruitingCostReferral" INTEGER,
    "pastRecruitingCostOther" INTEGER,
    "pastHiringCount" INTEGER,
    "desiredJobTypes" TEXT,
    "annualBudget" INTEGER,
    "annualHiringTarget" INTEGER,
    "hiringAreas" TEXT,
    "hiringTimeline" VARCHAR(100),
    "ageRangeMin" INTEGER,
    "ageRangeMax" INTEGER,
    "ageRange" VARCHAR(10),
    "requiredConditions" TEXT,
    "preferredConditions" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "processedAt" TIMESTAMP(3),
    "processedBy" INTEGER,
    "processingNote" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_lead_form_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_proposals" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER,
    "submissionId" INTEGER,
    "title" VARCHAR(200) NOT NULL,
    "proposalNumber" VARCHAR(50),
    "filePath" VARCHAR(500),
    "fileName" VARCHAR(200),
    "externalUrl" VARCHAR(500),
    "externalService" VARCHAR(50),
    "status" VARCHAR(20) NOT NULL DEFAULT 'draft',
    "sentAt" TIMESTAMP(3),
    "assignedTo" VARCHAR(100),
    "note" TEXT,
    "isAutoGenerated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "short_urls" (
    "id" SERIAL NOT NULL,
    "shortCode" VARCHAR(10) NOT NULL,
    "originalUrl" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "short_urls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_kpi_sheets" (
    "id" SERIAL NOT NULL,
    "stpCompanyId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_kpi_sheets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_kpi_weekly_data" (
    "id" SERIAL NOT NULL,
    "kpiSheetId" INTEGER NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "weekEndDate" DATE NOT NULL,
    "targetImpressions" INTEGER,
    "targetCpm" DECIMAL(10,2),
    "targetClicks" INTEGER,
    "targetCtr" DECIMAL(5,2),
    "targetCpc" DECIMAL(10,2),
    "targetApplications" INTEGER,
    "targetCvr" DECIMAL(5,2),
    "targetCpa" DECIMAL(10,2),
    "targetCost" INTEGER,
    "actualImpressions" INTEGER,
    "actualCpm" DECIMAL(10,2),
    "actualClicks" INTEGER,
    "actualCtr" DECIMAL(5,2),
    "actualCpc" DECIMAL(10,2),
    "actualApplications" INTEGER,
    "actualCvr" DECIMAL(5,2),
    "actualCpa" DECIMAL(10,2),
    "actualCost" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stp_kpi_weekly_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stp_kpi_share_links" (
    "id" SERIAL NOT NULL,
    "kpiSheetId" INTEGER NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" INTEGER,

    CONSTRAINT "stp_kpi_share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "master_stella_companies_companyCode_key" ON "master_stella_companies"("companyCode");

-- CreateIndex
CREATE UNIQUE INDEX "stp_agents_companyId_key" ON "stp_agents"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "stp_agent_staff_agentId_staffId_key" ON "stp_agent_staff"("agentId", "staffId");

-- CreateIndex
CREATE INDEX "idx_contact_histories_company_id" ON "contact_histories"("company_id");

-- CreateIndex
CREATE INDEX "idx_contact_histories_contact_date" ON "contact_histories"("contact_date");

-- CreateIndex
CREATE INDEX "idx_contact_histories_deleted_at" ON "contact_histories"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_contact_histories_staff_id" ON "contact_histories"("staff_id");

-- CreateIndex
CREATE INDEX "idx_contact_history_files_contact_history_id" ON "contact_history_files"("contact_history_id");

-- CreateIndex
CREATE INDEX "idx_contact_history_roles_contact_history_id" ON "contact_history_roles"("contact_history_id");

-- CreateIndex
CREATE INDEX "idx_contact_history_roles_customer_type_id" ON "contact_history_roles"("customer_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "contact_history_roles_contact_history_id_customer_type_id_key" ON "contact_history_roles"("contact_history_id", "customer_type_id");

-- CreateIndex
CREATE INDEX "idx_customer_types_project_id" ON "customer_types"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_types_project_id_name_key" ON "customer_types"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "master_staff_email_key" ON "master_staff"("email");

-- CreateIndex
CREATE UNIQUE INDEX "master_staff_loginId_key" ON "master_staff"("loginId");

-- CreateIndex
CREATE UNIQUE INDEX "master_staff_inviteToken_key" ON "master_staff"("inviteToken");

-- CreateIndex
CREATE UNIQUE INDEX "staff_role_types_code_key" ON "staff_role_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "staff_role_assignments_staffId_roleTypeId_key" ON "staff_role_assignments"("staffId", "roleTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_project_assignments_staffId_projectId_key" ON "staff_project_assignments"("staffId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "staff_permissions_staffId_projectCode_key" ON "staff_permissions"("staffId", "projectCode");

-- CreateIndex
CREATE INDEX "idx_master_contracts_company_id" ON "master_contracts"("company_id");

-- CreateIndex
CREATE INDEX "idx_master_contracts_project_id" ON "master_contracts"("project_id");

-- CreateIndex
CREATE INDEX "idx_master_contracts_company_project" ON "master_contracts"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "idx_master_contracts_current_status_id" ON "master_contracts"("current_status_id");

-- CreateIndex
CREATE INDEX "idx_master_contracts_is_active" ON "master_contracts"("is_active");

-- CreateIndex
CREATE INDEX "idx_master_contracts_cloudsign_document_id" ON "master_contracts"("cloudsign_document_id");

-- CreateIndex
CREATE INDEX "idx_master_contract_status_histories_contract_id" ON "master_contract_status_histories"("contract_id");

-- CreateIndex
CREATE INDEX "idx_master_contract_status_histories_recorded_at" ON "master_contract_status_histories"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "external_users_contactId_key" ON "external_users"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "external_users_email_key" ON "external_users"("email");

-- CreateIndex
CREATE INDEX "external_users_companyId_idx" ON "external_users"("companyId");

-- CreateIndex
CREATE INDEX "external_users_status_idx" ON "external_users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "display_views_viewKey_key" ON "display_views"("viewKey");

-- CreateIndex
CREATE UNIQUE INDEX "external_user_display_permissions_externalUserId_displayVie_key" ON "external_user_display_permissions"("externalUserId", "displayViewId");

-- CreateIndex
CREATE UNIQUE INDEX "registration_tokens_token_key" ON "registration_tokens"("token");

-- CreateIndex
CREATE INDEX "registration_tokens_token_idx" ON "registration_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "registration_token_default_views_registrationTokenId_displa_key" ON "registration_token_default_views"("registrationTokenId", "displayViewId");

-- CreateIndex
CREATE UNIQUE INDEX "email_verification_tokens_token_key" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE INDEX "email_verification_tokens_token_idx" ON "email_verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_key" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "password_reset_tokens_token_idx" ON "password_reset_tokens"("token");

-- CreateIndex
CREATE INDEX "login_histories_externalUserId_idx" ON "login_histories"("externalUserId");

-- CreateIndex
CREATE INDEX "login_histories_loginAt_idx" ON "login_histories"("loginAt");

-- CreateIndex
CREATE UNIQUE INDEX "stp_lead_form_tokens_token_key" ON "stp_lead_form_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "stp_lead_form_tokens_agentId_key" ON "stp_lead_form_tokens"("agentId");

-- CreateIndex
CREATE INDEX "stp_lead_form_tokens_token_idx" ON "stp_lead_form_tokens"("token");

-- CreateIndex
CREATE INDEX "stp_lead_form_submissions_tokenId_idx" ON "stp_lead_form_submissions"("tokenId");

-- CreateIndex
CREATE INDEX "stp_lead_form_submissions_status_idx" ON "stp_lead_form_submissions"("status");

-- CreateIndex
CREATE INDEX "stp_lead_form_submissions_submittedAt_idx" ON "stp_lead_form_submissions"("submittedAt");

-- CreateIndex
CREATE INDEX "stp_proposals_stpCompanyId_idx" ON "stp_proposals"("stpCompanyId");

-- CreateIndex
CREATE INDEX "stp_proposals_submissionId_idx" ON "stp_proposals"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "short_urls_shortCode_key" ON "short_urls"("shortCode");

-- CreateIndex
CREATE INDEX "stp_kpi_sheets_stpCompanyId_idx" ON "stp_kpi_sheets"("stpCompanyId");

-- CreateIndex
CREATE INDEX "stp_kpi_weekly_data_kpiSheetId_idx" ON "stp_kpi_weekly_data"("kpiSheetId");

-- CreateIndex
CREATE UNIQUE INDEX "stp_kpi_weekly_data_kpiSheetId_weekStartDate_key" ON "stp_kpi_weekly_data"("kpiSheetId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "stp_kpi_share_links_token_key" ON "stp_kpi_share_links"("token");

-- CreateIndex
CREATE INDEX "stp_kpi_share_links_token_idx" ON "stp_kpi_share_links"("token");

-- CreateIndex
CREATE INDEX "stp_kpi_share_links_kpiSheetId_idx" ON "stp_kpi_share_links"("kpiSheetId");

-- AddForeignKey
ALTER TABLE "master_stella_companies" ADD CONSTRAINT "master_stella_companies_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stella_company_locations" ADD CONSTRAINT "stella_company_locations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stella_company_contacts" ADD CONSTRAINT "stella_company_contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agents" ADD CONSTRAINT "stp_agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agents" ADD CONSTRAINT "stp_agents_referrerCompanyId_fkey" FOREIGN KEY ("referrerCompanyId") REFERENCES "master_stella_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_contracts" ADD CONSTRAINT "stp_agent_contracts_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_staff" ADD CONSTRAINT "stp_agent_staff_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_agent_staff" ADD CONSTRAINT "stp_agent_staff_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_nextTargetStageId_fkey" FOREIGN KEY ("nextTargetStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "stp_lead_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_communicationMethodId_fkey" FOREIGN KEY ("communicationMethodId") REFERENCES "stp_communication_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_companies" ADD CONSTRAINT "stp_companies_salesStaffId_fkey" FOREIGN KEY ("salesStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_company_contracts" ADD CONSTRAINT "stp_company_contracts_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_histories" ADD CONSTRAINT "contact_histories_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_histories" ADD CONSTRAINT "contact_histories_contact_method_id_fkey" FOREIGN KEY ("contact_method_id") REFERENCES "contact_methods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_histories" ADD CONSTRAINT "contact_histories_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_history_files" ADD CONSTRAINT "contact_history_files_contact_history_id_fkey" FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_history_roles" ADD CONSTRAINT "contact_history_roles_contact_history_id_fkey" FOREIGN KEY ("contact_history_id") REFERENCES "contact_histories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contact_history_roles" ADD CONSTRAINT "contact_history_roles_customer_type_id_fkey" FOREIGN KEY ("customer_type_id") REFERENCES "customer_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_types" ADD CONSTRAINT "customer_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_fromStageId_fkey" FOREIGN KEY ("fromStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_stage_histories" ADD CONSTRAINT "stp_stage_histories_toStageId_fkey" FOREIGN KEY ("toStageId") REFERENCES "stp_stages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_role_assignments" ADD CONSTRAINT "staff_role_assignments_roleTypeId_fkey" FOREIGN KEY ("roleTypeId") REFERENCES "staff_role_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_project_assignments" ADD CONSTRAINT "staff_project_assignments_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_project_assignments" ADD CONSTRAINT "staff_project_assignments_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "master_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_permissions" ADD CONSTRAINT "staff_permissions_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "master_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_salesStaffId_fkey" FOREIGN KEY ("salesStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_contract_histories" ADD CONSTRAINT "stp_contract_histories_operationStaffId_fkey" FOREIGN KEY ("operationStaffId") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "master_stella_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "master_projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_current_status_id_fkey" FOREIGN KEY ("current_status_id") REFERENCES "master_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contracts" ADD CONSTRAINT "master_contracts_parent_contract_id_fkey" FOREIGN KEY ("parent_contract_id") REFERENCES "master_contracts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contract_status_histories" ADD CONSTRAINT "master_contract_status_histories_contract_id_fkey" FOREIGN KEY ("contract_id") REFERENCES "master_contracts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contract_status_histories" ADD CONSTRAINT "master_contract_status_histories_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "master_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_contract_status_histories" ADD CONSTRAINT "master_contract_status_histories_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "master_contract_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_registrationTokenId_fkey" FOREIGN KEY ("registrationTokenId") REFERENCES "registration_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "stella_company_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_users" ADD CONSTRAINT "external_users_approvedBy_fkey" FOREIGN KEY ("approvedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_user_display_permissions" ADD CONSTRAINT "external_user_display_permissions_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "external_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_user_display_permissions" ADD CONSTRAINT "external_user_display_permissions_displayViewId_fkey" FOREIGN KEY ("displayViewId") REFERENCES "display_views"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "master_stella_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_tokens" ADD CONSTRAINT "registration_tokens_issuedBy_fkey" FOREIGN KEY ("issuedBy") REFERENCES "master_staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_token_default_views" ADD CONSTRAINT "registration_token_default_views_registrationTokenId_fkey" FOREIGN KEY ("registrationTokenId") REFERENCES "registration_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registration_token_default_views" ADD CONSTRAINT "registration_token_default_views_displayViewId_fkey" FOREIGN KEY ("displayViewId") REFERENCES "display_views"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "external_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "external_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_histories" ADD CONSTRAINT "login_histories_externalUserId_fkey" FOREIGN KEY ("externalUserId") REFERENCES "external_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_lead_form_tokens" ADD CONSTRAINT "stp_lead_form_tokens_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "stp_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_lead_form_submissions" ADD CONSTRAINT "stp_lead_form_submissions_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "stp_lead_form_tokens"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_lead_form_submissions" ADD CONSTRAINT "stp_lead_form_submissions_processedBy_fkey" FOREIGN KEY ("processedBy") REFERENCES "master_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_proposals" ADD CONSTRAINT "stp_proposals_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_proposals" ADD CONSTRAINT "stp_proposals_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "stp_lead_form_submissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_kpi_sheets" ADD CONSTRAINT "stp_kpi_sheets_stpCompanyId_fkey" FOREIGN KEY ("stpCompanyId") REFERENCES "stp_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_kpi_weekly_data" ADD CONSTRAINT "stp_kpi_weekly_data_kpiSheetId_fkey" FOREIGN KEY ("kpiSheetId") REFERENCES "stp_kpi_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stp_kpi_share_links" ADD CONSTRAINT "stp_kpi_share_links_kpiSheetId_fkey" FOREIGN KEY ("kpiSheetId") REFERENCES "stp_kpi_sheets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
