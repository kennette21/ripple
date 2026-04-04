import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@constants/theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CROP_SIZE = SCREEN_WIDTH - spacing.xl * 2;

interface ImageCropModalProps {
  visible: boolean;
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  onCrop: (uri: string, width: number, height: number) => void;
  onCancel: () => void;
}

export default function ImageCropModal({
  visible,
  imageUri,
  imageWidth,
  imageHeight,
  onCrop,
  onCancel,
}: ImageCropModalProps) {
  const [isCropping, setIsCropping] = useState(false);

  // Calculate how the image fits in the crop area
  const imageAspect = imageWidth / imageHeight;
  const fitWidth = imageAspect >= 1 ? CROP_SIZE : CROP_SIZE * imageAspect;
  const fitHeight = imageAspect >= 1 ? CROP_SIZE / imageAspect : CROP_SIZE;

  // Gesture shared values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransforms = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = Math.max(1, Math.min(savedScale.value * e.scale, 5));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const currentScale = scale.value;
      const maxOffsetX = ((fitWidth * currentScale - CROP_SIZE) / 2);
      const maxOffsetY = ((fitHeight * currentScale - CROP_SIZE) / 2);

      translateX.value = Math.max(
        -Math.max(0, maxOffsetX),
        Math.min(Math.max(0, maxOffsetX), savedTranslateX.value + e.translationX)
      );
      translateY.value = Math.max(
        -Math.max(0, maxOffsetY),
        Math.min(Math.max(0, maxOffsetY), savedTranslateY.value + e.translationY)
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const handleCrop = async () => {
    setIsCropping(true);
    try {
      const currentScale = scale.value;
      const currentTranslateX = translateX.value;
      const currentTranslateY = translateY.value;

      // Calculate the crop region in the original image coordinates
      const displayToOriginalX = imageWidth / fitWidth;
      const displayToOriginalY = imageHeight / fitHeight;

      // The crop frame center in display coordinates is at (0, 0) relative to image center
      // Image is offset by translate values and scaled
      const cropDisplayX = (CROP_SIZE / 2 - (fitWidth * currentScale) / 2 - currentTranslateX) / currentScale;
      const cropDisplayY = (CROP_SIZE / 2 - (fitHeight * currentScale) / 2 - currentTranslateY) / currentScale;
      const cropDisplaySize = CROP_SIZE / currentScale;

      // Convert to original image coordinates
      const originX = Math.max(0, Math.round(cropDisplayX * displayToOriginalX));
      const originY = Math.max(0, Math.round(cropDisplayY * displayToOriginalY));
      const cropWidth = Math.round(cropDisplaySize * displayToOriginalX);
      const cropHeight = Math.round(cropDisplaySize * displayToOriginalY);

      // Clamp to image bounds
      const clampedWidth = Math.min(cropWidth, imageWidth - originX);
      const clampedHeight = Math.min(cropHeight, imageHeight - originY);

      const result = await manipulateAsync(
        imageUri,
        [
          {
            crop: {
              originX,
              originY,
              width: clampedWidth,
              height: clampedHeight,
            },
          },
        ],
        { compress: 0.8, format: SaveFormat.JPEG }
      );

      resetTransforms();
      onCrop(result.uri, result.width, result.height);
    } catch (error) {
      console.error('Crop failed:', error);
    } finally {
      setIsCropping(false);
    }
  };

  const handleCancel = () => {
    resetTransforms();
    onCancel();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <GestureHandlerRootView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel} style={styles.headerButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crop</Text>
          <TouchableOpacity
            onPress={handleCrop}
            style={styles.headerButton}
            disabled={isCropping}
          >
            {isCropping ? (
              <ActivityIndicator size="small" color={colors.primary[500]} />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Crop area */}
        <View style={styles.cropContainer}>
          <View style={styles.cropFrame}>
            <GestureDetector gesture={composed}>
              <Animated.View
                style={[
                  {
                    width: fitWidth,
                    height: fitHeight,
                  },
                  animatedStyle,
                ]}
              >
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: fitWidth, height: fitHeight }}
                  contentFit="contain"
                />
              </Animated.View>
            </GestureDetector>
          </View>
          {/* Corner indicators */}
          <View style={[styles.corner, styles.cornerTopLeft]} />
          <View style={[styles.corner, styles.cornerTopRight]} />
          <View style={[styles.corner, styles.cornerBottomLeft]} />
          <View style={[styles.corner, styles.cornerBottomRight]} />
        </View>

        {/* Hint */}
        <Text style={styles.hint}>Pinch to zoom, drag to adjust</Text>

        {/* Reset button */}
        <TouchableOpacity onPress={resetTransforms} style={styles.resetButton}>
          <Ionicons name="refresh" size={20} color={colors.white} />
          <Text style={styles.resetText}>Reset</Text>
        </TouchableOpacity>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 60,
    paddingBottom: spacing.md,
  },
  headerButton: {
    minWidth: 60,
  },
  title: {
    fontSize: typography.fontSizes.lg,
    fontWeight: typography.fontWeights.semibold,
    color: colors.white,
  },
  cancelText: {
    fontSize: typography.fontSizes.md,
    color: colors.white,
  },
  doneText: {
    fontSize: typography.fontSizes.md,
    color: colors.primary[400],
    fontWeight: typography.fontWeights.semibold,
    textAlign: 'right',
  },
  cropContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: colors.white,
  },
  cornerTopLeft: {
    top: (SCREEN_HEIGHT - CROP_SIZE) / 2 - 60,
    left: spacing.xl,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTopRight: {
    top: (SCREEN_HEIGHT - CROP_SIZE) / 2 - 60,
    right: spacing.xl,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBottomLeft: {
    bottom: (SCREEN_HEIGHT - CROP_SIZE) / 2 + 60,
    left: spacing.xl,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: (SCREEN_HEIGHT - CROP_SIZE) / 2 + 60,
    right: spacing.xl,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  hint: {
    textAlign: 'center',
    color: colors.gray[400],
    fontSize: typography.fontSizes.sm,
    marginBottom: spacing.md,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginBottom: 40,
  },
  resetText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
  },
});
