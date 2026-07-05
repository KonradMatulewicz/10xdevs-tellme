import { LinearGradient } from 'expo-linear-gradient';
import { Link, Redirect, type Href } from 'expo-router';
import * as Linking from 'expo-linking';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Brand, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/lib/auth';
import { extractRecoveryCode, validateNewPassword } from '@/lib/recovery';
import { supabase } from '@/lib/supabase';

type Status = 'verifying' | 'ready' | 'error' | 'done';

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const theme = useTheme();
  // useURL covers both cold start (initial URL) and links arriving while mounted.
  const url = Linking.useURL();
  const exchanged = useRef(false);

  const [status, setStatus] = useState<Status>('verifying');
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (exchanged.current || url == null) return;
    const code = extractRecoveryCode(url);
    if (!code) {
      setStatus('error');
      setError('This reset link is invalid or missing its code. Request a new one.');
      return;
    }
    exchanged.current = true;
    supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        setStatus('error');
        setError(
          'This reset link could not be verified. It may have expired or been opened on a ' +
            'different device than the one that requested it. Request a new link.',
        );
      } else {
        setStatus('ready');
      }
    });
  }, [url]);

  // Home lives in the (app) group; its typed route isn't a bare "/", so cast.
  if (status === 'done') return <Redirect href={'/' as Href} />;

  const submit = async () => {
    setError(null);
    const validation = validateNewPassword(password, confirm);
    if (validation) return setError(validation);
    setBusy(true);
    const res = await updatePassword(password);
    setBusy(false);
    if (res.error) return setError(res.error);
    setStatus('done');
  };

  return (
    <ThemedView style={styles.fill}>
      <LinearGradient colors={Brand.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <ThemedText style={styles.brand}>New password</ThemedText>
          <ThemedText style={styles.tagline}>Choose a new password for your account.</ThemedText>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.form}>
          {status === 'verifying' && (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} />
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                Verifying your reset link…
              </ThemedText>
            </View>
          )}

          {status === 'error' && (
            <>
              <ThemedText type="subtitle">Link problem</ThemedText>
              <ThemedText type="small" style={{ color: theme.danger }}>
                {error}
              </ThemedText>
              <Link href="/forgot-password" asChild>
                <Pressable>
                  <ThemedText type="small" themeColor="accent" style={styles.link}>
                    Request a new link
                  </ThemedText>
                </Pressable>
              </Link>
            </>
          )}

          {status === 'ready' && (
            <>
              <ThemedText type="subtitle">Set a new password</ThemedText>

              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="New password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />
              <TextInput
                value={confirm}
                onChangeText={setConfirm}
                placeholder="Confirm password"
                placeholderTextColor={theme.textSecondary}
                secureTextEntry
                style={[
                  styles.input,
                  { backgroundColor: theme.backgroundElement, color: theme.text },
                ]}
              />

              {error && (
                <ThemedText type="small" style={{ color: theme.danger }}>
                  {error}
                </ThemedText>
              )}

              <Pressable onPress={submit} disabled={busy || !password || !confirm}>
                <LinearGradient
                  colors={Brand.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.cta, (busy || !password || !confirm) && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.ctaText}>Save new password</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  hero: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  brand: { color: '#fff', fontSize: 32, lineHeight: 38, fontWeight: '700' },
  tagline: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 22 },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  form: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.four,
    gap: Spacing.three,
  },
  center: { alignItems: 'center', gap: Spacing.two },
  centerText: { textAlign: 'center' },
  input: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  cta: {
    borderRadius: Radius.pill,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  link: { textAlign: 'center', marginTop: Spacing.one },
});
