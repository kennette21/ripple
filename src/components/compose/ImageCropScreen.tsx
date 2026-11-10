import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { StatusBar } from 'expo-status-bar';
import {
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors, spacing, typography } from '@constants/theme';
import { pixelPhotoCrop, rotatePhotoCrop, rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from '@/lib/photoEditingGeometry';

const EDGE_INSET = 24;
const HANDLE_HIT_RADIUS = 44;
const MIN_CROP_SIZE = 72;
const MAX_ZOOM = 64;
const SETTLE_DURATION = 240;
const HEADER_HEIGHT = 76;
const CONTROLS_HEIGHT = 81;

const HANDLE_NONE = -1;
const HANDLE_TOP_LEFT = 0;
const HANDLE_TOP_RIGHT = 1;
const HANDLE_BOTTOM_LEFT = 2;
const HANDLE_BOTTOM_RIGHT = 3;

interface ImageCropScreenProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  initialRotation?: PhotoRotation;
  initialCrop?: PhotoCrop;
  onCrop: (uri: string, width: number, height: number) => void;
  onCancel: () => void;
  onProcessingChange?: (processing: boolean) => void;
}

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

function photoLayout(width: number, height: number, rotation: PhotoRotation, stageWidth: number, stageHeight: number, bounds?: PhotoCrop) {
  const source = rotatedPhotoSize(Math.max(1, width), Math.max(1, height), rotation);
  const availableWidth = Math.max(MIN_CROP_SIZE, stageWidth - EDGE_INSET * 2);
  const availableHeight = Math.max(MIN_CROP_SIZE, stageHeight - EDGE_INSET * 2);
  const baseScale = Math.min(availableWidth / source.width, availableHeight / source.height);
  const crop = bounds ?? { originX: 0, originY: 0, width: source.width, height: source.height };
  const scale = Math.min(availableWidth / crop.width, availableHeight / crop.height);
  const cropWidth = crop.width * scale;
  const cropHeight = crop.height * scale;
  return {
    sourceWidth: source.width, sourceHeight: source.height, baseScale,
    displayWidth: source.width * baseScale, displayHeight: source.height * baseScale,
    cropWidth, cropHeight, cropX: (stageWidth - cropWidth) / 2, cropY: (stageHeight - cropHeight) / 2,
    zoom: scale / baseScale,
    translateX: (source.width / 2 - crop.originX - crop.width / 2) * scale,
    translateY: (source.height / 2 - crop.originY - crop.height / 2) * scale,
  };
}

