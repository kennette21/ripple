-- Profiles are inserted first because the remaining fixtures reference them.
-- The on_profile_create trigger also creates notification settings and feed
-- watermarks for every seeded user.

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
    'marcus_aurelius',
    'Marcus Aurelius',
    'Taking the scenic route whenever possible.',
    'avatar-01.png',
    30,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'julius_caesar',
    'Julius Caesar',
    'Making things and sharing the good bits.',
    'avatar-02.png',
    30,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000003',
    'augustus',
    'Augustus',
    'Coffee, music, and long conversations.',
    'avatar-03.png',
    30,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'cicero',
    'Cicero',
    'Usually outside or planning the next trip.',
    'avatar-04.png',
    30,
    true,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'seneca',
    'Seneca',
    'Collecting small moments worth remembering.',
    'avatar-05.png',
    30,
    true,
    null
  );

-- Each user has one public post and one private reflection.
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
    'The blur makes this feel like a memory in motion.',
    'I keep seeing a different expression every time I look at it.',
    now() - interval '5 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000001',
    'reflection',
    null,
    'A private note from Marcus Aurelius about slowing down and leaving more room in the day.',
    now() - interval '15 hours',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000002',
    'caption',
    'A tiny ship against all of that weather.',
    null,
    now() - interval '4 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000002',
    'reflection',
    null,
    'A private note from Julius Caesar about what to make next.',
    now() - interval '16 hours',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    '00000000-0000-4000-8000-000000000003',
    'both',
    'Every glance finds a different path through this.',
    'The quieter palette somehow makes all of that movement feel even louder.',
    now() - interval '3 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    '00000000-0000-4000-8000-000000000003',
    'reflection',
    null,
    'A private note from Augustus about making more time for music.',
    now() - interval '17 hours',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000007',
    '00000000-0000-4000-8000-000000000004',
    'caption',
    'Two completely different kinds of graphic energy.',
    null,
    now() - interval '2 hours',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000008',
    '00000000-0000-4000-8000-000000000004',
    'reflection',
    null,
    'A private note from Cicero about the next place he wants to explore.',
    now() - interval '18 hours',
    true
  ),
  (
    '10000000-0000-4000-8000-000000000009',
    '00000000-0000-4000-8000-000000000005',
    'both',
    'The light makes the whole scene feel immediate.',
    'It is difficult to look away from the tension between every figure.',
    now() - interval '1 hour',
    false
  ),
  (
    '10000000-0000-4000-8000-000000000010',
    '00000000-0000-4000-8000-000000000005',
    'reflection',
    null,
    'A private note from Seneca about holding onto a calm weekend feeling.',
    now() - interval '19 hours',
    true
  );

-- Give every public post unique artwork so seeded feeds are easy to distinguish.
-- Cicero's post has two images to exercise multi-image rendering.
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
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'frau-die-treppe.jpg', 843, 1315, 0, now() - interval '5 hours'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', 'ship-at-sea.jpeg', 1920, 1080, 0, now() - interval '4 hours'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', 'number-23.jpg', 1536, 1126, 0, now() - interval '3 hours'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000007', 'brushstroke-with-spatter.jpg', 843, 711, 0, now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000007', 'alkaseltzer.jpg', 843, 1118, 1, now() - interval '2 hours'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000009', 'dramatic-scene.jpg', 2000, 1479, 0, now() - interval '1 hour');

