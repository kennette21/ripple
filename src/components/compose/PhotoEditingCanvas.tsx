import React, { useLayoutEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { GestureDetector, usePanGesture, usePinchGesture, useSimultaneousGestures } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { colors } from '@/constants/theme';
import { rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from '@/lib/photoEditingGeometry';
import {
  clamp, frameOnImage, imageBehindFrame, MAX_PHOTO_ZOOM, panPhotoCrop, photoCanvasLayout,
  photoCropZoom, resizePhotoCrop, zoomPhotoCrop, type CropCorner, type PhotoFraming,
} from '@/lib/photoEditorGeometry';
import type { SelectedPostPhoto } from '@/types/postPhoto';
import { displayPhotoPosition, type PhotoEditorInteraction } from '@/lib/photoEditorInteraction';

interface Props {
  photo: SelectedPostPhoto;
  rotation: PhotoRotation;
  crop: PhotoCrop;
  mode: PhotoFraming;
  width: number;
  height: number;
  disabled: boolean;
  live: PhotoEditorInteraction;
  revision?: number;
  onCommit: (crop: PhotoCrop, revision: number) => void;
  onInteractionChange: (active: boolean) => void;
}

// Keep continuous gesture math and image transforms on the UI thread. Only the
// final selected source pixels cross to React, as one undoable adjustment.
export function PhotoEditingCanvas({ photo, rotation, crop, mode, width, height, disabled, live, revision, onCommit, onInteractionChange }: Props) {
  const source = rotatedPhotoSize(photo.width, photo.height, rotation);
  const { originX, originY, width: cropWidth, height: cropHeight } = crop;
  const { position, view: animated, active, revision: liveRevision } = live;
  const panStart = useSharedValue({ crop, view: photoCanvasLayout(crop, width, height), absoluteX: 0, absoluteY: 0, corner: null as CropCorner | null });
  const pinchStart = useSharedValue({ crop, view: photoCanvasLayout(crop, width, height), focalX: .5, focalY: .5 });
  const sourceWidth = source.width;
  const sourceHeight = source.height;
  const baseScale = photoCanvasLayout({ originX: 0, originY: 0, width: sourceWidth, height: sourceHeight }, width, height).scale;
  const imageWidth = sourceWidth * baseScale;
  const imageHeight = sourceHeight * baseScale;

  useLayoutEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      // A delayed JS commit must not overwrite a subsequent live gesture.
      if (active.get() || (revision !== undefined && revision < liveRevision.get())) return;
      const displayed = position.get();
      if (revision !== undefined && revision === liveRevision.get()
        && displayed.stageWidth === width && displayed.stageHeight === height
        && displayed.sourceWidth === sourceWidth && displayed.sourceHeight === sourceHeight) return;
      if (revision === undefined) liveRevision.set(liveRevision.get() + 1);
      const bounds = { originX, originY, width: cropWidth, height: cropHeight };
      const next = photoCanvasLayout(bounds, width, height);
      position.set({ crop: bounds, view: next, sourceWidth, sourceHeight, stageWidth: width, stageHeight: height });
      cancelAnimation(animated);
      animated.set(next);
    });
  }, [originX, originY, cropWidth, cropHeight, width, height, sourceWidth, sourceHeight, position, animated, active, revision, liveRevision]);

  const finish = (bounds: PhotoCrop, canceled: boolean, version: number) => {
    if (!canceled) onCommit(bounds, version);
    onInteractionChange(false);
  };
  const begin = (flag: number) => {
    'worklet';
    if (!active.get()) scheduleOnRN(onInteractionChange, true);
    active.set(active.get() | flag);
    const view = animated.get();
    cancelAnimation(animated);
    position.set({ ...position.get(), view });
    animated.set(view);
  };
  const end = (flag: number, canceled: boolean, settle = false) => {
    'worklet';
    if (!(active.get() & flag)) return;
    active.set(active.get() & ~flag);
    if (!active.get()) {
      const bounds = canceled ? (flag === 1 ? panStart.get().crop : pinchStart.get().crop) : position.get().crop;
      const next = photoCanvasLayout(bounds, width, height);
      position.set({ ...position.get(), crop: bounds, view: next });
      // Only resized crop corners settle. Zoom and pan follow the finger
      // directly, including their final frame and the explicit +/- buttons.
      animated.set(settle && !canceled ? withTiming(next, { duration: 180 }) : next);
      const version = liveRevision.get() + 1;
      liveRevision.set(version);
      scheduleOnRN(finish, bounds, canceled, version);
    }
  };
  const move = (absoluteX: number, absoluteY: number) => {
    'worklet';
    const start = panStart.get();
    const dx = absoluteX - start.absoluteX;
    const dy = absoluteY - start.absoluteY;
    if (start.corner) {
      const bounds = resizePhotoCrop(start.crop, start.corner, dx, dy, start.view, sourceWidth, sourceHeight, width, height);
      displayPhotoPosition(live, bounds, frameOnImage(bounds, start.view));
    } else {
      const bounds = panPhotoCrop(start.crop, dx, dy, start.view.scale, sourceWidth, sourceHeight);
      displayPhotoPosition(live, bounds, imageBehindFrame(bounds, start.view));
    }
  };
  const pan = usePanGesture({
    enabled: !disabled, runOnJS: false, maxPointers: 1,
    onBegin: event => {
      'worklet';
      begin(1);
      const current = position.get();
      const view = current.view;
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
      panStart.set({ crop: current.crop, view, absoluteX: event.absoluteX, absoluteY: event.absoluteY, corner });
    },
    onUpdate: event => { 'worklet'; move(event.absoluteX, event.absoluteY); },
    onDeactivate: event => { 'worklet'; if (!event.canceled) move(event.absoluteX, event.absoluteY); },
    onFinalize: event => { 'worklet'; end(1, event.canceled, panStart.get().corner !== null); },
  });
  const pinchMove = (scale: number) => {
    'worklet';
    const start = pinchStart.get();
    const startZoom = photoCropZoom(start.crop, sourceWidth, sourceHeight);
    const zoom = clamp(startZoom * scale, 1, Math.max(MAX_PHOTO_ZOOM, startZoom));
    const bounds = zoomPhotoCrop(start.crop, sourceWidth, sourceHeight, zoom, start.focalX, start.focalY);
    displayPhotoPosition(live, bounds, imageBehindFrame(bounds, start.view));
  };
  const pinch = usePinchGesture({
    enabled: !disabled, runOnJS: false,
    onActivate: event => {
      'worklet';
      begin(2);
      const current = position.get();
      const view = current.view;
      pinchStart.set({ crop: current.crop, view,
        focalX: clamp((event.focalX - view.frameLeft) / view.frameWidth, 0, 1),
        focalY: clamp((event.focalY - view.frameTop) / view.frameHeight, 0, 1) });
    },
    onUpdate: event => { 'worklet'; pinchMove(event.scale); },
    onDeactivate: event => { 'worklet'; if (!event.canceled) pinchMove(event.scale); },
    onFinalize: event => { 'worklet'; end(2, event.canceled); },
  });
  const gesture = useSimultaneousGestures(pan, pinch);

  const imageStyle = useAnimatedStyle(() => {
    const view = animated.get();
    // Keep the bitmap view's layout fixed. Zoom is a compositor transform,
    // rather than resizing and laying out a large image on every frame.
    return { transform: [
      { translateX: view.imageLeft + sourceWidth * view.scale / 2 - width / 2 },
      { translateY: view.imageTop + sourceHeight * view.scale / 2 - height / 2 },
      { scale: view.scale / baseScale },
    ] };
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
        <Animated.View style={[styles.image, { left: (width - imageWidth) / 2, top: (height - imageHeight) / 2, width: imageWidth, height: imageHeight }, imageStyle]} testID="photo-editor-image-transform">
          <View style={[styles.image, {
            width: photo.width * baseScale, height: photo.height * baseScale,
            left: (sourceWidth - photo.width) * baseScale / 2, top: (sourceHeight - photo.height) * baseScale / 2,
            transform: [{ rotate: `${rotation}deg` }],
          }]}>
            <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="fill" allowDownscaling={false} />
          </View>
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
