import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, typography } from '@constants/theme';

interface BadgeProps {
  count?: number;
  max?: number;
  variant?: 'primary' | 'error' | 'success' | 'warning';
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

export function Badge({
  count,
  max = 99,
  variant = 'error',
  size = 'sm',
  style,
}: BadgeProps) {
  if (count === undefined || count <= 0) {
    return null;
  }

  const displayCount = count > max ? `${max}+` : count.toString();

  return (
    <View style={[styles.badge, styles[variant], styles[size], style]}>
      <Text style={[styles.text, styles[`text_${size}`]]}>{displayCount}</Text>
    </View>
  );
}

// Dot badge (no number)
export function DotBadge({
  visible = true,
  variant = 'error',
  style,
}: {
  visible?: boolean;
  variant?: 'primary' | 'error' | 'success' | 'warning';
  style?: ViewStyle;
}) {
  if (!visible) return null;

  return <View style={[styles.dot, styles[variant], style]} />;
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 18,
    paddingHorizontal: spacing.xs,
    borderRadius: borderRadius.full,
  },

  // Sizes
  sm: {
    height: 18,
    minWidth: 18,
  },
  md: {
    height: 22,
    minWidth: 22,
  },

  // Variants
  primary: {
    backgroundColor: colors.primary[500],
  },
  error: {
    backgroundColor: colors.error.main,
  },
  success: {
    backgroundColor: colors.success.main,
  },
  warning: {
    backgroundColor: colors.warning.main,
  },

  text: {
    color: colors.white,
    fontWeight: typography.fontWeights.bold,
  },
  text_sm: {
    fontSize: 10,
  },
  text_md: {
    fontSize: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
