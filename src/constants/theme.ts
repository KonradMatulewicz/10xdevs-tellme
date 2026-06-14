/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#16131F',
    background: '#FBFAFF',
    backgroundElement: '#F2F0FA',
    backgroundSelected: '#E7E3F7',
    textSecondary: '#6B6580',
    surface: '#FFFFFF',
    border: '#ECE9F5',
    accent: '#6C5CE7',
    accentSoft: '#EDEAFD',
    success: '#10B981',
    danger: '#F43F6B',
    textOnAccent: '#FFFFFF',
  },
  dark: {
    text: '#F4F2FB',
    background: '#0E0B16',
    backgroundElement: '#1A1626',
    backgroundSelected: '#272235',
    textSecondary: '#A39DB8',
    surface: '#171320',
    border: '#272235',
    accent: '#8E7BFF',
    accentSoft: '#241E3A',
    success: '#34D399',
    danger: '#FB7199',
    textOnAccent: '#FFFFFF',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** Theme-independent brand accents — the "jazzy, fresh" look. */
export const Brand = {
  /** Record button / hero accent gradient (indigo → pink). */
  gradient: ['#7C5CFF', '#B05CFF', '#FF6BD6'] as const,
  /** Subtle header wash. */
  headerGradient: ['#6C5CE7', '#9B5CFF'] as const,
  recording: '#F43F6B',
} as const;

export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
