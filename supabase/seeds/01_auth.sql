-- Local-only Auth fixtures. These IDs and credentials are intentionally stable
-- so application seed rows can reference real, confirmed GoTrue users.

with seed_users (id, email, display_name) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, 'marcus.aurelius@gmail.com', 'Marcus Aurelius'),
    ('00000000-0000-4000-8000-000000000002'::uuid, 'julius.caesar@gmail.com', 'Julius Caesar'),
    ('00000000-0000-4000-8000-000000000003'::uuid, 'augustus@gmail.com', 'Augustus'),
    ('00000000-0000-4000-8000-000000000004'::uuid, 'cicero@gmail.com', 'Cicero'),
    ('00000000-0000-4000-8000-000000000005'::uuid, 'seneca@gmail.com', 'Seneca')
)
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  is_sso_user,
  is_anonymous
)
select
  '00000000-0000-0000-0000-000000000000'::uuid,
  id,
  'authenticated',
  'authenticated',
  email,
  extensions.crypt('12345678', extensions.gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'display_name', display_name,
    'local_fixture', true,
    'email_verified', true
  ),
  now(),
  now(),
  false,
  false
from seed_users;

with seed_users (id, identity_id, email) as (
  values
    ('00000000-0000-4000-8000-000000000001'::uuid, '00000000-0000-4000-9000-000000000001'::uuid, 'marcus.aurelius@gmail.com'),
    ('00000000-0000-4000-8000-000000000002'::uuid, '00000000-0000-4000-9000-000000000002'::uuid, 'julius.caesar@gmail.com'),
    ('00000000-0000-4000-8000-000000000003'::uuid, '00000000-0000-4000-9000-000000000003'::uuid, 'augustus@gmail.com'),
    ('00000000-0000-4000-8000-000000000004'::uuid, '00000000-0000-4000-9000-000000000004'::uuid, 'cicero@gmail.com'),
    ('00000000-0000-4000-8000-000000000005'::uuid, '00000000-0000-4000-9000-000000000005'::uuid, 'seneca@gmail.com')
)
insert into auth.identities (
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at,
  id
)
select
  id::text,
  id,
  jsonb_build_object(
    'sub', id::text,
    'email', email,
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  now(),
  now(),
  now(),
  identity_id
from seed_users;
