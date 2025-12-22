import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@components/ui';
import { useSignUp } from '@hooks/auth';
import { colors, spacing, typography } from '@constants/theme';
import { PATTERNS } from '@constants/config';

export default function SignupScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { signUp, isLoading, error, resetError } = useSignUp();

  const isValidEmail = PATTERNS.email.test(email);
  const isValidPassword = password.length >= 6;
  const passwordsMatch = password === confirmPassword;
  const canSubmit = isValidEmail && isValidPassword && passwordsMatch;

  const getPasswordError = () => {
    if (password.length > 0 && password.length < 6) {
      return 'Password must be at least 6 characters';
    }
    if (confirmPassword.length > 0 && !passwordsMatch) {
      return 'Passwords do not match';
    }
    return undefined;
  };

  const handleSignup = async () => {
    if (!canSubmit) return;

    const success = await signUp(email, password);

    if (success) {
      Alert.alert(
        'Check your email',
        'We sent you a confirmation email. Please verify your email to continue.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Join Ripple and connect meaningfully
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

            <Input
              label="Password"
              placeholder="At least 6 characters"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                resetError();
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              error={password.length > 0 && password.length < 6 ? 'Password must be at least 6 characters' : undefined}
            />

            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                resetError();
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="new-password"
              leftIcon="lock-closed-outline"
              error={confirmPassword.length > 0 && !passwordsMatch ? 'Passwords do not match' : undefined}
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Create Account"
              onPress={handleSignup}
              disabled={!canSubmit}
              loading={isLoading}
              style={styles.button}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign in</Text>
              </TouchableOpacity>
            </Link>
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
    alignItems: 'center',
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
    textAlign: 'center',
  },
  form: {
    marginBottom: spacing.xl,
  },
  error: {
    color: colors.error.main,
    fontSize: typography.fontSizes.sm,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
  },
  footerLink: {
    fontSize: typography.fontSizes.md,
    color: colors.primary[500],
    fontWeight: typography.fontWeights.semibold,
  },
});
