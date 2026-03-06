-- master_stella_companies: deleted_at → deletedAt
ALTER TABLE "master_stella_companies" RENAME COLUMN "deleted_at" TO "deletedAt";

-- contact_histories: deleted_at → deletedAt
-- インデックスはカラム参照なのでRENAME COLUMNで自動追従される
ALTER TABLE "contact_histories" RENAME COLUMN "deleted_at" TO "deletedAt";
