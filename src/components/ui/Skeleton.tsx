import React, { useEffect } from 'react';
import { View, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { colors, borderRadius } from '@constants/theme';

interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = '100%',
  height = 20,
  borderRadius: radius = borderRadius.md,
  style,
}: SkeletonProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true
    );
  }, [shimmer]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.5, 1]),
  }));

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width: width as DimensionValue, height, borderRadius: radius },
        animatedStyle,
        style,
      ]}
    />
  );
}

// Common skeleton patterns
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.textContainer}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          width={i === lines - 1 ? '60%' : '100%'}
          style={styles.textLine}
        />
      ))}
    </View>
  );
}

export function SkeletonAvatar({ size = 40 }: { size?: number }) {
  return <Skeleton width={size} height={size} borderRadius={size / 2} />;
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: colors.gray[200],
  },
  textContainer: {
    gap: 8,
  },
  textLine: {
    marginBottom: 4,
  },
});
