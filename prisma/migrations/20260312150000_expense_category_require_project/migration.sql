-- Step 1: Assign existing expense categories without project to STP project
UPDATE "ExpenseCategory"
SET "projectId" = (SELECT id FROM master_projects WHERE code = 'stp' LIMIT 1)
WHERE "projectId" IS NULL;

-- Step 2: Make projectId NOT NULL
ALTER TABLE "ExpenseCategory" ALTER COLUMN "projectId" SET NOT NULL;
