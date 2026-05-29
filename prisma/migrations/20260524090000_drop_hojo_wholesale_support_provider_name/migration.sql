-- 支援事業者名は紹介元ベンダー名と同義のため、卸顧客リストから廃止する。
ALTER TABLE "hojo_wholesale_accounts"
  DROP COLUMN "support_provider_name";
