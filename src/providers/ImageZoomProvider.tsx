import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { FullWindowOverlay } from 'react-native-screens';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { colors } from '@/constants/theme';

interface ImageZoomFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageZoomRequest {
  instanceId: number;
  session: number;
  uri: string;
  borderRadius: number;
  frame: ImageZoomFrame;
}

interface ImageZoomControlsContextValue {
  activeInstance: SharedValue<number>;
  liftedInstance: SharedValue<number>;
  readyInstance: SharedValue<number>;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  backdropOpacity: SharedValue<number>;
  beginZoom: (request: ImageZoomRequest) => void;
  finishZoom: (instanceId: number, session: number) => void;
  lockScroll: (instanceId: number) => void;
  unlockScroll: (instanceId: number) => void;
}

const ImageZoomControlsContext =
  createContext<ImageZoomControlsContextValue | null>(null);
const ImageZoomStateContext =
  createContext<boolean | null>(null);

function ImageZoomOverlay({ zoom }: { zoom: ImageZoomRequest }) {
  const {
    activeInstance,
    backdropOpacity,
    liftedInstance,
    readyInstance,
    scale,
    translateX,
    translateY,
  } =
    useImageZoomControls();
  const imageSource = useMemo(() => ({ uri: zoom.uri }), [zoom.uri]);

  useEffect(() => () => {
    if (liftedInstance.value === zoom.instanceId) {
      liftedInstance.value = 0;
    }
    if (readyInstance.value === zoom.instanceId) {
      readyInstance.value = 0;
    }
  }, [liftedInstance, readyInstance, zoom.instanceId]);

  const handleImageDisplay = useCallback(() => {
    if (activeInstance.value === zoom.instanceId) {
      readyInstance.value = zoom.instanceId;
      liftedInstance.value = zoom.instanceId;
    }
  }, [activeInstance, liftedInstance, readyInstance, zoom.instanceId]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: liftedInstance.value === zoom.instanceId
      ? backdropOpacity.value
      : 0,
  }));
  const imageStyle = useAnimatedStyle(() => ({
    opacity: liftedInstance.value === zoom.instanceId ? 1 : 0,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const content = (
    <View
      pointerEvents="none"
      style={styles.overlay}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View style={[styles.backdrop, backdropStyle]} />
      <Animated.View
        style={[
          styles.liftedImage,
          {
            left: zoom.frame.x,
            top: zoom.frame.y,
            width: zoom.frame.width,
            height: zoom.frame.height,
          },
          imageStyle,
        ]}
      >
        <View
          style={[
            styles.imageClip,
            { borderRadius: zoom.borderRadius },
          ]}
        >
          <Image
            source={imageSource}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            priority="high"
            transition={0}
            onDisplay={handleImageDisplay}
          />
        </View>
      </Animated.View>
    </View>
  );

  if (Platform.OS === 'ios') {
    return <FullWindowOverlay>{content}</FullWindowOverlay>;
  }

  return content;
}

export function ImageZoomProvider({ children }: PropsWithChildren) {
  const [activeZoom, setActiveZoom] = useState<ImageZoomRequest | null>(null);
  const [scrollLocks, setScrollLocks] = useState<Set<number>>(() => new Set());
  const activeInstance = useSharedValue(0);
  const liftedInstance = useSharedValue(0);
  const readyInstance = useSharedValue(0);
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(0);

  const beginZoom = useCallback((request: ImageZoomRequest) => {
    setActiveZoom((current) =>
      activeInstance.value === request.instanceId ? request : current
    );
  }, [activeInstance]);

  const finishZoom = useCallback((instanceId: number, session: number) => {
    setActiveZoom((current) =>
      current?.instanceId === instanceId && current.session === session
        ? null
        : current
    );
  }, []);

  const lockScroll = useCallback((instanceId: number) => {
    setScrollLocks((current) => {
      if (current.has(instanceId)) return current;
      const next = new Set(current);
      next.add(instanceId);
      return next;
    });
  }, []);

  const unlockScroll = useCallback((instanceId: number) => {
    setScrollLocks((current) => {
      if (!current.has(instanceId)) return current;
      const next = new Set(current);
      next.delete(instanceId);
      return next;
    });
  }, []);

  const controls = useMemo<ImageZoomControlsContextValue>(() => ({
    activeInstance,
    liftedInstance,
    readyInstance,
    scale,
    translateX,
    translateY,
    backdropOpacity,
    beginZoom,
    finishZoom,
    lockScroll,
    unlockScroll,
  }), [
    activeInstance,
    backdropOpacity,
    beginZoom,
    finishZoom,
    lockScroll,
    liftedInstance,
    readyInstance,
    scale,
    translateX,
    translateY,
    unlockScroll,
  ]);
  const isZoomActive = activeZoom !== null || scrollLocks.size > 0;

  return (
    <ImageZoomControlsContext.Provider value={controls}>
      <ImageZoomStateContext.Provider value={isZoomActive}>
        <View style={styles.root}>
          {children}
          {activeZoom && <ImageZoomOverlay zoom={activeZoom} />}
        </View>
      </ImageZoomStateContext.Provider>
    </ImageZoomControlsContext.Provider>
  );
}

export function useImageZoomActive() {
  const context = useContext(ImageZoomStateContext);

  if (context === null) {
    throw new Error('useImageZoomActive must be used within ImageZoomProvider');
  }

  return context;
}

export function useImageZoomControls() {
  const context = useContext(ImageZoomControlsContext);

  if (!context) {
    throw new Error('useImageZoomControls must be used within ImageZoomProvider');
  }

  return context;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.black,
  },
  liftedImage: {
    position: 'absolute',
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
    elevation: 16,
  },
  imageClip: {
    flex: 1,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
