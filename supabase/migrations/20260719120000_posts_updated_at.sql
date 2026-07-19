-- Keep content edits separate from creation time so feed ordering stays stable.
ALTER TABLE public.posts
  ADD COLUMN updated_at timestamp with time zone;

CREATE OR REPLACE FUNCTION public.set_post_updated_at() RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF ROW(NEW.caption, NEW.reflection, NEW.content_type)
    IS DISTINCT FROM ROW(OLD.caption, OLD.reflection, OLD.content_type) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER posts_updated_at
  BEFORE UPDATE OF caption, reflection, content_type ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.set_post_updated_at();
