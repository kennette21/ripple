import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { Avatar } from '@components/ui';
import { EmptyState } from '@components/common';
import { useAuth } from '@providers/AuthProvider';
import {
  groupNotificationsByStory,
  useMarkNotificationsSeen,
  useNotifications,
  type NotificationStoryGroup,
} from '@/hooks/notifications';
import { colors, spacing, typography } from '@constants/theme';

interface StorySection {
  title: string;
  data: NotificationStoryGroup[];
}

const EXPAND_DURATION = 340;
const COLLAPSE_DURATION = 270;
const EXPANSION_EASING = Easing.bezier(0.2, 0, 0, 1);

function expansionTiming(isExpanded: boolean) {
  return {
    duration: isExpanded ? EXPAND_DURATION : COLLAPSE_DURATION,
    easing: EXPANSION_EASING,
    reduceMotion: ReduceMotion.System,
  };
}

function StoryAvatars({
  story,
  onActorPress,
  onExpand,
}: {
  story: NotificationStoryGroup;
  onActorPress: (profileId: string) => void;
  onExpand?: () => void;
}) {
  const visibleActors = story.actors.slice(0, 3);
  const remainingCount = story.actors.length - visibleActors.length;

  return (
    <View style={styles.avatars} accessibilityLabel={story.actorLabel}>
      {(visibleActors.length > 0 ? visibleActors : [null]).map((actor, index) =>
        actor ? (
          <Pressable
            key={actor.id}
            style={index > 0 ? styles.avatarPressableOverlap : undefined}
            onPress={(event) => {
              event.stopPropagation();
              onActorPress(actor.id);
            }}
            accessibilityRole="button"
            accessibilityLabel={`View ${actor.display_name || actor.username}'s profile`}
            hitSlop={4}
          >
            <Avatar
              uri={actor.avatar_url}
              name={actor.display_name || actor.username}
              size="sm"
              style={index > 0 ? styles.stackedAvatar : undefined}
            />
          </Pressable>
        ) : (
          <Avatar key="unknown" name="Someone" size="sm" />
        )
      )}
      {remainingCount > 0 && onExpand && (
        <Pressable
          style={[styles.remainingActors, styles.avatarOverlap]}
          onPress={(event) => {
            event.stopPropagation();
            onExpand?.();
          }}
          accessibilityRole="button"
          accessibilityLabel={`Show ${remainingCount} more ${remainingCount === 1 ? 'person' : 'people'}`}
        >
          <Text style={styles.remainingActorsText}>+{remainingCount}</Text>
        </Pressable>
      )}
      {remainingCount > 0 && !onExpand && (
        <View style={[styles.remainingActors, styles.avatarOverlap]}>
          <Text style={styles.remainingActorsText}>+{remainingCount}</Text>
        </View>
      )}
    </View>
  );
}

