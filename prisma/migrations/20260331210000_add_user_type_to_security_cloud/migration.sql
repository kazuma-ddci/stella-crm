-- AlterTable
ALTER TABLE "hojo_line_friends_security_cloud" ADD COLUMN "user_type" VARCHAR(20) NOT NULL DEFAULT '顧客';

-- Update existing vendor records
UPDATE "hojo_line_friends_security_cloud" sc
SET "user_type" = 'ベンダー'
FROM "hojo_vendors" v
WHERE v."line_friend_id" = sc."id";
