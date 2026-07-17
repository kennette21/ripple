-- Post authors may update their own posts, including changing visibility.
-- This migration is checked into source but is not applied to production here.
DROP POLICY IF EXISTS "posts_update" ON "public"."posts";

CREATE POLICY "posts_update"
ON "public"."posts"
FOR UPDATE
USING (("auth"."uid"() = "author_id"))
WITH CHECK (("auth"."uid"() = "author_id"));
