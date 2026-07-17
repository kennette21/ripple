// App configuration constants
const localSupabaseUrl = process.env.EXPO_PUBLIC_LOCAL_SUPABASE_URL;
const localSupabaseAnonKey = process.env.EXPO_PUBLIC_LOCAL_SUPABASE_ANON_KEY;
const useLocalSupabase = Boolean(localSupabaseUrl && localSupabaseAnonKey);

export const APP_CONFIG = {
  name: 'Ripple',
  version: '1.0.0',
  isLocalSupabase: useLocalSupabase,

  // API
  supabaseUrl: useLocalSupabase
    ? localSupabaseUrl!
    : process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: useLocalSupabase
    ? localSupabaseAnonKey!
    : process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',

  // Feature flags
  features: {
    magicLink: true,
    pushNotifications: true,
    batchedNotifications: true,
  },
} as const;

// Content limits
export const LIMITS = {
  // Posts
  captionMaxLength: 280,
  reflectionMaxLength: 10000,
  maxImagesPerPost: 10,

  // Comments
  commentMaxLength: 1000,
  maxCommentDepth: 3,

  // Profile
  usernameMinLength: 3,
  usernameMaxLength: 20,
  displayNameMaxLength: 50,
  bioMaxLength: 160,

  // Wellness
  minDailyGoalMinutes: 5,
  maxDailyGoalMinutes: 480,
  defaultDailyGoalMinutes: 30,

  // Notifications
  defaultBatchIntervalMinutes: 60,

  // Feed
  feedPageSize: 20,
  maxNewPostsBanner: 99,
} as const;

// Regex patterns
export const PATTERNS = {
  username: /^[a-zA-Z0-9_]{3,20}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
} as const;
