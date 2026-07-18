import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@components/ui';
import { APP_CONFIG } from '@constants/config';
import { borderRadius, colors, shadows, spacing, typography } from '@constants/theme';
import { queryClient } from '@lib/queryClient';
import { signInWithEmail } from '@lib/supabase/auth';
import { useAuth } from '@providers/AuthProvider';
import { DevThemePanel } from './DevThemePanel';

const DEV_PASSWORD = '12345678';

const DEV_ACCOUNTS = [
  {
    name: 'Marcus Aurelius',
    email: 'marcus.aurelius@gmail.com',
    avatarPath: 'avatar-01.png',
  },
  {
    name: 'Julius Caesar',
    email: 'julius.caesar@gmail.com',
    avatarPath: 'avatar-02.png',
  },
  { name: 'Augustus', email: 'augustus@gmail.com', avatarPath: 'avatar-03.png' },
  { name: 'Cicero', email: 'cicero@gmail.com', avatarPath: 'avatar-04.png' },
  { name: 'Seneca', email: 'seneca@gmail.com', avatarPath: 'avatar-05.png' },
] as const;

const isEnabled = __DEV__;
const canSwitchAccounts = APP_CONFIG.isLocalSupabase;
const DEBUG_BUTTON_SIZE = 46;
const DEBUG_BUTTON_EDGE_INSET = spacing.sm;
const DEBUG_BUTTON_BOTTOM_OFFSET = 76;

type DevToolTab = 'accounts' | 'themes';