-- A user's outgoing follows are the people in that user's pond.
insert into public.follows (id, follower_id, following_id, created_at)
values
  -- Seneca -> Julius Caesar
  ('30000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', now() - interval '5 days'),
  -- Cicero -> Julius Caesar, Augustus
  ('30000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000002', now() - interval '5 days'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000003', now() - interval '5 days'),
  -- Marcus Aurelius -> Julius Caesar
  ('30000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', now() - interval '5 days'),
  -- Augustus -> Marcus Aurelius, Cicero
  ('30000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', now() - interval '5 days'),
  ('30000000-0000-4000-8000-000000000006', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', now() - interval '5 days'),
  -- Julius Caesar -> Seneca, Cicero, Augustus
  -- The recent Seneca follow joins the notification expansion showcase below.
  ('30000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000005', now() - interval '33 minutes'),
  ('30000000-0000-4000-8000-000000000008', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000004', now() - interval '5 days'),
  ('30000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003', now() - interval '5 days');

-- Each pond relationship also has a comment on the followed user's public post.
insert into public.comments (
  id,
  post_id,
  author_id,
  parent_id,
  content,
  depth,
  created_at
)
values
  ('50000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', null, 'That sea looks almost alive.', 0, now() - interval '3 hours 45 minutes'),
  ('50000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004', null, 'The scale of the storm is incredible.', 0, now() - interval '3 hours 30 minutes'),
  ('50000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000004', null, 'I keep finding new details in this.', 0, now() - interval '2 hours 45 minutes'),
  ('50000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000001', null, 'I love that tiny orange flag against the blue.', 0, now() - interval '3 hours 15 minutes'),
  ('50000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000003', null, 'The sense of motion is so good.', 0, now() - interval '4 hours 30 minutes'),
  ('50000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000003', null, 'These make a great pairing.', 0, now() - interval '1 hour 45 minutes'),
  ('50000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000002', null, 'The dramatic light is unreal.', 0, now() - interval '45 minutes'),
  ('50000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000007', '00000000-0000-4000-8000-000000000002', null, 'The second one is wonderfully strange.', 0, now() - interval '1 hour 30 minutes'),
  ('50000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000002', null, 'This works so well in black and white.', 0, now() - interval '2 hours 30 minutes');

-- A richer set of local-only interactions makes Seneca's notification inbox
-- demonstrate grouped stories, multiple actors, and seen versus unseen state.
insert into public.follows (id, follower_id, following_id, created_at)
values
  ('30000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000005', now() - interval '26 minutes'),
  ('30000000-0000-4000-8000-000000000011', '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000005', now() - interval '18 minutes'),
  ('30000000-0000-4000-8000-000000000012', '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005', now() - interval '9 minutes');

insert into public.comments (
  id,
  post_id,
  author_id,
  parent_id,
  content,
  depth,
  created_at
)
values
  -- More activity on Seneca's post becomes one calm, multi-actor story.
  ('50000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000003', null, 'The figures feel like they are about to step out of the frame.', 0, now() - interval '37 minutes'),
  ('50000000-0000-4000-8000-000000000011', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000004', null, 'That diagonal light holds the entire scene together.', 0, now() - interval '23 minutes'),
  ('50000000-0000-4000-8000-000000000012', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000001', null, 'I came back for another look and noticed a completely different story.', 0, now() - interval '7 minutes'),
  -- Replies to Seneca's comment on Julius Caesar's post become a thread story.
  ('50000000-0000-4000-8000-000000000013', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 'Exactly. The little ship makes the whole storm feel enormous.', 1, now() - interval '3 hours'),
  ('50000000-0000-4000-8000-000000000014', '10000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 'And somehow hopeful, despite all of that weather.', 1, now() - interval '2 hours 20 minutes');

insert into public.reposts (
  id,
  original_post_id,
  reposter_id,
  commentary,
  created_at
)
values
  ('60000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000003', 'The light in this one stays with you.', now() - interval '31 minutes'),
  ('60000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000009', '00000000-0000-4000-8000-000000000004', null, now() - interval '15 minutes');

-- Notification triggers run at seed time, so align generated notification
-- timestamps with the interactions that caused them.
update public.notifications notification
set created_at = comment.created_at
from public.comments comment
where notification.comment_id = comment.id;

update public.notifications notification
set created_at = follow.created_at
from public.follows follow
where notification.type = 'follow'
  and notification.actor_id = follow.follower_id
  and notification.recipient_id = follow.following_id;

update public.notifications notification
set created_at = repost.created_at
from public.reposts repost
where notification.type = 'repost'
  and notification.post_id = repost.original_post_id
  and notification.actor_id = repost.reposter_id;

-- Older stories have already been observed; recent stories remain new.
update public.notifications
set
  read = true,
  seen_at = created_at
where recipient_id = '00000000-0000-4000-8000-000000000005'
  and created_at < now() - interval '90 minutes';
