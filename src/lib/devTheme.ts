import { DevSettings, Platform, processColor } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const STORAGE_KEY = 'ripple.dev-themes.v1';
const MAX_SAVED_THEMES = 8;

export const defaultDevThemeColors = {
  primary: '#6366F1',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
} as const;

export type DevThemeColors = {
  -readonly [Key in keyof typeof defaultDevThemeColors]: string;
};

export interface DevThemePreset {
  id: string;
  name: string;
  colors: DevThemeColors;
}

export interface DevThemeState {
  activeThemeId: string | null;
  activeColors: DevThemeColors | null;
  presets: DevThemePreset[];
}

const emptyState: DevThemeState = {
  activeThemeId: null,
  activeColors: null,
  presets: [],
};

function isThemeColors(value: unknown): value is DevThemeColors {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Record<string, unknown>;
  return Object.keys(defaultDevThemeColors).every((key) =>
    typeof candidate[key] === 'string' &&
    /^#[\dA-F]{6}(?:[\dA-F]{2})?$/i.test(candidate[key]),
  );
}

function parseState(value: string | null): DevThemeState {
  if (!value) return emptyState;

  try {
    const parsed = JSON.parse(value) as Partial<DevThemeState>;
    const presets = Array.isArray(parsed.presets)
      ? parsed.presets.filter(
          (preset): preset is DevThemePreset =>
            !!preset &&
            typeof preset.id === 'string' &&
            typeof preset.name === 'string' &&
            isThemeColors(preset.colors),
        )
      : [];

    return {
      activeThemeId:
        typeof parsed.activeThemeId === 'string' ? parsed.activeThemeId : null,
      activeColors: isThemeColors(parsed.activeColors)
        ? parsed.activeColors
        : null,
      presets: presets.slice(0, MAX_SAVED_THEMES),
    };
  } catch {
    return emptyState;
  }
}

function readStoredValue(): string | null {
  try {
    if (Platform.OS === 'web') {
      return typeof localStorage === 'undefined'
        ? null
        : localStorage.getItem(STORAGE_KEY);
    }

    return SecureStore.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredValue(value: DevThemeState) {
  const serialized = JSON.stringify(value);

  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, serialized);
    }
    return;
  }

  SecureStore.setItem(STORAGE_KEY, serialized);
}

export function getDevThemeState(): DevThemeState {
  if (!__DEV__) return emptyState;
  return parseState(readStoredValue());
}

export function getActiveDevThemeColors(): DevThemeColors | null {
  return getDevThemeState().activeColors;
}

function reloadForThemeChange() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.location.reload();
    return;
  }

  DevSettings.reload('Applied Ripple developer theme');
}

export function applyDevTheme(
  colors: DevThemeColors,
  themeId: string | null = null,
) {
  if (!__DEV__) return;
  const state = getDevThemeState();
  writeStoredValue({ ...state, activeThemeId: themeId, activeColors: colors });
  reloadForThemeChange();
}

export function applyDefaultDevTheme() {
  if (!__DEV__) return;
  const state = getDevThemeState();
  writeStoredValue({ ...state, activeThemeId: null, activeColors: null });
  reloadForThemeChange();
}

export function saveDevTheme(name: string, colors: DevThemeColors) {
  if (!__DEV__) return;
  const state = getDevThemeState();
  const normalizedName = name.trim();
  if (!normalizedName) return;
  const matchingPreset = state.presets.find(
    (preset) =>
      preset.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
  );
  const id = matchingPreset?.id ?? `${Date.now().toString(36)}`;
  const preset: DevThemePreset = { id, name: normalizedName, colors };
  const presets = [
    preset,
    ...state.presets.filter((savedPreset) => savedPreset.id !== id),
  ].slice(0, MAX_SAVED_THEMES);

  writeStoredValue({ activeThemeId: id, activeColors: colors, presets });
  reloadForThemeChange();
}

export function deleteDevTheme(id: string) {
  if (!__DEV__) return;
  const state = getDevThemeState();
  const deletingActiveTheme = state.activeThemeId === id;

  writeStoredValue({
    activeThemeId: deletingActiveTheme ? null : state.activeThemeId,
    activeColors: deletingActiveTheme ? null : state.activeColors,
    presets: state.presets.filter((preset) => preset.id !== id),
  });

  if (deletingActiveTheme) reloadForThemeChange();
}

export function normalizeDevColor(value: string): string | null {
  const processed = processColor(value.trim());
  if (typeof processed !== 'number') return null;

  // React Native exposes processed colors as AARRGGBB (signed on Android).
  const unsigned = processed >>> 0;
  const alpha = (unsigned >>> 24) & 0xff;
  const red = (unsigned >>> 16) & 0xff;
  const green = (unsigned >>> 8) & 0xff;
  const blue = unsigned & 0xff;
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  const rgb = `#${toHex(red)}${toHex(green)}${toHex(blue)}`.toUpperCase();

  return alpha === 0xff ? rgb : `${rgb}${toHex(alpha).toUpperCase()}`;
}
