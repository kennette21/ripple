import React from 'react';
import { View, Text, StyleSheet, ViewStyle, ImageStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { colors, borderRadius } from '@constants/theme';

interface AvatarProps {
  uri?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: StyleProp<ViewStyle>;
}

const SIZES = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 80,
} as const;

const FONT_SIZES = {
  xs: 10,
  sm: 12,
  md: 16,
  lg: 22,
  xl: 32,
} as const;

export function Avatar({ uri, name, size = 'md', style }: AvatarProps) {
  const dimension = SIZES[size];
  const fontSize = FONT_SIZES[size];

  // Get initials from name
  const initials = name
    ? name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  // Generate a consistent color based on name
  const colorIndex = name
    ? name.charCodeAt(0) % Object.keys(AVATAR_COLORS).length
    : 0;
  const backgroundColor = AVATAR_COLORS[colorIndex];

  if (uri) {
    return (
      <View style={style}>
        <Image
          source={{ uri }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
          ]}
          contentFit="cover"
          transition={200}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: dimension,
          height: dimension,
          borderRadius: dimension / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const AVATAR_COLORS = [
  colors.primary[500],
  colors.success.main,
  colors.warning.main,
  colors.info.main,
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#14B8A6', // teal
  '#F97316', // orange
];

const styles = StyleSheet.create({
  image: {
    backgroundColor: colors.gray[100],
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.white,
    fontWeight: '600',
  },
});
