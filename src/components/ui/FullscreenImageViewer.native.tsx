import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import ImageViewing from 'react-native-image-viewing';
import { colors } from '@/constants/theme';
import type { FullscreenImageViewerProps } from './FullscreenImageViewer.types';

export function FullscreenImageViewer({
  closeAccessibilityLabel = 'Close image viewer',
  ...viewerProps
}: FullscreenImageViewerProps) {
  const HeaderComponent = useCallback(({ imageIndex }: { imageIndex: number }) => (
    <SafeAreaView style={styles.header} testID="fullscreen-image-viewer">
      <View style={styles.counterSlot}>
        {viewerProps.images.length > 1 && (
          <View style={styles.counter}>
            <Text
              style={styles.counterText}
              testID="fullscreen-image-index"
              accessibilityLabel={`Photo ${imageIndex + 1} of ${viewerProps.images.length}`}
            >
              {imageIndex + 1} / {viewerProps.images.length}
            </Text>
          </View>
        )}
      </View>
      <Pressable
        style={styles.closeButton}
        onPress={viewerProps.onRequestClose}
        testID="fullscreen-image-close"
        accessibilityRole="button"
        accessibilityLabel={closeAccessibilityLabel}
        hitSlop={12}
      >
        <Ionicons name="close" size={26} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  ), [
    closeAccessibilityLabel,
    viewerProps.images.length,
    viewerProps.onRequestClose,
  ]);

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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginLeft: 8,
  },
  counter: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
  counterText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '600',
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
