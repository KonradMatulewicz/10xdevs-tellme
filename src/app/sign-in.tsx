import { LinearGradient } from 'expo-linear-gradient';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
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

export default function SignInScreen() {
  const { session, loading, signIn, signUp } = useAuth();
  const theme = useTheme();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!loading && session) return <Redirect href="/" />;

  const submit = async () => {
    setError(null);
    setInfo(null);
    setBusy(true);
    const res =
      mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password);
    setBusy(false);
    if (res.error) return setError(res.error);
    if (mode === 'up' && 'needsConfirmation' in res && res.needsConfirmation) {
      setInfo('Check your email to confirm your account, then sign in.');
      setMode('in');
    }
    // On success the auth listener updates the session and the Redirect fires.
  };

  return (
    <ThemedView style={styles.fill}>
      <LinearGradient colors={Brand.headerGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']} style={styles.hero}>
          <ThemedText style={styles.brand}>Tellme</ThemedText>
          <ThemedText style={styles.tagline}>
            Speak your to-dos. We turn them into a list.
          </ThemedText>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formWrap}
      >
        <View style={styles.form}>
          <ThemedText type="subtitle">
            {mode === 'in' ? 'Welcome back' : 'Create account'}
          </ThemedText>

          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={theme.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />

          {error && (
            <ThemedText type="small" style={{ color: theme.danger }}>
              {error}
            </ThemedText>
          )}
          {info && (
            <ThemedText type="small" style={{ color: theme.success }}>
              {info}
            </ThemedText>
          )}

          <Pressable onPress={submit} disabled={busy || !email || !password}>
            <LinearGradient
              colors={Brand.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.cta, (busy || !email || !password) && { opacity: 0.6 }]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <ThemedText style={styles.ctaText}>
                  {mode === 'in' ? 'Sign in' : 'Sign up'}
                </ThemedText>
              )}
            </LinearGradient>
          </Pressable>

          <Pressable
            onPress={() => {
              setMode((m) => (m === 'in' ? 'up' : 'in'));
              setError(null);
              setInfo(null);
            }}
          >
            <ThemedText type="small" themeColor="textSecondary" style={styles.toggle}>
              {mode === 'in' ? 'No account? Sign up' : 'Have an account? Sign in'}
            </ThemedText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  brand: { color: '#fff', fontSize: 40, fontWeight: '700' },
  tagline: { color: 'rgba(255,255,255,0.9)', fontSize: 16, lineHeight: 22 },
  formWrap: { flex: 1, justifyContent: 'center' },
  form: { paddingHorizontal: Spacing.four, gap: Spacing.three },
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
  toggle: { textAlign: 'center', marginTop: Spacing.one },
});
