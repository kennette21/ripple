import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  type ScrollViewInstance,
} from 'react-native';
import { Image, type ImageLoadEventData } from 'expo-image';
import { FullscreenImageViewer } from '@/components/ui/FullscreenImageViewer';
import { PinchableImage } from '@/components/ui/PinchableImage';
import { spacing, borderRadius, colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';
import { getPostPreviewUrl } from '@/lib/supabase/storage';

const IMAGE_GAP = spacing.sm;

interface PostImageData {
  id: string;
  post_id: string;
  storage_path: string;
  blurhash: string | null;
  width: number | null;
  height: number | null;
  position: number;
}

interface ImageGalleryProps {
  images: PostImageData[];
}

function getImageUrl(storagePath: string): string {
  const { data } = supabase.storage.from('post-images').getPublicUrl(storagePath);
  return data.publicUrl;
}

function getPhotoHeight(image: Pick<PostImageData, 'width' | 'height'>, width: number) {
  if (!image.width || !image.height || image.width < 0 || image.height < 0) return width;
  return width * image.height / image.width;
}

function FeedImage({ image, shouldLoad = true, onLoad }: {
  image: PostImageData;
  shouldLoad?: boolean;
  onLoad?: (event: ImageLoadEventData) => void;
}) {
  const [failedPreview, setFailedPreview] = useState(false);
  return (
    <Image
      source={shouldLoad ? { uri: failedPreview
        ? getImageUrl(image.storage_path)
        : getPostPreviewUrl(image.storage_path) } : null}
      style={styles.image}
      placeholder={image.blurhash || undefined}
      contentFit="contain"
      placeholderContentFit="contain"
      enforceEarlyResizing
      cachePolicy="memory-disk"
      transition={200}
      onLoad={onLoad}
      onError={() => setFailedPreview(true)}
    />
  );
}

export function ImageGallery({ images }: ImageGalleryProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const imageWidth = screenWidth - spacing.md * 2;
  const maxHeight = Math.min(480, screenHeight * 0.6);
  const snapInterval = imageWidth + IMAGE_GAP;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCarouselInteractionActive, setIsCarouselInteractionActive] =
    useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [scrollCorrection, setScrollCorrection] = useState<{ index: number } | null>(null);
  const [loadedSize, setLoadedSize] = useState<{ path: string; width: number; height: number } | null>(null);
  const scrollViewRef = useRef<ScrollViewInstance>(null);

  const sortedImages = useMemo(() =>
    [...images].sort((a, b) => a.position - b.position),
    [images]
  );

  const lightboxImages = useMemo(() =>
    sortedImages.map((img) => ({ uri: getImageUrl(img.storage_path) })),
    [sortedImages]
  );
  const lastIndex = Math.max(0, sortedImages.length - 1);

  if (activeIndex > lastIndex) {
    setActiveIndex(lastIndex);
    setScrollCorrection({ index: lastIndex });
  }
  if (lightboxIndex > lastIndex) setLightboxIndex(lastIndex);

  useEffect(() => {
    if (!scrollCorrection) return;
    scrollViewRef.current?.scrollTo({
      x: scrollCorrection.index * snapInterval,
      animated: false,
    });
  }, [scrollCorrection, snapInterval]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / snapInterval);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < sortedImages.length) {
      setActiveIndex(newIndex);
    }
  };

  if (!sortedImages.length) return null;

  // Single image - no carousel needed
  if (sortedImages.length === 1) {
    const image = sortedImages[0];
    const needsSize = !image.width || !image.height || image.width < 0 || image.height < 0;
    const size = needsSize && loadedSize?.path === image.storage_path ? loadedSize : image;
    const height = Math.min(maxHeight, getPhotoHeight(size, imageWidth));

    return (
      <View style={styles.container}>
        <PinchableImage
          uri={lightboxImages[0].uri}
          previewUri={getPostPreviewUrl(image.storage_path)}
          borderRadius={borderRadius.md}
          style={[styles.postImage, { width: imageWidth, height }]}
          contentFit="contain"
          onPress={() => openLightbox(0)}
          accessibilityLabel="Post photo"
          testID={`post-image-${image.id}`}
        >
          <FeedImage
            key={image.storage_path}
            image={image}
            onLoad={needsSize && size === image ? ({ source }) => {
              setLoadedSize({ path: image.storage_path, width: source.width, height: source.height });
            } : undefined}
          />
        </PinchableImage>
        <FullscreenImageViewer
          images={lightboxImages}
          imageIndex={lightboxIndex}
          visible={lightboxVisible}
          onRequestClose={() => setLightboxVisible(false)}
        />
      </View>
    );
  }

  // Use the entire album to size the frame so swiping never shifts the feed.
  const albumHeight = Math.min(maxHeight, Math.max(...sortedImages.map((image) => getPhotoHeight(image, imageWidth))));

  // Multiple images - swipeable carousel
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        scrollEnabled={!isCarouselInteractionActive}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedImages.map((img, index) => (
          <PinchableImage
            key={img.id}
            uri={lightboxImages[index].uri}
            previewUri={getPostPreviewUrl(img.storage_path)}
            borderRadius={borderRadius.md}
            style={[styles.postImage, { width: imageWidth, height: albumHeight }]}
            contentFit="contain"
            onPress={() => openLightbox(index)}
            onInteractionChange={setIsCarouselInteractionActive}
            accessibilityLabel={`Post photo ${index + 1} of ${sortedImages.length}`}
            testID={`post-image-${img.id}`}
          >
            <FeedImage
              key={img.storage_path}
              image={img}
              shouldLoad={Math.abs(index - activeIndex) <= 1}
            />
          </PinchableImage>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotsContainer}>
        {sortedImages.map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              index === activeIndex && styles.dotActive,
            ]}
          />
        ))}
      </View>

      <FullscreenImageViewer
        images={lightboxImages}
        imageIndex={lightboxIndex}
        visible={lightboxVisible}
        onRequestClose={() => setLightboxVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  scrollContent: {
    alignItems: 'center',
    gap: IMAGE_GAP,
  },
  postImage: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.gray[300],
  },
  dotActive: {
    backgroundColor: colors.primary[500],
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
