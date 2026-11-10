import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { File } from 'expo-file-system';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { PhotoEditingCanvas } from './PhotoEditingCanvas';
import { PhotoZoomControl } from './PhotoZoomControl';
import { transformPostPhoto } from '@/lib/postPhotoEditing';
import { pixelPhotoCrop, rotatePhotoCrop, rotatedPhotoSize, type PhotoCrop, type PhotoRotation } from '@/lib/photoEditingGeometry';
import { clamp, fullPhotoCrop, MAX_PHOTO_ZOOM, photoCropZoom, samePhotoCrop, squarePhotoCrop, zoomPhotoCrop, type PhotoFraming } from '@/lib/photoEditorGeometry';
import { getErrorMessage } from '@/lib/errors';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface Props {
  photo: SelectedPostPhoto;
  startWithCrop?: boolean;
  onApply: (photo: SelectedPostPhoto) => void;
  onClose: () => void;
}
interface Composition {
  photo: SelectedPostPhoto;
  rotation: PhotoRotation;
  mode: PhotoFraming;
  crop?: PhotoCrop;
}
interface Session { current: Composition; history: Composition[] }
const boundsOf = (value: Composition) => value.crop ?? fullPhotoCrop(value.photo.width, value.photo.height, value.rotation);
const equivalent = (a: Composition, b: Composition) => a.photo.uri === b.photo.uri && a.rotation === b.rotation && a.mode === b.mode && samePhotoCrop(boundsOf(a), boundsOf(b));

