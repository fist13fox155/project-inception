import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';

const AnimatedG = Animated.createAnimatedComponent(G);

type Props = { size?: number; color?: string; speaking?: boolean };

export default function JarvisOrb({ size = 100, color = theme.colors.neon, speaking = false }: Props) {
  const rotation = useSharedValue(0);
  const pulse = useSharedValue(1);
  const innerRot = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 16000, easing: Easing.linear }),
      -1,
      false
    );
    innerRot.value = withRepeat(
      withTiming(-360, { duration: 9000, easing: Easing.linear }),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(speaking ? 1.08 : 1.03, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [speaking]);

  const outerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }, { scale: pulse.value }],
  }));
  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${innerRot.value}deg` }],
  }));

  const r = size / 2;
  const stroke = Math.max(1, size * 0.012);

  return (
    <View
      style={[styles.wrap, { width: size, height: size, shadowColor: color }]}
      testID="jarvis-avatar-orb"
    >
      <Animated.View style={[StyleSheet.absoluteFill, outerStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {/* outer ring */}
          <Circle cx={r} cy={r} r={r - stroke * 2} stroke={color} strokeWidth={stroke} fill="none" opacity={0.9} />
          {/* arcs */}
          <Circle
            cx={r}
            cy={r}
            r={r - stroke * 6}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${(r * 1.4).toFixed(0)}, ${(r * 6).toFixed(0)}`}
            opacity={0.7}
          />
          <Circle
            cx={r}
            cy={r}
            r={r - stroke * 10}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${(r * 0.8).toFixed(0)}, ${(r * 4).toFixed(0)}`}
            opacity={0.6}
          />
        </Svg>
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, innerStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={r}
            cy={r}
            r={r - stroke * 14}
            stroke={color}
            strokeWidth={stroke * 1.2}
            fill="none"
            strokeDasharray={`${(r * 0.5).toFixed(0)}, ${(r * 2).toFixed(0)}`}
            opacity={0.9}
          />
          <Circle cx={r} cy={r} r={r * 0.18} fill={color} opacity={0.9} />
          <Circle cx={r} cy={r} r={r * 0.34} stroke={color} strokeWidth={stroke} fill="none" opacity={0.5} />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 18,
    elevation: 12,
  },
});
