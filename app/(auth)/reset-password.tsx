import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@components/ui';
import { updatePassword } from '@lib/supabase';
import { colors, spacing, typography } from '@constants/theme';

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isValidPassword = password.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isValidPassword && passwordsMatch;

  const handleResetPassword = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="checkmark-circle-outline"
              size={64}
              color={colors.success.main}
            />
          </View>
          <Text style={styles.successTitle}>Password Updated</Text>
          <Text style={styles.successText}>
            Your password has been successfully reset.
          </Text>
          <Button
            title="Continue"
            onPress={() => router.replace('/(main)/(feed)')}
            style={styles.continueButton}
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
          <View style={styles.header}>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your new password below.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="New Password"
              placeholder="Enter new password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
            />

            <Input
              label="Confirm Password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                setError(null);
              }}
              secureTextEntry
              autoCapitalize="none"
              leftIcon="lock-closed-outline"
            />

            {password.length > 0 && password.length < 6 && (
              <Text style={styles.hint}>
                Password must be at least 6 characters
              </Text>
            )}

            {confirmPassword.length > 0 && !passwordsMatch && (
              <Text style={styles.error}>Passwords do not match</Text>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Reset Password"
              onPress={handleResetPassword}
              disabled={!canSubmit}
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
    justifyContent: 'center',
  },
  header: {
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
  hint: {
    color: colors.gray[500],
    fontSize: typography.fontSizes.sm,
    marginBottom: spacing.md,
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
    backgroundColor: colors.success.light,
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
    marginBottom: spacing.xl,
  },
  continueButton: {
    minWidth: 200,
  },
});
