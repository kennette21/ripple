CREATE UNIQUE INDEX notifications_new_post_recipient_post_idx
ON public.notifications (recipient_id, post_id)
WHERE type = 'new_post';

CREATE OR REPLACE FUNCTION public.create_new_post_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.is_private OR NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id,
    actor_id,
    type,
    post_id
  )
  SELECT
    follow.follower_id,
    NEW.author_id,
    'new_post'::public.notification_type,
    NEW.id
  FROM public.follows follow
  LEFT JOIN public.notification_settings settings
    ON settings.user_id = follow.follower_id
  WHERE follow.following_id = NEW.author_id
    AND COALESCE(
      settings.new_post_mode,
      'all'::public.new_post_notification_mode
    ) <> 'off'::public.new_post_notification_mode
    AND (
      COALESCE(
        settings.new_post_mode,
        'all'::public.new_post_notification_mode
      ) = 'all'::public.new_post_notification_mode
      OR (
        settings.new_post_mode = 'selected'::public.new_post_notification_mode
        AND EXISTS (
          SELECT 1
          FROM public.post_notification_subscriptions subscription
          WHERE subscription.user_id = follow.follower_id
            AND subscription.author_id = NEW.author_id
        )
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.mutes mute
      WHERE mute.muter_id = follow.follower_id
        AND mute.muted_id = NEW.author_id
    )
  ON CONFLICT (recipient_id, post_id)
    WHERE type = 'new_post'
  DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL
ON FUNCTION public.create_new_post_notifications()
FROM PUBLIC;

DROP TRIGGER IF EXISTS create_new_post_notifications_after_insert
ON public.posts;

CREATE TRIGGER create_new_post_notifications_after_insert
AFTER INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.create_new_post_notifications();
