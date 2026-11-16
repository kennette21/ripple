-- Run against the migrated local database with psql -v ON_ERROR_STOP=1.
-- Fixtures, storage metadata, and edits are all rolled back.
BEGIN;
DO $$
<<edit_post_composition>>
DECLARE
  author_id uuid;
  other_author uuid;
  post_id uuid;
  other_post uuid;
  first_image uuid;
  second_image uuid;
  foreign_image uuid;
  replacement text;
  addition text;
  result jsonb;
  album jsonb;
BEGIN
  SELECT id INTO STRICT author_id FROM public.profiles ORDER BY id LIMIT 1;
  SELECT id INTO STRICT other_author FROM public.profiles WHERE id <> author_id LIMIT 1;
  PERFORM set_config('request.jwt.claim.sub', author_id::text, true);
  INSERT INTO public.posts (author_id, content_type, caption)
    VALUES (author_id, 'caption', 'Original') RETURNING id INTO post_id;
  INSERT INTO public.posts (author_id, content_type, caption)
    VALUES (other_author, 'caption', 'Other') RETURNING id INTO other_post;
  INSERT INTO public.post_images (post_id, position, storage_path, thumbnail_path, width, height)
    VALUES (post_id, 0, author_id || '/' || post_id || '/0.jpg', author_id || '/' || post_id || '/thumb.jpg', 1200, 800)
    RETURNING id INTO first_image;
  INSERT INTO public.post_images (post_id, position, storage_path, width, height)
    VALUES (post_id, 1, author_id || '/' || post_id || '/1.jpg', 800, 1200) RETURNING id INTO second_image;
  INSERT INTO public.post_images (post_id, position, storage_path)
    VALUES (other_post, 0, other_author || '/' || other_post || '/0.jpg') RETURNING id INTO foreign_image;
  replacement := author_id || '/' || post_id || '/edit-test-replacement.jpg';
  addition := author_id || '/' || post_id || '/edit-test-addition.jpg';
  INSERT INTO storage.objects (bucket_id, name) VALUES ('post-images', replacement), ('post-images', addition);

  -- A reorder changes positions without requiring a re-upload or losing metadata.
  result := public.update_post_composition(post_id, 'Edited', '', 'caption', false,
    jsonb_build_array(jsonb_build_object('id', second_image), jsonb_build_object('id', first_image)));
  IF jsonb_array_length(result->'deleted_storage_paths') <> 0
    OR (SELECT position FROM public.post_images WHERE id = second_image) <> 0 THEN
    RAISE EXCEPTION 'Reorder must retain objects and update their positions';
  END IF;

  -- Upload replacements and additions, preserving the replaced image's identity.
  album := jsonb_build_array(
    jsonb_build_object('id', first_image, 'storage_path', replacement, 'width', 600, 'height', 600),
    jsonb_build_object('storage_path', addition, 'width', 900, 'height', 600));
  result := public.update_post_composition(post_id, '  ', '', 'caption', true, album);
  IF jsonb_array_length(result->'deleted_storage_paths') <> 3
    OR (SELECT storage_path FROM public.post_images WHERE id = first_image) <> replacement
    OR (SELECT width FROM public.post_images WHERE id = first_image) <> 600
    OR (SELECT thumbnail_path FROM public.post_images WHERE id = first_image) IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.post_images WHERE id = second_image)
    OR (SELECT count(*) FROM public.post_images image WHERE image.post_id = edit_post_composition.post_id) <> 2 THEN
    RAISE EXCEPTION 'Replacement, addition, removal, and cleanup must be atomic';
  END IF;
  IF NOT (SELECT is_private AND caption = '' FROM public.posts WHERE id = post_id) THEN
    RAISE EXCEPTION 'Audience and photo-only content must save together';
  END IF;

  BEGIN
    PERFORM public.update_post_composition(post_id, '', '', 'caption', false, '[]');
    RAISE EXCEPTION 'Empty post should fail';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Title', '', 'reflection', false, '[]');
    RAISE EXCEPTION 'Empty reflection should fail';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false, jsonb_build_array(jsonb_build_object('id', foreign_image)));
    RAISE EXCEPTION 'Foreign image should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false,
      jsonb_build_array(jsonb_build_object('id', first_image), jsonb_build_object('id', first_image)));
    RAISE EXCEPTION 'Duplicate image should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false,
      jsonb_build_array(jsonb_build_object('storage_path', replacement, 'width', 600, 'height', 600)));
    RAISE EXCEPTION 'Reusing a published object should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false,
      jsonb_build_array(jsonb_build_object('storage_path', author_id || '/' || post_id || '/edit-missing.jpg', 'width', 600, 'height', 600)));
    RAISE EXCEPTION 'Missing upload should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false,
      jsonb_build_array(jsonb_build_object('storage_path', other_author || '/' || other_post || '/edit-foreign.jpg', 'width', 600, 'height', 600)));
    RAISE EXCEPTION 'Foreign object should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Invalid', '', 'caption', false,
      (SELECT jsonb_agg(jsonb_build_object('id', first_image)) FROM generate_series(1, 11)));
    RAISE EXCEPTION 'Oversized album should fail';
  EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
  IF (SELECT caption FROM public.posts WHERE id = post_id) <> ''
    OR (SELECT storage_path FROM public.post_images WHERE id = first_image) <> replacement THEN
    RAISE EXCEPTION 'Rejected edits must preserve the saved post';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', other_author::text, true);
  BEGIN
    PERFORM public.update_post_composition(post_id, 'Hijacked', '', 'caption', false, '[]');
    RAISE EXCEPTION 'Another author should not be able to edit';
  EXCEPTION WHEN no_data_found THEN NULL; END;
  PERFORM set_config('request.jwt.claim.sub', author_id::text, true);
  INSERT INTO public.post_images (post_id, position, storage_path)
    VALUES (other_post, 1, replacement);
  result := public.update_post_composition(post_id, 'Title', 'Reflection body', 'reflection', false, '[]');
  IF (result->'deleted_storage_paths') ? replacement THEN
    RAISE EXCEPTION 'Objects still used by another post must not be cleaned up';
  END IF;
  IF NOT (SELECT content_type = 'reflection' AND reflection = 'Reflection body' AND NOT is_private FROM public.posts WHERE id = post_id) THEN
    RAISE EXCEPTION 'Mode changes must save the matching body and audience';
  END IF;
  IF has_function_privilege('anon', 'public.update_post_composition(uuid,text,text,public.post_content_type,boolean,jsonb)', 'execute') THEN
    RAISE EXCEPTION 'Anonymous callers must not be granted execution';
  END IF;
  RAISE NOTICE 'Post composition checks passed';
END;
$$ LANGUAGE plpgsql;
ROLLBACK;
