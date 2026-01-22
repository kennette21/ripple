import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input, Card } from '@components/ui';
import { useSignIn } from '@hooks/auth';
import { colors, spacing, typography } from '@constants/theme';
import { PATTERNS } from '@constants/config';

export default function MagicLinkScreen() {
  const [email, setEmail] = useState('');
  const { signInWithMagic, isLoading, error, magicLinkSent, resetError } =
    useSignIn();

  const isValidEmail = PATTERNS.email.test(email);

  const handleSendLink = async () => {
    if (!isValidEmail) return;
    await signInWithMagic(email);
  };

  if (magicLinkSent) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="mail-outline"
              size={64}
              color={colors.primary[500]}
            />
          </View>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successText}>
            We sent a magic link to{'\n'}
            <Text style={styles.emailHighlight}>{email}</Text>
          </Text>
          <Text style={styles.successHint}>
            Click the link in the email to sign in. The link will expire in 1
            hour.
          </Text>
          <Button
            title="Back to Sign In"
            onPress={() => router.replace('/(auth)/login')}
            variant="outline"
            style={styles.backButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backLink}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={colors.gray[600]}
            />
          </TouchableOpacity>

          <View style={styles.header}>
            <Text style={styles.title}>Magic Link</Text>
            <Text style={styles.subtitle}>
              Sign in without a password. We'll send you a link to your email.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                resetError();
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Send Magic Link"
              onPress={handleSendLink}
              disabled={!isValidEmail}
              loading={isLoading}
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  backLink: {
    marginTop: spacing.md,
    padding: spacing.sm,
    marginLeft: -spacing.sm,
  },
  header: {
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.fontSizes.xxxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
    lineHeight: 24,
  },
  form: {
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.error.main,
    fontSize: typography.fontSizes.sm,
    marginBottom: spacing.md,
  },
  button: {
    marginTop: spacing.sm,
  },
  // Success state
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  successTitle: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginBottom: spacing.md,
  },
  successText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emailHighlight: {
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  successHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  backButton: {
    minWidth: 200,
  },
});
