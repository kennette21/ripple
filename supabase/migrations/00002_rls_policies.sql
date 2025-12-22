-- Ripple Database Schema
-- Migration: Row Level Security Policies

-- =============================================
-- ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.read_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_watermarks ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Check if user is blocked (bidirectional)
CREATE OR REPLACE FUNCTION is_blocked(viewer_id UUID, target_id UUID)
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.blocks
        WHERE (blocker_id = viewer_id AND blocked_id = target_id)
           OR (blocker_id = target_id AND blocked_id = viewer_id)
    );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get follower count (private)
CREATE OR REPLACE FUNCTION get_follower_count(profile_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.follows WHERE following_id = profile_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Get following count (private)
CREATE OR REPLACE FUNCTION get_following_count(profile_id UUID)
RETURNS INTEGER AS $$
    SELECT COUNT(*)::INTEGER FROM public.follows WHERE follower_id = profile_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- =============================================
-- PROFILES POLICIES
-- =============================================

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
    USING (NOT is_blocked(auth.uid(), id));

CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- =============================================
-- POSTS POLICIES
-- =============================================

CREATE POLICY "posts_select" ON public.posts FOR SELECT
    USING (
        NOT is_blocked(auth.uid(), author_id)
        AND NOT EXISTS (
            SELECT 1 FROM public.mutes
            WHERE muter_id = auth.uid() AND muted_id = author_id
        )
    );

CREATE POLICY "posts_insert" ON public.posts FOR INSERT
    WITH CHECK (auth.uid() = author_id);

CREATE POLICY "posts_delete" ON public.posts FOR DELETE
    USING (auth.uid() = author_id);

-- =============================================
-- POST_IMAGES POLICIES
-- =============================================

CREATE POLICY "post_images_select" ON public.post_images FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_images.post_id
        )
    );

CREATE POLICY "post_images_insert" ON public.post_images FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_images.post_id AND posts.author_id = auth.uid()
        )
    );

CREATE POLICY "post_images_delete" ON public.post_images FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.posts
            WHERE posts.id = post_images.post_id AND posts.author_id = auth.uid()
        )
    );

-- =============================================
-- FOLLOWS POLICIES
-- =============================================

CREATE POLICY "follows_select" ON public.follows FOR SELECT
    USING (
        follower_id = auth.uid()
        OR following_id = auth.uid()
        OR NOT is_blocked(auth.uid(), follower_id)
    );

CREATE POLICY "follows_insert" ON public.follows FOR INSERT
    WITH CHECK (
        auth.uid() = follower_id
        AND NOT is_blocked(auth.uid(), following_id)
    );

CREATE POLICY "follows_delete" ON public.follows FOR DELETE
    USING (auth.uid() = follower_id);

-- =============================================
-- BLOCKS POLICIES
-- =============================================

CREATE POLICY "blocks_select" ON public.blocks FOR SELECT
    USING (auth.uid() = blocker_id);

CREATE POLICY "blocks_insert" ON public.blocks FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "blocks_delete" ON public.blocks FOR DELETE
    USING (auth.uid() = blocker_id);

-- =============================================
-- MUTES POLICIES
-- =============================================

CREATE POLICY "mutes_select" ON public.mutes FOR SELECT
    USING (auth.uid() = muter_id);

CREATE POLICY "mutes_insert" ON public.mutes FOR INSERT
    WITH CHECK (auth.uid() = muter_id);

CREATE POLICY "mutes_delete" ON public.mutes FOR DELETE
    USING (auth.uid() = muter_id);

-- =============================================
-- COMMENTS POLICIES
-- =============================================

CREATE POLICY "comments_select" ON public.comments FOR SELECT
    USING (NOT is_blocked(auth.uid(), author_id));

CREATE POLICY "comments_insert" ON public.comments FOR INSERT
    WITH CHECK (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM public.posts WHERE posts.id = post_id
        )
    );

CREATE POLICY "comments_delete" ON public.comments FOR DELETE
    USING (auth.uid() = author_id);

-- =============================================
-- REPOSTS POLICIES
-- =============================================

CREATE POLICY "reposts_select" ON public.reposts FOR SELECT
    USING (NOT is_blocked(auth.uid(), reposter_id));

CREATE POLICY "reposts_insert" ON public.reposts FOR INSERT
    WITH CHECK (auth.uid() = reposter_id);

CREATE POLICY "reposts_delete" ON public.reposts FOR DELETE
    USING (auth.uid() = reposter_id);

-- =============================================
-- BOOKMARKS POLICIES (completely private)
-- =============================================

CREATE POLICY "bookmarks_select" ON public.bookmarks FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "bookmarks_insert" ON public.bookmarks FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bookmarks_delete" ON public.bookmarks FOR DELETE
    USING (auth.uid() = user_id);

-- =============================================
-- USAGE TRACKING POLICIES (private)
-- =============================================

CREATE POLICY "usage_sessions_all" ON public.usage_sessions
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_usage_select" ON public.daily_usage FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "weekly_summaries_select" ON public.weekly_summaries FOR SELECT
    USING (auth.uid() = user_id);

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT
    USING (auth.uid() = recipient_id);

CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE
    USING (auth.uid() = recipient_id);

-- =============================================
-- NOTIFICATION SETTINGS POLICIES
-- =============================================

CREATE POLICY "notification_settings_select" ON public.notification_settings FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "notification_settings_insert" ON public.notification_settings FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notification_settings_update" ON public.notification_settings FOR UPDATE
    USING (auth.uid() = user_id);

-- =============================================
-- PUSH TOKENS POLICIES
-- =============================================

CREATE POLICY "push_tokens_all" ON public.push_tokens
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================
-- READ RECEIPTS POLICIES
-- =============================================

CREATE POLICY "read_receipts_all" ON public.read_receipts
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- =============================================
-- FEED WATERMARKS POLICIES
-- =============================================

CREATE POLICY "feed_watermarks_all" ON public.feed_watermarks
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
