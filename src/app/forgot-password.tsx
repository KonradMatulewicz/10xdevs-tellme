import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
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

export default function ForgotPasswordScreen() {
  const { resetPassword } = useAuth();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setError(null);
    setBusy(true);
    const res = await resetPassword(email.trim());
    setBusy(false);
    if (res.error) return setError(res.error);
    setSent(true);
  };

  return (
    <ThemedView style={styles.fill}>
      <LinearGradient colors={Brand.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <ThemedText style={styles.brand}>Reset password</ThemedText>
          <ThemedText style={styles.tagline}>
            We&apos;ll email you a link to set a new one.
          </ThemedText>
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
          {sent ? (
            <>
              <ThemedText type="subtitle">Check your email</ThemedText>
              <ThemedText themeColor="textSecondary">
                If an account exists for {email.trim()}, a reset link is on its way. Open it on this
                device to continue.
              </ThemedText>
              <Link href="/sign-in" asChild>
                <Pressable>
                  <ThemedText type="small" themeColor="accent" style={styles.link}>
                    Back to sign in
                  </ThemedText>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <ThemedText type="subtitle">Forgot your password?</ThemedText>

              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
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

              <Pressable onPress={submit} disabled={busy || !email}>
                <LinearGradient
                  colors={Brand.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.cta, (busy || !email) && { opacity: 0.6 }]}
                >
                  {busy ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={styles.ctaText}>Send reset link</ThemedText>
                  )}
                </LinearGradient>
              </Pressable>

              <Link href="/sign-in" asChild>
                <Pressable>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
                    Back to sign in
                  </ThemedText>
                </Pressable>
              </Link>
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
