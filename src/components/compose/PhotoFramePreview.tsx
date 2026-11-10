import React, { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from '@/lib/photoEditingGeometry';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface Props {
  photo: SelectedPostPhoto;
  size: number;
  rotation: PhotoRotation;
  fillFrame: boolean;
  initialCrop?: PhotoCrop;
  disabled: boolean;
  onCropChange: (crop: PhotoCrop) => void;
  onCrop: () => void;
  onInteractionChange: (active: boolean) => void;
}

export function PhotoFramePreview({ photo, size, rotation, fillFrame, initialCrop, disabled, onCropChange, onCrop, onInteractionChange }: Props) {
  const source = rotatedPhotoSize(photo.width, photo.height, rotation);
  const baseScale = (fillFrame ? Math.max : Math.min)(size / source.width, size / source.height);
  const initialZoom = fillFrame && initialCrop ? size / (initialCrop.width * baseScale) : 1;
  const initialX = fillFrame && initialCrop ? (source.width / 2 - initialCrop.originX - initialCrop.width / 2) * baseScale * initialZoom : 0;
  const initialY = fillFrame && initialCrop ? (source.height / 2 - initialCrop.originY - initialCrop.height / 2) * baseScale * initialZoom : 0;
  const zoom = useSharedValue(initialZoom);
  const x = useSharedValue(initialX);
  const y = useSharedValue(initialY);
  const currentPosition = useRef({ x: initialX, y: initialY, zoom: initialZoom });
  const [zoomPercent, setZoomPercent] = useState(Math.round(initialZoom * 100));
  const panStart = useRef({ x: 0, y: 0, absoluteX: 0, absoluteY: 0 });
  const pinchStart = useRef({ zoom: 1, x: 0, y: 0, focalX: 0, focalY: 0 });
  const activeGestures = useRef(new Set<string>());
  const interaction = (name: string, active: boolean) => {
    if (active) activeGestures.current.add(name);
    else activeGestures.current.delete(name);
    onInteractionChange(activeGestures.current.size > 0);
  };

  const position = (nextX: number, nextY: number, nextZoom = currentPosition.current.zoom) => {
    const maxX = Math.max(0, (source.width * baseScale * nextZoom - size) / 2);
    const maxY = Math.max(0, (source.height * baseScale * nextZoom - size) / 2);
    const next = { x: Math.max(-maxX, Math.min(maxX, nextX)), y: Math.max(-maxY, Math.min(maxY, nextY)), zoom: nextZoom };
    currentPosition.current = next;
    x.set(next.x);
    y.set(next.y);
    zoom.set(nextZoom);
  };
  const publishPosition = () => {
    const current = currentPosition.current;
    const scale = baseScale * current.zoom;
    const side = size / scale;
    onCropChange({
      originX: Math.max(0, Math.min(source.width - side, source.width / 2 - current.x / scale - side / 2)),
      originY: Math.max(0, Math.min(source.height - side, source.height / 2 - current.y / scale - side / 2)),
      width: side, height: side,
    });
    setZoomPercent(Math.round(current.zoom * 100));
  };
  const move = (absoluteX: number, absoluteY: number) => {
    position(panStart.current.x + absoluteX - panStart.current.absoluteX,
      panStart.current.y + absoluteY - panStart.current.absoluteY);
  };
  const pan = usePanGesture({
    enabled: fillFrame && !disabled, runOnJS: true, maxPointers: 1,
    onBegin: event => {
      panStart.current = { ...currentPosition.current, absoluteX: event.absoluteX, absoluteY: event.absoluteY };
      interaction('pan', true);
    },
    onUpdate: event => move(event.absoluteX, event.absoluteY),
    onDeactivate: event => {
      if (!event.canceled) move(event.absoluteX, event.absoluteY);
      publishPosition();
    },
    onFinalize: () => interaction('pan', false),
  });
  const pinch = usePinchGesture({
    enabled: fillFrame && !disabled, runOnJS: true,
    onActivate: event => {
      pinchStart.current = { ...currentPosition.current, focalX: event.focalX, focalY: event.focalY };
      interaction('pinch', true);
    },
    onUpdate: event => {
      const start = pinchStart.current;
      const nextZoom = Math.max(1, Math.min(8, start.zoom * event.scale));
      const delta = nextZoom / start.zoom;
      position(start.focalX + delta * (size / 2 + start.x - start.focalX) - size / 2,
        start.focalY + delta * (size / 2 + start.y - start.focalY) - size / 2, nextZoom);
    },
    onDeactivate: publishPosition,
    onFinalize: () => interaction('pinch', false),
  });
  const gesture = useSimultaneousGestures(pan, pinch);
  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: zoom.get() }, { rotate: `${rotation}deg` }],
  }));
  const adjustZoom = (factor: number) => {
    if (disabled) return;
    const current = currentPosition.current;
    const next = Math.max(1, Math.min(8, current.zoom * factor));
    const ratio = next / current.zoom;
    position(current.x * ratio, current.y * ratio, next);
    publishPosition();
  };

  return (
    <View>
      <GestureDetector gesture={gesture}>
        <View style={[styles.preview, { width: size, height: size }]} testID="photo-position-preview">
          <Animated.View style={[{
            position: 'absolute', width: photo.width * baseScale, height: photo.height * baseScale,
            left: (size - photo.width * baseScale) / 2, top: (size - photo.height * baseScale) / 2,
          }, imageStyle]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" accessibilityLabel="Photo framing preview" />
          </Animated.View>
          {fillFrame && (
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
              <View style={[styles.gridVertical, { left: '33.333%' }]} />
              <View style={[styles.gridVertical, { left: '66.667%' }]} />
              <View style={[styles.gridHorizontal, { top: '33.333%' }]} />
              <View style={[styles.gridHorizontal, { top: '66.667%' }]} />
            </View>
          )}
          <Pressable style={styles.crop} onPress={onCrop} disabled={disabled} accessibilityRole="button" accessibilityLabel="Crop photo" testID="photo-editor-crop">
            <Ionicons name="crop" size={20} color={colors.white} />
            <Text style={styles.cropText}>Crop</Text>
          </Pressable>
        </View>
      </GestureDetector>
      <Text style={styles.hint}>{fillFrame ? 'Drag to position · pinch to zoom' : 'Full photo · use Crop to reframe'}</Text>
      {fillFrame && (
        <View style={styles.zoomControls}>
          <Pressable style={styles.zoomButton} onPress={() => adjustZoom(1 / 1.25)} disabled={disabled || zoomPercent <= 100} accessibilityRole="button" accessibilityLabel="Zoom photo out">
            <Ionicons name="remove" size={22} color={zoomPercent <= 100 ? colors.gray[300] : colors.gray[700]} />
          </Pressable>
          <Text style={styles.zoomLabel} accessibilityLabel={`Photo zoom ${zoomPercent} percent`}>{zoomPercent}%</Text>
          <Pressable style={styles.zoomButton} onPress={() => adjustZoom(1.25)} disabled={disabled || zoomPercent >= 800} accessibilityRole="button" accessibilityLabel="Zoom photo in">
            <Ionicons name="add" size={22} color={zoomPercent >= 800 ? colors.gray[300] : colors.gray[700]} />
          </Pressable>
          <Pressable style={styles.centerButton} onPress={() => { position(0, 0, 1); publishPosition(); }} disabled={disabled} accessibilityRole="button" accessibilityLabel="Center photo in frame">
            <Text style={styles.centerText}>Center</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  preview: { alignSelf: 'center', borderRadius: borderRadius.lg, backgroundColor: colors.gray[100], overflow: 'hidden' },
  gridVertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  gridHorizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.5)' },
  crop: { position: 'absolute', bottom: spacing.sm, left: spacing.sm, minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(17,24,39,0.7)' },
  cropText: { color: colors.white, fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  hint: { textAlign: 'center', fontSize: typography.fontSizes.xs, color: colors.gray[500], marginTop: spacing.sm },
  zoomControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  zoomButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomLabel: { minWidth: 48, textAlign: 'center', fontSize: typography.fontSizes.xs, color: colors.gray[600] },
  centerButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md },
  centerText: { fontSize: typography.fontSizes.sm, color: colors.primary[600], fontWeight: typography.fontWeights.medium },
});
