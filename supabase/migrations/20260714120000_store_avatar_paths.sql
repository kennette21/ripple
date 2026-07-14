-- Store Supabase avatar object paths instead of environment-specific public URLs.
-- The column keeps its existing name for backwards compatibility.
-- e.g.
-- "avatar_url" : "https://blah.supabase.co/storage/v1/object/public/avatars/99999999-9999-9999-9999-999999999999/avatar.jpg"
-- becomes
-- "avatar_url" : "99999999-9999-9999-9999-999999999999/avatar.jpg"

update public.profiles
set avatar_url = regexp_replace(
  avatar_url,
  '^.*/storage/v1/object/public/avatars/',
  ''
)
where avatar_url like '%/storage/v1/object/public/avatars/%';
