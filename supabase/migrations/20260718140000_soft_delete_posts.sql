-- Keep deleted posts recoverable for 30 days. A scheduled Edge Function
-- permanently removes their Storage objects and database rows afterward.

ALTER TABLE public.posts
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at
ON public.posts (deleted_at)
WHERE deleted_at IS NOT NULL;

-- Active posts remain public. Recoverable posts are visible only to their
-- author; expired posts are left for the scheduled purge.
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select"
ON public.posts
FOR SELECT
USING (
  deleted_at IS NULL
  OR (
    auth.uid() = author_id
    AND deleted_at > now() - interval '30 days'
  )
);

DROP POLICY IF EXISTS "posts_insert" ON public.posts;
CREATE POLICY "posts_insert"
ON public.posts
FOR INSERT
WITH CHECK (auth.uid() = author_id AND deleted_at IS NULL);

-- Normal client updates are limited to privacy on active posts. Soft delete and
-- restore go through the narrowly scoped functions below.
DROP POLICY IF EXISTS "posts_update" ON public.posts;
CREATE POLICY "posts_update"
ON public.posts
FOR UPDATE
USING (auth.uid() = author_id AND deleted_at IS NULL)
WITH CHECK (auth.uid() = author_id AND deleted_at IS NULL);

REVOKE UPDATE ON public.posts FROM anon;
REVOKE UPDATE ON public.posts FROM authenticated;
GRANT UPDATE (is_private) ON public.posts TO authenticated;

-- Owners may hard-delete only after a post has entered Recently Deleted. This
-- prevents clients from bypassing the retention flow with a direct DELETE.
DROP POLICY IF EXISTS "posts_delete" ON public.posts;
CREATE POLICY "posts_delete"
ON public.posts
FOR DELETE
USING (auth.uid() = author_id AND deleted_at IS NOT NULL);

-- Prevent creating comments on posts that have already been deleted, and hide
-- existing comments from everyone except the deleted post's author.
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select"
ON public.comments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = comments.post_id
      AND (posts.deleted_at IS NULL OR posts.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert"
ON public.comments
FOR INSERT
WITH CHECK (
  auth.uid() = author_id
  AND EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = comments.post_id
      AND posts.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "post_images_select" ON public.post_images;
CREATE POLICY "post_images_select"
ON public.post_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = post_images.post_id
      AND (posts.deleted_at IS NULL OR posts.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "post_images_insert" ON public.post_images;
CREATE POLICY "post_images_insert"
ON public.post_images
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = post_images.post_id
      AND posts.author_id = auth.uid()
      AND posts.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "reposts_select" ON public.reposts;
CREATE POLICY "reposts_select"
ON public.reposts
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = reposts.original_post_id
      AND (posts.deleted_at IS NULL OR posts.author_id = auth.uid())
  )
);

DROP POLICY IF EXISTS "reposts_insert" ON public.reposts;
CREATE POLICY "reposts_insert"
ON public.reposts
FOR INSERT
WITH CHECK (
  auth.uid() = reposter_id
  AND EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = reposts.original_post_id
      AND posts.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "bookmarks_insert" ON public.bookmarks;
CREATE POLICY "bookmarks_insert"
ON public.bookmarks
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM public.posts
    WHERE posts.id = bookmarks.post_id
      AND posts.deleted_at IS NULL
  )
);

-- RPCs make soft deletion idempotent and keep the 30-day restore boundary in
-- the database instead of trusting device clocks.
CREATE OR REPLACE FUNCTION public.soft_delete_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.posts
  SET deleted_at = COALESCE(deleted_at, now())
  WHERE id = p_post_id
    AND author_id = auth.uid();

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.restore_deleted_post(p_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  UPDATE public.posts
  SET deleted_at = NULL
  WHERE id = p_post_id
    AND author_id = auth.uid()
    AND (
      deleted_at IS NULL
      OR deleted_at > now() - interval '30 days'
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_post(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.restore_deleted_post(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_post(uuid) TO authenticated;

-- Supabase Cron invokes the purge Edge Function daily. The job reads its URL
-- and shared request secret from Vault at runtime; see README.md for the
-- one-time setup commands.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'purge-deleted-posts-daily';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;

  PERFORM cron.schedule(
    'purge-deleted-posts-daily',
    '17 3 * * *',
    $cron$
      SELECT net.http_post(
        url := (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'project_url'
          LIMIT 1
        ) || '/functions/v1/purge-deleted-posts',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-purge-secret', (
            SELECT decrypted_secret
            FROM vault.decrypted_secrets
            WHERE name = 'purge_deleted_posts_secret'
            LIMIT 1
          )
        ),
        body := jsonb_build_object('scheduled_at', now())
      ) AS request_id;
    $cron$
  );
END;
$$;
