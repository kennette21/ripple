import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Input } from '@components/ui';
import { updatePassword } from '@lib/supabase';
import { colors, spacing, typography } from '@constants/theme';

export default function ChangePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidPassword = password.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isValidPassword && passwordsMatch;

  const handleChangePassword = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await updatePassword(password);
      if (updateError) {
        setError(updateError.message);
      } else {
        Alert.alert('Success', 'Your password has been updated.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.gray[600]} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Change Password</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.description}>
            Enter your new password below. Password must be at least 6
            characters.
          </Text>

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
              title="Update Password"
              onPress={handleChangePassword}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray[100],
  },
  headerTitle: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  description: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  form: {},
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
});
