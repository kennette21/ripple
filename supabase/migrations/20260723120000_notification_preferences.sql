-- Add user-facing push notification preferences, per-author subscriptions,
-- and authenticated device registration.

CREATE TYPE public.new_post_notification_mode AS ENUM (
  'all',
  'selected',
  'off'
);

ALTER TABLE public.notification_settings
DROP COLUMN push_enabled,
DROP COLUMN batch_notifications,
DROP COLUMN batch_interval_minutes,
DROP COLUMN repost_notifications,
DROP COLUMN dnd_enabled,
DROP COLUMN dnd_start_time,
DROP COLUMN dnd_end_time,
ADD COLUMN new_post_mode public.new_post_notification_mode NOT NULL DEFAULT 'all';

CREATE TRIGGER notification_settings_updated_at
BEFORE UPDATE ON public.notification_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.post_notification_subscriptions (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, author_id),
  CONSTRAINT post_notification_subscriptions_no_self
    CHECK (user_id <> author_id)
);

ALTER TABLE public.post_notification_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own post notification subscriptions"
ON public.post_notification_subscriptions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can add followed post notification subscriptions"
ON public.post_notification_subscriptions
FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.follows
    WHERE follower_id = auth.uid()
      AND following_id = author_id
  )
);

CREATE POLICY "Users can remove own post notification subscriptions"
ON public.post_notification_subscriptions
FOR DELETE
USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE
ON public.post_notification_subscriptions
TO authenticated;

GRANT ALL
ON public.post_notification_subscriptions
TO service_role;

CREATE OR REPLACE FUNCTION public.remove_post_notification_subscription_on_unfollow()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.post_notification_subscriptions
  WHERE user_id = OLD.follower_id
    AND author_id = OLD.following_id;

  RETURN OLD;
END;
$$;

REVOKE ALL
ON FUNCTION public.remove_post_notification_subscription_on_unfollow()
FROM PUBLIC;

CREATE TRIGGER remove_post_notification_subscription_after_unfollow
AFTER DELETE ON public.follows
FOR EACH ROW
EXECUTE FUNCTION public.remove_post_notification_subscription_on_unfollow();

CREATE OR REPLACE FUNCTION public.set_new_post_notification_mode(
  p_mode public.new_post_notification_mode
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_previous_mode public.new_post_notification_mode;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT new_post_mode
  INTO v_previous_mode
  FROM public.notification_settings
  WHERE user_id = v_user_id;

  INSERT INTO public.notification_settings (user_id, new_post_mode)
  VALUES (v_user_id, p_mode)
  ON CONFLICT (user_id) DO UPDATE
  SET new_post_mode = EXCLUDED.new_post_mode;

  -- The first move from Everyone to Choose people preserves the current
  -- notification audience. From there, the user can narrow it deliberately.
  IF p_mode = 'selected'
     AND COALESCE(v_previous_mode, 'all') = 'all'
     AND NOT EXISTS (
       SELECT 1
       FROM public.post_notification_subscriptions
       WHERE user_id = v_user_id
     )
  THEN
    INSERT INTO public.post_notification_subscriptions (user_id, author_id)
    SELECT v_user_id, following_id
    FROM public.follows
    WHERE follower_id = v_user_id
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_new_post_notification_mode(
  public.new_post_notification_mode
)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_new_post_notification_mode(
  public.new_post_notification_mode
)
TO authenticated;

CREATE OR REPLACE FUNCTION public.set_post_notification_subscription(
  p_author_id uuid,
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_enabled THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.follows
      WHERE follower_id = v_user_id
        AND following_id = p_author_id
    ) THEN
      RAISE EXCEPTION 'Post notifications require an active follow';
    END IF;

    INSERT INTO public.post_notification_subscriptions (user_id, author_id)
    VALUES (v_user_id, p_author_id)
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.post_notification_subscriptions
    WHERE user_id = v_user_id
      AND author_id = p_author_id;
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_post_notification_subscription(uuid, boolean)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_post_notification_subscription(uuid, boolean)
TO authenticated;

CREATE OR REPLACE FUNCTION public.set_all_post_notification_subscriptions(
  p_enabled boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_enabled THEN
    INSERT INTO public.post_notification_subscriptions (user_id, author_id)
    SELECT v_user_id, following_id
    FROM public.follows
    WHERE follower_id = v_user_id
    ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.post_notification_subscriptions
    WHERE user_id = v_user_id;
  END IF;
END;
$$;

REVOKE ALL
ON FUNCTION public.set_all_post_notification_subscriptions(boolean)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.set_all_post_notification_subscriptions(boolean)
TO authenticated;

CREATE TABLE public.push_devices (
  expo_push_token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('android', 'ios')),
  permission_status text NOT NULL
    CHECK (permission_status IN ('granted', 'provisional')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX push_devices_user_id_idx
ON public.push_devices (user_id);

CREATE TRIGGER push_devices_updated_at
BEFORE UPDATE ON public.push_devices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.push_devices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own push devices"
ON public.push_devices
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can remove own push devices"
ON public.push_devices
FOR DELETE
USING (user_id = auth.uid());

REVOKE ALL ON public.push_devices FROM anon;
REVOKE ALL ON public.push_devices FROM authenticated;
GRANT SELECT, DELETE ON public.push_devices TO authenticated;
GRANT ALL ON public.push_devices TO service_role;

CREATE OR REPLACE FUNCTION public.register_push_device(
  p_expo_push_token text,
  p_platform text,
  p_permission_status text,
  p_previous_expo_push_token text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_platform NOT IN ('android', 'ios') THEN
    RAISE EXCEPTION 'Unsupported push platform';
  END IF;

  IF p_permission_status NOT IN ('granted', 'provisional') THEN
    RAISE EXCEPTION 'Push permission is not active';
  END IF;

  IF p_previous_expo_push_token IS NOT NULL
     AND p_previous_expo_push_token <> p_expo_push_token
  THEN
    DELETE FROM public.push_devices
    WHERE expo_push_token = p_previous_expo_push_token
      AND user_id = v_user_id;
  END IF;

  INSERT INTO public.push_devices (
    expo_push_token,
    user_id,
    platform,
    permission_status
  )
  VALUES (
    p_expo_push_token,
    v_user_id,
    p_platform,
    p_permission_status
  )
  ON CONFLICT (expo_push_token) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    platform = EXCLUDED.platform,
    permission_status = EXCLUDED.permission_status,
    last_registered_at = now();
END;
$$;

REVOKE ALL
ON FUNCTION public.register_push_device(text, text, text, text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.register_push_device(text, text, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.unregister_push_device(
  p_expo_push_token text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM public.push_devices
  WHERE expo_push_token = p_expo_push_token
    AND user_id = auth.uid();
END;
$$;

REVOKE ALL
ON FUNCTION public.unregister_push_device(text)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.unregister_push_device(text)
TO authenticated;
