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
import { Button, Input } from '@components/ui';
import { supabase } from '@lib/supabase';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography } from '@constants/theme';
import { LIMITS, PATTERNS } from '@constants/config';

export default function ProfileSetupScreen() {
  const { user, refreshProfile } = useAuth();
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const isValidUsername = PATTERNS.username.test(username);
  const isValidDisplayName = displayName.trim().length >= 1;
  const canSubmit = isValidUsername && isValidDisplayName && !usernameError;

  // Check username availability
  const checkUsername = async (value: string) => {
    if (!PATTERNS.username.test(value)) {
      setUsernameError(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value.toLowerCase())
        .maybeSingle();

      if (data) {
        setUsernameError('Username is already taken');
      } else {
        setUsernameError(null);
      }
    } catch (err) {
      console.error('Error checking username:', err);
    }
  };

  const handleContinue = async () => {
    if (!canSubmit || !user) return;

    setIsLoading(true);

    try {
      const { error } = await (supabase.from('profiles') as any).upsert({
        id: user.id,
        username: username.toLowerCase(),
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        onboarding_completed: false, // Will be completed after setting goal
      });

      if (error) {
        console.error('Error creating profile:', error);
        setUsernameError(error.message);
        return;
      }

      await refreshProfile();
      router.push('/(auth)/onboarding/avatar');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getInputError = () => {
    if (username.length > 0 && !PATTERNS.username.test(username)) {
      return 'Username must be 3-20 characters (letters, numbers, underscores only)';
    }
    return usernameError ?? undefined;
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
          <View style={styles.progress}>
            <View style={[styles.progressDot, styles.progressActive]} />
            <View style={styles.progressDot} />
            <View style={styles.progressDot} />
          </View>

          <View style={styles.header}>
            <Text style={styles.title}>Set up your profile</Text>
            <Text style={styles.subtitle}>
              Let others know who you are. You can always change this later.
            </Text>
          </View>

          <View style={styles.form}>
            <Input
              label="Username"
              placeholder="yourname"
              value={username}
              onChangeText={(text) => {
                const cleaned = text.toLowerCase().replace(/[^a-z0-9_]/g, '');
                setUsername(cleaned);
                checkUsername(cleaned);
              }}
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon="at"
              error={getInputError()}
              hint={
                !getInputError() && username.length > 0
                  ? 'Username is available'
                  : undefined
              }
            />

            <Input
              label="Display Name"
              placeholder="Your Name"
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
              leftIcon="person-outline"
              maxLength={LIMITS.displayNameMaxLength}
            />

            <Input
              label="Bio (optional)"
              placeholder="Tell us about yourself"
              value={bio}
              onChangeText={setBio}
              multiline
              numberOfLines={3}
              maxLength={LIMITS.bioMaxLength}
              hint={`${bio.length}/${LIMITS.bioMaxLength}`}
            />
          </View>

          <Button
            title="Continue"
            onPress={handleContinue}
            disabled={!canSubmit}
            loading={isLoading}
            style={styles.button}
          />
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
    paddingTop: spacing.lg,
  },
  progress: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gray[200],
  },
  progressActive: {
    backgroundColor: colors.primary[500],
  },
  header: {
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
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
    flex: 1,
  },
  button: {
    marginTop: 'auto',
    marginBottom: spacing.xl,
  },
});
