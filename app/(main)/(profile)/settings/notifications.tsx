import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/components/ui';
import { EmptyState } from '@/components/common';
import { useAuth } from '@/providers/AuthProvider';
import {
  useNotificationPreferences,
  useSetAllPostNotificationSubscriptions,
  useSetNewPostNotificationMode,
  useSetPostNotificationSubscription,
  useUpdateBooleanNotificationPreference,
} from '@/hooks/notifications';
import {
  getDeviceNotificationPermission,
  openDeviceNotificationSettings,
  requestDeviceNotifications,
  syncPushDeviceRegistration,
  type DeviceNotificationPermission,
} from '@/lib/notifications/deviceNotifications';
import { getErrorMessage } from '@/lib/errors';
import type { NewPostNotificationMode } from '@/types/database';
import {
  borderRadius,
  colors,
  spacing,
  typography,
} from '@/constants/theme';

const NEW_POST_MODES: {
  label: string;
  value: NewPostNotificationMode;
}[] = [
  { label: 'Everyone', value: 'all' },
  { label: 'Choose people', value: 'selected' },
  { label: 'Off', value: 'off' },
];

const PERMISSION_COPY: Record<
  DeviceNotificationPermission,
  { action: string | null; description: string; title: string }
> = {
  granted: {
    action: 'Manage',
    title: 'Notifications are allowed',
    description: 'Your device allows Ripple alerts, sounds, and badges.',
  },
  provisional: {
    action: 'Manage',
    title: 'Notifications are delivered quietly',
    description: 'Your device allows Ripple notifications without interruption.',
  },
  denied: {
    action: 'Open settings',
    title: 'Notifications are off',
    description: 'Enable Ripple notifications in your device settings.',
  },
  undetermined: {
    action: 'Enable',
    title: 'Enable device notifications',
    description: 'Allow Ripple to send the alerts you choose below.',
  },
  unsupported: {
    action: null,
    title: 'Device notifications unavailable',
    description: 'Push notifications are supported in the iOS and Android apps.',
  },
};

type BooleanPreferenceKey =
  | 'comment_notifications'
  | 'follow_notifications';

interface PreferenceSwitchRowProps {
  description: string;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  title: string;
  value: boolean;
}

function PreferenceSwitchRow({
  description,
  disabled = false,
  onValueChange,
  title,
  value,
}: PreferenceSwitchRowProps) {
  return (
    <View style={styles.preferenceRow}>
      <View style={styles.preferenceCopy}>
        <Text style={styles.preferenceTitle}>{title}</Text>
        <Text style={styles.preferenceDescription}>{description}</Text>
      </View>
      <View style={styles.preferenceSwitchSlot}>
        <Switch
          accessibilityLabel={title}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{
            false: colors.gray[300],
            true: colors.primary[400],
          }}
          thumbColor={colors.white}
          value={value}
        />
      </View>
    </View>
  );
}

