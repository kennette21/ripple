import React, { useState } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { LIMITS } from '@/constants/config';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface PostAlbumGridProps {
  photos: SelectedPostPhoto[];
  disabled?: boolean;
  onAdd: () => void;
  onEdit: (photo: SelectedPostPhoto, startWithCrop?: boolean) => void;
  onRemove: (photo: SelectedPostPhoto) => void;
  onReorder: (photos: SelectedPostPhoto[]) => void;
}

export function PostAlbumGrid({ photos, disabled = false, onAdd, onEdit, onRemove, onReorder }: PostAlbumGridProps) {
  const [gridWidth, setGridWidth] = useState(0);
  const [reordering, setReordering] = useState(false);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tileWidth = ((gridWidth || width - spacing.md * 2) - spacing.sm) / 2;

  const movePhoto = (from: number, offset: number) => {
    const to = from + offset;
    if (disabled || to < 0 || to >= photos.length) return;
    const next = [...photos];
    [next[from], next[to]] = [next[to], next[from]];
    onReorder(next);
    void Haptics.selectionAsync().catch(() => {});
  };

  const renderReorderPhoto = ({ item, getIndex, drag, isActive }: RenderItemParams<SelectedPostPhoto>) => {
    const index = getIndex() ?? 0;
    return (
      <ScaleDecorator activeScale={1.03}>
        <View style={[styles.reorderRow, isActive && styles.activeRow]}>
          <Pressable
            style={styles.dragPhoto}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              drag();
            }}
            delayLongPress={180}
            disabled={disabled || isActive}
            accessibilityRole="button"
            accessibilityLabel={'Photo ' + (index + 1) + ' of ' + photos.length}
            accessibilityHint="Hold and drag to reorder, or use the move buttons."
          >
            <Ionicons name="reorder-three-outline" size={22} color={colors.gray[400]} />
            <Image source={{ uri: item.uri }} style={styles.reorderImage} contentFit="contain" />
            <View style={styles.reorderLabel}>
              <Text style={styles.photoLabel}>{'Photo ' + (index + 1)}</Text>
              {index === 0 && <Text style={styles.firstPhoto}>First in your post</Text>}
            </View>
          </Pressable>
          <Pressable
            style={styles.moveButton}
            onPress={() => movePhoto(index, -1)}
            disabled={disabled || isActive || index === 0}
            accessibilityRole="button"
            accessibilityLabel={'Move photo ' + (index + 1) + ' earlier'}
            accessibilityState={{ disabled: disabled || isActive || index === 0 }}
          >
            <Ionicons name="chevron-up" size={22} color={index === 0 ? colors.gray[200] : colors.gray[600]} />
          </Pressable>
          <Pressable
            style={styles.moveButton}
            onPress={() => movePhoto(index, 1)}
            disabled={disabled || isActive || index === photos.length - 1}
            accessibilityRole="button"
            accessibilityLabel={'Move photo ' + (index + 1) + ' later'}
            accessibilityState={{ disabled: disabled || isActive || index === photos.length - 1 }}
          >
            <Ionicons name="chevron-down" size={22} color={index === photos.length - 1 ? colors.gray[200] : colors.gray[600]} />
          </Pressable>
        </View>
      </ScaleDecorator>
    );
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.count}>
          {photos.length === 0 ? 'Photos' : photos.length + (photos.length === 1 ? ' photo' : ' photos')}
          {photos.length > 1 ? ' · First photo leads' : ''}
        </Text>
        {photos.length > 1 && (
          <Pressable
            onPress={() => { Keyboard.dismiss(); setReordering(true); }}
            disabled={disabled}
            style={styles.reorderButton}
            accessibilityRole="button"
            accessibilityLabel="Reorder photos"
            testID="reorder-post-photos"
          >
            <Text style={styles.reorderText}>Reorder</Text>
          </Pressable>
        )}
      </View>
      <View
        style={styles.grid}
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        testID="compose-photo-grid"
      >
        {photos.map((photo, index) => (
          <View key={photo.id} style={[styles.tile, { width: tileWidth, height: tileWidth / 1.1 }]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => onEdit(photo)}
              disabled={disabled}
              accessibilityRole="imagebutton"
              accessibilityLabel={'Edit photo ' + (index + 1) + ' of ' + photos.length}
              accessibilityHint="Change framing or crop this photo."
              testID={'compose-photo-' + (index + 1)}
            >
              <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
            </Pressable>
            <View style={styles.position} pointerEvents="none">
              <Text style={styles.positionText}>{index + 1}</Text>
            </View>
            <Pressable
              style={styles.remove}
              onPress={() => onRemove(photo)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={'Remove photo ' + (index + 1)}
            >
              <Ionicons name="close" size={20} color={colors.white} />
            </Pressable>
            <Pressable
              style={styles.crop}
              onPress={() => onEdit(photo, true)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={'Crop photo ' + (index + 1)}
              testID={'compose-crop-photo-' + (index + 1)}
            >
              <Ionicons name="crop" size={20} color={colors.white} />
            </Pressable>
          </View>
        ))}
        {photos.length < LIMITS.maxImagesPerPost && (
          <Pressable
            onPress={onAdd}
            disabled={disabled}
            style={[styles.addTile, { width: photos.length ? tileWidth : '100%', height: photos.length ? tileWidth / 1.1 : 140 }]}
            accessibilityRole="button"
            accessibilityLabel="Add photos"
            testID="compose-add-photos"
          >
            <Ionicons name="add" size={28} color={colors.primary[500]} />
            <Text style={styles.addText}>Add photos</Text>
          </Pressable>
        )}
      </View>
      {reordering && (
        <Modal transparent visible animationType="slide" statusBarTranslucent onRequestClose={() => setReordering(false)}>
          <GestureHandlerRootView style={styles.modalRoot}>
            <View style={styles.overlay} accessibilityViewIsModal>
              <Pressable
                style={StyleSheet.absoluteFill}
                onPress={() => setReordering(false)}
                accessibilityRole="button"
                accessibilityLabel="Close photo ordering"
              />
              <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                <View style={styles.grabber} />
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle} accessibilityRole="header">Photos</Text>
                  <Button title="Done" size="sm" onPress={() => setReordering(false)} />
                </View>
                <Text style={styles.reorderHint}>Hold and drag to reorder. Photo 1 appears first.</Text>
                <DraggableFlatList
                  data={photos}
                  keyExtractor={(photo) => photo.id}
                  renderItem={renderReorderPhoto}
                  onDragEnd={({ data }) => {
                    if (!disabled) onReorder(data);
                    void Haptics.selectionAsync().catch(() => {});
                  }}
                  style={{ height: Math.min(height * 0.55, photos.length * 76) }}
                  showsVerticalScrollIndicator={false}
                />
              </View>
            </View>
          </GestureHandlerRootView>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.md, paddingBottom: spacing.lg },
  sectionHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, marginBottom: spacing.sm },
  count: { flexShrink: 1, fontSize: typography.fontSizes.xs, color: colors.gray[500] },
  reorderButton: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.sm },
  reorderText: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.primary[500] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: { position: 'relative', borderRadius: borderRadius.lg, backgroundColor: colors.gray[100], overflow: 'hidden' },
  position: { position: 'absolute', top: spacing.sm, left: spacing.sm, minWidth: 24, height: 24, paddingHorizontal: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, backgroundColor: 'rgba(17,24,39,0.7)' },
  positionText: { color: colors.white, fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.semibold },
  remove: { position: 'absolute', top: 0, right: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.55)', borderBottomLeftRadius: borderRadius.lg },
  crop: { position: 'absolute', bottom: 0, left: 0, width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(17,24,39,0.65)', borderTopRightRadius: borderRadius.lg },
  addTile: { alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray[300], borderRadius: borderRadius.lg, backgroundColor: colors.gray[50] },
  addText: { color: colors.primary[500], fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  modalRoot: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.4)' },
  sheet: { width: '100%', maxWidth: 560, alignSelf: 'center', backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.gray[200] },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.sm },
  sheetTitle: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.gray[900] },
  reorderHint: { fontSize: typography.fontSizes.xs, color: colors.gray[500], marginBottom: spacing.sm },
  reorderRow: { flexDirection: 'row', alignItems: 'center', height: 76, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[100] },
  activeRow: { backgroundColor: colors.primary[50] },
  dragPhoto: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 60 },
  reorderImage: { width: 48, height: 48, borderRadius: borderRadius.md, backgroundColor: colors.gray[100] },
  reorderLabel: { flex: 1 },
  photoLabel: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium, color: colors.gray[900] },
  firstPhoto: { fontSize: typography.fontSizes.xs, color: colors.gray[500], marginTop: spacing.xs },
  moveButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
