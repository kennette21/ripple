-- Save the same composition fields and ordered album used when creating a post.
-- New/replaced assets must already exist at fresh paths; the live album changes
-- atomically, and superseded objects are returned for cleanup after commit.
CREATE OR REPLACE FUNCTION public.update_post_composition(
  p_post_id uuid,
  p_caption text,
  p_reflection text,
  p_content_type public.post_content_type,
  p_is_private boolean,
  p_images jsonb
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
  v_ids uuid[];
  v_deleted_paths text[];
  v_image jsonb;
  v_position integer;
  v_updated_at timestamptz;
BEGIN
  IF p_images IS NULL OR jsonb_typeof(p_images) <> 'array' THEN
    RAISE EXCEPTION 'Images must be an array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_array_length(p_images) > 10 OR p_content_type IS NULL OR p_is_private IS NULL THEN
    RAISE EXCEPTION 'Invalid post composition' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_post FROM public.posts
  WHERE id = p_post_id AND author_id = auth.uid() AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post not found or not editable' USING ERRCODE = 'P0002';
  END IF;
  IF p_content_type = 'caption' THEN
    IF v_caption IS NULL AND jsonb_array_length(p_images) = 0 THEN
      RAISE EXCEPTION 'Add a photo or write a caption' USING ERRCODE = '23514';
    END IF;
    IF v_reflection IS NOT NULL THEN
      RAISE EXCEPTION 'Caption posts cannot contain a reflection' USING ERRCODE = '23514';
    END IF;
    v_caption := COALESCE(v_caption, '');
  ELSE
    IF v_reflection IS NULL OR char_length(v_caption) > 100 THEN
      RAISE EXCEPTION 'A reflection needs a body and a title of at most 100 characters' USING ERRCODE = '23514';
    END IF;
  END IF;

  PERFORM id FROM public.post_images WHERE post_id = p_post_id ORDER BY position, id FOR UPDATE;
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_images) image WHERE jsonb_typeof(image) <> 'object') THEN
    RAISE EXCEPTION 'Invalid image entry' USING ERRCODE = '22023';
  END IF;
  SELECT COALESCE(array_agg((image->>'id')::uuid) FILTER (WHERE image->>'id' IS NOT NULL), ARRAY[]::uuid[])
    INTO v_ids FROM jsonb_array_elements(p_images) image;
  IF cardinality(v_ids) <> (SELECT count(DISTINCT id) FROM unnest(v_ids) id)
    OR EXISTS (
      SELECT 1 FROM unnest(v_ids) submitted(id)
      WHERE NOT EXISTS (SELECT 1 FROM public.post_images image WHERE image.id = submitted.id AND image.post_id = p_post_id)
    ) THEN
    RAISE EXCEPTION 'Images must belong to this post and cannot be repeated' USING ERRCODE = '22023';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(p_images) image WHERE image->>'storage_path' IS NOT NULL)
    <> (SELECT count(DISTINCT image->>'storage_path') FROM jsonb_array_elements(p_images) image WHERE image->>'storage_path' IS NOT NULL) THEN
    RAISE EXCEPTION 'New image paths cannot be repeated' USING ERRCODE = '22023';
  END IF;

  FOR v_image IN SELECT * FROM jsonb_array_elements(p_images) LOOP
    IF v_image->>'storage_path' IS NULL THEN
      IF v_image->>'id' IS NULL THEN
        RAISE EXCEPTION 'New photos require uploaded image data' USING ERRCODE = '22023';
      END IF;
    ELSE
      IF v_image->>'storage_path' !~ ('^' || auth.uid()::text || '/' || p_post_id::text || '/edit-[a-zA-Z0-9-]+\.jpg$')
        OR COALESCE((v_image->>'width')::integer, 0) <= 0
        OR COALESCE((v_image->>'height')::integer, 0) <= 0
        OR EXISTS (SELECT 1 FROM public.post_images WHERE storage_path = v_image->>'storage_path' OR thumbnail_path = v_image->>'storage_path')
        OR NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'post-images' AND name = v_image->>'storage_path') THEN
        RAISE EXCEPTION 'Use a fresh uploaded photo belonging to this post' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  SELECT COALESCE(array_agg(DISTINCT path) FILTER (WHERE path IS NOT NULL), ARRAY[]::text[])
    INTO v_deleted_paths
  FROM public.post_images image
  CROSS JOIN LATERAL unnest(ARRAY[image.storage_path, image.thumbnail_path]) path
  WHERE image.post_id = p_post_id AND (
    NOT (image.id = ANY(v_ids)) OR EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_images) submitted
      WHERE (submitted->>'id')::uuid = image.id AND submitted->>'storage_path' IS NOT NULL
    )
  );
  SET CONSTRAINTS public.unique_image_position DEFERRED;
  DELETE FROM public.post_images WHERE post_id = p_post_id AND NOT (id = ANY(v_ids));
  FOR v_image, v_position IN SELECT value, (ordinality - 1)::integer FROM jsonb_array_elements(p_images) WITH ORDINALITY LOOP
    IF v_image->>'id' IS NOT NULL THEN
      UPDATE public.post_images SET
        position = v_position,
        storage_path = COALESCE(v_image->>'storage_path', storage_path),
        thumbnail_path = CASE WHEN v_image->>'storage_path' IS NOT NULL THEN NULL ELSE thumbnail_path END,
        width = CASE WHEN v_image->>'storage_path' IS NOT NULL THEN (v_image->>'width')::integer ELSE width END,
        height = CASE WHEN v_image->>'storage_path' IS NOT NULL THEN (v_image->>'height')::integer ELSE height END,
        blurhash = CASE WHEN v_image->>'storage_path' IS NOT NULL THEN v_image->>'blurhash' ELSE blurhash END
      WHERE id = (v_image->>'id')::uuid AND post_id = p_post_id;
    ELSE
      INSERT INTO public.post_images (post_id, position, storage_path, width, height, blurhash)
      VALUES (p_post_id, v_position, v_image->>'storage_path', (v_image->>'width')::integer, (v_image->>'height')::integer, v_image->>'blurhash');
    END IF;
  END LOOP;
  UPDATE public.posts SET caption = v_caption, reflection = v_reflection,
    content_type = p_content_type, is_private = p_is_private, updated_at = now()
  WHERE id = p_post_id RETURNING updated_at INTO v_updated_at;
  -- Legacy data can share an object path. Never clean up an asset still used
  -- by a retained image or another post.
  SELECT COALESCE(array_agg(path), ARRAY[]::text[]) INTO v_deleted_paths
  FROM unnest(v_deleted_paths) discarded(path)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.post_images image
    WHERE image.storage_path = discarded.path OR image.thumbnail_path = discarded.path
  );
  RETURN jsonb_build_object('post_id', p_post_id, 'updated_at', v_updated_at, 'deleted_storage_paths', to_jsonb(v_deleted_paths));
END;
$$;
REVOKE ALL ON FUNCTION public.update_post_composition(uuid, text, text, public.post_content_type, boolean, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_post_composition(uuid, text, text, public.post_content_type, boolean, jsonb) TO authenticated;
