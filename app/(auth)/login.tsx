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
import { Link, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Input } from '@components/ui';
import { useSignIn } from '@hooks/auth';
import { colors, spacing, typography } from '@constants/theme';
import { PATTERNS } from '@constants/config';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, isLoading, error, resetError } = useSignIn();

  const isValidEmail = PATTERNS.email.test(email);
  const canSubmit = isValidEmail && password.length >= 6;

  const handleLogin = async () => {
    if (!canSubmit) return;
    await signIn(email, password);
  };

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
            <Text style={styles.logo}>Ripple</Text>
            <Text style={styles.tagline}>
              Connect &lt;&lt;&lt;+&gt;&gt;&gt; Reflect
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
              placeholder="Enter your password"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                resetError();
              }}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              leftIcon="lock-closed-outline"
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title="Sign In"
              onPress={handleLogin}
              disabled={!canSubmit}
              loading={isLoading}
              style={styles.button}
            />

            <TouchableOpacity
              onPress={() => router.push('/(auth)/magic-link')}
              style={styles.magicLinkButton}
            >
              <Text style={styles.magicLinkText}>
                Sign in with magic link instead
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.footerLink}>Sign up</Text>
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
  logo: {
    fontSize: 48,
    fontWeight: typography.fontWeights.bold,
    color: colors.primary[500],
    marginBottom: spacing.sm,
  },
  tagline: {
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
  magicLinkButton: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  magicLinkText: {
    color: colors.primary[500],
    fontSize: typography.fontSizes.sm,
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
