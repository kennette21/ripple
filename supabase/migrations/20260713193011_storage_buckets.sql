-- Storage buckets (mirrors production as of 2026-07-13).
-- Bucket rows are data, not schema, so `supabase db pull` doesn't capture
-- them; they are maintained by hand here. The storage.objects policies are
-- in the baseline migration.

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('post-images', 'post-images', true)
ON CONFLICT (id) DO NOTHING;
