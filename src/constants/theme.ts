import {
  defaultDevThemeColors,
  getActiveDevThemeColors,
  type DevThemeColors,
} from '@lib/devTheme';

function parseHexColor(value: string) {
  const hex = value.replace('#', '');
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) : 255,
  };
}

function mixColor(value: string, target: '#FFFFFF' | '#000000', amount: number) {
  const color = parseHexColor(value);
  const targetChannel = target === '#FFFFFF' ? 255 : 0;
  const mix = (channel: number) =>
    Math.round(channel + (targetChannel - channel) * amount)
      .toString(16)
      .padStart(2, '0');
  const alpha = color.alpha === 255 ? '' : color.alpha.toString(16).padStart(2, '0');

  return `#${mix(color.red)}${mix(color.green)}${mix(color.blue)}${alpha}`.toUpperCase();
}

function createPrimaryScale(main: string) {
  return {
    50: mixColor(main, '#FFFFFF', 0.94),
    100: mixColor(main, '#FFFFFF', 0.86),
    200: mixColor(main, '#FFFFFF', 0.70),
    300: mixColor(main, '#FFFFFF', 0.50),
    400: mixColor(main, '#FFFFFF', 0.25),
    500: main,
    600: mixColor(main, '#000000', 0.12),
    700: mixColor(main, '#000000', 0.25),
    800: mixColor(main, '#000000', 0.38),
    900: mixColor(main, '#000000', 0.50),
  };
}

function createSemanticScale(main: string) {
  return {
    light: mixColor(main, '#FFFFFF', 0.82),
    main,
    dark: mixColor(main, '#000000', 0.16),
  };
}

const activeDevThemeColors = getActiveDevThemeColors();
const devThemeColors: DevThemeColors =
  activeDevThemeColors ?? defaultDevThemeColors;
const hasCustomDevTheme = !!activeDevThemeColors;

export const colors = {
  // Primary brand colors
  primary: hasCustomDevTheme
    ? createPrimaryScale(devThemeColors.primary)
    : {
        50: '#EEF2FF',
        100: '#E0E7FF',
        200: '#C7D2FE',
        300: '#A5B4FC',
        400: '#818CF8',
        500: '#6366F1', // Main primary
        600: '#4F46E5',
        700: '#4338CA',
        800: '#3730A3',
        900: '#312E81',
      },

  // Neutral/gray scale
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Semantic colors
  success: hasCustomDevTheme
    ? createSemanticScale(devThemeColors.success)
    : { light: '#D1FAE5', main: '#10B981', dark: '#059669' },
  warning: hasCustomDevTheme
    ? createSemanticScale(devThemeColors.warning)
    : { light: '#FEF3C7', main: '#F59E0B', dark: '#D97706' },
  error: hasCustomDevTheme
    ? createSemanticScale(devThemeColors.error)
    : { light: '#FEE2E2', main: '#EF4444', dark: '#DC2626' },
  info: hasCustomDevTheme
    ? createSemanticScale(devThemeColors.info)
    : { light: '#DBEAFE', main: '#3B82F6', dark: '#2563EB' },

  // Base colors
  white: '#FFFFFF',
  black: '#000000',
  transparent: 'transparent',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const typography = {
  fontSizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  fontWeights: {
    normal: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
} as const;

export const shadows = {
  sm: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

// Light theme
export const lightTheme = {
  colors: {
    ...colors,
    background: colors.white,
    surface: colors.gray[50],
    surfaceElevated: colors.white,
    text: colors.gray[900],
    textSecondary: colors.gray[600],
    textTertiary: colors.gray[400],
    border: colors.gray[200],
    borderFocused: colors.primary[500],
    primaryMain: colors.primary[500],
    primaryLight: colors.primary[100],
  },
  spacing,
  borderRadius,
  typography,
  shadows,
};

// Dark theme
export const darkTheme = {
  colors: {
    ...colors,
    background: colors.gray[900],
    surface: colors.gray[800],
    surfaceElevated: colors.gray[700],
    text: colors.gray[50],
    textSecondary: colors.gray[400],
    textTertiary: colors.gray[500],
    border: colors.gray[700],
    borderFocused: colors.primary[400],
    primaryMain: colors.primary[400],
    primaryLight: colors.primary[900],
  },
  spacing,
  borderRadius,
  typography,
  shadows,
};

export type Theme = typeof lightTheme | typeof darkTheme;

// Default theme export for convenience
export const theme = lightTheme;
