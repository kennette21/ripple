import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Input, Avatar, Button } from '@components/ui';
import { EmptyState } from '@components/common';
import { useAuth } from '@providers/AuthProvider';
import { useSearch, type SearchUser } from '@/hooks/social/useSearch';
import { useFollow } from '@/hooks/social/useFollow';
import { colors, spacing, typography, borderRadius } from '@constants/theme';

function UserRow({ profile, currentUserId }: { profile: SearchUser; currentUserId: string }) {
  const router = useRouter();
  const followMutation = useFollow();

  const handleFollow = () => {
    followMutation.mutate({
      followerId: currentUserId,
      followingId: profile.id,
      isFollowing: profile.isFollowing,
    });
  };

  const handlePress = () => {
    router.push(`/user/${profile.id}`);
  };

  return (
    <Pressable style={styles.userRow} onPress={handlePress}>
      <Avatar
        uri={profile.avatar_url}
        name={profile.display_name || profile.username}
        size="md"
      />
      <View style={styles.userInfo}>
        <Text style={styles.displayName}>
          {profile.display_name || profile.username}
        </Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio && (
          <Text style={styles.bio} numberOfLines={1}>
            {profile.bio}
          </Text>
        )}
      </View>
      <Button
        title={profile.isFollowing ? 'Following' : 'Follow'}
        variant={profile.isFollowing ? 'outline' : 'primary'}
        size="sm"
        onPress={handleFollow}
        loading={followMutation.isPending}
      />
    </Pressable>
  );
}

export default function SearchScreen() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading, isFetching } = useSearch(searchQuery, user?.id);

  const renderUser = useCallback(({ item }: { item: SearchUser }) => (
    <UserRow profile={item} currentUserId={user?.id || ''} />
  ), [user?.id]);

  const showEmptyState = !isLoading && searchQuery.length >= 2 && data?.users.length === 0;
  const showInitialState = searchQuery.length < 2;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          containerStyle={styles.searchInput}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isFetching && (
          <ActivityIndicator
            style={styles.loadingIndicator}
            color={colors.primary[500]}
            size="small"
          />
        )}
      </View>

      {showInitialState ? (
        <EmptyState
          icon="people-outline"
          title="Find people to follow"
          description="Search for users by their username or display name"
        />
      ) : showEmptyState ? (
        <EmptyState
          icon="search-outline"
          title="No results found"
          description={`No users found matching "${searchQuery}"`}
        />
      ) : (
        <FlatList
          data={data?.users || []}
          renderItem={renderUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  title: {
    fontSize: typography.fontSizes.xl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    position: 'relative',
  },
  searchInput: {
    marginBottom: 0,
  },
  loadingIndicator: {
    position: 'absolute',
    right: spacing.xl,
    top: spacing.md + 12,
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.sm,
    marginRight: spacing.sm,
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
  bio: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[600],
    marginTop: 2,
  },
});
