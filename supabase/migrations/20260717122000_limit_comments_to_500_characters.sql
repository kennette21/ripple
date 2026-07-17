-- Keep comments concise and aligned with the client-side composer limit.
ALTER TABLE "public"."comments"
DROP CONSTRAINT IF EXISTS "comment_length";

ALTER TABLE "public"."comments"
ADD CONSTRAINT "comment_length"
CHECK ((char_length("content") <= 500));
