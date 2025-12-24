// Database types - will be auto-generated from Supabase later
// This file contains manual types until we run `supabase gen types typescript`

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PostContentType = 'caption' | 'reflection' | 'both';
export type ContentType = PostContentType; // Alias for convenience
export type NotificationType = 'follow' | 'comment' | 'comment_reply' | 'repost' | 'mention';

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          bio: string | null;
          avatar_url: string | null;
          daily_usage_goal_minutes: number;
          onboarding_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          username: string;
          display_name: string;
          bio?: string | null;
          avatar_url?: string | null;
          daily_usage_goal_minutes?: number;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          display_name?: string;
          bio?: string | null;
          avatar_url?: string | null;
          daily_usage_goal_minutes?: number;
          onboarding_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      posts: {
        Row: {
          id: string;
          author_id: string;
          content_type: PostContentType;
          caption: string | null;
          reflection: string | null;
          is_private: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          content_type: PostContentType;
          caption?: string | null;
          reflection?: string | null;
          is_private?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          content_type?: PostContentType;
          caption?: string | null;
          reflection?: string | null;
          is_private?: boolean;
          created_at?: string;
        };
      };
      post_images: {
        Row: {
          id: string;
          post_id: string;
          storage_path: string;
          thumbnail_path: string | null;
          width: number | null;
          height: number | null;
          blurhash: string | null;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          storage_path: string;
          thumbnail_path?: string | null;
          width?: number | null;
          height?: number | null;
          blurhash?: string | null;
          position: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          storage_path?: string;
          thumbnail_path?: string | null;
          width?: number | null;
          height?: number | null;
          blurhash?: string | null;
          position?: number;
          created_at?: string;
        };
      };
      follows: {
        Row: {
          id: string;
          follower_id: string;
          following_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          follower_id: string;
          following_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          follower_id?: string;
          following_id?: string;
          created_at?: string;
        };
      };
      blocks: {
        Row: {
          id: string;
          blocker_id: string;
          blocked_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          blocker_id: string;
          blocked_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          blocker_id?: string;
          blocked_id?: string;
          created_at?: string;
        };
      };
      mutes: {
        Row: {
          id: string;
          muter_id: string;
          muted_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          muter_id: string;
          muted_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          muter_id?: string;
          muted_id?: string;
          created_at?: string;
        };
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          author_id: string;
          parent_id: string | null;
          content: string;
          depth: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          author_id: string;
          parent_id?: string | null;
          content: string;
          depth?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          author_id?: string;
          parent_id?: string | null;
          content?: string;
          depth?: number;
          created_at?: string;
        };
      };
      reposts: {
        Row: {
          id: string;
          original_post_id: string;
          reposter_id: string;
          commentary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          original_post_id: string;
          reposter_id: string;
          commentary?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          original_post_id?: string;
          reposter_id?: string;
          commentary?: string | null;
          created_at?: string;
        };
      };
      bookmarks: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          recipient_id: string;
          actor_id: string | null;
          type: NotificationType;
          post_id: string | null;
          comment_id: string | null;
          read: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_id: string;
          actor_id?: string | null;
          type: NotificationType;
          post_id?: string | null;
          comment_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_id?: string;
          actor_id?: string | null;
          type?: NotificationType;
          post_id?: string | null;
          comment_id?: string | null;
          read?: boolean;
          created_at?: string;
        };
      };
      notification_settings: {
        Row: {
          user_id: string;
          push_enabled: boolean;
          batch_notifications: boolean;
          batch_interval_minutes: number;
          follow_notifications: boolean;
          comment_notifications: boolean;
          repost_notifications: boolean;
          dnd_enabled: boolean;
          dnd_start_time: string | null;
          dnd_end_time: string | null;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          push_enabled?: boolean;
          batch_notifications?: boolean;
          batch_interval_minutes?: number;
          follow_notifications?: boolean;
          comment_notifications?: boolean;
          repost_notifications?: boolean;
          dnd_enabled?: boolean;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          push_enabled?: boolean;
          batch_notifications?: boolean;
          batch_interval_minutes?: number;
          follow_notifications?: boolean;
          comment_notifications?: boolean;
          repost_notifications?: boolean;
          dnd_enabled?: boolean;
          dnd_start_time?: string | null;
          dnd_end_time?: string | null;
          updated_at?: string;
        };
      };
      read_receipts: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          read_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          read_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          read_at?: string;
        };
      };
      feed_watermarks: {
        Row: {
          user_id: string;
          last_seen_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          last_seen_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          last_seen_at?: string;
          updated_at?: string;
        };
      };
      usage_sessions: {
        Row: {
          id: string;
          user_id: string;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          started_at?: string;
          ended_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          started_at?: string;
          ended_at?: string | null;
        };
      };
      daily_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          total_seconds: number;
          posts_created: number;
          comments_made: number;
          reposts_made: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          total_seconds?: number;
          posts_created?: number;
          comments_made?: number;
          reposts_made?: number;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          total_seconds?: number;
          posts_created?: number;
          comments_made?: number;
          reposts_made?: number;
        };
      };
      weekly_summaries: {
        Row: {
          id: string;
          user_id: string;
          week_start: string;
          week_end: string;
          total_time_seconds: number;
          posts_created: number;
          comments_made: number;
          new_followers: number;
          top_post_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          week_start: string;
          week_end: string;
          total_time_seconds?: number;
          posts_created?: number;
          comments_made?: number;
          new_followers?: number;
          top_post_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          week_start?: string;
          week_end?: string;
          total_time_seconds?: number;
          posts_created?: number;
          comments_made?: number;
          new_followers?: number;
          top_post_id?: string | null;
          created_at?: string;
        };
      };
      push_tokens: {
        Row: {
          id: string;
          user_id: string;
          token: string;
          platform: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          token: string;
          platform: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          token?: string;
          platform?: string;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_follower_count: {
        Args: { profile_id: string };
        Returns: number;
      };
      get_following_count: {
        Args: { profile_id: string };
        Returns: number;
      };
      get_unseen_posts_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
      is_blocked: {
        Args: { viewer_id: string; target_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      post_content_type: PostContentType;
      notification_type: NotificationType;
    };
  };
}

// Helper types for common operations
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];

export type Post = Database['public']['Tables']['posts']['Row'];
export type PostInsert = Database['public']['Tables']['posts']['Insert'];

export type PostImage = Database['public']['Tables']['post_images']['Row'];
export type PostImageInsert = Database['public']['Tables']['post_images']['Insert'];

export type Follow = Database['public']['Tables']['follows']['Row'];
export type Comment = Database['public']['Tables']['comments']['Row'];
export type Repost = Database['public']['Tables']['reposts']['Row'];
export type Bookmark = Database['public']['Tables']['bookmarks']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type NotificationSettings = Database['public']['Tables']['notification_settings']['Row'];
