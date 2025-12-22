import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '@constants/theme';

interface CardProps {
  children: React.ReactNode;
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'elevated',
  padding = 'md',
  style,
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        styles[`padding_${padding}`],
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },

  // Variants
  elevated: {
    backgroundColor: colors.white,
    ...shadows.md,
  },
  outlined: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray[200],
  },
  filled: {
    backgroundColor: colors.gray[50],
  },

  // Padding
  padding_none: {
    padding: 0,
  },
  padding_sm: {
    padding: spacing.sm,
  },
  padding_md: {
    padding: spacing.md,
  },
  padding_lg: {
    padding: spacing.lg,
  },
});
