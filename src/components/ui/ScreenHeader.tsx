import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

interface HeaderIconButtonProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  children?: ReactNode;
}

export function HeaderIconButton({ icon, label, onPress, disabled, testID, children }: HeaderIconButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
    >
      <Ionicons name={icon} size={24} color={colors.gray[700]} />
      {children}
    </Pressable>
  );
}

interface ScreenHeaderProps {
  title: string;
  titleStyle?: StyleProp<TextStyle>;
  onBack?: () => void;
  backLabel?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  sideWidth?: number;
}

export function ScreenHeader({ title, titleStyle, onBack, backLabel = 'Go back', leading, trailing, sideWidth = 44 }: ScreenHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={{ width: sideWidth, alignItems: 'flex-start' }}>
        {leading ?? (onBack && <HeaderIconButton icon="arrow-back" label={backLabel} onPress={onBack} />)}
      </View>
      <Text style={[styles.title, titleStyle]} accessibilityRole="header" numberOfLines={2}>{title}</Text>
      <View style={{ width: sideWidth, alignItems: 'flex-end' }}>{trailing}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  title: {
    flex: 1,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    textAlign: 'center',
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.gray[900],
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  pressed: { backgroundColor: colors.gray[100] },
  disabled: { opacity: 0.45 },
});
