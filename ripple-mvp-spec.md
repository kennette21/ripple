# Ripple - Healthy Social Media MVP Specification

## For the Development Agent

This document provides product direction and context for building Ripple. You have full authority to make technical decisions - stack choices, architecture, file structure, libraries, etc. The suggestions here are starting points, not requirements. If you see a better approach during implementation, take it.

---

## What is Ripple?

Ripple is a social media app designed around mental health and genuine connection. It removes the toxic patterns that make traditional social media addictive and anxiety-inducing, while keeping the parts that actually connect people.

## Core Philosophy

**Show users only what they haven't seen.** The feed shows new content from people you follow in chronological order. Once you reach the bottom, you see "You're all caught up." You can optionally tap to browse older posts, but the default experience has a natural stopping point.

**No public metrics.** Follower counts and view counts are private. Only you see your own stats. This removes social comparison anxiety and "clout chasing" behavior.

**No algorithm.** Chronological feed only. No engagement optimization, no suggested content, no infinite rabbit holes.

**Usage transparency.** Users set daily goals and get gentle insights about their usage patterns. Not punitive - just awareness.

## MVP Features

### Authentication
- Email/password and magic link
- OAuth (Apple, Google)
- Profile setup: username, display name, bio, avatar
- Set daily usage goal during onboarding

### The Feed
- Chronological posts from people you follow
- Only shows content you haven't seen yet
- Natural endpoint: "You're all caught up" when you've seen everything
- Option to browse past posts if you want, but not the default
- New posts appear via banner ("3 new posts") rather than auto-loading

### Posts
Two types of content on posts:
- **Caption** - short form, quick thought (think tweet-length)
- **Reflection** - long form, deeper content (think blog post)

A post can have either or both.

Additional post features:
- Multiple images (up to 4)
- Image gallery with pinch-to-zoom
- Delete your own posts
- No edit window - what you post is what you post (encourages thoughtfulness)

### Interactions
- **Comments** - threaded replies
- **Repost** - share to your followers with optional commentary
- **Bookmark** - save posts privately

### Social Graph
- Follow/unfollow
- View your followers and who you follow (but counts are private to you)
- Search users by username or display name
- User profiles showing their posts
- Block and mute

### Wellness Features
- **Daily usage insights** - time spent, posts made, interactions
- **Gentle nudges** - non-intrusive awareness when approaching your daily goal
- **Weekly reflection** - summary of your week on the platform

### Notifications
- Push notifications for direct interactions (someone commented on your post, new follower)
- Batched delivery by default (not instant dopamine hits)
- Granular controls - users choose what they get notified about
- Do not disturb scheduling

## Suggested Tech Stack

These are suggestions based on the requirements. Adjust as you see fit.

**Client:** React Native with Expo (good for rapid iteration, OTA updates)

**Backend:** Supabase (PostgreSQL, auth, realtime, storage, edge functions all in one)

**Key needs:**
- Real-time capability for new post notifications
- Image storage and optimization
- Push notifications
- Usage tracking that doesn't feel invasive

## Out of Scope for MVP

- Direct messaging
- Video content
- Stories or ephemeral content
- Hashtags or discovery features
- Web client
- Monetization

## Success Criteria for Alpha

- Users can sign up, create a profile, follow others
- Feed works with "caught up" stopping point
- Posts support captions, reflections, and multiple images
- Comments work with threading
- Basic usage tracking displays to user
- Stable enough for ~50-100 test users
