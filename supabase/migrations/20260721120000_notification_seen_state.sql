-- Track notification visibility per recipient and support efficient inbox reads.

ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS seen_at timestamptz;

-- Preserve the meaning of the legacy read flag for existing rows.
UPDATE public.notifications
SET seen_at = COALESCE(created_at, now())
WHERE read = true
  AND seen_at IS NULL;

CREATE INDEX IF NOT EXISTS notifications_recipient_created_id_idx
ON public.notifications (recipient_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS notifications_recipient_unseen_idx
ON public.notifications (recipient_id, created_at DESC)
WHERE seen_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_notifications_seen(
  p_notification_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.notifications
  SET
    seen_at = COALESCE(seen_at, now()),
    read = true
  WHERE recipient_id = auth.uid()
    AND id = ANY(COALESCE(p_notification_ids, ARRAY[]::uuid[]))
    AND (seen_at IS NULL OR read IS DISTINCT FROM true);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_notifications_seen(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_notifications_seen(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notifications_seen(uuid[]) TO service_role;

-- A reply belongs both to its direct conversation and to the post owner's
-- broader story. Avoid a duplicate when those recipients are the same person.
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
    END IF;

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
    LEFT JOIN public.comments parent ON parent.id = NEW.parent_id
    WHERE post.id = NEW.post_id
      AND post.author_id <> NEW.author_id
      AND (
        NEW.parent_id IS NULL
        OR parent.author_id IS DISTINCT FROM post.author_id
      );
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
