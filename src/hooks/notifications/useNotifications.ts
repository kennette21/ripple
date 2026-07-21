import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type {
  Comment,
  Notification,
  NotificationType,
  Post,
  Profile,
} from '@/types/database';

const NOTIFICATION_LIMIT = 100;
const NOTIFICATION_REFRESH_INTERVAL_MS = 10_000;

type NotificationActor = Pick<
  Profile,
  'id' | 'avatar_url' | 'display_name' | 'username'
>;

type NotificationPostAuthor = Pick<
  Profile,
  'id' | 'display_name' | 'username'
>;

type NotificationPost = Pick<
  Post,
  'id' | 'author_id'
> & {
  author: NotificationPostAuthor | null;
};

type NotificationComment = Pick<
  Comment,
  'id' | 'content' | 'parent_id' | 'post_id' | 'thread_root_id'
>;

export interface NotificationWithRelations extends Notification {
  actor: NotificationActor | null;
  post: NotificationPost | null;
  comment: NotificationComment | null;
}

export type NotificationStoryKind =
  | 'post'
  | 'thread'
  | 'people'
  | 'activity';

export interface NotificationStoryGroup {
  key: string;
  kind: NotificationStoryKind;
  actorLabel: string;
  actors: NotificationActor[];
  activitySummary: string;
  latestAt: string;
  isNew: boolean;
  notificationIds: string[];
  unseenNotificationIds: string[];
  postId: string | null;
  postAuthorId: string | null;
  targetCommentId: string | null;
  targetProfileId: string | null;
}

interface StoryAccumulator {
  key: string;
  kind: NotificationStoryKind;
  notifications: NotificationWithRelations[];
}