export default function ImageCropScreen({
  imageUri,
  imageWidth,
  imageHeight,
  initialRotation = 0,
  initialCrop,
  onCrop,
  onCancel,
  onProcessingChange,
}: ImageCropScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [isCropping, setIsCropping] = useState(false);
  const [rotation, setRotation] = useState<PhotoRotation>(initialRotation);
  const processingRef = useRef(false);

  const topInset = Math.max(
    insets.top,
    initialWindowMetrics?.insets.top ?? 0
  );
  const bottomInset = Math.max(
    insets.bottom,
    initialWindowMetrics?.insets.bottom ?? 0
  );

  const stageWidth = screenWidth;
  const stageHeight = Math.max(
    220,
    screenHeight -
      topInset -
      bottomInset -
      HEADER_HEIGHT -
      CONTROLS_HEIGHT
  );
  const availableWidth = Math.max(MIN_CROP_SIZE, stageWidth - EDGE_INSET * 2);
  const availableHeight = Math.max(MIN_CROP_SIZE, stageHeight - EDGE_INSET * 2);
  const availableRatio = availableWidth / availableHeight;
  const { sourceWidth, sourceHeight, baseScale, displayWidth, displayHeight } =
    photoLayout(imageWidth, imageHeight, rotation, stageWidth, stageHeight);
  const initial = photoLayout(imageWidth, imageHeight, initialRotation, stageWidth, stageHeight, initialCrop);
  const initialCropX = initial.cropX;
  const initialCropY = initial.cropY;
  const initialCropWidth = initial.cropWidth;
  const initialCropHeight = initial.cropHeight;

  const zoom = useSharedValue(initial.zoom);
  const translateX = useSharedValue(initial.translateX);
  const translateY = useSharedValue(initial.translateY);
  const cropX = useSharedValue(initialCropX);
  const cropY = useSharedValue(initialCropY);
  const cropWidth = useSharedValue(initialCropWidth);
  const cropHeight = useSharedValue(initialCropHeight);

  const activeHandle = useSharedValue(HANDLE_NONE);
  const startAbsoluteX = useSharedValue(0);
  const startAbsoluteY = useSharedValue(0);
  const startZoom = useSharedValue(1);
  const startTranslateX = useSharedValue(0);
  const startTranslateY = useSharedValue(0);
  const startCropX = useSharedValue(initialCropX);
  const startCropY = useSharedValue(initialCropY);
  const startCropWidth = useSharedValue(initialCropWidth);
  const startCropHeight = useSharedValue(initialCropHeight);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);

  const clampImageTranslation = (
    nextX: number,
    nextY: number,
    nextZoom: number
  ) => {
    'worklet';
    const halfImageWidth = (displayWidth * nextZoom) / 2;
    const halfImageHeight = (displayHeight * nextZoom) / 2;
    const minX = cropX.get() + cropWidth.get() - halfImageWidth - stageWidth / 2;
    const maxX = cropX.get() + halfImageWidth - stageWidth / 2;
    const minY = cropY.get() + cropHeight.get() - halfImageHeight - stageHeight / 2;
    const maxY = cropY.get() + halfImageHeight - stageHeight / 2;

    return {
      x: clamp(nextX, minX, maxX),
      y: clamp(nextY, minY, maxY),
    };
  };

  const settleCrop = () => {
    'worklet';
    const oldWidth = cropWidth.get();
    const oldHeight = cropHeight.get();
    const ratio = oldWidth / oldHeight;
    const targetWidth =
      ratio > availableRatio ? availableWidth : availableHeight * ratio;
    const targetHeight =
      ratio > availableRatio ? availableWidth / ratio : availableHeight;
    const scaleDelta = targetWidth / oldWidth;
    const oldCenterX = cropX.get() + oldWidth / 2;
    const oldCenterY = cropY.get() + oldHeight / 2;
    const imageCenterX = stageWidth / 2 + translateX.get();
    const imageCenterY = stageHeight / 2 + translateY.get();
    const animation = {
      duration: SETTLE_DURATION,
      easing: Easing.out(Easing.cubic),
    };

    // Move the old crop center to the stage center and scale the image by the
    // same amount as the crop. This keeps the selected source pixels stable
    // throughout the familiar Photos-style settle animation.
    translateX.set(withTiming(
      scaleDelta * (imageCenterX - oldCenterX),
      animation
    ));
    translateY.set(withTiming(
      scaleDelta * (imageCenterY - oldCenterY),
      animation
    ));
    zoom.set(withTiming(zoom.get() * scaleDelta, animation));
    cropX.set(withTiming((stageWidth - targetWidth) / 2, animation));
    cropY.set(withTiming((stageHeight - targetHeight) / 2, animation));
    cropWidth.set(withTiming(targetWidth, animation));
    cropHeight.set(withTiming(targetHeight, animation));
  };

  const updatePan = (deltaX: number, deltaY: number) => {
    'worklet';

      if (activeHandle.get() === HANDLE_NONE) {
        const clamped = clampImageTranslation(
          startTranslateX.get() + deltaX,
          startTranslateY.get() + deltaY,
          zoom.get()
        );
        translateX.set(clamped.x);
        translateY.set(clamped.y);
        return;
      }

      const startLeft = startCropX.get();
      const startTop = startCropY.get();
      const startRight = startLeft + startCropWidth.get();
      const startBottom = startTop + startCropHeight.get();
      const imageHalfWidth = (displayWidth * startZoom.get()) / 2;
      const imageHalfHeight = (displayHeight * startZoom.get()) / 2;
      const imageLeft = stageWidth / 2 + startTranslateX.get() - imageHalfWidth;
      const imageRight = stageWidth / 2 + startTranslateX.get() + imageHalfWidth;
      const imageTop = stageHeight / 2 + startTranslateY.get() - imageHalfHeight;
      const imageBottom = stageHeight / 2 + startTranslateY.get() + imageHalfHeight;
      const minimumLeft = Math.max(EDGE_INSET, imageLeft);
      const maximumRight = Math.min(stageWidth - EDGE_INSET, imageRight);
      const minimumTop = Math.max(EDGE_INSET, imageTop);
      const maximumBottom = Math.min(stageHeight - EDGE_INSET, imageBottom);

      if (
        activeHandle.get() === HANDLE_TOP_LEFT ||
        activeHandle.get() === HANDLE_BOTTOM_LEFT
      ) {
        const nextLeft = clamp(
          startLeft + deltaX,
          minimumLeft,
          startRight - MIN_CROP_SIZE
        );
        cropX.set(nextLeft);
        cropWidth.set(startRight - nextLeft);
      } else {
        cropWidth.set(
          clamp(
            startRight + deltaX,
            startLeft + MIN_CROP_SIZE,
            maximumRight
          ) - startLeft
        );
      }

      if (
        activeHandle.get() === HANDLE_TOP_LEFT ||
        activeHandle.get() === HANDLE_TOP_RIGHT
      ) {
        const nextTop = clamp(
          startTop + deltaY,
          minimumTop,
          startBottom - MIN_CROP_SIZE
        );
        cropY.set(nextTop);
        cropHeight.set(startBottom - nextTop);
      } else {
        cropHeight.set(
          clamp(
            startBottom + deltaY,
            startTop + MIN_CROP_SIZE,
            maximumBottom
          ) - startTop
        );
      }
  };

  const panGesture = usePanGesture({
    maxPointers: 1,
    onBegin: (event) => {
      'worklet';
      startAbsoluteX.set(event.absoluteX);
      startAbsoluteY.set(event.absoluteY);

      startZoom.set(zoom.get());
      startTranslateX.set(translateX.get());
      startTranslateY.set(translateY.get());
      startCropX.set(cropX.get());
      startCropY.set(cropY.get());
      startCropWidth.set(cropWidth.get());
      startCropHeight.set(cropHeight.get());

      const left = cropX.get();
      const top = cropY.get();
      const right = left + cropWidth.get();
      const bottom = top + cropHeight.get();
      const nearLeft = Math.abs(event.x - left) <= HANDLE_HIT_RADIUS;
      const nearRight = Math.abs(event.x - right) <= HANDLE_HIT_RADIUS;
      const nearTop = Math.abs(event.y - top) <= HANDLE_HIT_RADIUS;
      const nearBottom = Math.abs(event.y - bottom) <= HANDLE_HIT_RADIUS;

      if (nearLeft && nearTop) activeHandle.set(HANDLE_TOP_LEFT);
      else if (nearRight && nearTop) activeHandle.set(HANDLE_TOP_RIGHT);
      else if (nearLeft && nearBottom) activeHandle.set(HANDLE_BOTTOM_LEFT);
      else if (nearRight && nearBottom) activeHandle.set(HANDLE_BOTTOM_RIGHT);
      else activeHandle.set(HANDLE_NONE);
    },
    onUpdate: (event) => {
      'worklet';
      updatePan(event.absoluteX - startAbsoluteX.get(), event.absoluteY - startAbsoluteY.get());
    },
    onDeactivate: (event) => {
      'worklet';
      if (!event.canceled) {
        updatePan(event.absoluteX - startAbsoluteX.get(), event.absoluteY - startAbsoluteY.get());
        if (activeHandle.get() !== HANDLE_NONE) settleCrop();
      }
      activeHandle.set(HANDLE_NONE);
    },
    onFinalize: () => { 'worklet'; activeHandle.set(HANDLE_NONE); },
  });

  const pinchGesture = usePinchGesture({
    onActivate: (event) => {
      'worklet';

      startZoom.set(zoom.get());
      startTranslateX.set(translateX.get());
      startTranslateY.set(translateY.get());
      startFocalX.set(event.focalX);
      startFocalY.set(event.focalY);
    },
    onUpdate: (event) => {
      'worklet';

      const minimumZoom = Math.max(
        cropWidth.get() / displayWidth,
        cropHeight.get() / displayHeight
      );
      const nextZoom = clamp(
        startZoom.get() * event.scale,
        minimumZoom,
        MAX_ZOOM
      );
      const scaleDelta = nextZoom / startZoom.get();
      const oldCenterX = stageWidth / 2 + startTranslateX.get();
      const oldCenterY = stageHeight / 2 + startTranslateY.get();
      const nextCenterX =
        startFocalX.get() + scaleDelta * (oldCenterX - startFocalX.get());
      const nextCenterY =
        startFocalY.get() + scaleDelta * (oldCenterY - startFocalY.get());
      const clamped = clampImageTranslation(
        nextCenterX - stageWidth / 2,
        nextCenterY - stageHeight / 2,
        nextZoom
      );

      zoom.set(nextZoom);
      translateX.set(clamped.x);
      translateY.set(clamped.y);
    },
  });
  const cropGesture = useSimultaneousGestures(pinchGesture, panGesture);

  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.get() },
      { translateY: translateY.get() },
      { scale: zoom.get() },
    ],
  }));

  const topMaskStyle = useAnimatedStyle(() => ({
    height: cropY.get(),
  }));
  const bottomMaskStyle = useAnimatedStyle(() => ({
    top: cropY.get() + cropHeight.get(),
  }));
  const leftMaskStyle = useAnimatedStyle(() => ({
    top: cropY.get(),
    width: cropX.get(),
    height: cropHeight.get(),
  }));
  const rightMaskStyle = useAnimatedStyle(() => ({
    top: cropY.get(),
    left: cropX.get() + cropWidth.get(),
    height: cropHeight.get(),
  }));
  const cropOverlayStyle = useAnimatedStyle(() => ({
    left: cropX.get(),
    top: cropY.get(),
    width: cropWidth.get(),
    height: cropHeight.get(),
  }));

  const sourceCrop = (): PhotoCrop => {
    const scale = baseScale * zoom.get();
    const left = stageWidth / 2 + translateX.get() - displayWidth * zoom.get() / 2;
    const top = stageHeight / 2 + translateY.get() - displayHeight * zoom.get() / 2;
    const originX = clamp((cropX.get() - left) / scale, 0, sourceWidth);
    const originY = clamp((cropY.get() - top) / scale, 0, sourceHeight);
    return {
      originX, originY,
      width: clamp((cropX.get() + cropWidth.get() - left) / scale, 0, sourceWidth) - originX,
      height: clamp((cropY.get() + cropHeight.get() - top) / scale, 0, sourceHeight) - originY,
    };
  };

  const setComposition = (nextRotation: PhotoRotation, bounds?: PhotoCrop) => {
    if (processingRef.current) return;
    const next = photoLayout(imageWidth, imageHeight, nextRotation, stageWidth, stageHeight, bounds);
    setRotation(nextRotation);
    zoom.set(next.zoom);
    translateX.set(next.translateX);
    translateY.set(next.translateY);
    cropX.set(next.cropX);
    cropY.set(next.cropY);
    cropWidth.set(next.cropWidth);
    cropHeight.set(next.cropHeight);
    activeHandle.set(HANDLE_NONE);
  };

  const rotate = () => {
    setComposition(((rotation + 90) % 360) as PhotoRotation, rotatePhotoCrop(sourceCrop(), sourceHeight));
  };

  const adjustZoom = (factor: number) => {
    if (processingRef.current) return;
    const minimum = Math.max(cropWidth.get() / displayWidth, cropHeight.get() / displayHeight);
    const next = clamp(zoom.get() * factor, minimum, MAX_ZOOM);
    const delta = next / zoom.get();
    const centerX = cropX.get() + cropWidth.get() / 2;
    const centerY = cropY.get() + cropHeight.get() / 2;
    const clamped = clampImageTranslation(
      centerX + delta * (stageWidth / 2 + translateX.get() - centerX) - stageWidth / 2,
      centerY + delta * (stageHeight / 2 + translateY.get() - centerY) - stageHeight / 2,
      next
    );
    zoom.set(next);
    translateX.set(clamped.x);
    translateY.set(clamped.y);
  };

  const handleCrop = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setIsCropping(true);
    onProcessingChange?.(true);
    let context: ReturnType<typeof ImageManipulator.manipulate> | undefined;
    try {
      context = ImageManipulator.manipulate(imageUri);
      if (rotation) context.rotate(rotation);
      context.crop(pixelPhotoCrop(sourceCrop(), sourceWidth, sourceHeight));
      const rendered = await context.renderAsync();
      try {
        const result = await rendered.saveAsync({ compress: 0.9, format: SaveFormat.JPEG });
        onCrop(result.uri, result.width, result.height);
      } finally {
        rendered.release();
      }
    } catch {
      Alert.alert('Couldn\'t crop photo', 'Please try again or choose a different photo.');
    } finally {
      context?.release();
      processingRef.current = false;
      setIsCropping(false);
      onProcessingChange?.(false);
    }
  };

  const handleCancel = () => {
    if (isCropping) return;
    onCancel();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={{ paddingTop: topInset }}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleCancel}
            style={[styles.headerButton, isCropping && styles.buttonDisabled]}
            disabled={isCropping}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Cancel cropping"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Crop</Text>
          <TouchableOpacity
            onPress={() => void handleCrop()}
            style={[
              styles.headerButton,
              styles.doneButton,
              isCropping && styles.buttonDisabled,
            ]}
            disabled={isCropping}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Apply crop"
          >
            {isCropping ? (
              <ActivityIndicator size="small" color={colors.primary[400]} />
            ) : (
              <Text style={styles.doneText}>Done</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cropContainer}>
        <GestureDetector gesture={cropGesture}>
          <Animated.View
            style={[styles.stage, { width: stageWidth, height: stageHeight }]}
            accessible
            accessibilityRole="image"
            accessibilityLabel="Photo crop area"
            accessibilityHint="Drag the corners to resize the crop. Pinch and drag the photo to reposition it."
          >
            <Animated.View
              style={[
                styles.imageContainer,
                {
                  left: (stageWidth - displayWidth) / 2,
                  top: (stageHeight - displayHeight) / 2,
                  width: displayWidth,
                  height: displayHeight,
                },
                animatedImageStyle,
              ]}
            >
              <Image
                source={{ uri: imageUri }}
                style={{
                  position: 'absolute', width: imageWidth * baseScale, height: imageHeight * baseScale,
                  left: (displayWidth - imageWidth * baseScale) / 2,
                  top: (displayHeight - imageHeight * baseScale) / 2,
                  transform: [{ rotate: `${rotation}deg` }],
                }}
                contentFit="fill"
              />
            </Animated.View>

            <Animated.View
              pointerEvents="none"
              style={[styles.mask, styles.topMask, topMaskStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.mask, styles.bottomMask, bottomMaskStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.mask, styles.leftMask, leftMaskStyle]}
            />
            <Animated.View
              pointerEvents="none"
              style={[styles.mask, styles.rightMask, rightMaskStyle]}
            />

            <Animated.View
              pointerEvents="none"
              style={[styles.cropOverlay, cropOverlayStyle]}
            >
              <View style={[styles.gridLine, styles.gridVerticalLeft]} />
              <View style={[styles.gridLine, styles.gridVerticalRight]} />
              <View style={[styles.gridLine, styles.gridHorizontalTop]} />
              <View style={[styles.gridLine, styles.gridHorizontalBottom]} />
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </Animated.View>
          </Animated.View>
        </GestureDetector>
      </View>

      <View style={[styles.controlsSafeArea, { paddingBottom: bottomInset }]}>
        <Text style={styles.hint}>Drag corners · pinch and move photo</Text>
        <View style={styles.controlsRow}>
          <TouchableOpacity onPress={() => adjustZoom(1 / 1.25)} style={styles.zoomButton} disabled={isCropping} accessibilityRole="button" accessibilityLabel="Zoom crop out">
            <Ionicons name="remove" size={24} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => adjustZoom(1.25)} style={styles.zoomButton} disabled={isCropping} accessibilityRole="button" accessibilityLabel="Zoom crop in">
            <Ionicons name="add" size={24} color={colors.white} />
          </TouchableOpacity>
          <TouchableOpacity onPress={rotate} style={[styles.resetButton, isCropping && styles.buttonDisabled]} disabled={isCropping} accessibilityRole="button" accessibilityLabel="Rotate crop 90 degrees clockwise">
            <Ionicons name="refresh-outline" size={20} color={colors.white} />
            <Text style={styles.resetText}>Rotate 90°</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setComposition(initialRotation)} style={[styles.resetButton, isCropping && styles.buttonDisabled]} disabled={isCropping} accessibilityRole="button" accessibilityLabel="Reset crop">
            <Ionicons name="arrow-undo-outline" size={20} color={colors.white} />
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  header: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerButton: {
    minWidth: 64,
    minHeight: 44,
    justifyContent: 'center',
  },
  doneButton: {
    alignItems: 'flex-end',
  },
  buttonDisabled: {
    opacity: 0.6,
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
  },
  cropContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stage: {
    overflow: 'hidden',
    backgroundColor: colors.black,
  },
  imageContainer: {
    position: 'absolute',
  },
  mask: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  topMask: {
    top: 0,
    left: 0,
    right: 0,
  },
  bottomMask: {
    left: 0,
    right: 0,
    bottom: 0,
  },
  leftMask: {
    left: 0,
  },
  rightMask: {
    right: 0,
  },
  cropOverlay: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  gridVerticalLeft: {
    top: 0,
    bottom: 0,
    left: '33.333%',
    width: StyleSheet.hairlineWidth,
  },
  gridVerticalRight: {
    top: 0,
    bottom: 0,
    right: '33.333%',
    width: StyleSheet.hairlineWidth,
  },
  gridHorizontalTop: {
    left: 0,
    right: 0,
    top: '33.333%',
    height: StyleSheet.hairlineWidth,
  },
  gridHorizontalBottom: {
    left: 0,
    right: 0,
    bottom: '33.333%',
    height: StyleSheet.hairlineWidth,
  },
  corner: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderColor: colors.white,
  },
  cornerTopLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  cornerTopRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  cornerBottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  cornerBottomRight: {
    right: -2,
    bottom: -2,
    borderRightWidth: 4,
    borderBottomWidth: 4,
  },
  controlsSafeArea: {
    minHeight: CONTROLS_HEIGHT,
    alignItems: 'center',
    paddingTop: spacing.md,
  },
  hint: {
    color: colors.gray[400],
    fontSize: typography.fontSizes.sm,
  },
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' },
  zoomButton: { width: 44, height: 48, alignItems: 'center', justifyContent: 'center' },
  resetButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  resetText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
  },
});
