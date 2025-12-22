// Query key factory for consistent cache management
// Following the pattern from TanStack Query docs

export const queryKeys = {
  // Auth & Profile
  auth: {
    all: ['auth'] as const,
    session: () => [...queryKeys.auth.all, 'session'] as const,
    user: () => [...queryKeys.auth.all, 'user'] as const,
  },

  profiles: {
    all: ['profiles'] as const,
    detail: (userId: string) => [...queryKeys.profiles.all, userId] as const,
    byUsername: (username: string) =>
      [...queryKeys.profiles.all, 'username', username] as const,
    search: (query: string) =>
      [...queryKeys.profiles.all, 'search', query] as const,
  },

  // Feed
  feed: {
    all: ['feed'] as const,
    list: (userId: string) => [...queryKeys.feed.all, 'list', userId] as const,
    unseenCount: (userId: string) =>
      [...queryKeys.feed.all, 'unseen', userId] as const,
  },

  // Posts
  posts: {
    all: ['posts'] as const,
    detail: (postId: string) => [...queryKeys.posts.all, postId] as const,
    byUser: (userId: string) =>
      [...queryKeys.posts.all, 'user', userId] as const,
  },

  // Comments
  comments: {
    all: ['comments'] as const,
    byPost: (postId: string) =>
      [...queryKeys.comments.all, 'post', postId] as const,
  },

  // Social
  follows: {
    all: ['follows'] as const,
    followers: (userId: string) =>
      [...queryKeys.follows.all, 'followers', userId] as const,
    following: (userId: string) =>
      [...queryKeys.follows.all, 'following', userId] as const,
    isFollowing: (followerId: string, followingId: string) =>
      [...queryKeys.follows.all, 'check', followerId, followingId] as const,
    counts: (userId: string) =>
      [...queryKeys.follows.all, 'counts', userId] as const,
  },

  // Bookmarks
  bookmarks: {
    all: ['bookmarks'] as const,
    list: (userId: string) =>
      [...queryKeys.bookmarks.all, 'list', userId] as const,
    isBookmarked: (userId: string, postId: string) =>
      [...queryKeys.bookmarks.all, 'check', userId, postId] as const,
  },

  // Reposts
  reposts: {
    all: ['reposts'] as const,
    byUser: (userId: string) =>
      [...queryKeys.reposts.all, 'user', userId] as const,
    isReposted: (userId: string, postId: string) =>
      [...queryKeys.reposts.all, 'check', userId, postId] as const,
  },

  // Notifications
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) =>
      [...queryKeys.notifications.all, 'list', userId] as const,
    unreadCount: (userId: string) =>
      [...queryKeys.notifications.all, 'unread', userId] as const,
    settings: (userId: string) =>
      [...queryKeys.notifications.all, 'settings', userId] as const,
  },

  // Wellness
  wellness: {
    all: ['wellness'] as const,
    dailyUsage: (userId: string, date: string) =>
      [...queryKeys.wellness.all, 'daily', userId, date] as const,
    weeklyUsage: (userId: string, weekStart: string) =>
      [...queryKeys.wellness.all, 'weekly', userId, weekStart] as const,
    goal: (userId: string) =>
      [...queryKeys.wellness.all, 'goal', userId] as const,
  },

  // Blocks & Mutes
  privacy: {
    all: ['privacy'] as const,
    blocks: (userId: string) =>
      [...queryKeys.privacy.all, 'blocks', userId] as const,
    mutes: (userId: string) =>
      [...queryKeys.privacy.all, 'mutes', userId] as const,
    isBlocked: (userId: string, targetId: string) =>
      [...queryKeys.privacy.all, 'isBlocked', userId, targetId] as const,
  },
} as const;
