import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Button } from '@components/ui';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@providers/AuthProvider';
import { queryKeys } from '@/lib/query/keys';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import type { Profile } from '@/types/database';

interface UserWithFollowStatus extends Profile {
  isFollowing: boolean;
}

export default function DiscoverScreen() {
  const { user, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [users, setUsers] = useState<UserWithFollowStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUsers();
  }, [user?.id]);

  const loadUsers = async () => {
    if (!user?.id) return;

    try {
      // Get all users except current user
      const { data: profiles, error: profilesError } = await (supabase
        .from('profiles') as any)
        .select('*')
        .neq('id', user.id)
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Get who the current user is following
      const { data: follows, error: followsError } = await (supabase
        .from('follows') as any)
        .select('following_id')
        .eq('follower_id', user.id);

      if (followsError) throw followsError;

      const followingSet = new Set(follows?.map((f: any) => f.following_id) || []);
      setFollowingIds(followingSet);

      const usersWithStatus = (profiles || []).map((profile: Profile) => ({
        ...profile,
        isFollowing: followingSet.has(profile.id),
      }));

      setUsers(usersWithStatus);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!user?.id) return;

    const isCurrentlyFollowing = followingIds.has(targetUserId);

    // Optimistic update
    setFollowingIds((prev) => {
      const newSet = new Set(prev);
      if (isCurrentlyFollowing) {
        newSet.delete(targetUserId);
      } else {
        newSet.add(targetUserId);
      }
      return newSet;
    });

    setUsers((prev) =>
      prev.map((u) =>
        u.id === targetUserId ? { ...u, isFollowing: !isCurrentlyFollowing } : u
      )
    );

    try {
      if (isCurrentlyFollowing) {
        await (supabase.from('follows') as any)
          .delete()
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId);
      } else {
        await (supabase.from('follows') as any)
          .insert({
            follower_id: user.id,
            following_id: targetUserId,
          });
      }

      // Invalidate feed query so it refreshes with new followed user's posts
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert on error
      loadUsers();
    }
  };

  const handleContinue = async () => {
    if (!user?.id) return;

    // Mark onboarding as complete
    await (supabase.from('profiles') as any)
      .update({ onboarding_completed: true })
      .eq('id', user.id);

    // Refresh the auth profile - the root layout will automatically
    // navigate to the feed when needsOnboarding becomes false
    await refreshProfile();
  };

  const renderUser = ({ item }: { item: UserWithFollowStatus }) => {
    const isFollowing = followingIds.has(item.id);

    return (
      <View style={styles.userRow}>
        <Avatar
          uri={item.avatar_url}
          name={item.display_name || item.username}
          size="md"
        />
        <View style={styles.userInfo}>
          <Text style={styles.displayName}>
            {item.display_name || item.username}
          </Text>
          <Text style={styles.username}>@{item.username}</Text>
        </View>
        <Pressable
          style={[
            styles.followButton,
            isFollowing && styles.followingButton,
          ]}
          onPress={() => handleToggleFollow(item.id)}
        >
          <Text
            style={[
              styles.followButtonText,
              isFollowing && styles.followingButtonText,
            ]}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </Text>
        </Pressable>
      </View>
    );
  };

  const followingCount = followingIds.size;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="people" size={48} color={colors.primary[500]} />
        <Text style={styles.title}>Find People to Follow</Text>
        <Text style={styles.subtitle}>
          Follow people to see their posts in your feed
        </Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No other users yet</Text>
          <Text style={styles.emptySubtext}>
            You're one of the first! Invite your friends to join.
          </Text>
        </View>
      ) : (
        <FlatList
          data={users}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        {followingCount > 0 && (
          <Text style={styles.followingCount}>
            Following {followingCount} {followingCount === 1 ? 'person' : 'people'}
          </Text>
        )}
        <Button
          title={followingCount > 0 ? "Let's Go!" : "Skip for Now"}
          onPress={handleContinue}
          variant={followingCount > 0 ? 'primary' : 'outline'}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginTop: spacing.md,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[700],
  },
  emptySubtext: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[500],
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  list: {
    padding: spacing.md,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  displayName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  username: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  followButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
  },
  followingButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[300],
  },
  followButtonText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  followingButtonText: {
    color: colors.gray[700],
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
    gap: spacing.sm,
  },
  followingCount: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[600],
    textAlign: 'center',
  },
});
