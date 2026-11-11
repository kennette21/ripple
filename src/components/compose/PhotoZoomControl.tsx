import React from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, useAnimatedProps, useAnimatedStyle, useDerivedValue, useSharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { clamp, photoCanvasLayout, photoCropZoom } from '@/lib/photoEditorGeometry';
import { zoomLivePhoto, type LivePhotoPosition, type PhotoEditorInteraction } from '@/lib/photoEditorInteraction';
import type { PhotoCrop } from '@/lib/photoEditingGeometry';

const ZoomText = Animated.createAnimatedComponent(TextInput);
interface Props {
  value: number;
  maximum: number;
  disabled: boolean;
  live: PhotoEditorInteraction;
  onStart: () => void;
  onEnd: (crop: PhotoCrop, canceled: boolean, revision: number) => void;
  onStep: (direction: number) => void;
}

export function PhotoZoomControl({ value, maximum, disabled, live, onStart, onEnd, onStep }: Props) {
  const trackWidth = useSharedValue(1);
  const start = useSharedValue<LivePhotoPosition | null>(null);
  const zoom = useDerivedValue(() => {
    const position = live.position.get();
    return photoCropZoom(position.crop, position.sourceWidth, position.sourceHeight);
  });
  const changeAt = (x: number) => {
    'worklet';
    if (trackWidth.get() < 2) return;
    zoomLivePhoto(live, 1 + clamp(x / trackWidth.get(), 0, 1) * (maximum - 1));
  };
  const pan = usePanGesture({
    enabled: !disabled, runOnJS: false, minDistance: 0,
    onBegin: event => {
      'worklet';
      const view = live.view.get();
      cancelAnimation(live.view);
      const position = { ...live.position.get(), view };
      live.position.set(position);
      start.set(position);
      live.active.set(live.active.get() | 4);
      scheduleOnRN(onStart);
      changeAt(event.x);
    },
    onUpdate: event => { 'worklet'; changeAt(event.x); },
    onDeactivate: event => { 'worklet'; if (!event.canceled) changeAt(event.x); },
    onFinalize: event => {
      'worklet';
      const initial = start.get();
      if (!initial) return;
      const position = event.canceled ? initial : live.position.get();
      const nextView = photoCanvasLayout(position.crop, position.stageWidth, position.stageHeight);
      live.position.set({ ...position, view: nextView });
      live.view.set(nextView);
      live.active.set(live.active.get() & ~4);
      start.set(null);
      const version = live.revision.get() + 1;
      live.revision.set(version);
      scheduleOnRN(onEnd, position.crop, event.canceled, version);
    },
  });
  const fillStyle = useAnimatedStyle(() => ({ width: `${clamp((zoom.get() - 1) / (maximum - 1), 0, 1) * 100}%` as `${number}%` }));
  const thumbStyle = useAnimatedStyle(() => ({ left: `${clamp((zoom.get() - 1) / (maximum - 1), 0, 1) * 100}%` as `${number}%` }));
  // Native text updates with the image and thumb, without a React render for
  // every percentage change. TextInput is read-only and excluded from focus.
  const labelProps = useAnimatedProps(() => ({ text: `${Math.round(zoom.get() * 100)}%` }) as TextInputProps);
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onStep(-1)} disabled={disabled || value <= 1.001} style={styles.button} accessibilityRole="button" accessibilityLabel="Zoom photo out">
        <Ionicons name="remove" size={22} color={disabled || value <= 1.001 ? colors.gray[300] : colors.gray[700]} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <View style={styles.slider} onLayout={event => { trackWidth.set(event.nativeEvent.layout.width); }}
          accessible accessibilityRole="adjustable" accessibilityLabel="Photo zoom"
          accessibilityValue={{ min: 100, max: Math.round(maximum * 100), now: Math.round(value * 100), text: `${Math.round(value * 100)} percent` }}
          accessibilityState={{ disabled }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => { if (!disabled) onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1); }} testID="photo-editor-zoom">
          <View style={styles.track}><Animated.View style={[styles.fill, fillStyle]} /></View>
          <Animated.View style={[styles.thumb, thumbStyle]} pointerEvents="none" />
        </View>
      </GestureDetector>
      <Pressable onPress={() => onStep(1)} disabled={disabled || value >= maximum - .001} style={styles.button} accessibilityRole="button" accessibilityLabel="Zoom photo in">
        <Ionicons name="add" size={22} color={disabled || value >= maximum - .001 ? colors.gray[300] : colors.gray[700]} />
      </Pressable>
      <ZoomText style={styles.value} animatedProps={labelProps} defaultValue={`${Math.round(value * 100)}%`} editable={false} pointerEvents="none" caretHidden underlineColorAndroid="transparent" accessible={false} accessibilityElementsHidden importantForAccessibility="no" />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  slider: { flex: 1, height: 44, justifyContent: 'center' },
  track: { height: 4, backgroundColor: colors.gray[200], borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: colors.primary[500] },
  thumb: { position: 'absolute', width: 16, height: 16, borderRadius: 8, backgroundColor: colors.primary[500], marginLeft: -8, top: 14 },
  value: { width: 48, padding: 0, textAlign: 'right', fontSize: typography.fontSizes.xs, color: colors.gray[500], fontVariant: ['tabular-nums'] },
});
