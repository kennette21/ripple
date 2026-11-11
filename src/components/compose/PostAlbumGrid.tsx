import React, { useState } from 'react';
import { Keyboard, StyleSheet, Text, useWindowDimensions, View, type ScrollView } from 'react-native';
import type { AnimatedRef } from 'react-native-reanimated';
import Sortable, { type SortableGridRenderItem } from 'react-native-sortables';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { LIMITS } from '@/constants/config';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface PostAlbumGridProps {
  photos: SelectedPostPhoto[];
  disabled?: boolean;
  scrollableRef?: AnimatedRef<ScrollView>;
  onAdd: () => void;
  onEdit: (photo: SelectedPostPhoto, startWithCrop?: boolean) => void;
  onRemove: (photo: SelectedPostPhoto) => void;
  onReorder: (photos: SelectedPostPhoto[]) => void;
}

const ADD_PHOTOS = { id: 'add-post-photos' };
type AlbumEntry = SelectedPostPhoto | typeof ADD_PHOTOS;
const isPhoto = (entry: AlbumEntry): entry is SelectedPostPhoto => 'uri' in entry;

export function PostAlbumGrid({ photos, disabled = false, scrollableRef, onAdd, onEdit, onRemove, onReorder }: PostAlbumGridProps) {
  const [gridWidth, setGridWidth] = useState(0);
  const { width } = useWindowDimensions();
  const tileWidth = ((gridWidth || width - spacing.md * 2) - spacing.sm) / 2;
  const entries: AlbumEntry[] = photos.length < LIMITS.maxImagesPerPost ? [...photos, ADD_PHOTOS] : photos;

  const movePhoto = (index: number, offset: number) => {
    const to = index + offset;
    if (disabled || to < 0 || to >= photos.length) return;
    const next = [...photos];
    const [moved] = next.splice(index, 1);
    next.splice(to, 0, moved);
    onReorder(next);
  };

  const renderItem: SortableGridRenderItem<AlbumEntry> = ({ item, index }) => {
    const tileSize = { width: photos.length ? tileWidth : '100%' as const, height: photos.length ? tileWidth / 1.1 : 140 };
    if (!isPhoto(item)) {
      return (
        <Sortable.Handle mode="fixed-order">
          <Sortable.Touchable
            accessible
            onTap={() => { if (!disabled) onAdd(); }}
            onAccessibilityTap={() => { if (!disabled) onAdd(); }}
            style={[styles.addTile, tileSize]}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            accessibilityState={{ disabled }}
            testID="compose-add-photos"
          >
            <Ionicons name="add" size={28} color={colors.primary[500]} />
            <Text style={styles.addText}>Add photos</Text>
          </Sortable.Touchable>
        </Sortable.Handle>
      );
    }
    return (
      <Sortable.Handle>
        <View style={[styles.tile, tileSize]}>
          <Sortable.Touchable
            accessible
            style={StyleSheet.absoluteFill}
            onTap={() => { if (!disabled) onEdit(item); }}
            onAccessibilityTap={() => { if (!disabled) onEdit(item); }}
            accessibilityRole="imagebutton"
            accessibilityLabel={'Edit photo ' + (index + 1) + ' of ' + photos.length}
            accessibilityHint="Tap to edit. Hold and drag to change this photo's position."
            accessibilityState={{ disabled }}
            accessibilityActions={[
              { name: 'activate', label: 'Edit photo' },
              ...(index > 0 ? [{ name: 'moveEarlier', label: 'Move photo earlier' }] : []),
              ...(index < photos.length - 1 ? [{ name: 'moveLater', label: 'Move photo later' }] : []),
            ]}
            onAccessibilityAction={({ nativeEvent }) => {
              if (disabled) return;
              if (nativeEvent.actionName === 'moveEarlier') movePhoto(index, -1);
              else if (nativeEvent.actionName === 'moveLater') movePhoto(index, 1);
              else if (nativeEvent.actionName === 'activate') onEdit(item);
            }}
            testID={'compose-photo-' + (index + 1)}
          >
            <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
          </Sortable.Touchable>
          <View style={styles.position} pointerEvents="none">
            <Text style={styles.positionText}>{index + 1}</Text>
          </View>
          <Sortable.Touchable
            accessible
            style={styles.remove}
            onTap={() => { if (!disabled) onRemove(item); }}
            onAccessibilityTap={() => { if (!disabled) onRemove(item); }}
            accessibilityRole="button"
            accessibilityLabel={'Remove photo ' + (index + 1)}
            accessibilityState={{ disabled }}
          >
            <Ionicons name="close" size={20} color={colors.white} />
          </Sortable.Touchable>
          <Sortable.Touchable
            accessible
            style={styles.crop}
            onTap={() => { if (!disabled) onEdit(item, true); }}
            onAccessibilityTap={() => { if (!disabled) onEdit(item, true); }}
            accessibilityRole="button"
            accessibilityLabel={'Crop photo ' + (index + 1)}
            accessibilityState={{ disabled }}
            testID={'compose-crop-photo-' + (index + 1)}
          >
            <Ionicons name="crop" size={20} color={colors.white} />
          </Sortable.Touchable>
        </View>
      </Sortable.Handle>
    );
  };

  return (
    <View style={styles.section}>
      <Text style={styles.count}>
        {photos.length === 0 ? 'Photos' : photos.length + (photos.length === 1 ? ' photo' : ' photos')}
        {photos.length > 1 ? ' · Hold and drag to reorder' : ''}
      </Text>
      <View onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)} testID="compose-photo-grid">
        <Sortable.Grid
          columns={photos.length ? 2 : 1}
          data={entries}
          keyExtractor={(entry) => entry.id}
          renderItem={renderItem}
          customHandle
          sortEnabled={!disabled && photos.length > 1}
          dragActivationDelay={250}
          activeItemScale={1.04}
          inactiveItemOpacity={0.8}
          enableActiveItemSnap={false}
          rowGap={spacing.sm}
          columnGap={spacing.sm}
          scrollableRef={scrollableRef}
          hapticsEnabled
          showDropIndicator
          dropIndicatorStyle={styles.dropIndicator}
          onDragStart={() => Keyboard.dismiss()}
          onDragEnd={({ data, fromIndex, toIndex }) => {
            if (!disabled && fromIndex !== toIndex) onReorder(data.filter(isPhoto));
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md, paddingBottom: spacing.lg },
  count: { fontSize: typography.fontSizes.xs, color: colors.gray[500], marginBottom: spacing.md },
  tile: { position: 'relative', borderRadius: borderRadius.lg, backgroundColor: colors.gray[100], overflow: 'hidden' },
  position: { position: 'absolute', top: spacing.sm, left: spacing.sm, minWidth: 24, height: 24, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: 'rgba(17,24,39,0.7)' },
  positionText: { color: colors.white, fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold },
  remove: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.55)', borderBottomLeftRadius: borderRadius.lg },
  crop: { position: 'absolute', bottom: 0, left: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.65)', borderTopRightRadius: borderRadius.lg },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray[300], borderRadius: borderRadius.lg, backgroundColor: colors.gray[50] },
  addText: { color: colors.primary[500], fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  dropIndicator: { borderRadius: borderRadius.lg, borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
});
