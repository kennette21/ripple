-- Comment authors may edit their own comment text.
-- This migration is checked into source but is not applied to production here.
DROP POLICY IF EXISTS "comments_update" ON "public"."comments";

CREATE POLICY "comments_update"
ON "public"."comments"
FOR UPDATE
USING (("auth"."uid"() = "author_id"))
WITH CHECK (("auth"."uid"() = "author_id"));
