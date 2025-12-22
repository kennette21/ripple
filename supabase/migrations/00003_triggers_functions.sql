-- Ripple Database Schema
-- Migration: Triggers and Helper Functions

-- =============================================
-- NOTIFICATION TRIGGERS
-- =============================================

-- Create notification on various events
CREATE OR REPLACE FUNCTION create_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Comment notification
    IF TG_TABLE_NAME = 'comments' THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id, comment_id)
        SELECT
            p.author_id,
            NEW.author_id,
            CASE WHEN NEW.parent_id IS NOT NULL THEN 'comment_reply'::notification_type ELSE 'comment'::notification_type END,
            NEW.post_id,
            NEW.id
        FROM public.posts p
        WHERE p.id = NEW.post_id
          AND p.author_id != NEW.author_id;

    -- Follow notification
    ELSIF TG_TABLE_NAME = 'follows' THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type)
        VALUES (NEW.following_id, NEW.follower_id, 'follow');

    -- Repost notification
    ELSIF TG_TABLE_NAME = 'reposts' THEN
        INSERT INTO public.notifications (recipient_id, actor_id, type, post_id)
        SELECT
            p.author_id,
            NEW.reposter_id,
            'repost',
            NEW.original_post_id
        FROM public.posts p
        WHERE p.id = NEW.original_post_id
          AND p.author_id != NEW.reposter_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_create
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION create_notification();

CREATE TRIGGER on_follow_create
    AFTER INSERT ON public.follows
    FOR EACH ROW EXECUTE FUNCTION create_notification();

CREATE TRIGGER on_repost_create
    AFTER INSERT ON public.reposts
    FOR EACH ROW EXECUTE FUNCTION create_notification();

-- =============================================
-- PROFILE INITIALIZATION
-- =============================================

-- Initialize related tables when profile is created
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
    -- Create notification settings with healthy defaults
    INSERT INTO public.notification_settings (user_id)
    VALUES (NEW.id);

    -- Create feed watermark
    INSERT INTO public.feed_watermarks (user_id)
    VALUES (NEW.id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_create
    AFTER INSERT ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- =============================================
-- FEED HELPER FUNCTIONS
-- =============================================

-- Get unseen posts count for "X new posts" banner
CREATE OR REPLACE FUNCTION get_unseen_posts_count(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    last_seen TIMESTAMPTZ;
BEGIN
    SELECT last_seen_at INTO last_seen
    FROM public.feed_watermarks
    WHERE user_id = p_user_id;

    IF last_seen IS NULL THEN
        RETURN 0;
    END IF;

    RETURN (
        SELECT COUNT(*)::INTEGER
        FROM public.posts p
        JOIN public.follows f ON f.following_id = p.author_id
        WHERE f.follower_id = p_user_id
          AND p.created_at > last_seen
          AND NOT is_blocked(p_user_id, p.author_id)
          AND NOT EXISTS (
              SELECT 1 FROM public.mutes m
              WHERE m.muter_id = p_user_id AND m.muted_id = p.author_id
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update feed watermark (mark all posts as seen)
CREATE OR REPLACE FUNCTION update_feed_watermark(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.feed_watermarks (user_id, last_seen_at, updated_at)
    VALUES (p_user_id, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
        last_seen_at = NOW(),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- USAGE TRACKING FUNCTIONS
-- =============================================

-- Increment daily usage stats
CREATE OR REPLACE FUNCTION increment_daily_usage(
    p_user_id UUID,
    p_date DATE,
    p_seconds INTEGER DEFAULT 0,
    p_posts INTEGER DEFAULT 0,
    p_comments INTEGER DEFAULT 0,
    p_reposts INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.daily_usage (user_id, date, total_seconds, posts_created, comments_made, reposts_made)
    VALUES (p_user_id, p_date, p_seconds, p_posts, p_comments, p_reposts)
    ON CONFLICT (user_id, date) DO UPDATE SET
        total_seconds = daily_usage.total_seconds + EXCLUDED.total_seconds,
        posts_created = daily_usage.posts_created + EXCLUDED.posts_created,
        comments_made = daily_usage.comments_made + EXCLUDED.comments_made,
        reposts_made = daily_usage.reposts_made + EXCLUDED.reposts_made;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to track post creation in daily usage
CREATE OR REPLACE FUNCTION track_post_creation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_daily_usage(NEW.author_id, CURRENT_DATE, 0, 1, 0, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_post_create_usage
    AFTER INSERT ON public.posts
    FOR EACH ROW EXECUTE FUNCTION track_post_creation();

-- Trigger to track comment creation in daily usage
CREATE OR REPLACE FUNCTION track_comment_creation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_daily_usage(NEW.author_id, CURRENT_DATE, 0, 0, 1, 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_comment_create_usage
    AFTER INSERT ON public.comments
    FOR EACH ROW EXECUTE FUNCTION track_comment_creation();

-- Trigger to track repost creation in daily usage
CREATE OR REPLACE FUNCTION track_repost_creation()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM increment_daily_usage(NEW.reposter_id, CURRENT_DATE, 0, 0, 0, 1);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_repost_create_usage
    AFTER INSERT ON public.reposts
    FOR EACH ROW EXECUTE FUNCTION track_repost_creation();

-- =============================================
-- CLEANUP: Auto-remove follow when blocked
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_on_block()
RETURNS TRIGGER AS $$
BEGIN
    -- Remove any follows between blocker and blocked
    DELETE FROM public.follows
    WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
       OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_block_cleanup
    AFTER INSERT ON public.blocks
    FOR EACH ROW EXECUTE FUNCTION cleanup_on_block();
