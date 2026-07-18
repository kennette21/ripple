import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '@constants/theme';
import {
  applyDefaultDevTheme,
  applyDevTheme,
  defaultDevThemeColors,
  deleteDevTheme,
  getDevThemeState,
  normalizeDevColor,
  saveDevTheme,
  type DevThemeColors,
  type DevThemePreset,
} from '@lib/devTheme';

const COLOR_FIELDS: Array<{
  key: keyof DevThemeColors;
  label: string;
  description: string;
}> = [
  { key: 'primary', label: 'Brand', description: 'Buttons, links, and active states' },
  { key: 'success', label: 'Success', description: 'Positive feedback' },
  { key: 'warning', label: 'Warning', description: 'Cautionary feedback' },
  { key: 'error', label: 'Danger', description: 'Errors and destructive actions' },
  { key: 'info', label: 'Info', description: 'Informational feedback' },
];

const PICKER_HUES = Array.from({ length: 12 }, (_, index) => index * 30);

function hslToHex(hue: number, saturation: number, lightness: number) {
  const saturationRatio = saturation / 100;
  const lightnessRatio = lightness / 100;
  const chroma = (1 - Math.abs(2 * lightnessRatio - 1)) * saturationRatio;
  const hueSection = hue / 60;
  const secondary = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const offset = lightnessRatio - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection < 1) [red, green, blue] = [chroma, secondary, 0];
  else if (hueSection < 2) [red, green, blue] = [secondary, chroma, 0];
  else if (hueSection < 3) [red, green, blue] = [0, chroma, secondary];
  else if (hueSection < 4) [red, green, blue] = [0, secondary, chroma];
  else if (hueSection < 5) [red, green, blue] = [secondary, 0, chroma];
  else [red, green, blue] = [chroma, 0, secondary];

  const toHex = (channel: number) =>
    Math.round((channel + offset) * 255)
      .toString(16)
      .padStart(2, '0');

  return `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();
}

const COLOR_PICKER_ROWS = [
  PICKER_HUES.map((hue) => hslToHex(hue, 78, 88)),
  PICKER_HUES.map((hue) => hslToHex(hue, 76, 72)),
  PICKER_HUES.map((hue) => hslToHex(hue, 78, 56)),
  PICKER_HUES.map((hue) => hslToHex(hue, 76, 43)),
  PICKER_HUES.map((hue) => hslToHex(hue, 70, 30)),
  Array.from({ length: 12 }, (_, index) => hslToHex(0, 0, 100 - index * 8.5)),
];

interface VisualColorPickerProps {
  label: string;
  onClose: () => void;
  onSelect: (color: string) => void;
  value: string;
}

function VisualColorPicker({ label, onClose, onSelect, value }: VisualColorPickerProps) {
  const selectedColor = normalizeDevColor(value);

  return (
    <View style={styles.colorPicker}>
      <View style={styles.colorPickerHeader}>
        <View style={styles.selectedColorGroup}>
          <View
            style={[
              styles.selectedColor,
              { backgroundColor: selectedColor ?? colors.transparent },
            ]}
          />
          <View>
            <Text style={styles.colorPickerTitle}>Pick {label.toLowerCase()}</Text>
            <Text style={styles.selectedColorValue}>{selectedColor ?? 'Invalid color'}</Text>
          </View>
        </View>
        <Pressable
          accessibilityLabel="Close color picker"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onClose}
        >
          <Ionicons name="close" size={20} color={colors.gray[500]} />
        </Pressable>
      </View>

      <View style={styles.colorGrid}>
        {COLOR_PICKER_ROWS.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.colorRow}>
            {row.map((color) => {
              const selected = selectedColor === color;
              return (
                <Pressable
                  accessibilityLabel={`Select ${color}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  key={color}
                  onPress={() => onSelect(color)}
                  style={[
                    styles.colorCell,
                    { backgroundColor: color },
                    selected && styles.selectedColorCell,
                  ]}
                >
                  {selected && (
                    <Ionicons
                      name="checkmark"
                      size={13}
                      color={rowIndex < 2 || (rowIndex === 5 && row.indexOf(color) < 6)
                        ? colors.gray[900]
                        : colors.white}
                    />
                  )}
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

function PalettePreview({ palette }: { palette: DevThemeColors }) {
  return (
    <View style={styles.palettePreview}>
      {COLOR_FIELDS.map((field) => (
        <View
          key={field.key}
          style={[styles.paletteDot, { backgroundColor: palette[field.key] }]}
        />
      ))}
    </View>
  );
}

interface PresetRowProps {
  active: boolean;
  name: string;
  palette: DevThemeColors;
  onDelete?: () => void;
  onPress: () => void;
}

