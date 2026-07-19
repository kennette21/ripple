import React, {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useImageZoomControls } from '@/providers/ImageZoomProvider';

const MAX_SCALE = 4;
const MAX_BACKDROP_OPACITY = 0.78;
const PRESS_RESET_DELAY = 240;
const RETURN_SPRING = {
  damping: 20,
  stiffness: 230,
  mass: 0.72,
  overshootClamping: true,
};

let nextInstanceId = 1;

interface PinchableImageProps extends PropsWithChildren {
  uri: string;
  borderRadius: number;
  style: StyleProp<ViewStyle>;
  onPress: () => void;
  onInteractionChange?: (active: boolean) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  testID?: string;
}

function clamp(value: number, minimum: number, maximum: number) {
  'worklet';
  return Math.min(Math.max(value, minimum), maximum);
}

export function PinchableImage({
  uri,
  borderRadius,
  style,
  onPress,
  onInteractionChange,
  accessibilityLabel,
  accessibilityHint = 'Pinch to zoom. Tap to view full screen.',
  testID,
  children,
}: PinchableImageProps) {
  const {
    activeInstance,
    backdropOpacity,
    beginZoom,
    finishZoom,
    liftedInstance,
    lockScroll,
    readyInstance,
    scale,
    translateX,
    translateY,
    unlockScroll,
  } = useImageZoomControls();
  const [instanceId] = useState(() => nextInstanceId++);
  const imageRef = useAnimatedRef<Animated.View>();
  const session = useSharedValue(0);
  const gestureReady = useSharedValue(false);
  const interactionStarted = useSharedValue(false);
  const startFocalX = useSharedValue(0);
  const startFocalY = useSharedValue(0);
  const halfWidth = useSharedValue(0);
  const halfHeight = useSharedValue(0);
  const returnAnimationsCompleted = useSharedValue(0);
  const suppressPress = useRef(false);
  const pressResetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sourceStyle = useAnimatedStyle(() => ({
    opacity: liftedInstance.value === instanceId ? 0 : 1,
  }));

  const startInteraction = useCallback(() => {
    suppressPress.current = true;
    if (pressResetTimer.current) clearTimeout(pressResetTimer.current);
    lockScroll(instanceId);
    onInteractionChange?.(true);
  }, [instanceId, lockScroll, onInteractionChange]);

  const markPinchFinished = useCallback(() => {
    if (pressResetTimer.current) clearTimeout(pressResetTimer.current);
    pressResetTimer.current = setTimeout(() => {
      suppressPress.current = false;
      pressResetTimer.current = null;
    }, PRESS_RESET_DELAY);
  }, []);

  const handlePress = useCallback(() => {
    if (suppressPress.current || activeInstance.value !== 0) return;
    onPress();
  }, [activeInstance, onPress]);

  const finishInteraction = useCallback((completedSession?: number) => {
    unlockScroll(instanceId);
    onInteractionChange?.(false);

    if (completedSession !== undefined) {
      finishZoom(instanceId, completedSession);
    }
  }, [finishZoom, instanceId, onInteractionChange, unlockScroll]);

  useEffect(() => () => {
    if (pressResetTimer.current) clearTimeout(pressResetTimer.current);
    if (activeInstance.value === instanceId) {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
      activeInstance.value = 0;
      liftedInstance.value = 0;
      readyInstance.value = 0;
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      backdropOpacity.value = 0;
    }
    finishInteraction(session.value);
  }, [
    activeInstance,
    backdropOpacity,
    finishInteraction,
    instanceId,
    liftedInstance,
    readyInstance,
    scale,
    session,
    translateX,
    translateY,
  ]);

  const pinchGesture = useMemo(() => Gesture.Pinch()
    .onTouchesDown((event) => {
      if (event.numberOfTouches === 2) {
        interactionStarted.value = true;
        runOnJS(startInteraction)();
      }
    })
    .onStart((event) => {
      if (!interactionStarted.value) {
        interactionStarted.value = true;
        runOnJS(startInteraction)();
      }

      if (
        activeInstance.value !== 0 &&
        activeInstance.value !== instanceId
      ) return;

      const frame = measure(imageRef);
      if (!frame || frame.width <= 0 || frame.height <= 0) return;

      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);

      activeInstance.value = instanceId;
      session.value += 1;
      gestureReady.value = true;
      startFocalX.value = event.focalX;
      startFocalY.value = event.focalY;
      halfWidth.value = frame.width / 2;
      halfHeight.value = frame.height / 2;
      scale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      backdropOpacity.value = 0;
      if (readyInstance.value === instanceId) {
        liftedInstance.value = instanceId;
      }

      runOnJS(beginZoom)({
        instanceId,
        session: session.value,
        uri,
        borderRadius,
        frame: {
          x: frame.pageX,
          y: frame.pageY,
          width: frame.width,
          height: frame.height,
        },
      });
    })
    .onUpdate((event) => {
      if (!gestureReady.value) return;

      const nextScale = clamp(event.scale, 1, MAX_SCALE);
      const focalDeltaX = event.focalX - startFocalX.value;
      const focalDeltaY = event.focalY - startFocalY.value;

      scale.value = nextScale;
      translateX.value =
        focalDeltaX +
        (1 - nextScale) * (startFocalX.value - halfWidth.value);
      translateY.value =
        focalDeltaY +
        (1 - nextScale) * (startFocalY.value - halfHeight.value);
      backdropOpacity.value = clamp(
        ((nextScale - 1) / 1.5) * MAX_BACKDROP_OPACITY,
        0,
        MAX_BACKDROP_OPACITY
      );
    })
    .onFinalize(() => {
      if (!interactionStarted.value) return;
      interactionStarted.value = false;
      runOnJS(markPinchFinished)();

      if (
        !gestureReady.value ||
        activeInstance.value !== instanceId
      ) {
        runOnJS(finishInteraction)();
        return;
      }

      const completedSession = session.value;
      gestureReady.value = false;
      returnAnimationsCompleted.value = 0;

      const completeReturnAnimation = (finished?: boolean) => {
        'worklet';
        if (!finished || session.value !== completedSession) return;

        returnAnimationsCompleted.value += 1;
        if (returnAnimationsCompleted.value === 4) {
          activeInstance.value = 0;
          liftedInstance.value = 0;
          runOnJS(finishInteraction)(completedSession);
        }
      };

      translateX.value = withSpring(
        0,
        RETURN_SPRING,
        completeReturnAnimation
      );
      translateY.value = withSpring(
        0,
        RETURN_SPRING,
        completeReturnAnimation
      );
      backdropOpacity.value = withTiming(
        0,
        { duration: 180 },
        completeReturnAnimation
      );
      scale.value = withSpring(
        1,
        RETURN_SPRING,
        completeReturnAnimation
      );
    }), [
    activeInstance,
    backdropOpacity,
    beginZoom,
    borderRadius,
    finishInteraction,
    gestureReady,
    halfHeight,
    halfWidth,
    imageRef,
    instanceId,
    interactionStarted,
    liftedInstance,
    markPinchFinished,
    returnAnimationsCompleted,
    readyInstance,
    scale,
    session,
    startInteraction,
    startFocalX,
    startFocalY,
    translateX,
    translateY,
    uri,
  ]);

  return (
    <GestureDetector gesture={pinchGesture}>
      <Animated.View
        ref={imageRef}
        collapsable={false}
        style={[style, sourceStyle]}
      >
        <Pressable
          style={styles.fill}
          onPress={handlePress}
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityHint={accessibilityHint}
        >
          {children}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: {
    width: '100%',
    height: '100%',
  },
});
