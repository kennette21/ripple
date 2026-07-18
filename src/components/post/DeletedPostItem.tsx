import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { BUCKETS, getPublicUrl } from '@/lib/supabase/storage';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';
import type { DeletedPost } from '@/hooks/posts/useDeletedPosts';

const RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface DeletedPostItemProps {
  post: DeletedPost;
  isRestoring?: boolean;
  isDeleting?: boolean;
  onRestore: (postId: string) => void;
  onDeletePermanently: (postId: string) => void;
}

export function DeletedPostItem({
  post,
  isRestoring = false,
  isDeleting = false,
  onRestore,
  onDeletePermanently,
}: DeletedPostItemProps) {
  const firstImage = useMemo(
    () => [...post.images].sort((a, b) => a.position - b.position)[0],
    [post.images]
  );
  const deletedAt = new Date(post.deleted_at);
  const expiresAt = deletedAt.getTime() + RETENTION_DAYS * DAY_IN_MS;
  const daysRemaining = Math.max(
    0,
    Math.ceil((expiresAt - Date.now()) / DAY_IN_MS)
  );
  const title = post.caption || 'Reflection';
  const preview = post.reflection || post.caption || 'Untitled post';
  const isBusy = isRestoring || isDeleting;

  return (
    <View style={styles.container}>
      {firstImage ? (
        <Image
          source={{
            uri: getPublicUrl(
              BUCKETS.POST_IMAGES,
              firstImage.thumbnail_path || firstImage.storage_path
            ),
          }}
          style={styles.thumbnail}
          placeholder={firstImage.blurhash || undefined}
          contentFit="cover"
          transition={150}
        />
      ) : (
        <View style={[styles.thumbnail, styles.reflectionThumbnail]}>
          <Ionicons
            name="document-text-outline"
            size={28}
            color={colors.gray[400]}
          />
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.preview} numberOfLines={2}>
          {preview}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>Deleted {format(deletedAt, 'MMM d')}</Text>
          <View
            style={[
              styles.countdownBadge,
              daysRemaining <= 7 && styles.countdownBadgeUrgent,
            ]}
          >
            <Text
              style={[
                styles.countdownText,
                daysRemaining <= 7 && styles.countdownTextUrgent,
              ]}
            >
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [
              styles.restoreButton,
              pressed && styles.buttonPressed,
              isBusy && styles.buttonDisabled,
            ]}
            onPress={() => onRestore(post.id)}
            disabled={isBusy}
            testID={`restore-post-${post.id}`}
            accessibilityRole="button"
            accessibilityLabel="Restore post"
            accessibilityState={{ busy: isRestoring, disabled: isBusy }}
          >
            {isRestoring ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="arrow-undo" size={15} color={colors.white} />
                <Text style={styles.restoreText}>Restore</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.deleteButton,
              pressed && styles.deleteButtonPressed,
              isBusy && styles.buttonDisabled,
            ]}
            onPress={() => onDeletePermanently(post.id)}
            disabled={isBusy}
            testID={`permanently-delete-post-${post.id}`}
            accessibilityRole="button"
            accessibilityLabel="Delete post permanently"
            accessibilityState={{ busy: isDeleting, disabled: isBusy }}
            hitSlop={6}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={colors.error.main} />
            ) : (
              <Ionicons
                name="trash-outline"
                size={20}
                color={colors.error.main}
              />
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  thumbnail: {
    width: 84,
    height: 84,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
  },
  reflectionThumbnail: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  preview: {
    marginTop: 2,
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
    color: colors.gray[600],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  meta: {
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
  countdownBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.full,
    backgroundColor: colors.gray[100],
  },
  countdownBadgeUrgent: {
    backgroundColor: colors.warning.light,
  },
  countdownText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[600],
  },
  countdownTextUrgent: {
    color: colors.warning.dark,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  restoreButton: {
    minHeight: 34,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[500],
  },
  restoreText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  deleteButton: {
    width: 38,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.lg,
    backgroundColor: colors.error.light,
  },
  deleteButtonPressed: {
    backgroundColor: '#FECACA',
  },
  buttonPressed: {
    opacity: 0.78,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
});
