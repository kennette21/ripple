-- Ripple Database Schema
-- Migration: Initial Schema

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- =============================================
-- PROFILES TABLE
-- =============================================

CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT,
    avatar_url TEXT,
    daily_usage_goal_minutes INTEGER DEFAULT 30
        CHECK (daily_usage_goal_minutes >= 5 AND daily_usage_goal_minutes <= 480),
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Username constraints
ALTER TABLE public.profiles
ADD CONSTRAINT username_format CHECK (
    username ~ '^[a-zA-Z0-9_]{3,20}$'
);

-- Indexes for profiles
CREATE INDEX idx_profiles_username ON public.profiles USING btree (username);
CREATE INDEX idx_profiles_username_trgm ON public.profiles USING gin (username gin_trgm_ops);
CREATE INDEX idx_profiles_display_name_trgm ON public.profiles USING gin (display_name gin_trgm_ops);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- POSTS SYSTEM
-- =============================================

-- Content type enum
CREATE TYPE post_content_type AS ENUM ('caption', 'reflection', 'both');

-- Posts table
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content_type post_content_type NOT NULL,
    caption TEXT,
    reflection TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT caption_length CHECK (char_length(caption) <= 280),
    CONSTRAINT reflection_length CHECK (char_length(reflection) <= 10000),
    CONSTRAINT has_content CHECK (caption IS NOT NULL OR reflection IS NOT NULL)
);

-- Post images table
CREATE TABLE public.post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    width INTEGER,
    height INTEGER,
    blurhash TEXT,
    position INTEGER NOT NULL CHECK (position >= 0 AND position < 4),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_image_position UNIQUE (post_id, position)
);

-- Indexes for posts
CREATE INDEX idx_posts_author_id ON public.posts USING btree (author_id);
CREATE INDEX idx_posts_created_at ON public.posts USING btree (created_at DESC);
CREATE INDEX idx_posts_author_created ON public.posts USING btree (author_id, created_at DESC);
CREATE INDEX idx_post_images_post_id ON public.post_images USING btree (post_id);

-- =============================================
-- SOCIAL GRAPH
-- =============================================

-- Follows table
CREATE TABLE public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT no_self_follow CHECK (follower_id != following_id),
    CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Blocks table
CREATE TABLE public.blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT no_self_block CHECK (blocker_id != blocked_id),
    CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

-- Mutes table
CREATE TABLE public.mutes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    muter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    muted_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT no_self_mute CHECK (muter_id != muted_id),
    CONSTRAINT unique_mute UNIQUE (muter_id, muted_id)
);

-- Indexes for social graph
CREATE INDEX idx_follows_follower ON public.follows USING btree (follower_id);
CREATE INDEX idx_follows_following ON public.follows USING btree (following_id);
CREATE INDEX idx_blocks_blocker ON public.blocks USING btree (blocker_id);
CREATE INDEX idx_blocks_blocked ON public.blocks USING btree (blocked_id);
CREATE INDEX idx_mutes_muter ON public.mutes USING btree (muter_id);

-- =============================================
-- INTERACTIONS
-- =============================================

-- Comments table (threaded)
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    depth INTEGER DEFAULT 0 CHECK (depth <= 3),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT comment_length CHECK (char_length(content) <= 1000)
);

-- Reposts table
CREATE TABLE public.reposts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    original_post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    reposter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    commentary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_repost UNIQUE (original_post_id, reposter_id),
    CONSTRAINT commentary_length CHECK (char_length(commentary) <= 280)
);

-- Bookmarks table
CREATE TABLE public.bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_bookmark UNIQUE (user_id, post_id)
);

-- Indexes for interactions
CREATE INDEX idx_comments_post_id ON public.comments USING btree (post_id);
CREATE INDEX idx_comments_author_id ON public.comments USING btree (author_id);
CREATE INDEX idx_comments_parent_id ON public.comments USING btree (parent_id);
CREATE INDEX idx_comments_post_created ON public.comments USING btree (post_id, created_at);
CREATE INDEX idx_reposts_original ON public.reposts USING btree (original_post_id);
CREATE INDEX idx_reposts_reposter ON public.reposts USING btree (reposter_id);
CREATE INDEX idx_reposts_created ON public.reposts USING btree (created_at DESC);
CREATE INDEX idx_bookmarks_user ON public.bookmarks USING btree (user_id);
CREATE INDEX idx_bookmarks_user_created ON public.bookmarks USING btree (user_id, created_at DESC);

-- =============================================
-- WELLNESS/USAGE TRACKING
-- =============================================

-- Usage sessions
CREATE TABLE public.usage_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER GENERATED ALWAYS AS (
        CASE WHEN ended_at IS NOT NULL
        THEN EXTRACT(EPOCH FROM (ended_at - started_at))::INTEGER
        ELSE NULL END
    ) STORED
);

-- Daily usage summary
CREATE TABLE public.daily_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    total_seconds INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    comments_made INTEGER DEFAULT 0,
    reposts_made INTEGER DEFAULT 0,

    CONSTRAINT unique_daily_usage UNIQUE (user_id, date)
);

-- Weekly summaries
CREATE TABLE public.weekly_summaries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    total_time_seconds INTEGER DEFAULT 0,
    posts_created INTEGER DEFAULT 0,
    comments_made INTEGER DEFAULT 0,
    new_followers INTEGER DEFAULT 0,
    top_post_id UUID REFERENCES public.posts(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_weekly_summary UNIQUE (user_id, week_start)
);

-- Indexes for usage tracking
CREATE INDEX idx_usage_sessions_user ON public.usage_sessions USING btree (user_id);
CREATE INDEX idx_usage_sessions_user_date ON public.usage_sessions USING btree (user_id, (started_at::date));
CREATE INDEX idx_daily_usage_user_date ON public.daily_usage USING btree (user_id, date DESC);
CREATE INDEX idx_weekly_summaries_user ON public.weekly_summaries USING btree (user_id, week_start DESC);

-- =============================================
-- NOTIFICATIONS
-- =============================================

-- Notification types enum
CREATE TYPE notification_type AS ENUM (
    'follow',
    'comment',
    'comment_reply',
    'repost',
    'mention'
);

-- Notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type notification_type NOT NULL,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification settings
CREATE TABLE public.notification_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    push_enabled BOOLEAN DEFAULT TRUE,
    batch_notifications BOOLEAN DEFAULT TRUE,
    batch_interval_minutes INTEGER DEFAULT 60,
    follow_notifications BOOLEAN DEFAULT TRUE,
    comment_notifications BOOLEAN DEFAULT TRUE,
    repost_notifications BOOLEAN DEFAULT TRUE,
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start_time TIME,
    dnd_end_time TIME,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Push tokens table
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
    created_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_token UNIQUE (token)
);

-- Read receipts for "caught up" feature
CREATE TABLE public.read_receipts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT unique_read_receipt UNIQUE (user_id, post_id)
);

-- Feed watermarks
CREATE TABLE public.feed_watermarks (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_recipient ON public.notifications USING btree (recipient_id);
CREATE INDEX idx_notifications_recipient_unread ON public.notifications USING btree (recipient_id) WHERE NOT read;
CREATE INDEX idx_notifications_created ON public.notifications USING btree (recipient_id, created_at DESC);
CREATE INDEX idx_push_tokens_user ON public.push_tokens USING btree (user_id);
CREATE INDEX idx_read_receipts_user ON public.read_receipts USING btree (user_id);
CREATE INDEX idx_read_receipts_user_post ON public.read_receipts USING btree (user_id, post_id);
