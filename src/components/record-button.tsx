import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Brand, Radius } from '@/constants/theme';

export type RecordState = 'idle' | 'recording' | 'busy';

const SIZE = 96;

export function RecordButton({ state, onPress }: { state: RecordState; onPress: () => void }) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (state === 'recording') {
      pulse.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.out(Easing.ease) }),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
    }
  }, [pulse, state]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.55 }],
    opacity: 0.35 * (1 - pulse.value),
  }));

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />
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
