import React, { useCallback } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ImageViewing from 'react-native-image-viewing';
import { colors } from '@/constants/theme';
import type { FullscreenImageViewerProps } from './FullscreenImageViewer.types';

export function FullscreenImageViewer({
  closeAccessibilityLabel = 'Close image viewer',
  ...viewerProps
}: FullscreenImageViewerProps) {
  const HeaderComponent = useCallback(() => (
    <SafeAreaView style={styles.header}>
      <Pressable
        style={styles.closeButton}
        onPress={viewerProps.onRequestClose}
        accessibilityRole="button"
        accessibilityLabel={closeAccessibilityLabel}
        hitSlop={12}
      >
        <Ionicons name="close" size={26} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  ), [closeAccessibilityLabel, viewerProps.onRequestClose]);

  return (
    <ImageViewing
      {...viewerProps}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      HeaderComponent={HeaderComponent}
    />
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'flex-end',
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginRight: 8,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
});
