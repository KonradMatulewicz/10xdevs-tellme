/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // useColorScheme can return null/undefined; only 'dark' opts into dark.
  const theme = scheme === 'dark' ? 'dark' : 'light';

  return Colors[theme];
}
