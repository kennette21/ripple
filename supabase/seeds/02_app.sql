-- Profiles are inserted first because the remaining fixtures reference them.
-- The on_profile_create trigger also creates notification settings and feed
-- watermarks, which are customized below.

insert into public.profiles (
  id,
  username,
  display_name,
  bio,
  avatar_url,
  daily_usage_goal_minutes,
  onboarding_completed,
  phone_number
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'admin',
    'Ripple Dev',
    'The primary local development account.',
    'avatar.png',
    30,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'maya',
    'Maya Chen',
    'Designer, reader, and enthusiastic walker.',
    'avatar.png',
    20,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'alex',
    'Alex Rivera',
    'Trying to spend more time making things.',
    'avatar.png',
    45,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'jordan',
    'Jordan Kim',
    'Coffee, cameras, and long train rides.',
    'avatar.png',
    25,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'sam',
    'Sam Okafor',
    'Finding a little more quiet in every day.',
    'avatar.png',
    15,
    true,
    null
  );

update public.notification_settings
set batch_interval_minutes = 30
where user_id = '00000000-0000-4000-8000-000000000001';

update public.notification_settings
set
  dnd_enabled = true,
  dnd_start_time = '22:00:00',
  dnd_end_time = '07:00:00'
where user_id = '00000000-0000-4000-8000-000000000005';

update public.feed_watermarks
set
  last_seen_at = now() - interval '2 hours',
  updated_at = now() - interval '1 hour'
where user_id = '00000000-0000-4000-8000-000000000001';

insert into public.posts (
  id,
  author_id,
  content_type,
  caption,
  reflection,
  created_at,
  is_private
)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'both',
    'Welcome to the local Ripple',
    'This account is a normal authenticated user, so local development exercises the same sessions, profile loading, and row-level security as production.',
    now() - interval '1 hour',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000002',
    'caption',
    'A slow morning and a very good cup of coffee.',
    null,
    now() - interval '3 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000003',
    'reflection',
    null,
    'I left my phone at home for the walk today. It felt strange for five minutes and completely normal after ten.',
    now() - interval '7 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000004',
    'both',
    'Somewhere between here and there',
    'Train windows turn an ordinary afternoon into a sequence of small landscapes.',
    now() - interval '11 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000005',
    'caption',
    'Today was quieter than yesterday. I needed that.',
    null,
    now() - interval '20 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000001',
    'reflection',
    'Private reflection fixture',
    'This private post is useful for checking the owner-only presentation in the feed.',
    now() - interval '28 hours',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000002',
    'caption',
    'Finished a book without checking notifications between chapters.',
    null,
    now() - interval '34 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000003',
    'both',
    'Made something small today',
    'Small counts. Finished counts even more.',
    now() - interval '48 hours',
    false
  );

insert into public.post_images (
  id,
  post_id,
  storage_path,
  width,
  height,
  position,
  created_at
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'post.png',
    296,
    640,
    0,
    now() - interval '1 hour'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'post.png',
    296,
    640,
    0,
    now() - interval '3 hours'
  ),
  (
    '20000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000004',
    'post.png',
    296,
    640,
    0,
    now() - interval '11 hours'
  ),
  (
    '20000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000008',
    'post.png',
    296,
    640,
    0,
    now() - interval '48 hours'
  );

insert into public.follows (id, follower_id, following_id, created_at)
values
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '72 hours'),
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', now() - interval '69 hours'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000004', now() - interval '66 hours'),
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', now() - interval '63 hours'),
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', now() - interval '60 hours'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', now() - interval '57 hours'),
  ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', now() - interval '54 hours'),
  ('30000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', now() - interval '51 hours'),
  ('30000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', now() - interval '48 hours');

insert into public.notifications (
  id,
  recipient_id,
  actor_id,
  type,
  post_id,
  read,
  created_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    'mention',
    '10000000-0000-4000-8000-000000000002',
    false,
    now() - interval '2 hours'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'repost',
    '10000000-0000-4000-8000-000000000001',
    true,
    now() - interval '8 hours'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'mention',
    '10000000-0000-4000-8000-000000000001',
    false,
    now() - interval '1 hour'
  );
