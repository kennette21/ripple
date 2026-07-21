import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';
import { queryKeys } from '@/lib/query/keys';
import type {
  NewPostNotificationMode,
  NotificationSettings,
} from '@/types/database';

export interface NotificationPreferencePerson {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface NotificationPreferencesData {
  settings: NotificationSettings;
  following: NotificationPreferencePerson[];
  selectedAuthorIds: string[];
}

type BooleanPreferenceKey =
  | 'comment_notifications'
  | 'follow_notifications';

type BooleanPreferenceUpdate = {
  key: BooleanPreferenceKey;
  value: boolean;
};

interface FollowingRow {
  following_id: string;
  profile: {
    avatar_url: string | null;
    display_name: string;
    id: string;
    username: string;
  } | null;
}

async function fetchNotificationPreferences(
  userId: string
): Promise<NotificationPreferencesData> {
  const [settingsResult, followsResult, subscriptionsResult] = await Promise.all([
    supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('follows')
      .select(`
        following_id,
        profile:profiles!follows_following_id_fkey(
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('follower_id', userId),
    supabase
      .from('post_notification_subscriptions')
      .select('author_id')
      .eq('user_id', userId),
  ]);

  if (settingsResult.error) throw settingsResult.error;
  if (followsResult.error) throw followsResult.error;
  if (subscriptionsResult.error) throw subscriptionsResult.error;

  let settings = settingsResult.data;
  if (!settings) {
    const insertResult = await supabase
      .from('notification_settings')
      .insert({ user_id: userId })
      .select('*')
      .single();

    if (insertResult.error) throw insertResult.error;
    settings = insertResult.data;
  }

  const following = ((followsResult.data ?? []) as FollowingRow[])
    .flatMap((row) => {
      if (!row.profile) return [];
      return [{
        id: row.profile.id,
        username: row.profile.username,
        displayName: row.profile.display_name,
        avatarUrl: row.profile.avatar_url,
      }];
    })
    .sort((left, right) =>
      left.displayName.localeCompare(right.displayName, undefined, {
        sensitivity: 'base',
      })
    );
  const followingIds = new Set(following.map((person) => person.id));

  return {
    settings,
    following,
    selectedAuthorIds: (subscriptionsResult.data ?? [])
      .map((subscription) => subscription.author_id)
      .filter((authorId) => followingIds.has(authorId)),
  };
}

export function useNotificationPreferences(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(userId ?? ''),
    queryFn: () => fetchNotificationPreferences(userId!),
    enabled: !!userId,
  });
}

export function useUpdateBooleanNotificationPreference(
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notifications.preferences(userId ?? '');

  return useMutation({
    mutationFn: async ({ key, value }: BooleanPreferenceUpdate) => {
      if (!userId) throw new Error('Authentication required');

      const { error } = await supabase
        .from('notification_settings')
        .update({ [key]: value })
        .eq('user_id', userId);

      if (error) throw error;
    },
    onMutate: async ({ key, value }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<NotificationPreferencesData>(queryKey);

      queryClient.setQueryData<NotificationPreferencesData>(
        queryKey,
        (current) => current
          ? {
              ...current,
              settings: { ...current.settings, [key]: value },
            }
          : current
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useSetNewPostNotificationMode(
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notifications.preferences(userId ?? '');

  return useMutation({
    mutationFn: async (mode: NewPostNotificationMode) => {
      if (!userId) throw new Error('Authentication required');

      const { error } = await supabase.rpc(
        'set_new_post_notification_mode',
        { p_mode: mode }
      );

      if (error) throw error;
    },
    onMutate: async (mode) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<NotificationPreferencesData>(queryKey);

      queryClient.setQueryData<NotificationPreferencesData>(
        queryKey,
        (current) => {
          if (!current) return current;

          return {
            ...current,
            settings: { ...current.settings, new_post_mode: mode },
            selectedAuthorIds:
              mode === 'selected' &&
              current.settings.new_post_mode === 'all' &&
              current.selectedAuthorIds.length === 0
                ? current.following.map((person) => person.id)
                : current.selectedAuthorIds,
          };
        }
      );

      return { previous };
    },
    onError: (_error, _mode, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useSetPostNotificationSubscription(
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notifications.preferences(userId ?? '');

  return useMutation({
    mutationFn: async ({
      authorId,
      enabled,
    }: {
      authorId: string;
      enabled: boolean;
    }) => {
      if (!userId) throw new Error('Authentication required');

      const { error } = await supabase.rpc(
        'set_post_notification_subscription',
        {
          p_author_id: authorId,
          p_enabled: enabled,
        }
      );

      if (error) throw error;
    },
    onMutate: async ({ authorId, enabled }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<NotificationPreferencesData>(queryKey);

      queryClient.setQueryData<NotificationPreferencesData>(
        queryKey,
        (current) => {
          if (!current) return current;

          const selected = new Set(current.selectedAuthorIds);
          if (enabled) selected.add(authorId);
          else selected.delete(authorId);

          return { ...current, selectedAuthorIds: [...selected] };
        }
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

export function useSetAllPostNotificationSubscriptions(
  userId: string | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = queryKeys.notifications.preferences(userId ?? '');

  return useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!userId) throw new Error('Authentication required');

      const { error } = await supabase.rpc(
        'set_all_post_notification_subscriptions',
        { p_enabled: enabled }
      );

      if (error) throw error;
    },
    onMutate: async (enabled) => {
      await queryClient.cancelQueries({ queryKey });
      const previous =
        queryClient.getQueryData<NotificationPreferencesData>(queryKey);

      queryClient.setQueryData<NotificationPreferencesData>(
        queryKey,
        (current) => current
          ? {
              ...current,
              selectedAuthorIds: enabled
                ? current.following.map((person) => person.id)
                : [],
            }
          : current
      );

      return { previous };
    },
    onError: (_error, _enabled, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}
