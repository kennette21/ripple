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
import { updateEmail } from '@lib/supabase';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography } from '@constants/theme';
import { PATTERNS } from '@constants/config';

export default function ChangeEmailScreen() {
  const { user } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isValidEmail = PATTERNS.email.test(newEmail);
  const isSameEmail = newEmail.toLowerCase() === user?.email?.toLowerCase();
  const canSubmit = isValidEmail && !isSameEmail;

  const handleChangeEmail = async () => {
    if (!canSubmit) return;
    setIsLoading(true);
    setError(null);

    try {
      const { error: updateError } = await updateEmail(newEmail);
      if (updateError) {
        setError(updateError.message);
      } else {
        Alert.alert(
          'Confirmation Required',
          'We sent confirmation emails to both your current and new email addresses. Please confirm both to complete the change.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
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
        <Text style={styles.headerTitle}>Change Email</Text>
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
          <View style={styles.currentEmailSection}>
            <Text style={styles.label}>Current Email</Text>
            <Text style={styles.currentEmail}>{user?.email}</Text>
          </View>

          <View style={styles.form}>
            <Input
              label="New Email"
              placeholder="new@example.com"
              value={newEmail}
              onChangeText={(text) => {
                setNewEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              leftIcon="mail-outline"
            />

            {isSameEmail && newEmail.length > 0 && (
              <Text style={styles.hint}>
                New email must be different from your current email
              </Text>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Update Email"
              onPress={handleChangeEmail}
              disabled={!canSubmit}
              loading={isLoading}
              style={styles.button}
            />

            <Text style={styles.infoText}>
              You will receive confirmation emails at both your current and new
              email addresses. You must confirm both to complete the change.
            </Text>
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
  currentEmailSection: {
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.medium,
    color: colors.gray[500],
    marginBottom: spacing.xs,
  },
  currentEmail: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[900],
    fontWeight: typography.fontWeights.medium,
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
  infoText: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    lineHeight: 20,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
});
