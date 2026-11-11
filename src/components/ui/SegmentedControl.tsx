import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '@/constants/theme';

interface Segment<Value extends string> {
  value: Value;
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

interface SegmentedControlProps<Value extends string> {
  options: readonly Segment<Value>[];
  value: Value;
  onChange: (value: Value) => void;
  label: string;
  variant?: 'tabs' | 'modes';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function SegmentedControl<Value extends string>({
  options, value, onChange, label, variant = 'modes', disabled = false, style,
}: SegmentedControlProps<Value>) {
  const tabs = variant === 'tabs';

  return (
    <View style={[styles.group, tabs ? styles.tabBar : styles.modeTrack, style]} accessibilityRole={tabs ? 'tablist' : 'radiogroup'} accessibilityLabel={label}>
      {options.map(option => {
        const selected = value === option.value;
        const color = selected ? colors.primary[700] : colors.gray[600];
        return (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              styles.segment,
              tabs ? styles.tab : styles.mode,
              selected && (tabs ? styles.tabSelected : styles.modeSelected),
              pressed && styles.pressed,
              disabled && styles.disabled,
            ]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
            accessibilityRole={tabs ? 'tab' : 'radio'}
            accessibilityLabel={option.label}
            accessibilityState={tabs ? { selected, disabled } : { checked: selected, disabled }}
          >
            {option.icon && <Ionicons name={option.icon} size={16} color={color} />}
            <Text style={[styles.label, { color }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row' },
  tabBar: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
  },
  modeTrack: {
    padding: spacing.xs,
    gap: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.gray[100],
  },
  segment: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  tab: { borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabSelected: { borderBottomColor: colors.primary[500] },
  mode: { borderRadius: borderRadius.md },
  modeSelected: { backgroundColor: colors.white },
  label: {
    flexShrink: 1,
    textAlign: 'center',
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  pressed: { backgroundColor: colors.primary[50] },
  disabled: { opacity: 0.5 },
});
