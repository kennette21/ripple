import React, { useLayoutEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { colors } from '@/constants/theme';
import { rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from '@/lib/photoEditingGeometry';
import {
  clamp, frameOnImage, imageBehindFrame, MAX_PHOTO_ZOOM, panPhotoCrop, photoCanvasLayout,
  photoCropZoom, resizePhotoCrop, zoomPhotoCrop, type CropCorner, type PhotoCanvasLayout, type PhotoFraming,
} from '@/lib/photoEditorGeometry';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface Props {
  photo: SelectedPostPhoto;
  rotation: PhotoRotation;
  crop: PhotoCrop;
  mode: PhotoFraming;
  width: number;
  height: number;
  disabled: boolean;
  onCommit: (crop: PhotoCrop) => void;
  onInteractionChange: (active: boolean) => void;
}
interface Position { crop: PhotoCrop; view: PhotoCanvasLayout }

// The selected source pixels are canonical. Animated values only display them;
// exporting a fast gesture never depends on a queued UI-thread read.
export function PhotoEditingCanvas({ photo, rotation, crop, mode, width, height, disabled, onCommit, onInteractionChange }: Props) {
  const source = rotatedPhotoSize(photo.width, photo.height, rotation);
  const initialView = photoCanvasLayout(crop, width, height);
  const initialPosition = { crop, view: initialView };
  const current = useRef<Position>(initialPosition);
  const animated = useSharedValue(initialView);
  const previousAsset = useRef(`${photo.uri}:${rotation}`);
  const { originX, originY, width: cropWidth, height: cropHeight } = crop;
  const panStart = useRef({ position: initialPosition, absoluteX: 0, absoluteY: 0, corner: null as CropCorner | null });
  const pinchStart = useRef({ position: initialPosition, focalX: .5, focalY: .5 });
  const active = useRef(new Set<string>());

  useLayoutEffect(() => {
    const bounds = { originX, originY, width: cropWidth, height: cropHeight };
    const view = photoCanvasLayout(bounds, width, height);
    const asset = `${photo.uri}:${rotation}`;
    current.current = { crop: bounds, view };
    animated.set(previousAsset.current === asset ? withTiming(view, { duration: 180 }) : view);
    previousAsset.current = asset;
  }, [originX, originY, cropWidth, cropHeight, width, height, photo.uri, rotation, animated]);

  const display = (bounds: PhotoCrop, view: PhotoCanvasLayout) => {
    current.current = { crop: bounds, view };
    animated.set(view);
  };
  const begin = (name: string) => {
    active.current.add(name);
    // Interrupt a settle at its canonical destination before a new gesture.
    animated.set(current.current.view);
    onInteractionChange(true);
  };
  const end = (name: string, canceled: boolean) => {
    if (!active.current.delete(name)) return;
    if (active.current.size === 0) {
      const bounds = canceled ? crop : current.current.crop;
      const view = photoCanvasLayout(bounds, width, height);
      current.current = { crop: bounds, view };
      animated.set(withTiming(view, { duration: 180 }));
      if (!canceled) onCommit(bounds);
      onInteractionChange(false);
    }
  };
  const move = (absoluteX: number, absoluteY: number) => {
    const start = panStart.current;
    const dx = absoluteX - start.absoluteX;
    const dy = absoluteY - start.absoluteY;
    if (start.corner) {
      const bounds = resizePhotoCrop(start.position.crop, start.corner, dx, dy, start.position.view, source.width, source.height, width, height);
      display(bounds, frameOnImage(bounds, start.position.view));
    } else {
      const bounds = panPhotoCrop(start.position.crop, dx, dy, start.position.view.scale, source.width, source.height);
      display(bounds, imageBehindFrame(bounds, start.position.view));
    }
  };
  const pan = usePanGesture({
    enabled: !disabled, runOnJS: true, maxPointers: 1,
    onBegin: event => {
      const view = current.current.view;
      const nearLeft = Math.abs(event.x - view.frameLeft) <= 28;
      const nearRight = Math.abs(event.x - view.frameLeft - view.frameWidth) <= 28;
      const nearTop = Math.abs(event.y - view.frameTop) <= 28;
      const nearBottom = Math.abs(event.y - view.frameTop - view.frameHeight) <= 28;
      let corner: CropCorner | null = null;
      if (mode === 'crop') {
        if (nearLeft && nearTop) corner = 'nw';
        else if (nearRight && nearTop) corner = 'ne';
        else if (nearLeft && nearBottom) corner = 'sw';
        else if (nearRight && nearBottom) corner = 'se';
      }
      panStart.current = { position: current.current, absoluteX: event.absoluteX, absoluteY: event.absoluteY, corner };
      begin('pan');
    },
    onUpdate: event => move(event.absoluteX, event.absoluteY),
    onDeactivate: event => { if (!event.canceled) move(event.absoluteX, event.absoluteY); },
    onFinalize: event => end('pan', event.canceled),
  });
  const pinchMove = (scale: number) => {
    const start = pinchStart.current;
    const startZoom = photoCropZoom(start.position.crop, source.width, source.height);
    const zoom = clamp(startZoom * scale, 1, Math.max(MAX_PHOTO_ZOOM, startZoom));
    const bounds = zoomPhotoCrop(start.position.crop, source.width, source.height, zoom, start.focalX, start.focalY);
    display(bounds, imageBehindFrame(bounds, start.position.view));
  };
  const pinch = usePinchGesture({
    enabled: !disabled, runOnJS: true,
    onActivate: event => {
      const view = current.current.view;
      pinchStart.current = {
        position: current.current,
        focalX: clamp((event.focalX - view.frameLeft) / view.frameWidth, 0, 1),
        focalY: clamp((event.focalY - view.frameTop) / view.frameHeight, 0, 1),
      };
      begin('pinch');
    },
    onUpdate: event => pinchMove(event.scale),
    onDeactivate: event => { if (!event.canceled) pinchMove(event.scale); },
    onFinalize: event => end('pinch', event.canceled),
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const imageStyle = useAnimatedStyle(() => {
    const view = animated.get();
    return { left: view.imageLeft, top: view.imageTop, width: source.width * view.scale, height: source.height * view.scale };
  });
  const rotatedStyle = useAnimatedStyle(() => {
    const scale = animated.get().scale;
    return { width: photo.width * scale, height: photo.height * scale,
      left: (source.width - photo.width) * scale / 2, top: (source.height - photo.height) * scale / 2,
      transform: [{ rotate: `${rotation}deg` }] };
  });
  const frameStyle = useAnimatedStyle(() => {
    const view = animated.get();
    return { left: view.frameLeft, top: view.frameTop, width: view.frameWidth, height: view.frameHeight };
  });
  const topMask = useAnimatedStyle(() => ({ height: animated.get().frameTop }));
  const bottomMask = useAnimatedStyle(() => ({ top: animated.get().frameTop + animated.get().frameHeight }));
  const leftMask = useAnimatedStyle(() => ({ top: animated.get().frameTop, width: animated.get().frameLeft, height: animated.get().frameHeight }));
  const rightMask = useAnimatedStyle(() => ({ top: animated.get().frameTop, left: animated.get().frameLeft + animated.get().frameWidth, height: animated.get().frameHeight }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.stage, { width, height }]} accessible accessibilityRole="image"
        accessibilityLabel="Photo editing area" accessibilityHint={mode === 'crop' ? 'Drag the corners to crop. Pinch to zoom and drag the photo to reposition.' : 'Pinch to zoom and drag the photo to reposition. Select Crop to resize the edges.'} testID="photo-editor-canvas">
        <Animated.View style={[styles.image, imageStyle]}>
          <Animated.View style={[styles.image, rotatedStyle]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" />
          </Animated.View>
        </Animated.View>
        <Animated.View pointerEvents="none" style={[styles.mask, styles.top, topMask]} />
        <Animated.View pointerEvents="none" style={[styles.mask, styles.bottom, bottomMask]} />
        <Animated.View pointerEvents="none" style={[styles.mask, styles.left, leftMask]} />
        <Animated.View pointerEvents="none" style={[styles.mask, styles.right, rightMask]} />
        {mode !== 'fit' && (
          <Animated.View pointerEvents="none" style={[styles.frame, frameStyle]}>
            <View style={[styles.vertical, { left: '33.333%' }]} /><View style={[styles.vertical, { left: '66.667%' }]} />
            <View style={[styles.horizontal, { top: '33.333%' }]} /><View style={[styles.horizontal, { top: '66.667%' }]} />
            {mode === 'crop' && <>
              <View style={[styles.corner, styles.nw]} /><View style={[styles.corner, styles.ne]} />
              <View style={[styles.corner, styles.sw]} /><View style={[styles.corner, styles.se]} />
            </>}
          </Animated.View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  stage: { overflow: 'hidden', backgroundColor: colors.gray[100] },
  image: { position: 'absolute' },
  mask: { position: 'absolute', backgroundColor: 'rgba(17,24,39,0.4)' },
  top: { top: 0, left: 0, right: 0 }, bottom: { bottom: 0, left: 0, right: 0 },
  left: { left: 0 }, right: { right: 0 },
  frame: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  horizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.45)' },
  corner: { position: 'absolute', width: 22, height: 22, borderColor: colors.white },
  nw: { left: -2, top: -2, borderLeftWidth: 3, borderTopWidth: 3 },
  ne: { right: -2, top: -2, borderRightWidth: 3, borderTopWidth: 3 },
  sw: { left: -2, bottom: -2, borderLeftWidth: 3, borderBottomWidth: 3 },
  se: { right: -2, bottom: -2, borderRightWidth: 3, borderBottomWidth: 3 },
});
