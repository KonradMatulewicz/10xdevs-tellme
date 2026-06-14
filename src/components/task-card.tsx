import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Task, TaskStatus } from '@/types';

type Patch = { text?: string; status?: TaskStatus };

export function TaskCard({ task, onUpdate }: { task: Task; onUpdate: (patch: Patch) => void }) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.text);

  const stripe =
    task.status === 'done'
      ? theme.success
      : task.status === 'deleted'
        ? theme.danger
        : theme.accent;

  const save = () => {
    const trimmed = draft.trim();
    setEditing(false);
    if (trimmed && trimmed !== task.text) onUpdate({ text: trimmed });
    else setDraft(task.text);
  };

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={[styles.stripe, { backgroundColor: stripe }]} />

      <View style={styles.body}>
        {editing ? (
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onBlur={save}
            onSubmitEditing={save}
            autoFocus
            multiline
            style={[styles.input, { color: theme.text, borderColor: theme.accent }]}
          />
        ) : (
          <ThemedText
            style={[styles.text, task.status === 'done' && styles.done]}
            themeColor={task.status === 'todo' ? 'text' : 'textSecondary'}
          >
            {task.text}
          </ThemedText>
        )}

        <View style={styles.actions}>
          {task.status === 'todo' && (
            <>
              <Action
                label="Edit"
                tint={theme.textSecondary}
                onPress={() => setEditing((e) => !e)}
              />
              <Action
                label="✓ Done"
                tint={theme.success}
                onPress={() => onUpdate({ status: 'done' })}
              />
              <Action
                label="Delete"
                tint={theme.danger}
                onPress={() => onUpdate({ status: 'deleted' })}
              />
            </>
          )}
          {task.status === 'done' && (
            <>
              <Action
                label="↺ To-Do"
                tint={theme.accent}
                onPress={() => onUpdate({ status: 'todo' })}
              />
              <Action
                label="Delete"
                tint={theme.danger}
                onPress={() => onUpdate({ status: 'deleted' })}
              />
            </>
          )}
          {task.status === 'deleted' && (
            <Action
              label="↩ Restore"
              tint={theme.accent}
              onPress={() => onUpdate({ status: 'todo' })}
            />
          )}
        </View>
      </View>
    </View>
  );
}

function Action({ label, tint, onPress }: { label: string; tint: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, pressed && { opacity: 0.55 }]}
    >
      <ThemedText type="smallBold" style={{ color: tint }}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#1B1530',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stripe: { width: 4 },
  body: {
    flex: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  text: { fontSize: 16, lineHeight: 22 },
  done: { textDecorationLine: 'line-through' },
  input: {
    fontSize: 16,
    lineHeight: 22,
    borderBottomWidth: 1.5,
    paddingVertical: Spacing.one,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    marginTop: Spacing.half,
  },
  action: { paddingVertical: Spacing.half },
});