export function DevTools() {
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<DevToolTab>(
    canSwitchAccounts ? 'accounts' : 'themes',
  );
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const minimumButtonX = DEBUG_BUTTON_EDGE_INSET;
  const maximumButtonX = Math.max(
    minimumButtonX,
    windowWidth - DEBUG_BUTTON_SIZE - DEBUG_BUTTON_EDGE_INSET,
  );
  const minimumButtonY = insets.top + DEBUG_BUTTON_EDGE_INSET;
  const maximumButtonY = Math.max(
    minimumButtonY,
    windowHeight - insets.bottom - DEBUG_BUTTON_SIZE - DEBUG_BUTTON_EDGE_INSET,
  );
  const buttonX = useSharedValue(
    Math.max(minimumButtonX, windowWidth - DEBUG_BUTTON_SIZE - spacing.md),
  );
  const buttonY = useSharedValue(
    Math.min(
      maximumButtonY,
      Math.max(
        minimumButtonY,
        windowHeight -
          insets.bottom -
          DEBUG_BUTTON_BOTTOM_OFFSET -
          DEBUG_BUTTON_SIZE,
      ),
    ),
  );
  const dragStartX = useSharedValue(0);
  const dragStartY = useSharedValue(0);

  useEffect(() => {
    buttonX.value = Math.min(
      maximumButtonX,
      Math.max(minimumButtonX, buttonX.value),
    );
    buttonY.value = Math.min(
      maximumButtonY,
      Math.max(minimumButtonY, buttonY.value),
    );
  }, [
    buttonX,
    buttonY,
    maximumButtonX,
    maximumButtonY,
    minimumButtonX,
    minimumButtonY,
  ]);

  const dragGesture = Gesture.Pan()
    .maxPointers(1)
    .minDistance(5)
    .onStart(() => {
      dragStartX.value = buttonX.value;
      dragStartY.value = buttonY.value;
    })
    .onUpdate((event) => {
      buttonX.value = Math.min(
        maximumButtonX,
        Math.max(minimumButtonX, dragStartX.value + event.translationX),
      );
      buttonY.value = Math.min(
        maximumButtonY,
        Math.max(minimumButtonY, dragStartY.value + event.translationY),
      );
    });

  const animatedButtonStyle = useAnimatedStyle(() => ({
    left: buttonX.value,
    top: buttonY.value,
  }));

  if (!isEnabled) return null;

  const open = () => {
    setError(null);
    setIsOpen(true);
  };

  const close = () => {
    if (switchingEmail) return;
    setIsOpen(false);
    setError(null);
  };

  const switchAccount = async (email: string) => {
    if (email === user?.email) {
      close();
      return;
    }

    setSwitchingEmail(email);
    setError(null);
    queryClient.clear();

    try {
      const { error: authError } = await signInWithEmail(email, DEV_PASSWORD);

      if (authError) {
        setError(authError.message);
        return;
      }

      queryClient.clear();
      setIsOpen(false);
      router.replace('/(main)/(feed)');
    } catch {
      setError('Could not switch accounts. Is the local seed database running?');
    } finally {
      setSwitchingEmail(null);
    }
  };

  return (
    <>
      <GestureDetector gesture={dragGesture}>
        <Animated.View style={[styles.debugButtonContainer, animatedButtonStyle]}>
          <Pressable
            accessibilityHint="Tap to open or drag to reposition"
            accessibilityLabel="Open developer tools"
            accessibilityRole="button"
            onPress={open}
            style={({ pressed }) => [
              styles.debugButton,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="bug-outline" size={22} color={colors.white} />
          </Pressable>
        </Animated.View>
      </GestureDetector>

      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={isOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close developer tools"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.eyebrow}>LOCAL DEVELOPMENT</Text>
                <Text style={styles.title}>Developer tools</Text>
              </View>
              <Pressable
                accessibilityLabel="Close"
                accessibilityRole="button"
                disabled={!!switchingEmail}
                hitSlop={12}
                onPress={close}
              >
                <Ionicons name="close" size={24} color={colors.gray[500]} />
              </Pressable>
            </View>

            <View accessibilityRole="tablist" style={styles.tabBar}>
              {(canSwitchAccounts
                ? (['accounts', 'themes'] as const)
                : (['themes'] as const)
              ).map((tab) => {
                const selected = activeTab === tab;
                const label = tab === 'accounts' ? 'Accounts' : 'Themes';
                const icon = tab === 'accounts' ? 'people-outline' : 'color-palette-outline';

                return (
                  <Pressable
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    key={tab}
                    onPress={() => setActiveTab(tab)}
                    style={[styles.tab, selected && styles.activeTab]}
                  >
                    <Ionicons
                      name={icon}
                      size={17}
                      color={selected ? colors.primary[600] : colors.gray[500]}
                    />
                    <Text style={[styles.tabText, selected && styles.activeTabText]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeTab === 'accounts' ? (
              <>
                <View style={styles.accountList}>
                  {DEV_ACCOUNTS.map((account) => {
                    const isCurrent = account.email === user?.email;
                    const isSwitching = account.email === switchingEmail;

                    return (
                      <Pressable
                        accessibilityRole="button"
                        disabled={!!switchingEmail}
                        key={account.email}
                        onPress={() => switchAccount(account.email)}
                        style={({ pressed }) => [
                          styles.account,
                          isCurrent && styles.currentAccount,
                          pressed && styles.accountPressed,
                        ]}
                      >
                        <Avatar uri={account.avatarPath} name={account.name} size="md" />
                        <View style={styles.accountDetails}>
                          <Text style={styles.accountName}>{account.name}</Text>
                          <Text style={styles.accountEmail}>{account.email}</Text>
                        </View>
                        {isSwitching ? (
                          <ActivityIndicator color={colors.primary[500]} />
                        ) : isCurrent ? (
                          <View style={styles.currentBadge}>
                            <Ionicons name="checkmark" size={14} color={colors.primary[700]} />
                            <Text style={styles.currentBadgeText}>Current</Text>
                          </View>
                        ) : (
                          <Ionicons name="chevron-forward" size={20} color={colors.gray[400]} />
                        )}
                      </Pressable>
                    );
                  })}
                </View>

                {error && <Text style={styles.error}>{error}</Text>}
              </>
            ) : (
              <DevThemePanel />
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  debugButtonContainer: {
    position: 'absolute',
    zIndex: 100,
    width: DEBUG_BUTTON_SIZE,
    height: DEBUG_BUTTON_SIZE,
  },
  debugButton: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray[900],
    borderWidth: 2,
    borderColor: colors.white,
    ...shadows.lg,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.48)',
  },
  sheet: {
    maxHeight: '90%',
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md,
    ...shadows.lg,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  eyebrow: {
    color: colors.primary[600],
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.bold,
    letterSpacing: 0.8,
  },
  title: {
    marginTop: spacing.xs,
    color: colors.gray[900],
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
  },
  description: {
    marginTop: spacing.sm,
    color: colors.gray[500],
    fontSize: typography.fontSizes.sm,
  },
  tabBar: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.lg,
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
  },
  tab: {
    height: 38,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
  },
  activeTab: {
    backgroundColor: colors.white,
    ...shadows.sm,
  },
  tabText: {
    color: colors.gray[500],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  activeTabText: {
    color: colors.primary[700],
  },
  accountList: {
    marginTop: spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
  },
  account: {
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  currentAccount: {
    backgroundColor: colors.primary[50],
  },
  accountPressed: {
    backgroundColor: colors.gray[100],
  },
  accountDetails: {
    flex: 1,
  },
  accountName: {
    color: colors.gray[900],
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.semibold,
  },
  accountEmail: {
    marginTop: 2,
    color: colors.gray[500],
    fontSize: typography.fontSizes.xs,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
  },
  currentBadgeText: {
    color: colors.primary[700],
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
  },
  error: {
    marginTop: spacing.md,
    color: colors.error.dark,
    fontSize: typography.fontSizes.sm,
  },
});

// Kept for imports outside the root layout while the dev surface grows beyond accounts.
export const DevAccountSwitcher = DevTools;
