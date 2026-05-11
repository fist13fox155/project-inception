/**
 * EtherealOrbBackground - cyan pulsing orb halo painted behind the home screen.
 * Pure SVG (no images) with reanimated pulse + drift for an ambient JARVIS feel.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const { width: W, height: H } = Dimensions.get('window');
const SAFE_W = W > 0 ? W : 400;
const SAFE_H = H > 0 ? H : 800;
const ORB = Math.max(SAFE_W, SAFE_H) * 1.4;

export default function EtherealOrbBackground() {
  const pulse = useSharedValue(0.9);
  const drift = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: 4500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 14000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false
    );
  }, [pulse, drift]);

  const orbStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: pulse.value },
      { translateY: drift.value * 30 - 15 },
      { translateX: drift.value * 18 - 9 },
    ],
    opacity: 0.55 + (pulse.value - 0.9) * 1.2,
  }));

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.85 + (1.12 - pulse.value) * 1.4 }],
    opacity: 0.25 + (1.12 - pulse.value) * 1.5,
  }));

  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap]}>
      {/* Soft starfield grid */}
      <Svg width={SAFE_W} height={SAFE_H} style={StyleSheet.absoluteFill}>
        {[...Array(28)].map((_, i) => {
          const x = (i * 137.5) % SAFE_W;
          const y = (i * 78.3) % SAFE_H;
          return (
            <Circle
              key={`s-${i}`}
              cx={x}
              cy={y}
              r={i % 7 === 0 ? 1.4 : 0.7}
              fill="#7FDBFF"
              opacity={i % 5 === 0 ? 0.5 : 0.18}
            />
          );
        })}
      </Svg>

      {/* Outer pulsing halo */}
      <Animated.View style={[styles.center, ringStyle]}>
        <Svg width={ORB} height={ORB}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#00E5FF" stopOpacity="0.35" />
              <Stop offset="40%" stopColor="#00BFFF" stopOpacity="0.18" />
              <Stop offset="70%" stopColor="#0077B6" stopOpacity="0.08" />
              <Stop offset="100%" stopColor="#000814" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={ORB / 2} cy={ORB / 2} r={ORB / 2} fill="url(#halo)" />
        </Svg>
      </Animated.View>

      {/* Inner core orb */}
      <Animated.View style={[styles.center, orbStyle]}>
        <Svg width={ORB * 0.6} height={ORB * 0.6}>
          <Defs>
            <RadialGradient id="core" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#7FFCFF" stopOpacity="0.55" />
              <Stop offset="35%" stopColor="#00E5FF" stopOpacity="0.28" />
              <Stop offset="70%" stopColor="#0096C7" stopOpacity="0.10" />
              <Stop offset="100%" stopColor="#000" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={ORB * 0.3} cy={ORB * 0.3} r={ORB * 0.3} fill="url(#core)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#000814',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
