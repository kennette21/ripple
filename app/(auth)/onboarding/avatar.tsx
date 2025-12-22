import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, Avatar } from '@components/ui';
import { supabase, uploadAvatar } from '@lib/supabase';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography } from '@constants/theme';

export default function AvatarSetupScreen() {
  const { user, profile, refreshProfile } = useAuth();
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permissionResult.granted) {
      Alert.alert(
        'Permission Required',
        'Please allow access to your photos to set a profile picture.'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const handleContinue = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      let avatarUrl = null;

      if (avatarUri) {
        const { url, error: uploadError } = await uploadAvatar(
          user.id,
          avatarUri
        );

        if (uploadError) {
          console.error('Error uploading avatar:', uploadError);
          Alert.alert('Upload Error', 'Failed to upload avatar. Continuing without it.');
        } else {
          avatarUrl = url;
        }
      }

      if (avatarUrl) {
        const { error } = await (supabase
          .from('profiles') as any)
          .update({ avatar_url: avatarUrl })
          .eq('id', user.id);

        if (error) {
          console.error('Error updating profile:', error);
        }
      }

      await refreshProfile();
      router.push('/(auth)/onboarding/daily-goal');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = () => {
    router.push('/(auth)/onboarding/daily-goal');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={styles.progressDot} />
        </View>

        <View style={styles.header}>
          <Text style={styles.title}>Add a profile photo</Text>
          <Text style={styles.subtitle}>
            Help others recognize you. You can skip this for now.
          </Text>
        </View>

        <TouchableOpacity style={styles.avatarContainer} onPress={pickImage}>
          {avatarUri ? (
            <Avatar uri={avatarUri} size="xl" style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Avatar name={profile?.display_name} size="xl" />
            </View>
          )}
          <View style={styles.editBadge}>
            <Ionicons name="camera" size={16} color={colors.white} />
          </View>
        </TouchableOpacity>

        <Text style={styles.tapHint}>Tap to choose a photo</Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Skip for now"
          onPress={handleSkip}
          variant="ghost"
          style={styles.skipButton}
        />
        <Button
          title={avatarUri ? 'Continue' : 'Skip'}
          onPress={handleContinue}
          loading={isLoading}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    alignItems: 'center',
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
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: typography.fontSizes.xxl,
    fontWeight: typography.fontWeights.bold,
    color: colors.gray[900],
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.fontSizes.md,
    color: colors.gray[600],
    lineHeight: 24,
    textAlign: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 120,
    height: 120,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: 'hidden',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
  },
  tapHint: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  buttons: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  skipButton: {
    marginBottom: spacing.xs,
  },
});
