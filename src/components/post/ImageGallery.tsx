import React, { useState, useMemo } from 'react';
import { View, StyleSheet, Pressable, Modal, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { spacing, borderRadius } from '@/constants/theme';
import { supabase } from '@/lib/supabase/client';

const { width: screenWidth } = Dimensions.get('window');

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
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const sortedImages = useMemo(() =>
    [...images].sort((a, b) => a.position - b.position),
    [images]
  );

  const renderGrid = () => {
    const count = sortedImages.length;

    if (count === 1) {
      return (
        <Pressable onPress={() => setSelectedIndex(0)} style={styles.singleImage}>
          <Image
            source={{ uri: getImageUrl(sortedImages[0].storage_path) }}
            style={styles.image}
            placeholder={sortedImages[0].blurhash || undefined}
            contentFit="cover"
            transition={200}
          />
        </Pressable>
      );
    }

    if (count === 2) {
      return (
        <View style={styles.twoImages}>
          {sortedImages.map((img, idx) => (
            <Pressable
              key={img.id}
              onPress={() => setSelectedIndex(idx)}
              style={styles.halfImage}
            >
              <Image
                source={{ uri: getImageUrl(img.storage_path) }}
                style={styles.image}
                placeholder={img.blurhash || undefined}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          ))}
        </View>
      );
    }

    if (count === 3) {
      return (
        <View style={styles.threeImages}>
          <Pressable onPress={() => setSelectedIndex(0)} style={styles.largeImage}>
            <Image
              source={{ uri: getImageUrl(sortedImages[0].storage_path) }}
              style={styles.image}
              placeholder={sortedImages[0].blurhash || undefined}
              contentFit="cover"
              transition={200}
            />
          </Pressable>
          <View style={styles.smallColumn}>
            {sortedImages.slice(1).map((img, idx) => (
              <Pressable
                key={img.id}
                onPress={() => setSelectedIndex(idx + 1)}
                style={styles.smallImage}
              >
                <Image
                  source={{ uri: getImageUrl(img.storage_path) }}
                  style={styles.image}
                  placeholder={img.blurhash || undefined}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            ))}
          </View>
        </View>
      );
    }

    // 4 images - 2x2 grid
    return (
      <View style={styles.fourImages}>
        <View style={styles.row}>
          {sortedImages.slice(0, 2).map((img, idx) => (
            <Pressable
              key={img.id}
              onPress={() => setSelectedIndex(idx)}
              style={styles.quarterImage}
            >
              <Image
                source={{ uri: getImageUrl(img.storage_path) }}
                style={styles.image}
                placeholder={img.blurhash || undefined}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {sortedImages.slice(2, 4).map((img, idx) => (
            <Pressable
              key={img.id}
              onPress={() => setSelectedIndex(idx + 2)}
              style={styles.quarterImage}
            >
              <Image
                source={{ uri: getImageUrl(img.storage_path) }}
                style={styles.image}
                placeholder={img.blurhash || undefined}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {renderGrid()}

      {/* Fullscreen modal */}
      <Modal
        visible={selectedIndex !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedIndex(null)}
      >
        <View style={styles.modalContainer}>
          <Pressable style={styles.closeButton} onPress={() => setSelectedIndex(null)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          {selectedIndex !== null && (
            <Image
              source={{ uri: getImageUrl(sortedImages[selectedIndex].storage_path) }}
              style={styles.fullscreenImage}
              contentFit="contain"
              transition={200}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  singleImage: {
    width: '100%',
    height: 280,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  twoImages: {
    flexDirection: 'row',
    height: 220,
    gap: 2,
  },
  halfImage: {
    flex: 1,
    height: '100%',
  },
  threeImages: {
    flexDirection: 'row',
    height: 240,
    gap: 2,
  },
  largeImage: {
    flex: 2,
    height: '100%',
  },
  smallColumn: {
    flex: 1,
    gap: 2,
  },
  smallImage: {
    flex: 1,
  },
  fourImages: {
    height: 280,
    gap: 2,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    gap: 2,
  },
  quarterImage: {
    flex: 1,
    height: '100%',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: spacing.sm,
  },
  fullscreenImage: {
    width: screenWidth,
    height: '80%',
  },
});
