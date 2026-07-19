-- Save post content and the retained ordering of existing images in one
-- transaction. Storage objects for removed rows are returned to the client for
-- best-effort cleanup after the database commit.

CREATE OR REPLACE FUNCTION public.update_post(
  p_post_id uuid,
  p_caption text,
  p_reflection text,
  p_image_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_post public.posts%ROWTYPE;
  v_caption text := NULLIF(btrim(p_caption), '');
  v_reflection text := NULLIF(btrim(p_reflection), '');
  v_image_ids uuid[];
  v_current_image_ids uuid[];
  v_deleted_storage_paths text[] := ARRAY[]::text[];
  v_updated_at timestamptz;
  v_has_changes boolean;
BEGIN
  IF p_image_ids IS NULL THEN
    RAISE EXCEPTION 'p_image_ids must be an array'
      USING ERRCODE = '22004';
  END IF;

  v_image_ids := p_image_ids;

  IF cardinality(v_image_ids) > 10 THEN
    RAISE EXCEPTION 'A post cannot contain more than 10 images'
      USING ERRCODE = '22023';
  END IF;

  IF cardinality(v_image_ids) <> (
    SELECT count(DISTINCT image_id)
    FROM unnest(v_image_ids) AS submitted(image_id)
  ) THEN
    RAISE EXCEPTION 'p_image_ids cannot contain duplicate image IDs'
      USING ERRCODE = '22023';
  END IF;

  SELECT post.*
  INTO v_post
  FROM public.posts AS post
  WHERE post.id = p_post_id
    AND post.author_id = auth.uid()
    AND post.deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or not editable'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_post.content_type = 'caption' THEN
    IF v_caption IS NULL THEN
      RAISE EXCEPTION 'Caption posts require a caption'
        USING ERRCODE = '23514';
    END IF;

    IF v_reflection IS NOT NULL THEN
      RAISE EXCEPTION 'Caption posts cannot contain reflection content'
        USING ERRCODE = '23514';
    END IF;
  ELSIF v_reflection IS NULL THEN
    -- Applies to both reflection and the legacy both content type. For these
    -- posts caption is the optional editable title.
    RAISE EXCEPTION 'Reflection posts require reflection content'
      USING ERRCODE = '23514';
  END IF;

  -- Serialize concurrent edits of the same image set before validating it.
  PERFORM image.id
  FROM public.post_images AS image
  WHERE image.post_id = p_post_id
  ORDER BY image.position, image.id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM unnest(v_image_ids) AS submitted(image_id)
    LEFT JOIN public.post_images AS image
      ON image.id = submitted.image_id
      AND image.post_id = p_post_id
    WHERE image.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Images can only be retained from the post being edited'
      USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    array_agg(image.id ORDER BY image.position, image.id),
    ARRAY[]::uuid[]
  )
  INTO v_current_image_ids
  FROM public.post_images AS image
  WHERE image.post_id = p_post_id;

  v_has_changes :=
    ROW(v_caption, v_reflection)
      IS DISTINCT FROM ROW(v_post.caption, v_post.reflection)
    OR v_image_ids IS DISTINCT FROM v_current_image_ids;

  IF NOT v_has_changes THEN
    RETURN jsonb_build_object(
      'post_id', v_post.id,
      'updated_at', v_post.updated_at,
      'deleted_storage_paths', to_jsonb(v_deleted_storage_paths)
    );
  END IF;

  SELECT COALESCE(array_agg(path), ARRAY[]::text[])
  INTO v_deleted_storage_paths
  FROM (
    SELECT image.storage_path AS path
    FROM public.post_images AS image
    WHERE image.post_id = p_post_id
      AND NOT (image.id = ANY(v_image_ids))
    UNION ALL
    SELECT image.thumbnail_path AS path
    FROM public.post_images AS image
    WHERE image.post_id = p_post_id
      AND NOT (image.id = ANY(v_image_ids))
      AND image.thumbnail_path IS NOT NULL
  ) AS deleted_paths;

  DELETE FROM public.post_images AS image
  WHERE image.post_id = p_post_id
    AND NOT (image.id = ANY(v_image_ids));

  UPDATE public.post_images AS image
  SET position = submitted.ordinality - 1
  FROM unnest(v_image_ids) WITH ORDINALITY AS submitted(image_id, ordinality)
  WHERE image.id = submitted.image_id
    AND image.post_id = p_post_id;

  UPDATE public.posts AS post
  SET caption = v_caption,
      reflection = v_reflection,
      updated_at = now()
  WHERE post.id = p_post_id
  RETURNING post.updated_at INTO v_updated_at;

  RETURN jsonb_build_object(
    'post_id', p_post_id,
    'updated_at', v_updated_at,
    'deleted_storage_paths', to_jsonb(v_deleted_storage_paths)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.update_post(uuid, text, text, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_post(uuid, text, text, uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_post(uuid, text, text, uuid[]) TO authenticated;

-- Content edits use update_post so text and image changes cannot partially
-- commit. Privacy remains a separately authorized update.
REVOKE UPDATE (caption, reflection, content_type) ON public.posts FROM authenticated;
