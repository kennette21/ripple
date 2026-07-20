import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import type { FullscreenImageViewerProps } from './FullscreenImageViewer.types';

// Web fallback. Native platforms resolve FullscreenImageViewer.native.tsx,
// which provides pinch, pan, double-tap, and swipe-to-close behavior.
export function FullscreenImageViewer({
  images,
  imageIndex,
  visible,
  onRequestClose,
  closeAccessibilityLabel = 'Close image viewer',
}: FullscreenImageViewerProps) {
  const image = images[imageIndex];

  return (
    <Modal
      visible={visible && !!image}
      transparent
      animationType="fade"
      onRequestClose={onRequestClose}
    >
      <View style={styles.container}>
        {image && (
          <Image
            source={image}
            style={styles.image}
            contentFit="contain"
          />
        )}
        <SafeAreaView
          style={styles.header}
          pointerEvents="box-none"
          testID="fullscreen-image-viewer"
        >
          <View style={styles.counterSlot}>
            {images.length > 1 && (
              <View style={styles.counter}>
                <Text
                  style={styles.counterText}
                  testID="fullscreen-image-index"
                  accessibilityLabel={`Photo ${imageIndex + 1} of ${images.length}`}
                >
                  {imageIndex + 1} / {images.length}
                </Text>
              </View>
            )}
          </View>
          <Pressable
            style={styles.closeButton}
            onPress={onRequestClose}
            testID="fullscreen-image-close"
            accessibilityRole="button"
            accessibilityLabel={closeAccessibilityLabel}
            hitSlop={12}
          >
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.black,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  header: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-start',
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
