import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@components/ui';
import { supabase } from '@lib/supabase';
import { useAuth } from '@providers/AuthProvider';
import { colors, spacing, typography, borderRadius } from '@constants/theme';
import { LIMITS } from '@constants/config';

const GOAL_OPTIONS = [
  { minutes: 15, label: '15 min', description: 'Quick check-ins' },
  { minutes: 30, label: '30 min', description: 'Balanced (recommended)' },
  { minutes: 60, label: '1 hour', description: 'More time to explore' },
  { minutes: 120, label: '2 hours', description: 'Extended browsing' },
];

export default function DailyGoalScreen() {
  const { user, refreshProfile } = useAuth();
  const [selectedGoal, setSelectedGoal] = useState(30);
  const [isLoading, setIsLoading] = useState(false);

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);

    try {
      const { error } = await (supabase
        .from('profiles') as any)
        .update({
          daily_usage_goal_minutes: selectedGoal,
          onboarding_completed: true,
        })
        .eq('id', user.id);

      if (error) {
        console.error('Error updating profile:', error);
        return;
      }

      await refreshProfile();
      router.replace('/(main)/(feed)');
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.progress}>
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={[styles.progressDot, styles.progressActive]} />
          <View style={[styles.progressDot, styles.progressActive]} />
        </View>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="time-outline" size={48} color={colors.primary[500]} />
          </View>
          <Text style={styles.title}>Set your daily goal</Text>
          <Text style={styles.subtitle}>
            We'll gently remind you when you're approaching your goal. This helps
            you stay mindful of your time.
          </Text>
        </View>

        <View style={styles.options}>
          {GOAL_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.minutes}
              style={[
                styles.option,
                selectedGoal === option.minutes && styles.optionSelected,
              ]}
              onPress={() => setSelectedGoal(option.minutes)}
            >
              <View style={styles.optionContent}>
                <Text
                  style={[
                    styles.optionLabel,
                    selectedGoal === option.minutes && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDescription,
                    selectedGoal === option.minutes &&
                      styles.optionDescriptionSelected,
                  ]}
                >
                  {option.description}
                </Text>
              </View>
              {selectedGoal === option.minutes && (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary[500]}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.note}>
          You can change this anytime in settings.
        </Text>
      </View>

      <View style={styles.buttons}>
        <Button
          title="Get Started"
          onPress={handleComplete}
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
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary[50],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
  options: {
    gap: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.white,
  },
  optionSelected: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  optionContent: {
    flex: 1,
  },
  optionLabel: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
    marginBottom: 2,
  },
  optionLabelSelected: {
    color: colors.primary[700],
  },
  optionDescription: {
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
  },
  optionDescriptionSelected: {
    color: colors.primary[600],
  },
  note: {
    marginTop: spacing.lg,
    fontSize: typography.fontSizes.sm,
    color: colors.gray[500],
    textAlign: 'center',
  },
  buttons: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
});