function ExpandedPeople({
  story,
  onActorPress,
}: {
  story: NotificationStoryGroup;
  onActorPress: (profileId: string) => void;
}) {
  return (
    <View style={styles.expandedPeople}>
      {story.actors.map((actor) => (
        <Pressable
          key={actor.id}
          style={({ pressed }) => [
            styles.expandedPerson,
            pressed && styles.expandedPersonPressed,
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onActorPress(actor.id);
          }}
          accessibilityRole="button"
          accessibilityLabel={`View ${actor.display_name || actor.username}'s profile`}
        >
          <Avatar
            uri={actor.avatar_url}
            name={actor.display_name || actor.username}
            size="md"
          />
          <View style={styles.expandedPersonText}>
            <Text style={styles.expandedPersonName} numberOfLines={2}>
              {actor.display_name || actor.username}
            </Text>
            <Text style={styles.expandedPersonUsername} numberOfLines={1}>
              @{actor.username}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function ExpansionChevron({ isExpanded }: { isExpanded: boolean }) {
  const progress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(
      isExpanded ? 1 : 0,
      expansionTiming(isExpanded)
    );
  }, [isExpanded, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${progress.value * 180}deg` }],
  }));

  return (
    <Animated.View style={animatedStyle} pointerEvents="none">
      <Ionicons name="chevron-down" size={17} color={colors.gray[400]} />
    </Animated.View>
  );
}

function CollapsiblePeople({
  story,
  onActorPress,
  onToggle,
  isExpanded,
}: {
  story: NotificationStoryGroup;
  onActorPress: (profileId: string) => void;
  onToggle: () => void;
  isExpanded: boolean;
}) {
  const previewHeight = useSharedValue(0);
  const gridHeight = useSharedValue(0);
  const progress = useSharedValue(isExpanded ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(
      isExpanded ? 1 : 0,
      expansionTiming(isExpanded)
    );
  }, [isExpanded, progress]);

  const clipStyle = useAnimatedStyle(() => ({
    height: interpolate(
      progress.value,
      [0, 1],
      [previewHeight.value, gridHeight.value]
    ),
  }));

  const previewStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.65, 1], [1, 0, 0]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [0, -4]) },
    ],
  }));

  const gridStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.25, 1], [0, 0, 1]),
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [4, 0]) },
    ],
  }));

  const handlePreviewLayout = (event: LayoutChangeEvent) => {
    previewHeight.value = event.nativeEvent.layout.height;
  };

  const handleGridLayout = (event: LayoutChangeEvent) => {
    gridHeight.value = event.nativeEvent.layout.height;
  };

  return (
    <View style={styles.peopleContentFrame}>
      <Animated.View style={[styles.peopleContentClip, clipStyle]}>
        <Animated.View
          style={[styles.peopleContentLayer, previewStyle]}
          onLayout={handlePreviewLayout}
          pointerEvents={isExpanded ? 'none' : 'auto'}
          accessibilityElementsHidden={isExpanded}
          importantForAccessibility={isExpanded ? 'no-hide-descendants' : 'auto'}
        >
          <View style={styles.peoplePreview}>
            <StoryAvatars
              story={story}
              onActorPress={onActorPress}
              onExpand={onToggle}
            />
            <Text style={styles.peoplePreviewLabel} numberOfLines={2}>
              {story.actorLabel}
            </Text>
          </View>
        </Animated.View>

        <Animated.View
          style={[styles.peopleContentLayer, gridStyle]}
          onLayout={handleGridLayout}
          pointerEvents={isExpanded ? 'auto' : 'none'}
          accessibilityElementsHidden={!isExpanded}
          importantForAccessibility={isExpanded ? 'auto' : 'no-hide-descendants'}
        >
          <ExpandedPeople story={story} onActorPress={onActorPress} />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function StoryRow({
  story,
  onPress,
  onActorPress,
  isExpanded,
}: {
  story: NotificationStoryGroup;
  onPress: () => void;
  onActorPress: (profileId: string) => void;
  isExpanded: boolean;
}) {
  const timeAgo = formatDistanceToNow(new Date(story.latestAt), {
    addSuffix: true,
  });
  const isExpandablePeople = story.kind === 'people' && story.actors.length > 1;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.story,
        story.isNew && styles.storyNew,
        pressed && styles.storyPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${story.actorLabel}. ${story.activitySummary}`}
      accessibilityHint={isExpandablePeople
        ? `${isExpanded ? 'Collapses' : 'Expands'} the people in this notification`
        : story.kind === 'people'
          ? 'Opens this profile'
          : 'Opens the related post'
      }
      accessibilityState={isExpandablePeople
        ? { expanded: isExpanded }
        : undefined
      }
    >
      <View style={styles.actorRow}>
        {!isExpandablePeople && (
          <StoryAvatars
            story={story}
            onActorPress={onActorPress}
          />
        )}
        <View
          style={[
            styles.storyBody,
            isExpandablePeople && styles.followerStoryBody,
          ]}
        >
          <View style={styles.actorMetaRow}>
            <Text
              style={[
                styles.actorLabel,
                isExpandablePeople && styles.followerHeading,
              ]}
              numberOfLines={2}
            >
              {isExpandablePeople ? story.activitySummary : story.actorLabel}
            </Text>
            <View style={styles.storyMeta}>
              {story.isNew && <Text style={styles.newLabel}>New</Text>}
              {isExpandablePeople && (
                <ExpansionChevron isExpanded={isExpanded} />
              )}
            </View>
          </View>
          {!isExpandablePeople && (
            <Text style={styles.activitySummary}>{story.activitySummary}</Text>
          )}
          <Text style={styles.time}>{timeAgo}</Text>
        </View>
      </View>

      {isExpandablePeople && (
        <CollapsiblePeople
          story={story}
          onActorPress={onActorPress}
          onToggle={onPress}
          isExpanded={isExpanded}
        />
      )}
    </Pressable>
  );
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const {
    data: notifications = [],
    isError,
    isLoading,
    isRefetching,
    refetch,
  } = useNotifications(user?.id);
  const markSeen = useMarkNotificationsSeen(user?.id);
  const [newAtEntryIds, setNewAtEntryIds] = useState<Set<string> | null>(null);
  const [expandedStoryKeys, setExpandedStoryKeys] = useState<Set<string>>(
    new Set()
  );
  const markedSeenIdsRef = useRef(new Set<string>());
  const markSeenRef = useRef(markSeen.mutate);

  markSeenRef.current = markSeen.mutate;

  useEffect(() => {
    setNewAtEntryIds(null);
    setExpandedStoryKeys(new Set());
    markedSeenIdsRef.current.clear();
  }, [user?.id]);

  useEffect(() => {
    if (isLoading || newAtEntryIds !== null) return;

    setNewAtEntryIds(new Set(
      notifications
        .filter((notification) => notification.seen_at === null)
        .map((notification) => notification.id)
    ));
  }, [isLoading, newAtEntryIds, notifications]);

  const stories = useMemo(() => {
    if (!user?.id) return [];

    return groupNotificationsByStory(notifications, user.id).map((story) => ({
      ...story,
      isNew: story.isNew || story.notificationIds.some(
        (notificationId) => newAtEntryIds?.has(notificationId)
      ),
    }));
  }, [newAtEntryIds, notifications, user?.id]);

  const sections = useMemo<StorySection[]>(() => {
    const newStories = stories.filter((story) => story.isNew);
    const earlierStories = stories.filter((story) => !story.isNew);

    return [
      { title: 'New stories', data: newStories },
      { title: 'Earlier stories', data: earlierStories },
    ].filter((section) => section.data.length > 0);
  }, [stories]);

  const onViewableItemsChanged = useRef(({
    viewableItems,
  }: {
    viewableItems: ViewToken<NotificationStoryGroup>[];
  }) => {
    const notificationIds: string[] = [];

    viewableItems.forEach(({ isViewable, item }) => {
      if (!isViewable || !item?.unseenNotificationIds) return;

      item.unseenNotificationIds.forEach((notificationId) => {
        if (!markedSeenIdsRef.current.has(notificationId)) {
          markedSeenIdsRef.current.add(notificationId);
          notificationIds.push(notificationId);
        }
      });
    });

    if (notificationIds.length > 0) {
      markSeenRef.current(notificationIds);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 500,
  }).current;

  const handleActorPress = (profileId: string) => {
    router.push(`/user/${profileId}`);
  };

  const toggleStory = (storyKey: string) => {
    setExpandedStoryKeys((current) => {
      const next = new Set(current);
      if (next.has(storyKey)) {
        next.delete(storyKey);
      } else {
        next.add(storyKey);
      }
      return next;
    });
  };

  const handleStoryPress = (story: NotificationStoryGroup) => {
    if (story.unseenNotificationIds.length > 0) {
      story.unseenNotificationIds.forEach((notificationId) =>
        markedSeenIdsRef.current.add(notificationId)
      );
      markSeen.mutate(story.unseenNotificationIds);
    }

    if (story.kind === 'people') {
      if (story.actors.length > 1) {
        toggleStory(story.key);
      } else if (story.targetProfileId) {
        handleActorPress(story.targetProfileId);
      }
      return;
    }

    if (story.postId) {
      router.push({
        pathname: '/post/[id]',
        params: {
          id: story.postId,
          ...(story.targetCommentId
            ? { commentId: story.targetCommentId }
            : {}),
        },
      });
      return;
    }

    if (story.targetProfileId) {
      handleActorPress(story.targetProfileId);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <NotificationsHeader />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <NotificationsHeader />
      <SectionList
        sections={sections}
        keyExtractor={(story) => story.key}
        renderItem={({ item }) => (
          <StoryRow
            story={item}
            onPress={() => handleStoryPress(item)}
            onActorPress={handleActorPress}
            isExpanded={expandedStoryKeys.has(item.key)}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
          </View>
        )}
        ListEmptyComponent={
          isError ? (
            <EmptyState
              icon="cloud-offline-outline"
              title="Couldn't load notifications"
              description="Something went wrong while loading your activity."
              actionLabel="Try Again"
              onAction={() => void refetch()}
            />
          ) : (
            <EmptyState
              icon="water-outline"
              title="All quiet for now"
              description="New conversations and activity will gather here."
            />
          )
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary[500]}
          />
        }
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        stickySectionHeadersEnabled={false}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

function NotificationsHeader() {
  return (
    <View style={styles.header}>
      <Pressable
        style={styles.headerButton}
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.gray[700]} />
      </Pressable>
      <Text style={styles.headerTitle}>Notifications</Text>
      <View style={styles.headerPlaceholder} />
    </View>
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
  headerButton: {
    width: 32,
    alignItems: 'flex-start',
  },
  headerPlaceholder: {
    width: 32,
  },
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
  sectionHeader: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.white,
  },
  sectionTitle: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[600],
  },
  story: {
    marginHorizontal: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  storyNew: {
    backgroundColor: colors.primary[50],
    borderLeftWidth: 3,
    borderLeftColor: colors.primary[500],
  },
  storyPressed: {
    opacity: 0.68,
  },
  storyMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 0,
  },
  newLabel: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
  },
  actorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarOverlap: {
    marginLeft: -8,
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 18,
  },
  avatarPressableOverlap: {
    marginLeft: -8,
  },
  stackedAvatar: {
    borderWidth: 2,
    borderColor: colors.white,
    borderRadius: 18,
  },
  remainingActors: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[200],
  },
  remainingActorsText: {
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[600],
  },
  actorLabel: {
    flex: 1,
    marginRight: spacing.xs,
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  storyBody: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  followerStoryBody: {
    marginLeft: 0,
  },
  followerHeading: {
    fontSize: typography.fontSizes.sm,
  },
  actorMetaRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  activitySummary: {
    marginTop: spacing.xs,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[600],
  },
  time: {
    marginTop: 2,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[400],
  },
  peopleContentFrame: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  peopleContentClip: {
    position: 'relative',
    overflow: 'hidden',
  },
  peopleContentLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  peoplePreview: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  peoplePreviewLabel: {
    flex: 1,
    marginLeft: spacing.sm,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  expandedPeople: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  expandedPerson: {
    width: '48.5%',
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
  },
  expandedPersonPressed: {
    backgroundColor: colors.primary[50],
  },
  expandedPersonText: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  expandedPersonName: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  expandedPersonUsername: {
    marginTop: 1,
    fontSize: typography.fontSizes.xs,
    color: colors.gray[500],
  },
});
