export * from './database';

// Common app types

export interface User {
  id: string;
  email: string;
}

export interface Session {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// Feed types
export interface FeedPost {
  id: string;
  author_id: string;
  content_type: 'caption' | 'reflection' | 'both';
  caption: string | null;
  reflection: string | null;
  created_at: string;
  // Joined fields
  username: string;
  display_name: string;
  avatar_url: string | null;
  images: PostImageData[];
  comment_count: number;
  repost_count: number;
  is_bookmarked: boolean;
  is_reposted: boolean;
}

export interface PostImageData {
  id: string;
  storage_path: string;
  thumbnail_path: string | null;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  position: number;
}

// Navigation types
export type RootStackParamList = {
  '(auth)': undefined;
  '(main)': undefined;
  '(shared)': undefined;
};

// Form types
export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ProfileSetupFormData {
  username: string;
  displayName: string;
  bio?: string;
}

export interface PostFormData {
  contentType: 'caption' | 'reflection' | 'both';
  caption?: string;
  reflection?: string;
  images?: LocalImage[];
}

export interface LocalImage {
  uri: string;
  width: number;
  height: number;
  blurhash?: string;
}

// API response types
export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ApiError {
  message: string;
  code?: string;
}
