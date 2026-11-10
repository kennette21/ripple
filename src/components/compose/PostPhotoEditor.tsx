import React, { useEffect, useRef, useState } from 'react';
import {
  Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import ImageCropScreen from './ImageCropScreen';
import { fillPostPhotoFrame } from '@/lib/postPhotoEditing';
import { getErrorMessage } from '@/lib/errors';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import type { SelectedPostPhoto } from '@/types/postPhoto';

interface PostPhotoEditorProps {
  photo: SelectedPostPhoto;
  startWithCrop?: boolean;
  onApply: (photo: SelectedPostPhoto) => void;
  onClose: () => void;
}

export function PostPhotoEditor({ photo, startWithCrop = false, onApply, onClose }: PostPhotoEditorProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [draft, setDraft] = useState(photo);
  const [fillFrame, setFillFrame] = useState(false);
  const [cropping, setCropping] = useState(startWithCrop);
  const [cropProcessing, setCropProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const generatedUris = useRef(new Set<string>());
  const keptUri = useRef<string | null>(null);
  const previewSize = Math.min(width - spacing.xl * 2, height * 0.35, 360);

  useEffect(() => {
    const generated = generatedUris.current;
    return () => {
      for (const uri of generated) {
        if (uri === keptUri.current) continue;
        try {
          const file = new File(uri);
          if (file.exists) file.delete();
        } catch {}
      }
    };
  }, []);

  const close = () => {
    if (!savingRef.current) onClose();
  };

  const apply = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const result = fillFrame ? await fillPostPhotoFrame(draft) : draft;
      if (result.uri !== photo.uri) generatedUris.current.add(result.uri);
      keptUri.current = result.uri;
      onApply(result);
    } catch (error) {
      setError(getErrorMessage(error, 'Could not edit the photo. Please try again.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (cropping) {
          if (!cropProcessing) setCropping(false);
          return;
        }
        close();
      }}
    >
      <GestureHandlerRootView style={styles.root}>
        {cropping ? (
          <ImageCropScreen
            imageUri={photo.sourceUri}
            imageWidth={photo.sourceWidth}
            imageHeight={photo.sourceHeight}
            onCrop={(uri, imageWidth, imageHeight) => {
              generatedUris.current.add(uri);
              setDraft({ ...draft, uri, width: imageWidth, height: imageHeight, isCropped: true });
              setFillFrame(false);
              setCropping(false);
              setError(null);
            }}
            onCancel={() => setCropping(false)}
            onProcessingChange={setCropProcessing}
          />
        ) : (
          <View style={styles.overlay} accessibilityViewIsModal onAccessibilityEscape={close}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel="Dismiss photo editor"
            />
            <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
              <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.grabber} />
                <View style={styles.header}>
                  <Text style={styles.title} accessibilityRole="header">Edit photo</Text>
                  <Pressable style={styles.close} onPress={close} disabled={saving} accessibilityRole="button" accessibilityLabel="Close photo editor">
                    <Ionicons name="close" size={24} color={colors.gray[600]} />
                  </Pressable>
                </View>
                <View style={[styles.preview, { width: previewSize, height: previewSize }]}>
                  <Image
                    source={{ uri: draft.uri }}
                    style={StyleSheet.absoluteFill}
                    contentFit={fillFrame ? 'cover' : 'contain'}
                    accessibilityLabel="Photo framing preview"
                  />
                  <Pressable
                    style={styles.crop}
                    onPress={() => setCropping(true)}
                    disabled={saving}
                    accessibilityRole="button"
                    accessibilityLabel="Crop photo"
                    testID="photo-editor-crop"
                  >
                    <Ionicons name="crop" size={20} color={colors.white} />
                    <Text style={styles.cropText}>Crop</Text>
                  </Pressable>
                </View>
                <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Photo framing">
                  {[
                    { fill: false, label: 'Fit whole photo', detail: 'Keep the full photo' },
                    { fill: true, label: 'Fill frame', detail: 'Crop to a square' },
                  ].map((option) => (
                    <Pressable
                      key={option.label}
                      style={[styles.option, fillFrame === option.fill && styles.optionSelected]}
                      onPress={() => setFillFrame(option.fill)}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityLabel={option.label + '. ' + option.detail}
                      accessibilityState={{ checked: fillFrame === option.fill, disabled: saving }}
                    >
                      <Text style={[styles.optionLabel, fillFrame === option.fill && styles.selectedText]}>{option.label}</Text>
                      <Text style={styles.optionDetail}>{option.detail}</Text>
                    </Pressable>
                  ))}
                </View>
                {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                <Button title="Done" onPress={() => void apply()} loading={saving} style={styles.done} />
              </ScrollView>
            </View>
          </View>
        )}
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.4)' },
  sheet: {
    maxHeight: '92%', width: '100%', maxWidth: 560, alignSelf: 'center',
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  grabber: { width: 36, height: 4, alignSelf: 'center', backgroundColor: colors.gray[200], borderRadius: borderRadius.full },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  title: { fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.gray[900] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  preview: { alignSelf: 'center', borderRadius: borderRadius.lg, backgroundColor: colors.gray[100], overflow: 'hidden' },
  crop: {
    position: 'absolute', bottom: spacing.sm, left: spacing.sm,
    minHeight: 44, paddingHorizontal: spacing.sm, borderRadius: borderRadius.md,
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs, backgroundColor: 'rgba(17,24,39,0.7)',
  },
  cropText: { color: colors.white, fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.medium },
  options: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  option: { flex: 1, padding: spacing.sm, minHeight: 64, justifyContent: 'center', borderWidth: 1, borderColor: colors.gray[200], borderRadius: borderRadius.lg },
  optionSelected: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  optionLabel: { fontSize: typography.fontSizes.sm, fontWeight: typography.fontWeights.semibold, color: colors.gray[900] },
  selectedText: { color: colors.primary[600] },
  optionDetail: { fontSize: typography.fontSizes.xs, color: colors.gray[500], marginTop: spacing.xs },
  done: { marginTop: spacing.md },
  error: { color: colors.error.dark, fontSize: typography.fontSizes.sm, marginTop: spacing.sm },
});
