import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography, borderRadius } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';

const audiences = [
  {
    isPrivate: false,
    label: 'Public',
    icon: 'globe-outline' as const,
    description: 'Anyone on Ripple can view this post, including people who don’t follow you.',
  },
  {
    isPrivate: true,
    label: 'Only me',
    icon: 'lock-closed-outline' as const,
    description: 'Visible only to you on your profile.',
  },
];

interface PostAudiencePickerProps {
  isPrivate: boolean;
  onChange: (isPrivate: boolean) => void | Promise<void>;
  confirmChange?: boolean;
  disabled?: boolean;
  testID?: string;
}

export function PostAudiencePicker({
  isPrivate, onChange, confirmChange = false, disabled = false, testID,
}: PostAudiencePickerProps) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [selectedPrivate, setSelectedPrivate] = useState(isPrivate);
  const [confirming, setConfirming] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saving = useRef(false);
  const audience = audiences[isPrivate ? 1 : 0];

  const close = () => {
    if (saving.current) return;
    setVisible(false);
  };

  const open = () => {
    if (disabled || saving.current) return;
    Keyboard.dismiss();
    setSelectedPrivate(isPrivate);
    setConfirming(false);
    setError(null);
    setVisible(true);
  };

  const apply = async () => {
    if (saving.current) return;
    saving.current = true;
    setIsSaving(true);
    setError(null);
    try {
      await onChange(selectedPrivate);
      setVisible(false);
    } catch (error) {
      setError(getErrorMessage(error, 'Could not update the audience. Please try again.'));
    } finally {
      saving.current = false;
      setIsSaving(false);
    }
  };

  const handleDone = () => {
    if (selectedPrivate === isPrivate) return close();
    if (confirmChange) setConfirming(true);
    else void apply();
  };

  return (
    <>
      <Pressable
        style={({ pressed }) => [styles.trigger, isPrivate && styles.privateTrigger, pressed && styles.pressed]}
        onPress={open}
        disabled={disabled || isSaving}
        accessibilityRole="button"
        accessibilityLabel={`Change audience, currently ${audience.label}`}
        accessibilityState={{ expanded: visible, disabled: disabled || isSaving, busy: isSaving }}
        testID={testID}
        hitSlop={4}
      >
        {isSaving ? <ActivityIndicator size="small" color={colors.primary[500]} /> : (
          <Ionicons name={audience.icon} size={15} color={isPrivate ? colors.primary[600] : colors.gray[600]} />
        )}
        <Text style={[styles.triggerText, isPrivate && styles.privateText]}>{audience.label}</Text>
        <Ionicons name="chevron-down" size={12} color={isPrivate ? colors.primary[600] : colors.gray[500]} />
      </Pressable>

      {visible && (
        <Modal transparent visible animationType="slide" onRequestClose={close} statusBarTranslucent>
          <View style={[styles.overlay, confirming && styles.centered]} accessibilityViewIsModal onAccessibilityEscape={close}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={close}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityLabel="Dismiss audience picker"
            />
            {confirming ? (
              <View style={styles.confirmation}>
                <ScrollView contentContainerStyle={styles.confirmationContent}>
                  <Text style={styles.heading} accessibilityRole="header">
                    {selectedPrivate ? 'Make this post private?' : 'Make this post public?'}
                  </Text>
                  <Text style={styles.confirmationCopy}>
                    {selectedPrivate
                      ? 'This post will only be visible to you in Ripple. It will be hidden from other people’s feeds and your public profile.'
                      : 'Anyone on Ripple will be able to view this post on your profile, including people who don’t follow you.'}
                  </Text>
                  {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                  <Button title={selectedPrivate ? 'Make private' : 'Make public'} onPress={() => void apply()} loading={isSaving} />
                  <Button title="Cancel" variant="secondary" onPress={close} disabled={isSaving} style={styles.cancel} />
                </ScrollView>
              </View>
            ) : (
              <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
                <ScrollView contentContainerStyle={styles.sheetContent}>
                  <View style={styles.grabber} />
                  <View style={styles.sheetHeader}>
                    <Text style={styles.heading} accessibilityRole="header">Who can see this post?</Text>
                    <Pressable onPress={close} style={styles.close} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Close audience picker">
                      <Ionicons name="close" size={22} color={colors.gray[600]} />
                    </Pressable>
                  </View>
                  <View accessibilityRole="radiogroup" accessibilityLabel="Post audience">
                    {audiences.map((option) => {
                      const selected = selectedPrivate === option.isPrivate;
                      return (
                        <Pressable
                          key={option.label}
                          style={[styles.option, selected && styles.selectedOption]}
                          onPress={() => setSelectedPrivate(option.isPrivate)}
                          disabled={isSaving}
                          accessibilityRole="radio"
                          accessibilityLabel={`${option.label}. ${option.description}`}
                          accessibilityState={{ checked: selected, disabled: isSaving }}
                        >
                          <Ionicons name={option.icon} size={23} color={colors.primary[500]} />
                          <View style={styles.optionText}>
                            <Text style={styles.optionLabel}>{option.label}</Text>
                            <Text style={styles.optionDescription}>{option.description}</Text>
                          </View>
                          <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary[500] : colors.gray[300]} />
                        </Pressable>
                      );
                    })}
                  </View>
                  <Text style={styles.note}>Public posts can also appear in the feeds of people who follow you.</Text>
                  {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
                  <Button title="Done" onPress={handleDone} loading={isSaving} />
                </ScrollView>
              </View>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs,
    minHeight: 36, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.md, borderWidth: 1, borderColor: colors.gray[200], backgroundColor: colors.gray[50],
  },
  privateTrigger: { backgroundColor: colors.primary[50], borderColor: colors.primary[100] },
  triggerText: { fontSize: typography.fontSizes.xs, fontWeight: typography.fontWeights.medium, color: colors.gray[600] },
  privateText: { color: colors.primary[600] },
  pressed: { opacity: 0.7 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(17,24,39,0.4)' },
  centered: { justifyContent: 'center', padding: spacing.lg },
  sheet: {
    backgroundColor: colors.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center',
  },
  sheetContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  grabber: { width: 36, height: 4, borderRadius: borderRadius.full, backgroundColor: colors.gray[200], alignSelf: 'center' },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: spacing.sm },
  heading: { flexShrink: 1, fontSize: typography.fontSizes.xl, fontWeight: typography.fontWeights.bold, color: colors.gray[900] },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, marginBottom: spacing.sm, borderRadius: borderRadius.lg,
    borderWidth: 1, borderColor: colors.gray[200],
  },
  selectedOption: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  optionText: { flex: 1 },
  optionLabel: { fontSize: typography.fontSizes.md, fontWeight: typography.fontWeights.semibold, color: colors.gray[900] },
  optionDescription: { fontSize: typography.fontSizes.sm, lineHeight: 20, color: colors.gray[500], marginTop: spacing.xs },
  note: { fontSize: typography.fontSizes.xs, lineHeight: 18, color: colors.gray[500], marginTop: spacing.sm, marginBottom: spacing.md },
  confirmation: { backgroundColor: colors.white, borderRadius: 22, maxHeight: '90%', width: '100%', maxWidth: 400, alignSelf: 'center', overflow: 'hidden' },
  confirmationContent: { padding: spacing.lg },
  confirmationCopy: { fontSize: typography.fontSizes.sm, lineHeight: 22, color: colors.gray[500], marginVertical: spacing.md },
  cancel: { marginTop: spacing.sm },
  error: { fontSize: typography.fontSizes.sm, color: colors.error.dark, marginBottom: spacing.md },
});
