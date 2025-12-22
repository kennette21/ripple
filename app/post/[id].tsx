import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@providers/AuthProvider';
import { usePost } from '@/hooks/posts/usePost';
import { PostCard } from '@/components/post/PostCard';
import { LoadingScreen, EmptyState } from '@components/common';
import { colors, spacing, typography } from '@constants/theme';

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const { data: post, isLoading: postLoading } = usePost(id, user?.id);

  const handleRipple = useCallback(() => {
    Alert.alert(
      'Coming Soon',
      'Ripple messaging will let you connect directly with this person. Stay tuned!'
    );
  }, []);

  if (postLoading) {
    return <LoadingScreen />;
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon="document-text-outline"
          title="Post not found"
          description="This post doesn't exist or has been removed"
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.navbar}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[900]} />
        </Pressable>
        <Text style={styles.navTitle}>Post</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <PostCard
          post={post}
          currentUserId={user?.id}
          onRipple={handleRipple}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  navbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  backButton: {
    padding: spacing.xs,
  },
  navTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
  },
});