export function PostPhotoEditor({ photo, startWithCrop = false, onApply, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const [session, setSession] = useState<Session>({ current: { photo, rotation: 0, mode: startWithCrop ? 'crop' : 'fit' }, history: [] });
  const latest = useRef(session);
  const zoomStart = useRef<Composition | null>(null);
  const savingRef = useRef(false);
  const keptUri = useRef<string | null>(null);
  const generatedUris = useRef(new Set<string>());
  const [saving, setSaving] = useState(false);
  const [canvasInteracting, setCanvasInteracting] = useState(false);
  const [zooming, setZooming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState({ width: width - spacing.md * 2, height: Math.max(140, height - 330) });
  const current = session.current;
  const source = rotatedPhotoSize(current.photo.width, current.photo.height, current.rotation);
  const bounds = boundsOf(current);
  const zoom = photoCropZoom(bounds, source.width, source.height);
  const maximumZoom = Math.max(MAX_PHOTO_ZOOM, zoom);
  const disabled = saving || canvasInteracting || zooming;
  const original: Composition = {
    photo: { ...photo, uri: photo.sourceUri, width: photo.sourceWidth, height: photo.sourceHeight, isCropped: false },
    rotation: 0, mode: 'fit',
  };

  useEffect(() => {
    const generated = generatedUris.current;
    return () => {
      for (const uri of generated) {
        if (uri === keptUri.current) continue;
        try { const file = new File(uri); if (file.exists) file.delete(); } catch {}
      }
    };
  }, []);

  const replace = (next: Session) => { latest.current = next; setSession(next); };
  const change = (next: Composition, record = true) => {
    if (savingRef.current || equivalent(latest.current.current, next)) return;
    const previous = latest.current;
    replace({ current: next, history: record ? [...previous.history.slice(-39), previous.current] : previous.history });
    setError(null);
  };
  const close = () => { if (!savingRef.current) onClose(); };
  const selectMode = (mode: PhotoFraming) => {
    if (disabled) return;
    const value = latest.current.current;
    change({ ...value, mode, crop: mode === 'fit' ? undefined : mode === 'fill' ? squarePhotoCrop(boundsOf(value)) : boundsOf(value) });
  };
  const rotate = () => {
    if (disabled) return;
    const value = latest.current.current;
    const size = rotatedPhotoSize(value.photo.width, value.photo.height, value.rotation);
    change({ ...value, rotation: ((value.rotation + 90) % 360) as PhotoRotation,
      crop: value.crop ? rotatePhotoCrop(value.crop, size.height) : undefined });
  };
  const commitCrop = (crop: PhotoCrop) => {
    const value = latest.current.current;
    const size = rotatedPhotoSize(value.photo.width, value.photo.height, value.rotation);
    const next = pixelPhotoCrop(crop, size.width, size.height);
    if (samePhotoCrop(boundsOf(value), next)) return;
    change({ ...value, crop: next, mode: value.mode === 'fit' ? 'crop' : value.mode });
  };
  const zoomTo = (requested: number) => {
    const value = latest.current.current;
    const size = rotatedPhotoSize(value.photo.width, value.photo.height, value.rotation);
    const crop = boundsOf(value);
    const nextZoom = clamp(requested, 1, Math.max(MAX_PHOTO_ZOOM, photoCropZoom(crop, size.width, size.height)));
    const nextCrop = zoomPhotoCrop(crop, size.width, size.height, nextZoom);
    change({ ...value, crop: nextCrop, mode: value.mode === 'fit' ? 'crop' : value.mode }, false);
  };
  const finishZoom = (canceled: boolean) => {
    const start = zoomStart.current;
    zoomStart.current = null;
    if (start) {
      const previous = latest.current;
      if (canceled) replace({ ...previous, current: start });
      else if (!equivalent(start, previous.current)) replace({ current: previous.current, history: [...previous.history.slice(-39), start] });
    }
    setZooming(false);
  };
  const stepZoom = (direction: number) => {
    if (disabled || zoomStart.current) return;
    const value = latest.current.current;
    const size = rotatedPhotoSize(value.photo.width, value.photo.height, value.rotation);
    zoomStart.current = value;
    zoomTo(photoCropZoom(boundsOf(value), size.width, size.height) * (direction > 0 ? 1.25 : .8));
    finishZoom(false);
  };
  const undo = () => {
    if (disabled) return;
    const value = latest.current;
    const previous = value.history.at(-1);
    if (previous) { replace({ current: previous, history: value.history.slice(0, -1) }); setError(null); }
  };
  const apply = async () => {
    if (savingRef.current || canvasInteracting || zoomStart.current) return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const value = latest.current.current;
      const result = await transformPostPhoto(value.photo, { rotation: value.rotation, crop: value.crop });
      if (result.uri !== photo.uri && result.uri !== photo.sourceUri) generatedUris.current.add(result.uri);
      keptUri.current = result.uri;
      onApply(result);
    } catch (error) {
      setError(getErrorMessage(error, 'Could not edit the photo. Please try again.'));
    } finally {
      savingRef.current = false; setSaving(false);
    }
  };

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <GestureHandlerRootView style={styles.root}>
        <SafeAreaView style={styles.root} edges={['top', 'bottom']} accessibilityViewIsModal onAccessibilityEscape={close}>
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel="Cancel photo edits"><Text style={styles.cancel}>Cancel</Text></Pressable>
            <Text style={styles.title} accessibilityRole="header">Edit photo</Text>
            <Pressable style={[styles.headerButton, styles.done]} onPress={apply} disabled={disabled} accessibilityRole="button" accessibilityLabel="Done editing photo" accessibilityState={{ disabled, busy: saving }}>
              {saving ? <ActivityIndicator color={colors.primary[500]} /> : <Text style={[styles.doneText, disabled && styles.muted]}>Done</Text>}
            </Pressable>
          </View>
          <View style={styles.tools}>
            <Pressable style={styles.iconButton} onPress={rotate} disabled={disabled} accessibilityRole="button" accessibilityLabel="Rotate photo clockwise" accessibilityHint="Rotates the image a quarter turn." testID="photo-editor-rotate">
              <MaterialIcons name="rotate-90-degrees-cw" size={27} color={disabled ? colors.gray[300] : colors.gray[700]} />
            </Pressable>
            <Pressable style={styles.iconButton} onPress={undo} disabled={disabled || !session.history.length} accessibilityRole="button" accessibilityLabel="Undo photo adjustment" testID="photo-editor-undo">
              <Ionicons name="arrow-undo-outline" size={23} color={disabled || !session.history.length ? colors.gray[300] : colors.gray[700]} />
            </Pressable>
          </View>
          <View style={styles.canvas} onLayout={event => {
            const layout = event.nativeEvent.layout;
            if (layout.width > 0 && layout.height > 0 && (layout.width !== stage.width || layout.height !== stage.height)) setStage({ width: layout.width, height: layout.height });
          }}>
            <PhotoEditingCanvas photo={current.photo} rotation={current.rotation} crop={bounds} mode={current.mode}
              width={stage.width} height={stage.height} disabled={saving || zooming} onCommit={commitCrop} onInteractionChange={setCanvasInteracting} />
          </View>
          <Text style={styles.hint}>{current.mode === 'crop' ? 'Drag corners · pinch and move photo' : 'Pinch to zoom · drag to position'}</Text>
          <View style={styles.controls}>
            <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Photo framing">
              {([{ mode: 'fit', label: 'Fit whole photo' }, { mode: 'fill', label: 'Fill frame' }, { mode: 'crop', label: 'Crop' }] as const).map(option => (
                <Pressable key={option.mode} style={[styles.option, current.mode === option.mode && styles.optionSelected]} onPress={() => selectMode(option.mode)} disabled={disabled}
                  accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: current.mode === option.mode, disabled }}>
                  <Text style={[styles.optionText, current.mode === option.mode && styles.selectedText]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
            <PhotoZoomControl value={zoom} maximum={maximumZoom} disabled={saving || canvasInteracting}
              onStart={() => { zoomStart.current = latest.current.current; setZooming(true); }} onChange={zoomTo} onEnd={finishZoom} onStep={stepZoom} />
            {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
            <Pressable style={styles.reset} onPress={() => { if (!disabled) change(original); }} disabled={disabled || equivalent(current, original)} accessibilityRole="button" accessibilityLabel="Reset adjustments" accessibilityHint="Restores the original photo and clears cropping, rotation, and positioning." testID="photo-editor-reset">
              <Text style={[styles.resetText, (disabled || equivalent(current, original)) && styles.muted]}>Reset adjustments</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: 56 },
  headerButton: { minWidth: 70, minHeight: 44, justifyContent: 'center' },
  done: { alignItems: 'flex-end' },
  cancel: { fontSize: typography.fontSizes.md, color: colors.gray[600] },
  title: { fontSize: typography.fontSizes.lg, fontWeight: typography.fontWeights.semibold, color: colors.gray[900] },
  doneText: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.semibold, color: colors.primary[500] },
  tools: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, minHeight: 48, marginBottom: spacing.sm },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  canvas: { flex: 1, marginHorizontal: spacing.md, borderRadius: borderRadius.lg, overflow: 'hidden' },
  hint: { textAlign: 'center', color: colors.gray[500], fontSize: typography.fontSizes.xs, marginTop: spacing.sm, marginBottom: spacing.sm },
  controls: { paddingHorizontal: spacing.md, paddingBottom: spacing.xs },
  options: { flexDirection: 'row', padding: spacing.xs, gap: spacing.xs, backgroundColor: colors.gray[100], borderRadius: borderRadius.lg, marginBottom: spacing.sm },
  option: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md, paddingHorizontal: spacing.xs },
  optionSelected: { backgroundColor: colors.white },
  optionText: { fontSize: typography.fontSizes.xs, color: colors.gray[600] },
  selectedText: { fontWeight: typography.fontWeights.semibold, color: colors.gray[900] },
  reset: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
  resetText: { color: colors.gray[600], fontSize: typography.fontSizes.sm },
  muted: { color: colors.gray[300] },
  error: { color: colors.error.dark, fontSize: typography.fontSizes.sm, textAlign: 'center', marginVertical: spacing.xs },
});
