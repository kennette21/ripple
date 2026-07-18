-- Support Instagram-style reply chains: every reply targets a specific comment,
-- while thread_root_id groups the full conversation under one top-level comment.
ALTER TABLE "public"."comments"
ADD COLUMN "thread_root_id" uuid;

WITH RECURSIVE comment_threads AS (
  SELECT
    id,
    parent_id,
    id AS root_id,
    ARRAY[id] AS path
  FROM public.comments
  WHERE parent_id IS NULL

  UNION ALL

  SELECT
    child.id,
    child.parent_id,
    thread.root_id,
    thread.path || child.id
  FROM public.comments child
  JOIN comment_threads thread ON child.parent_id = thread.id
  WHERE NOT child.id = ANY(thread.path)
)
UPDATE public.comments comment
SET
  thread_root_id = thread.root_id,
  depth = 1
FROM comment_threads thread
WHERE comment.id = thread.id
  AND comment.parent_id IS NOT NULL;

ALTER TABLE "public"."comments"
ADD CONSTRAINT "comments_thread_root_id_fkey"
FOREIGN KEY ("thread_root_id")
REFERENCES "public"."comments"("id")
ON DELETE CASCADE;

CREATE INDEX "comments_post_thread_created_idx"
ON "public"."comments" ("post_id", "thread_root_id", "created_at");

CREATE OR REPLACE FUNCTION public.set_comment_thread()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  parent_comment public.comments%ROWTYPE;
  creates_cycle boolean := false;
BEGIN
  IF NEW.parent_id IS NULL THEN
    NEW.thread_root_id := NULL;
    NEW.depth := 0;
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A comment cannot reply to itself.'
      USING ERRCODE = '23514';
  END IF;

  SELECT *
  INTO parent_comment
  FROM public.comments
  WHERE id = NEW.parent_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reply target does not exist.'
      USING ERRCODE = '23503';
  END IF;

  IF parent_comment.post_id <> NEW.post_id THEN
    RAISE EXCEPTION 'Reply target must belong to the same post.'
      USING ERRCODE = '23514';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    WITH RECURSIVE ancestors AS (
      SELECT
        id,
        parent_id,
        ARRAY[id] AS path
      FROM public.comments
      WHERE id = NEW.parent_id

      UNION ALL

      SELECT
        parent.id,
        parent.parent_id,
        ancestors.path || parent.id
      FROM public.comments parent
      JOIN ancestors ON parent.id = ancestors.parent_id
      WHERE NOT parent.id = ANY(ancestors.path)
    )
    SELECT EXISTS (
      SELECT 1
      FROM ancestors
      WHERE id = NEW.id
    )
    INTO creates_cycle;

    IF creates_cycle THEN
      RAISE EXCEPTION 'A comment reply chain cannot contain a cycle.'
        USING ERRCODE = '23514';
    END IF;
  END IF;

  NEW.thread_root_id := COALESCE(
    parent_comment.thread_root_id,
    parent_comment.id
  );
  -- Replies are displayed at one visual depth, regardless of conversational depth.
  NEW.depth := 1;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "set_comment_thread_before_write"
BEFORE INSERT OR UPDATE OF "post_id", "parent_id", "thread_root_id", "depth"
ON "public"."comments"
FOR EACH ROW
EXECUTE FUNCTION public.set_comment_thread();

CREATE OR REPLACE FUNCTION public.create_comment(
  p_post_id uuid,
  p_content text,
  p_parent_id uuid DEFAULT NULL
)
RETURNS public.comments
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  created_comment public.comments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.comments (
    post_id,
    author_id,
    parent_id,
    content
  )
  VALUES (
    p_post_id,
    auth.uid(),
    p_parent_id,
    p_content
  )
  RETURNING * INTO created_comment;

  RETURN created_comment;
END;
$$;

REVOKE ALL ON FUNCTION public.create_comment(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_comment(uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_comment(uuid, text, uuid) TO service_role;

-- Comment authors may edit content, but relationship fields are database-owned.
REVOKE UPDATE ON TABLE public.comments FROM anon;
REVOKE UPDATE ON TABLE public.comments FROM authenticated;
GRANT UPDATE (content) ON TABLE public.comments TO authenticated;

-- Route reply notifications to the author of the exact comment being answered.
CREATE OR REPLACE FUNCTION public.create_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_TABLE_NAME = 'comments' THEN
    IF NEW.parent_id IS NOT NULL THEN
      INSERT INTO public.notifications (
        recipient_id,
        actor_id,
        type,
        post_id,
        comment_id
      )
      SELECT
        parent.author_id,
        NEW.author_id,
        'comment_reply'::public.notification_type,
        NEW.post_id,
        NEW.id
      FROM public.comments parent
      WHERE parent.id = NEW.parent_id
        AND parent.author_id <> NEW.author_id;
    ELSE
      INSERT INTO public.notifications (
        recipient_id,
        actor_id,
        type,
        post_id,
        comment_id
      )
      SELECT
        post.author_id,
        NEW.author_id,
        'comment'::public.notification_type,
        NEW.post_id,
        NEW.id
      FROM public.posts post
      WHERE post.id = NEW.post_id
        AND post.author_id <> NEW.author_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'follows' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type)
    VALUES (NEW.following_id, NEW.follower_id, 'follow');
  ELSIF TG_TABLE_NAME = 'reposts' THEN
    INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
    SELECT
      post.author_id,
      NEW.reposter_id,
      'repost',
      NEW.original_post_id
    FROM public.posts post
    WHERE post.id = NEW.original_post_id
      AND post.author_id <> NEW.reposter_id;
  END IF;

  RETURN NEW;
END;
$$;
