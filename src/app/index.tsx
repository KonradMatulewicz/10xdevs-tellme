import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder } from 'expo-audio';
import { Redirect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RecordButton, type RecordState } from '@/components/record-button';
import { Segmented } from '@/components/segmented';
import { TaskCard } from '@/components/task-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fetchTasks, transcribe, updateTask } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { Task, TaskStatus } from '@/types';

const TABS: { value: TaskStatus; label: string }[] = [
  { value: 'todo', label: 'To-Do' },
  { value: 'done', label: 'Done' },
  { value: 'deleted', label: 'Deleted' },
];

type Patch = { text?: string; status?: TaskStatus };

export default function HomeScreen() {
  const { session, loading: authLoading, signOut } = useAuth();
  const theme = useTheme();
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);

  const [status, setStatus] = useState<TaskStatus>('todo');
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [recordState, setRecordState] = useState<RecordState>('idle');
  const [banner, setBanner] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setListLoading(true);
      setTasks(await fetchTasks(status, query.trim() || undefined));
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Could not load tasks');
    } finally {
      setListLoading(false);
    }
  }, [status, query]);

  useEffect(() => {
    if (!session) return;
    const t = setTimeout(load, 250); // debounce search + react to tab changes
    return () => clearTimeout(t);
  }, [session, load]);

  // Hooks above run unconditionally; gate rendering below.
  if (authLoading) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.accent} />
      </ThemedView>
    );
  }
  if (!session) return <Redirect href="/sign-in" />;

  const onRecord = async () => {
    if (recordState === 'recording') {
      setRecordState('busy');
      try {
        await recorder.stop();
        if (!recorder.uri) throw new Error('No recording captured');
        const { tasks: added } = await transcribe(recorder.uri);
        setBanner(
          added.length
            ? `Added ${added.length} task${added.length > 1 ? 's' : ''}`
            : 'No tasks detected — try again',
        );
        setStatus('todo');
        await load();
      } catch (e) {
        setBanner(e instanceof Error ? e.message : 'Something went wrong');
      } finally {
        setRecordState('idle');
      }
      return;
    }

    setBanner('Starting…'); // immediate confirmation the tap registered
    try {
      const perm = await AudioModule.requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setBanner(null);
        Alert.alert('Microphone needed', 'Enable microphone access to record voice notes.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setBanner(null);
      setRecordState('recording');
    } catch (e) {
      setBanner(`Record error: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const onUpdate = async (id: string, patch: Patch) => {
    // Optimistic: drop it from view if it moved tabs, else patch in place.
    setTasks((prev) =>
      prev.flatMap((t) => {
        if (t.id !== id) return [t];
        if (patch.status && patch.status !== status) return [];
        return [{ ...t, ...patch }];
      }),
    );
    try {
      await updateTask(id, patch);
    } catch (e) {
      setBanner(e instanceof Error ? e.message : 'Update failed');
      load(); // reconcile with server truth
    }
  };

  const recordLabel =
    recordState === 'recording'
      ? 'Recording… tap to stop'
      : recordState === 'busy'
        ? 'Transcribing…'
        : 'Tap to capture a voice note';

  return (
    <ThemedView style={styles.fill}>
      <SafeAreaView style={styles.fill} edges={['top']}>
        <View style={styles.header}>
          <View>
            <ThemedText type="subtitle">Tellme</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Speak it. We’ll list it.
            </ThemedText>
          </View>
          <Pressable onPress={signOut} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              Sign out
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <RecordButton state={recordState} onPress={onRecord} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.heroSpace}>
            {recordLabel}
          </ThemedText>
        </View>

        {banner && (
          <Pressable
            onPress={() => setBanner(null)}
            style={[styles.banner, { backgroundColor: theme.accentSoft }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {banner}
            </ThemedText>
          </Pressable>
        )}

        <View style={styles.controls}>
          <Segmented options={TABS} value={status} onChange={setStatus} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search tasks"
            placeholderTextColor={theme.textSecondary}
            style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
          />
        </View>

        <FlatList
          style={styles.list}
          data={tasks}
          keyExtractor={(t) => t.id}
          renderItem={({ item }) => <TaskCard task={item} onUpdate={(p) => onUpdate(item.id, p)} />}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            listLoading ? (
              <ActivityIndicator color={theme.accent} style={{ marginTop: Spacing.five }} />
            ) : (
              <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                {emptyText(status)}
              </ThemedText>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function emptyText(status: TaskStatus) {
  if (status === 'todo') return 'No to-dos yet. Tap record and say what you need to do.';
  if (status === 'done') return 'Nothing completed yet.';
  return 'Nothing deleted.';
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  // No `gap` here: on iOS Fabric, `gap` + `alignItems: 'center'` with children
  // narrower than the container mis-measured the hit rect, so taps on the
  // centered buttons landed outside it and were dropped (web kept them live).
  // Explicit margins keep the container's bounds around its children.
  hero: { alignItems: 'center', paddingVertical: Spacing.four },
  heroSpace: { marginTop: Spacing.two },
  banner: {
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  controls: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  list: { flex: 1 },
  search: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  listContent: {
    padding: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  empty: { textAlign: 'center', marginTop: Spacing.five, paddingHorizontal: Spacing.four },
});
