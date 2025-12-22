export const queryKeys = {
  feed: {
    all: ['feed'] as const,
    list: (userId: string) => ['feed', 'list', userId] as const,
    caughtUp: (userId: string) => ['feed', 'caughtUp', userId] as const,
  },
  posts: {
    all: ['posts'] as const,
    detail: (postId: string) => ['posts', 'detail', postId] as const,
    byUser: (userId: string) => ['posts', 'byUser', userId] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    detail: (userId: string) => ['profiles', 'detail', userId] as const,
  },
  social: {
    followers: (userId: string) => ['social', 'followers', userId] as const,
    following: (userId: string) => ['social', 'following', userId] as const,
    followStatus: (userId: string, targetId: string) =>
      ['social', 'followStatus', userId, targetId] as const,
  },
  search: {
    users: (query: string) => ['search', 'users', query] as const,
  },
  comments: {
    byPost: (postId: string) => ['comments', 'byPost', postId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) => ['notifications', 'list', userId] as const,
    unreadCount: (userId: string) => ['notifications', 'unreadCount', userId] as const,
  },
  wellness: {
    dailyUsage: (userId: string, date: string) =>
      ['wellness', 'dailyUsage', userId, date] as const,
    weeklySummary: (userId: string) => ['wellness', 'weeklySummary', userId] as const,
  },
};
