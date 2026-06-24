import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '../lib/theme';
import type { Presence } from '../lib/presence';

// Status dot: pulses when actively present, static green when online, grey when
// offline.
export default function PresenceDot({
  presence,
  size = 12,
}: {
  presence: Presence;
  size?: number;
}) {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (presence !== 'active') {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [presence, pulse]);

  const color = presence === 'offline' ? colors.offline : colors.online;
  const dot = { width: size, height: size, borderRadius: size / 2, backgroundColor: color };

  if (presence !== 'active') {
    return <View style={dot} />;
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size * 2, height: size * 2, borderRadius: size, backgroundColor: color, opacity: pulse.interpolate({ inputRange: [0.35, 1], outputRange: [0, 0.4] }), transform: [{ scale: pulse }] },
        ]}
      />
      <View style={dot} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute' },
});