async function fetchNotifications(
  userId: string
): Promise<NotificationWithRelations[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(`
      *,
      actor:profiles!notifications_actor_id_fkey(
        id,
        avatar_url,
        display_name,
        username
      ),
      post:posts!notifications_post_id_fkey(
        id,
        author_id,
        author:profiles!posts_author_id_fkey(
          id,
          display_name,
          username
        )
      ),
      comment:comments!notifications_comment_id_fkey(
        id,
        content,
        parent_id,
        post_id,
        thread_root_id
      )
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(NOTIFICATION_LIMIT);

  if (error) throw error;
  return (data ?? []) as NotificationWithRelations[];
}

async function fetchUnseenNotificationCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .is('seen_at', null);

  if (error) throw error;
  return count ?? 0;
}

function getStoryIdentity(
  notification: NotificationWithRelations,
  userId: string
): Pick<StoryAccumulator, 'key' | 'kind'> {
  const createdDay = (notification.created_at ?? new Date(0).toISOString())
    .slice(0, 10);

  if (notification.type === 'follow') {
    return { key: `people:${createdDay}`, kind: 'people' };
  }

  if (
    notification.post_id &&
    notification.post?.author_id === userId
  ) {
    return { key: `post:${notification.post_id}`, kind: 'post' };
  }

  if (
    notification.comment &&
    (notification.type === 'comment_reply' || notification.type === 'mention')
  ) {
    const threadId = notification.comment.thread_root_id
      ?? notification.comment.parent_id
      ?? notification.comment.id;

    return {
      key: `thread:${notification.comment.post_id}:${threadId}`,
      kind: 'thread',
    };
  }

  if (notification.post_id) {
    return { key: `post:${notification.post_id}`, kind: 'post' };
  }

  return {
    key: `activity:${notification.type}:${notification.id}`,
    kind: 'activity',
  };
}

function possessive(value: string) {
  return value.endsWith('s') ? `${value}’` : `${value}’s`;
}

function getProfileName(
  profile: NotificationActor | NotificationPostAuthor | null
) {
  return profile?.display_name || profile?.username || 'Someone';
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function countTypes(notifications: NotificationWithRelations[]) {
  return notifications.reduce<Record<NotificationType, number>>(
    (counts, notification) => {
      counts[notification.type] += 1;
      return counts;
    },
    {
      follow: 0,
      comment: 0,
      comment_reply: 0,
      repost: 0,
      new_post: 0,
      mention: 0,
    }
  );
}

function getActivitySummary(
  kind: NotificationStoryKind,
  notifications: NotificationWithRelations[],
  userId: string
) {
  const counts = countTypes(notifications);

  if (kind === 'people') {
    return `${pluralize(counts.follow, 'person', 'people')} started following you`;
  }

  if (counts.new_post > 0) {
    return counts.new_post === 1
      ? 'shared a new post'
      : `shared ${counts.new_post} new posts`;
  }

  const pieces: string[] = [];
  const responseCount = counts.comment + counts.comment_reply;

  if (kind === 'thread' && responseCount > 0) {
    pieces.push(pluralize(responseCount, 'reply', 'replies'));
  } else if (responseCount > 0) {
    pieces.push(pluralize(responseCount, 'response'));
  }

  if (counts.mention > 0) {
    pieces.push(pluralize(counts.mention, 'mention'));
  }

  if (counts.repost > 0) {
    pieces.push(pluralize(counts.repost, 'repost'));
  }

  const activity = pieces.length === 2
    ? `${pieces[0]} and ${pieces[1]}`
    : pieces[0] || pluralize(notifications.length, 'update');
  const latest = notifications[0];

  if (kind === 'thread') {
    const postAuthor = getProfileName(latest.post?.author ?? null);
    return `${activity} to your comment on ${possessive(postAuthor)} post`;
  }

  if (kind === 'post') {
    if (latest.post?.author_id === userId) {
      return `${activity} on your post`;
    }

    const postAuthor = getProfileName(latest.post?.author ?? null);
    return `${activity} on ${possessive(postAuthor)} post`;
  }

  return activity;
}

function getUniqueActors(notifications: NotificationWithRelations[]) {
  const actors = new Map<string, NotificationActor>();

  notifications.forEach((notification) => {
    if (notification.actor) {
      actors.set(notification.actor.id, notification.actor);
    }
  });

  return Array.from(actors.values());
}

function getActorLabel(actors: NotificationActor[]) {
  const names = actors.map(getProfileName);

  if (names.length === 0) return 'Someone';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names[0]} and ${names.length - 1} others`;
}

export function groupNotificationsByStory(
  notifications: NotificationWithRelations[],
  userId: string
): NotificationStoryGroup[] {
  const groups = new Map<string, StoryAccumulator>();

  notifications.forEach((notification) => {
    const identity = getStoryIdentity(notification, userId);
    const existing = groups.get(identity.key);

    if (existing) {
      existing.notifications.push(notification);
    } else {
      groups.set(identity.key, {
        ...identity,
        notifications: [notification],
      });
    }
  });

  return Array.from(groups.values())
    .map((group) => {
      const sortedNotifications = group.notifications.sort((left, right) =>
        (right.created_at ?? '').localeCompare(left.created_at ?? '')
      );
      const latest = sortedNotifications[0];
      const actors = getUniqueActors(sortedNotifications);
      const unseenNotificationIds = sortedNotifications
        .filter((notification) => notification.seen_at === null)
        .map((notification) => notification.id);

      return {
        key: group.key,
        kind: group.kind,
        actorLabel: getActorLabel(actors),
        actors,
        activitySummary: getActivitySummary(
          group.kind,
          sortedNotifications,
          userId
        ),
        latestAt: latest.created_at ?? new Date(0).toISOString(),
        isNew: unseenNotificationIds.length > 0,
        notificationIds: sortedNotifications.map((notification) => notification.id),
        unseenNotificationIds,
        postId: latest.post_id,
        postAuthorId: latest.post?.author_id ?? null,
        targetCommentId: latest.comment_id,
        targetProfileId: latest.actor?.id ?? null,
      };
    })
    .sort((left, right) => right.latestAt.localeCompare(left.latestAt));
}

export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.list(userId ?? ''),
    queryFn: () => fetchNotifications(userId!),
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: NOTIFICATION_REFRESH_INTERVAL_MS,
  });
}

export function useUnseenNotificationCount(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(userId ?? ''),
    queryFn: () => fetchUnseenNotificationCount(userId!),
    enabled: !!userId,
    staleTime: 0,
    refetchInterval: NOTIFICATION_REFRESH_INTERVAL_MS,
  });
}

export function useMarkNotificationsSeen(userId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notificationIds: string[]) => {
      if (notificationIds.length === 0) return 0;

      const { data, error } = await supabase.rpc('mark_notifications_seen', {
        p_notification_ids: notificationIds,
      });

      if (error) throw error;
      return data;
    },
    onMutate: async (notificationIds) => {
      if (!userId) return undefined;

      const queryKey = queryKeys.notifications.list(userId);
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationWithRelations[]>(
        queryKey
      );
      const seenIds = new Set(notificationIds);
      const seenAt = new Date().toISOString();

      queryClient.setQueryData<NotificationWithRelations[]>(
        queryKey,
        previous?.map((notification) =>
          seenIds.has(notification.id)
            ? { ...notification, read: true, seen_at: notification.seen_at ?? seenAt }
            : notification
        )
      );

      return { previous };
    },
    onError: (_error, _notificationIds, context) => {
      if (!userId || !context?.previous) return;
      queryClient.setQueryData(
        queryKeys.notifications.list(userId),
        context.previous
      );
    },
    onSettled: () => {
      if (!userId) return;
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount(userId),
      });
    },
  });
}
