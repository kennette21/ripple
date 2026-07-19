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
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { FullscreenImageViewer } from '@/components/ui/FullscreenImageViewer';
import { PinchableImage } from '@/components/ui/PinchableImage';
import { spacing, borderRadius, colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';

const { width: screenWidth } = Dimensions.get('window');
const IMAGE_WIDTH = screenWidth - spacing.md * 2;
const IMAGE_HEIGHT = 350;

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

export function ImageGallery({ images }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isCarouselInteractionActive, setIsCarouselInteractionActive] =
    useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const scrollViewRef = useRef<ScrollView>(null);

  const sortedImages = useMemo(() =>
    [...images].sort((a, b) => a.position - b.position),
    [images]
  );

  const lightboxImages = useMemo(() =>
    sortedImages.map((img) => ({ uri: getImageUrl(img.storage_path) })),
    [sortedImages]
  );

  useEffect(() => {
    const lastIndex = Math.max(0, sortedImages.length - 1);

    if (activeIndex > lastIndex) {
      setActiveIndex(lastIndex);
      scrollViewRef.current?.scrollTo({
        x: lastIndex * IMAGE_WIDTH,
        animated: false,
      });
    }

    setLightboxIndex((currentIndex) => Math.min(currentIndex, lastIndex));
  }, [activeIndex, sortedImages.length]);

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxVisible(true);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(contentOffsetX / IMAGE_WIDTH);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < sortedImages.length) {
      setActiveIndex(newIndex);
    }
  };

  // Single image - no carousel needed
  if (sortedImages.length === 1) {
    const image = sortedImages[0];

    return (
      <View style={styles.container}>
        <PinchableImage
          uri={lightboxImages[0].uri}
          borderRadius={borderRadius.md}
          style={styles.postImage}
          onPress={() => openLightbox(0)}
          accessibilityLabel="Post photo"
          testID={`post-image-${image.id}`}
        >
          <Image
            source={lightboxImages[0]}
            style={styles.image}
            placeholder={image.blurhash || undefined}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={200}
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

  // Multiple images - swipeable carousel
  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        decelerationRate="fast"
        snapToInterval={IMAGE_WIDTH}
        snapToAlignment="start"
        scrollEnabled={!isCarouselInteractionActive}
        contentContainerStyle={styles.scrollContent}
      >
        {sortedImages.map((img, index) => (
          <PinchableImage
            key={img.id}
            uri={lightboxImages[index].uri}
            borderRadius={borderRadius.md}
            style={styles.postImage}
            onPress={() => openLightbox(index)}
            onInteractionChange={setIsCarouselInteractionActive}
            accessibilityLabel={`Post photo ${index + 1} of ${sortedImages.length}`}
            testID={`post-image-${img.id}`}
          >
            <Image
              source={lightboxImages[index]}
              style={styles.image}
              placeholder={img.blurhash || undefined}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
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
  },
  postImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
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
