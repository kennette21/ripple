export const queryKeys = {
  feed: {
    all: ['feed'] as const,
    list: (userId: string) => ['feed', 'list', 'viewer-visible', userId] as const,
    caughtUp: (userId: string) =>
      ['feed', 'caughtUp', 'viewer-visible', userId] as const,
  },
  posts: {
    all: ['posts'] as const,
    detail: (postId: string, viewerId: string) =>
      ['posts', 'detail', postId, viewerId] as const,
    edit: (postId: string, userId: string) =>
      ['posts', 'edit', postId, userId] as const,
    byUser: (userId: string, viewerId: string) =>
      ['posts', 'byUser', userId, viewerId] as const,
    deleted: (userId: string) =>
      ['posts', 'deleted', userId] as const,
  },
  profiles: {
    all: ['profiles'] as const,
    detail: (userId: string) => ['profiles', 'detail', userId] as const,
  },
  social: {
    connectionCounts: (userId: string) =>
      ['social', 'connectionCounts', userId] as const,
    followers: (userId: string) => ['social', 'followers', userId] as const,
    following: (userId: string) => ['social', 'following', userId] as const,
    followStatus: (userId: string, targetId: string) =>
      ['social', 'followStatus', userId, targetId] as const,
  },
  friends: {
    all: ['friends'] as const,
    list: (userId: string) => ['friends', 'list', userId] as const,
    requests: (userId: string) => ['friends', 'requests', userId] as const,
    status: (userId: string, targetId: string) =>
      ['friends', 'status', userId, targetId] as const,
    contacts: (userId: string) => ['friends', 'contacts', userId] as const,
  },
  search: {
    all: ['search'] as const,
    users: (query: string, userId: string) =>
      ['search', 'users', userId, query] as const,
  },
  comments: {
    all: ['comments'] as const,
    byPost: (postId: string) =>
      [...queryKeys.comments.all, 'byPost', postId] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: (userId: string) => ['notifications', 'list', userId] as const,
    unreadCount: (userId: string) => ['notifications', 'unreadCount', userId] as const,
    preferences: (userId: string) =>
      ['notifications', 'preferences', userId] as const,
  },
  wellness: {
    dailyUsage: (userId: string, date: string) =>
      ['wellness', 'dailyUsage', userId, date] as const,
    weeklySummary: (userId: string) => ['wellness', 'weeklySummary', userId] as const,
  },
};
