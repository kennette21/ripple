import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@components/ui';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import type { Profile } from '@/types/database';

interface UserWithFollowStatus extends Profile {
  isFollowing: boolean;
}

export default function FindPeopleScreen() {
  const { user } = useAuth();
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
    } catch (error) {
      console.error('Error toggling follow:', error);
      // Revert on error
      loadUsers();
    }
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
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.title}>Find People</Text>
        <View style={{ width: 24 }} />
      </View>

      {followingCount > 0 && (
        <View style={styles.statsBar}>
          <Text style={styles.followingCount}>
            Following {followingCount} {followingCount === 1 ? 'person' : 'people'}
          </Text>
        </View>
      )}

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : users.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="people-outline" size={48} color={colors.gray[300]} />
          <Text style={styles.emptyText}>No other users yet</Text>
          <Text style={styles.emptySubtext}>
            Invite your friends to join Ripple!
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  statsBar: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.primary[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.primary[100],
  },
  followingCount: {
    fontSize: typography.fontSizes.sm,
    color: colors.primary[600],
    textAlign: 'center',
    fontWeight: typography.fontWeights.medium,
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
    marginTop: spacing.md,
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
});
