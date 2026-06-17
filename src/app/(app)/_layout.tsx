import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';

// Gate for the authenticated "product" routes. Every screen nested under
// (app)/ is protected here, so individual screens no longer redirect.
export default function AppLayout() {
  const { session, loading } = useAuth();
  const theme = useTheme();

  if (loading) {
    return (
      <ThemedView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }

  if (!session) return <Redirect href="/sign-in" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}
