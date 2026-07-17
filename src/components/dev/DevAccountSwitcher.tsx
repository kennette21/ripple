import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@components/ui';
import { APP_CONFIG } from '@constants/config';
import { borderRadius, colors, shadows, spacing, typography } from '@constants/theme';
import { queryClient } from '@lib/queryClient';
import { signInWithEmail } from '@lib/supabase/auth';
import { useAuth } from '@providers/AuthProvider';

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

const isEnabled = __DEV__ && APP_CONFIG.isLocalSupabase;

export function DevAccountSwitcher() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [switchingEmail, setSwitchingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Pressable
        accessibilityLabel="Open development account switcher"
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          styles.debugButton,
          { bottom: insets.bottom + 76 },
          pressed && styles.pressed,
        ]}
      >
        <Ionicons name="bug-outline" size={22} color={colors.white} />
      </Pressable>

      <Modal
        animationType="fade"
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={isOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Close development account switcher"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.eyebrow}>LOCAL DEVELOPMENT</Text>
                <Text style={styles.title}>Switch account</Text>
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
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  debugButton: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 100,
    width: 46,
    height: 46,
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
