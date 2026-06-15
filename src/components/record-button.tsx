import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Brand, Radius } from '@/constants/theme';

export type RecordState = 'idle' | 'recording' | 'busy';

const SIZE = 96;

// NOTE: Reanimated temporarily removed to isolate an iOS-only freeze. The pulse
// ring is static for now; restore the animation once the root cause is fixed.
export function RecordButton({ state, onPress }: { state: RecordState; onPress: () => void }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.ring} pointerEvents="none" />
      <Pressable onPress={onPress} disabled={state === 'busy'} hitSlop={12}>
        <LinearGradient
          colors={state === 'recording' ? [Brand.recording, '#FF8FB0'] : Brand.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.button}
        >
          {state === 'busy' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <View style={state === 'recording' ? styles.stopIcon : styles.recordIcon} />
          )}
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: Brand.recording,
    opacity: 0.35,
    pointerEvents: 'none',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7C5CFF',
    shadowOpacity: 0.45,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#fff',
  },
  stopIcon: {
    width: 26,
    height: 26,
    borderRadius: Radius.sm,
    backgroundColor: '#fff',
  },
});
