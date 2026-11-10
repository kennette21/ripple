import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { clamp } from '@/lib/photoEditorGeometry';

interface Props {
  value: number;
  maximum: number;
  disabled: boolean;
  onStart: () => void;
  onChange: (zoom: number) => void;
  onEnd: (canceled: boolean) => void;
  onStep: (direction: number) => void;
}

export function PhotoZoomControl({ value, maximum, disabled, onStart, onChange, onEnd, onStep }: Props) {
  const trackWidth = useRef(1);
  const changeAt = (x: number) => onChange(1 + clamp(x / trackWidth.current, 0, 1) * (maximum - 1));
  const pan = usePanGesture({
    enabled: !disabled, runOnJS: true, minDistance: 0,
    onBegin: event => { onStart(); changeAt(event.x); },
    onUpdate: event => changeAt(event.x),
    onDeactivate: event => { if (!event.canceled) changeAt(event.x); },
    onFinalize: event => onEnd(event.canceled),
  });
  const percent = `${clamp((value - 1) / (maximum - 1), 0, 1) * 100}%` as `${number}%`;
  return (
    <View style={styles.row}>
      <Pressable onPress={() => onStep(-1)} disabled={disabled || value <= 1.001} style={styles.button} accessibilityRole="button" accessibilityLabel="Zoom photo out">
        <Ionicons name="remove" size={22} color={disabled || value <= 1.001 ? colors.gray[300] : colors.gray[700]} />
      </Pressable>
      <GestureDetector gesture={pan}>
        <View style={styles.slider} onLayout={event => { trackWidth.current = event.nativeEvent.layout.width; }}
          accessible accessibilityRole="adjustable" accessibilityLabel="Photo zoom"
          accessibilityValue={{ min: 100, max: Math.round(maximum * 100), now: Math.round(value * 100), text: `${Math.round(value * 100)} percent` }}
          accessibilityState={{ disabled }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onAccessibilityAction={event => { if (!disabled) onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1); }} testID="photo-editor-zoom">
          <View style={styles.track}><View style={[styles.fill, { width: percent }]} /></View>
          <View style={[styles.thumb, { left: percent }]} pointerEvents="none" />
        </View>
      </GestureDetector>
      <Pressable onPress={() => onStep(1)} disabled={disabled || value >= maximum - .001} style={styles.button} accessibilityRole="button" accessibilityLabel="Zoom photo in">
        <Ionicons name="add" size={22} color={disabled || value >= maximum - .001 ? colors.gray[300] : colors.gray[700]} />
      </Pressable>
      <Text style={styles.value} accessibilityElementsHidden importantForAccessibility="no">{Math.round(value * 100)}%</Text>
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
  value: { minWidth: 42, textAlign: 'right', fontSize: typography.fontSizes.xs, color: colors.gray[500], fontVariant: ['tabular-nums'] },
});