function PresetRow({ active, name, palette, onDelete, onPress }: PresetRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.preset,
        active && styles.activePreset,
        pressed && styles.rowPressed,
      ]}
    >
      <PalettePreview palette={palette} />
      <Text numberOfLines={1} style={styles.presetName}>{name}</Text>
      {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary[600]} />}
      {onDelete && (
        <Pressable
          accessibilityLabel={`Delete ${name}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          style={styles.deleteButton}
        >
          <Ionicons name="trash-outline" size={18} color={colors.gray[400]} />
        </Pressable>
      )}
    </Pressable>
  );
}

export function DevThemePanel() {
  const initialState = useMemo(() => getDevThemeState(), []);
  const [presets, setPresets] = useState(initialState.presets);
  const [draft, setDraft] = useState<DevThemeColors>(
    initialState.activeColors ?? { ...defaultDevThemeColors },
  );
  const [themeName, setThemeName] = useState('');
  const [pickerField, setPickerField] = useState<keyof DevThemeColors | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof DevThemeColors, string>>>({});
  const [message, setMessage] = useState<string | null>(null);

  const normalizedDraft = () => {
    const nextErrors: Partial<Record<keyof DevThemeColors, string>> = {};
    const normalized = {} as DevThemeColors;

    COLOR_FIELDS.forEach(({ key }) => {
      const value = normalizeDevColor(draft[key]);
      if (!value) nextErrors[key] = 'Enter a valid color';
      else normalized[key] = value;
    });

    setErrors(nextErrors);
    return Object.keys(nextErrors).length ? null : normalized;
  };

  const applyDraft = () => {
    const normalized = normalizedDraft();
    if (!normalized) return;
    applyDevTheme(normalized);
  };

  const saveDraft = () => {
    const normalized = normalizedDraft();
    if (!normalized) return;
    if (!themeName.trim()) {
      setMessage('Give this theme a name first.');
      return;
    }

    saveDevTheme(themeName, normalized);
  };

  const confirmDelete = (preset: DevThemePreset) => {
    Alert.alert(
      `Delete “${preset.name}”?`,
      'This removes the saved theme from this development device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteDevTheme(preset.id);
            setPresets((current) => current.filter((item) => item.id !== preset.id));
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={styles.scroll}
    >
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Saved themes</Text>
        <Text style={styles.sectionMeta}>{presets.length}/8</Text>
      </View>

      <View style={styles.presetList}>
        <PresetRow
          active={!initialState.activeColors}
          name="Ripple default"
          onPress={applyDefaultDevTheme}
          palette={{ ...defaultDevThemeColors }}
        />
        {initialState.activeColors && !initialState.activeThemeId && (
          <PresetRow
            active
            name="Custom preview"
            onPress={() => applyDevTheme(initialState.activeColors!)}
            palette={initialState.activeColors}
          />
        )}
        {presets.map((preset) => (
          <PresetRow
            active={preset.id === initialState.activeThemeId}
            key={preset.id}
            name={preset.name}
            onDelete={() => confirmDelete(preset)}
            onPress={() => applyDevTheme(preset.colors, preset.id)}
            palette={preset.colors}
          />
        ))}
      </View>

      <View style={styles.editorHeader}>
        <View>
          <Text style={styles.sectionTitle}>Theme colors</Text>
          <Text style={styles.help}>Hex, RGB(A), HSL(A), HWB, or CSS color names</Text>
        </View>
      </View>

      <View style={styles.fieldList}>
        {COLOR_FIELDS.map((field) => (
          <View key={field.key} style={styles.field}>
            <View style={styles.fieldLabelGroup}>
              <Pressable
                accessibilityLabel={`Open ${field.label.toLowerCase()} color picker`}
                accessibilityRole="button"
                onPress={() =>
                  setPickerField((current) => current === field.key ? null : field.key)
                }
                style={[
                  styles.swatchButton,
                  {
                    backgroundColor:
                      normalizeDevColor(draft[field.key]) ?? colors.transparent,
                  },
                ]}
              >
                <Ionicons name="color-palette" size={14} color={colors.white} />
              </Pressable>
              <View>
                <Text style={styles.fieldLabel}>{field.label}</Text>
                <Text style={styles.fieldDescription}>{field.description}</Text>
              </View>
            </View>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              onChangeText={(value) => {
                setDraft((current) => ({ ...current, [field.key]: value }));
                setErrors((current) => ({ ...current, [field.key]: undefined }));
                setMessage(null);
              }}
              onSubmitEditing={applyDraft}
              placeholder="#6366F1"
              placeholderTextColor={colors.gray[400]}
              selectTextOnFocus
              style={[styles.colorInput, errors[field.key] && styles.invalidInput]}
              value={draft[field.key]}
            />
            {errors[field.key] && <Text style={styles.fieldError}>{errors[field.key]}</Text>}
            {pickerField === field.key && (
              <VisualColorPicker
                label={field.label}
                onClose={() => setPickerField(null)}
                onSelect={(color) => {
                  setDraft((current) => ({ ...current, [field.key]: color }));
                  setErrors((current) => ({ ...current, [field.key]: undefined }));
                  setMessage(null);
                }}
                value={draft[field.key]}
              />
            )}
          </View>
        ))}
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={applyDraft}
        style={({ pressed }) => [styles.applyButton, pressed && styles.buttonPressed]}
      >
        <Ionicons name="color-palette-outline" size={19} color={colors.white} />
        <Text style={styles.applyButtonText}>Apply without saving</Text>
      </Pressable>

      <View style={styles.saveRow}>
        <TextInput
          maxLength={28}
          onChangeText={(value) => {
            setThemeName(value);
            setMessage(null);
          }}
          onSubmitEditing={saveDraft}
          placeholder="Theme name"
          placeholderTextColor={colors.gray[400]}
          returnKeyType="done"
          style={styles.nameInput}
          value={themeName}
        />
        <Pressable
          accessibilityRole="button"
          onPress={saveDraft}
          style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}
        >
          <Ionicons name="bookmark-outline" size={18} color={colors.primary[600]} />
          <Text style={styles.saveButtonText}>Save</Text>
        </Pressable>
      </View>
      {message && <Text style={styles.message}>{message}</Text>}

      <View style={styles.reloadNote}>
        <Ionicons name="refresh-outline" size={16} color={colors.gray[500]} />
        <Text style={styles.reloadNoteText}>
          Applying reloads the dev app so existing static styles pick up the palette.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexShrink: 1,
  },
  content: {
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    color: colors.gray[900],
    fontSize: typography.fontSizes.md,
    fontWeight: typography.fontWeights.bold,
  },
  sectionMeta: {
    color: colors.gray[400],
    fontSize: typography.fontSizes.xs,
    fontWeight: typography.fontWeights.semibold,
  },
  presetList: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.lg,
  },
  preset: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.gray[200],
    backgroundColor: colors.white,
  },
  activePreset: {
    backgroundColor: colors.primary[50],
  },
  rowPressed: {
    backgroundColor: colors.gray[100],
  },
  presetName: {
    flex: 1,
    color: colors.gray[800],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  palettePreview: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: borderRadius.sm,
  },
  paletteDot: {
    width: 8,
    height: 28,
  },
  deleteButton: {
    padding: spacing.xs,
  },
  editorHeader: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  help: {
    marginTop: 3,
    color: colors.gray[500],
    fontSize: typography.fontSizes.xs,
  },
  fieldList: {
    gap: spacing.sm,
  },
  field: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[50],
  },
  fieldLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  swatchButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
  },
  fieldLabel: {
    color: colors.gray[800],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  fieldDescription: {
    marginTop: 1,
    color: colors.gray[500],
    fontSize: 11,
  },
  colorInput: {
    height: 40,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    color: colors.gray[900],
    backgroundColor: colors.white,
    fontSize: typography.fontSizes.sm,
  },
  invalidInput: {
    borderColor: colors.error.main,
  },
  fieldError: {
    marginTop: spacing.xs,
    color: colors.error.dark,
    fontSize: typography.fontSizes.xs,
  },
  colorPicker: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.white,
  },
  colorPickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  selectedColorGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selectedColor: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderColor: colors.gray[200],
    borderRadius: borderRadius.full,
  },
  colorPickerTitle: {
    color: colors.gray[800],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.semibold,
  },
  selectedColorValue: {
    marginTop: 1,
    color: colors.gray[500],
    fontSize: 11,
  },
  colorGrid: {
    gap: 3,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 3,
  },
  colorCell: {
    height: 24,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(17, 24, 39, 0.12)',
    borderRadius: 3,
  },
  selectedColorCell: {
    borderWidth: 2,
    borderColor: colors.gray[900],
  },
  applyButton: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
  },
  applyButtonText: {
    color: colors.white,
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  buttonPressed: {
    opacity: 0.76,
  },
  saveRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  nameInput: {
    height: 44,
    flex: 1,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.gray[300],
    borderRadius: borderRadius.md,
    color: colors.gray[900],
    backgroundColor: colors.white,
    fontSize: typography.fontSizes.sm,
  },
  saveButton: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary[200],
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[50],
  },
  saveButtonText: {
    color: colors.primary[700],
    fontSize: typography.fontSizes.sm,
    fontWeight: typography.fontWeights.bold,
  },
  message: {
    marginTop: spacing.sm,
    color: colors.error.dark,
    fontSize: typography.fontSizes.xs,
  },
  reloadNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.gray[100],
  },
  reloadNoteText: {
    flex: 1,
    color: colors.gray[500],
    fontSize: typography.fontSizes.xs,
    lineHeight: 17,
  },
});
