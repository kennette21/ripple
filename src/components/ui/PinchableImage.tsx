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
  previewUri?: string;
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
  previewUri,
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
    opacity: liftedInstance.get() === instanceId ? 0 : 1,
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
    if (suppressPress.current || activeInstance.get() !== 0) return;
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
    if (activeInstance.get() === instanceId) {
      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);
      activeInstance.set(0);
      liftedInstance.set(0);
      readyInstance.set(0);
      scale.set(1);
      translateX.set(0);
      translateY.set(0);
      backdropOpacity.set(0);
    }
    finishInteraction(session.get());
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
    // RNGH registers these worklets; runOnJS accesses refs only when a gesture fires.
    // eslint-disable-next-line react-hooks/refs
    .onTouchesDown((event) => {
      if (event.numberOfTouches === 2) {
        interactionStarted.set(true);
        runOnJS(startInteraction)();
      }
    })
    // eslint-disable-next-line react-hooks/refs -- measure and runOnJS run on gesture start.
    .onStart((event) => {
      if (!interactionStarted.get()) {
        interactionStarted.set(true);
        runOnJS(startInteraction)();
      }

      if (
        activeInstance.get() !== 0 &&
        activeInstance.get() !== instanceId
      ) return;

      const frame = measure(imageRef);
      if (!frame || frame.width <= 0 || frame.height <= 0) return;

      cancelAnimation(scale);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(backdropOpacity);

      activeInstance.set(instanceId);
      session.set(session.get() + 1);
      gestureReady.set(true);
      startFocalX.set(event.focalX);
      startFocalY.set(event.focalY);
      halfWidth.set(frame.width / 2);
      halfHeight.set(frame.height / 2);
      scale.set(1);
      translateX.set(0);
      translateY.set(0);
      backdropOpacity.set(0);
      if (readyInstance.get() === instanceId) {
        liftedInstance.set(instanceId);
      }

      runOnJS(beginZoom)({
        instanceId,
        session: session.get(),
        uri,
        previewUri,
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
      if (!gestureReady.get()) return;

      const nextScale = clamp(event.scale, 1, MAX_SCALE);
      const focalDeltaX = event.focalX - startFocalX.get();
      const focalDeltaY = event.focalY - startFocalY.get();

      scale.set(nextScale);
      translateX.set(
        focalDeltaX +
        (1 - nextScale) * (startFocalX.get() - halfWidth.get())
      );
      translateY.set(
        focalDeltaY +
        (1 - nextScale) * (startFocalY.get() - halfHeight.get())
      );
      backdropOpacity.set(clamp(
        ((nextScale - 1) / 1.5) * MAX_BACKDROP_OPACITY,
        0,
        MAX_BACKDROP_OPACITY
      ));
    })
    // eslint-disable-next-line react-hooks/refs -- runOnJS runs when the gesture finishes.
    .onFinalize(() => {
      if (!interactionStarted.get()) return;
      interactionStarted.set(false);
      runOnJS(markPinchFinished)();

      if (
        !gestureReady.get() ||
        activeInstance.get() !== instanceId
      ) {
        runOnJS(finishInteraction)();
        return;
      }

      const completedSession = session.get();
      gestureReady.set(false);
      returnAnimationsCompleted.set(0);

      const completeReturnAnimation = (finished?: boolean) => {
        'worklet';
        if (!finished || session.get() !== completedSession) return;

        returnAnimationsCompleted.set(returnAnimationsCompleted.get() + 1);
        if (returnAnimationsCompleted.get() === 4) {
          activeInstance.set(0);
          liftedInstance.set(0);
          runOnJS(finishInteraction)(completedSession);
        }
      };

      translateX.set(withSpring(
        0,
        RETURN_SPRING,
        completeReturnAnimation
      ));
      translateY.set(withSpring(
        0,
        RETURN_SPRING,
        completeReturnAnimation
      ));
      backdropOpacity.set(withTiming(
        0,
        { duration: 180 },
        completeReturnAnimation
      ));
      scale.set(withSpring(
        1,
        RETURN_SPRING,
        completeReturnAnimation
      ));
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
    previewUri,
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
