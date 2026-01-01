import React, { useState, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import ImageViewing from 'react-native-image-viewing';
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
    return (
      <View style={styles.container}>
        <Pressable onPress={() => openLightbox(0)} style={styles.singleImage}>
          <Image
            source={{ uri: getImageUrl(sortedImages[0].storage_path) }}
            style={styles.image}
            placeholder={sortedImages[0].blurhash || undefined}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
        <ImageViewing
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
        contentContainerStyle={styles.scrollContent}
      >
        {sortedImages.map((img, index) => (
          <Pressable key={img.id} onPress={() => openLightbox(index)} style={styles.carouselImage}>
            <Image
              source={{ uri: getImageUrl(img.storage_path) }}
              style={styles.image}
              placeholder={img.blurhash || undefined}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
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

      <ImageViewing
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
  singleImage: {
    width: IMAGE_WIDTH,
    height: IMAGE_HEIGHT,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  carouselImage: {
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
