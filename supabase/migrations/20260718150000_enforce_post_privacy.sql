-- Enforce private-post visibility and add the one index used by post pages.

-- Private posts are visible only to their author. Keep the existing 30-day
-- owner access for soft-deleted posts.
DROP POLICY IF EXISTS "posts_select" ON public.posts;
CREATE POLICY "posts_select"
ON public.posts FOR SELECT
USING (
  (
    deleted_at IS NULL
    AND (NOT is_private OR author_id = auth.uid())
  )
  OR (
    author_id = auth.uid()
    AND deleted_at > now() - interval '30 days'
  )
);

-- Child rows must not reveal a post that the caller cannot read.
DROP POLICY IF EXISTS "comments_select" ON public.comments;
CREATE POLICY "comments_select"
ON public.comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = comments.post_id
  )
);

DROP POLICY IF EXISTS "comments_insert" ON public.comments;
CREATE POLICY "comments_insert"
ON public.comments FOR INSERT
WITH CHECK (
  author_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = comments.post_id
      AND posts.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "post_images_select" ON public.post_images;
CREATE POLICY "post_images_select"
ON public.post_images FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = post_images.post_id
  )
);

DROP POLICY IF EXISTS "reposts_select" ON public.reposts;
CREATE POLICY "reposts_select"
ON public.reposts FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = reposts.original_post_id
  )
);

DROP POLICY IF EXISTS "reposts_insert" ON public.reposts;
CREATE POLICY "reposts_insert"
ON public.reposts FOR INSERT
WITH CHECK (
  reposter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = reposts.original_post_id
      AND posts.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS "bookmarks_select" ON public.bookmarks;
CREATE POLICY "bookmarks_select"
ON public.bookmarks FOR SELECT
USING (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = bookmarks.post_id
  )
);

DROP POLICY IF EXISTS "bookmarks_insert" ON public.bookmarks;
CREATE POLICY "bookmarks_insert"
ON public.bookmarks FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.posts
    WHERE posts.id = bookmarks.post_id
      AND posts.deleted_at IS NULL
  )
);

-- Supports profile post pages and per-author feed scans without adding
-- speculative indexes elsewhere.
CREATE INDEX IF NOT EXISTS posts_author_created_id_idx
ON public.posts (author_id, created_at DESC, id DESC)
WHERE deleted_at IS NULL;
