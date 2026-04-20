-- 補助金フォーム回答の編集・確定機能: フォーム回答と申請者レコードの紐付け＆確定日管理

ALTER TABLE "hojo_form_submissions"
  ADD COLUMN "linked_application_support_id" INTEGER,
  ADD COLUMN "linked_at" TIMESTAMP(3),
  ADD COLUMN "confirmed_at" TIMESTAMP(3);

CREATE INDEX "hojo_form_submissions_linked_application_support_id_idx"
  ON "hojo_form_submissions"("linked_application_support_id");

ALTER TABLE "hojo_form_submissions"
  ADD CONSTRAINT "hojo_form_submissions_linked_application_support_id_fkey"
  FOREIGN KEY ("linked_application_support_id")
  REFERENCES "hojo_application_supports"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- BBS共有基準を formAnswerDate から formTranscriptDate に切り替えるため、既存値を移送
UPDATE "hojo_application_supports"
SET "formTranscriptDate" = "formAnswerDate"
WHERE "formAnswerDate" IS NOT NULL AND "formTranscriptDate" IS NULL;

-- UIDから申請者レコードが一意に決まるものは自動紐付け（複数候補は画面で手動選択）
UPDATE "hojo_form_submissions" AS hfs
SET
  "linked_application_support_id" = t.asid,
  "linked_at" = NOW()
FROM (
  SELECT
    hfs2."id" AS sid,
    MIN(has."id") AS asid,
    COUNT(has."id") AS cnt
  FROM "hojo_form_submissions" hfs2
  JOIN "hojo_line_friends_josei_support" hlf
    ON hlf."uid" = (hfs2."answers"->'_meta'->>'uid')
  JOIN "hojo_application_supports" has
    ON has."lineFriendId" = hlf."id" AND has."deletedAt" IS NULL
  WHERE hfs2."deletedAt" IS NULL
  GROUP BY hfs2."id"
  HAVING COUNT(has."id") = 1
) t
WHERE hfs."id" = t.sid
  AND hfs."linked_application_support_id" IS NULL;
