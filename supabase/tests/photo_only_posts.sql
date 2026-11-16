-- Run against the migrated local database with psql -v ON_ERROR_STOP=1.
-- All fixtures and edits are rolled back.
BEGIN;

DO $$
DECLARE
  v_author uuid;
  v_post uuid;
  v_reflection uuid;
  v_other_post uuid;
  v_image uuid;
  v_other_image uuid;
BEGIN
  SELECT id INTO STRICT v_author FROM public.profiles LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', v_author::text, true);

  INSERT INTO public.posts (author_id, content_type, caption)
    VALUES (v_author, 'caption', '') RETURNING id INTO v_post;
  INSERT INTO public.post_images (post_id, storage_path, position)
    VALUES (v_post, v_author || '/' || v_post || '/0.jpg', 0) RETURNING id INTO v_image;

  -- Caption removal and photo-only no-op saves both remain editable.
  PERFORM public.update_post(v_post, 'A caption', NULL, ARRAY[v_image]);
  PERFORM public.update_post(v_post, '  ', NULL, ARRAY[v_image]);
  PERFORM public.update_post(v_post, NULL, NULL, ARRAY[v_image]);
  IF (SELECT caption FROM public.posts WHERE id = v_post) IS DISTINCT FROM '' THEN
    RAISE EXCEPTION 'A photo-only post must retain its empty caption';
  END IF;

  BEGIN
    PERFORM public.update_post(v_post, '', NULL, ARRAY[]::uuid[]);
    RAISE EXCEPTION 'Removing the last photo without text should fail';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.post_images WHERE id = v_image) THEN
    RAISE EXCEPTION 'A rejected edit must retain its original image';
  END IF;

  INSERT INTO public.posts (author_id, content_type, caption)
    VALUES (v_author, 'caption', 'Another post') RETURNING id INTO v_other_post;
  INSERT INTO public.post_images (post_id, storage_path, position)
    VALUES (v_other_post, v_author || '/' || v_other_post || '/0.jpg', 0) RETURNING id INTO v_other_image;
  BEGIN
    PERFORM public.update_post(v_post, '', NULL, ARRAY[v_other_image]);
    RAISE EXCEPTION 'An image from another post should not authorize a photo-only edit';
  EXCEPTION WHEN invalid_parameter_value THEN NULL;
  END;

  INSERT INTO public.posts (author_id, content_type, reflection)
    VALUES (v_author, 'reflection', 'A reflection') RETURNING id INTO v_reflection;
  BEGIN
    PERFORM public.update_post(v_reflection, 'A title', '', ARRAY[]::uuid[]);
    RAISE EXCEPTION 'A reflection title cannot replace its body';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  -- Text is a valid replacement when the final image is removed.
  PERFORM public.update_post(v_post, 'Now text-only', NULL, ARRAY[]::uuid[]);
  IF EXISTS (SELECT 1 FROM public.post_images WHERE post_id = v_post) THEN
    RAISE EXCEPTION 'A text-only edit should remove the omitted image';
  END IF;
  RAISE NOTICE 'Photo-only post edit checks passed';
END;
$$;

ROLLBACK;