export default function NotificationSettingsScreen() {
  const { user } = useAuth();
  const {
    data,
    isLoading,
    isRefetching,
    error,
    refetch,
  } = useNotificationPreferences(user?.id);
  const setMode = useSetNewPostNotificationMode(user?.id);
  const setSubscription = useSetPostNotificationSubscription(user?.id);
  const setAllSubscriptions =
    useSetAllPostNotificationSubscriptions(user?.id);
  const updateBoolean =
    useUpdateBooleanNotificationPreference(user?.id);
  const [permission, setPermission] =
    useState<DeviceNotificationPermission>('undetermined');
  const [isPermissionLoading, setIsPermissionLoading] = useState(true);

  const refreshDevicePermission = useCallback(async () => {
    setIsPermissionLoading(true);

    try {
      const nextPermission = await getDeviceNotificationPermission();
      setPermission(nextPermission);

      if (nextPermission !== 'unsupported') {
        await syncPushDeviceRegistration();
      }
    } catch (permissionError) {
      console.warn('Could not refresh notification permission:', permissionError);
    } finally {
      setIsPermissionLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshDevicePermission();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshDevicePermission();
      }
    });

    return () => subscription.remove();
  }, [refreshDevicePermission]);

  const selectedIds = useMemo(
    () => new Set(data?.selectedAuthorIds ?? []),
    [data?.selectedAuthorIds]
  );
  const selectedCount = selectedIds.size;
  const followingCount = data?.following.length ?? 0;
  const allPeopleSelected =
    followingCount > 0 && selectedCount === followingCount;
  const mode = data?.settings.new_post_mode ?? 'all';
  const permissionCopy = PERMISSION_COPY[permission];
  const newPostMutationPending =
    setMode.isPending ||
    setSubscription.isPending ||
    setAllSubscriptions.isPending;
  const preferenceMutationPending =
    newPostMutationPending ||
    updateBoolean.isPending;

  const showError = useCallback((action: string, actionError: unknown) => {
    Alert.alert(
      `Could not ${action}`,
      getErrorMessage(actionError, 'Please try again.')
    );
  }, []);

  const handlePermissionAction = useCallback(async () => {
    if (!permissionCopy.action) return;
    setIsPermissionLoading(true);

    try {
      if (permission === 'undetermined') {
        const nextPermission = await requestDeviceNotifications();
        setPermission(nextPermission);
      } else {
        await openDeviceNotificationSettings();
      }
    } catch (actionError) {
      showError('update device notifications', actionError);
    } finally {
      setIsPermissionLoading(false);
    }
  }, [permission, permissionCopy.action, showError]);

  const handleModeChange = useCallback(async (
    nextMode: NewPostNotificationMode
  ) => {
    if (nextMode === mode || setMode.isPending) return;

    try {
      await setMode.mutateAsync(nextMode);
    } catch (modeError) {
      showError('update new-post notifications', modeError);
    }
  }, [mode, setMode, showError]);

  const handlePersonToggle = useCallback(async (
    authorId: string,
    enabled: boolean
  ) => {
    try {
      await setSubscription.mutateAsync({ authorId, enabled });
    } catch (subscriptionError) {
      showError('update this person', subscriptionError);
    }
  }, [setSubscription, showError]);

  const handleBulkToggle = useCallback(async () => {
    try {
      await setAllSubscriptions.mutateAsync(!allPeopleSelected);
    } catch (bulkError) {
      showError('update selected people', bulkError);
    }
  }, [allPeopleSelected, setAllSubscriptions, showError]);

  const handleBooleanChange = useCallback(async (
    key: BooleanPreferenceKey,
    value: boolean
  ) => {
    try {
      await updateBoolean.mutateAsync({ key, value });
    } catch (preferenceError) {
      showError('update notification preferences', preferenceError);
    }
  }, [showError, updateBoolean]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to settings"
          accessibilityRole="button"
          hitSlop={8}
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="arrow-back" size={24} color={colors.gray[700]} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerButton} />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary[500]} />
        </View>
      ) : error || !data ? (
        <EmptyState
          icon="notifications-off-outline"
          title="Could not load preferences"
          description={getErrorMessage(error, 'Please try again.')}
          actionLabel={isRefetching ? undefined : 'Try Again'}
          onAction={() => void refetch()}
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.sectionLabel}>System</Text>
          <View style={styles.systemCard}>
            <View style={styles.systemIcon}>
              <Ionicons
                name="notifications-outline"
                size={22}
                color={colors.primary[600]}
              />
            </View>
            <View style={styles.systemCopy}>
              <Text style={styles.systemTitle}>{permissionCopy.title}</Text>
              <Text style={styles.systemDescription}>
                {permissionCopy.description}
              </Text>
            </View>
            {permissionCopy.action && (
              <Pressable
                accessibilityRole="button"
                disabled={isPermissionLoading}
                onPress={() => void handlePermissionAction()}
                style={({ pressed }) => [
                  styles.systemAction,
                  pressed && styles.pressed,
                ]}
              >
                {isPermissionLoading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.primary[500]}
                  />
                ) : (
                  <Text style={styles.systemActionText}>
                    {permissionCopy.action}
                  </Text>
                )}
              </Pressable>
            )}
          </View>

          <Text style={styles.sectionLabel}>New posts</Text>
          <View style={styles.sectionCard}>
            <View style={styles.sectionIntro}>
              <Text style={styles.introTitle}>
                Who should Ripple tell you about?
              </Text>
              <Text style={styles.introDescription}>
                Choose whose new posts should appear in your notifications.
              </Text>
            </View>

            <View
              accessibilityRole="radiogroup"
              style={styles.segmentedControl}
            >
              {NEW_POST_MODES.map((option) => {
                const selected = mode === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    disabled={newPostMutationPending}
                    key={option.value}
                    onPress={() => void handleModeChange(option.value)}
                    style={[
                      styles.segment,
                      selected && styles.segmentSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        selected && styles.segmentTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {mode === 'all' && (
              <View style={styles.modeMessage}>
                <Ionicons
                  name="people-outline"
                  size={19}
                  color={colors.gray[500]}
                />
                <Text style={styles.modeMessageText}>
                  Everyone you follow now—and anyone you follow later—is
                  included.
                </Text>
              </View>
            )}

            {mode === 'off' && (
              <View style={styles.modeMessage}>
                <Ionicons
                  name="notifications-off-outline"
                  size={19}
                  color={colors.gray[500]}
                />
                <Text style={styles.modeMessageText}>
                  New posts still appear in your feed without push alerts.
                </Text>
              </View>
            )}

            {mode === 'selected' && (
              <View style={styles.peopleSection}>
                {followingCount > 0 ? (
                  <>
                    <View style={styles.peopleHeader}>
                      <Text style={styles.peopleCount}>
                        {selectedCount} of {followingCount} selected
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={newPostMutationPending}
                        onPress={() => void handleBulkToggle()}
                      >
                        <Text style={styles.bulkAction}>
                          {allPeopleSelected ? 'Deselect all' : 'Select all'}
                        </Text>
                      </Pressable>
                    </View>

                    <ScrollView
                      accessibilityLabel="People available for new-post notifications"
                      nestedScrollEnabled
                      scrollEnabled={followingCount > 5}
                      showsVerticalScrollIndicator={followingCount > 5}
                      style={
                        followingCount > 5
                          ? styles.peopleListScrollable
                          : undefined
                      }
                    >
                      {data.following.map((person, index) => {
                        const selected = selectedIds.has(person.id);
                        const changingThisPerson =
                          setSubscription.isPending &&
                          setSubscription.variables?.authorId === person.id;

                        return (
                          <Pressable
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: selected }}
                            disabled={newPostMutationPending}
                            key={person.id}
                            onPress={() =>
                              void handlePersonToggle(person.id, !selected)
                            }
                            style={[
                              styles.personRow,
                              index === data.following.length - 1 &&
                                styles.personRowLast,
                            ]}
                          >
                            <Avatar
                              name={person.displayName}
                              size="md"
                              uri={person.avatarUrl}
                            />
                            <View style={styles.personCopy}>
                              <Text style={styles.personName}>
                                {person.displayName}
                              </Text>
                              <Text style={styles.personUsername}>
                                @{person.username}
                              </Text>
                            </View>
                            {changingThisPerson ? (
                              <ActivityIndicator
                                size="small"
                                color={colors.primary[500]}
                              />
                            ) : (
                              <Ionicons
                                name={selected ? 'checkbox' : 'square-outline'}
                                size={24}
                                color={
                                  selected
                                    ? colors.primary[500]
                                    : colors.gray[400]
                                }
                              />
                            )}
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </>
                ) : (
                  <View style={styles.noPeople}>
                    <Text style={styles.noPeopleTitle}>
                      You are not following anyone yet
                    </Text>
                    <Text style={styles.noPeopleDescription}>
                      Follow someone to add them to new-post notifications.
                    </Text>
                  </View>
                )}
              </View>
            )}
          </View>

          <Text style={styles.sectionLabel}>Other activity</Text>
          <View style={styles.sectionCard}>
            <PreferenceSwitchRow
              description="When someone joins a conversation on your post"
              disabled={preferenceMutationPending}
              onValueChange={(value) =>
                void handleBooleanChange('comment_notifications', value)
              }
              title="Comments and replies"
              value={data.settings.comment_notifications ?? true}
            />
            <PreferenceSwitchRow
              description="When someone follows you"
              disabled={preferenceMutationPending}
              onValueChange={(value) =>
                void handleBooleanChange('follow_notifications', value)
              }
              title="New followers"
              value={data.settings.follow_notifications ?? true}
            />
          </View>

        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  systemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  systemIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  systemCopy: {
    flex: 1,
    gap: 2,
  },
  systemTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  systemDescription: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
    color: colors.gray[500],
  },
  systemAction: {
    minWidth: 64,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  systemActionText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
  },
  pressed: {
    opacity: 0.6,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.gray[200],
    paddingHorizontal: spacing.md,
  },
  sectionIntro: {
    paddingTop: spacing.md,
    gap: spacing.xs,
  },
  introTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  introDescription: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[500],
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  segment: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  segmentSelected: {
    borderColor: colors.gray[900],
    backgroundColor: colors.gray[900],
  },
  segmentText: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[700],
    textAlign: 'center',
  },
  segmentTextSelected: {
    color: colors.white,
  },
  modeMessage: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  modeMessageText: {
    flex: 1,
    fontSize: typography.fontSizes.sm,
    lineHeight: 20,
    color: colors.gray[500],
  },
  peopleSection: {
    marginTop: spacing.xs,
  },
  peopleHeader: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  peopleCount: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[700],
  },
  bulkAction: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
    color: colors.primary[600],
  },
  personRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  personRowLast: {
    borderBottomWidth: 0,
  },
  peopleListScrollable: {
    height: 320,
  },
  personCopy: {
    flex: 1,
    gap: 2,
  },
  personName: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[900],
  },
  personUsername: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  noPeople: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  noPeopleTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[800],
    textAlign: 'center',
  },
  noPeopleDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  preferenceRow: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  preferenceCopy: {
    flex: 1,
    gap: 2,
  },
  preferenceSwitchSlot: {
    width: 52,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceTitle: {
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[900],
  },
  preferenceDescription: {
    fontSize: typography.fontSizes.sm,
    lineHeight: 19,
    color: colors.gray[500],
  },
});
