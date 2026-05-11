/**
 * JarvisOrb — Ethereal pulsating Northern Star in lighter cyan.
 * 8-pointed star (4 long primary + 4 short secondary rays) with pulsing glow,
 * a soft halo, and slow rotation for an ambient, celestial feel.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Polygon, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';

const STAR_CYAN = '#7FFCFF';
const STAR_DEEP = '#00E5FF';

type Props = { size?: number; color?: string; speaking?: boolean };

export default function JarvisOrb({ size = 100, color = STAR_CYAN, speaking = false }: Props) {
  const pulse = useSharedValue(1);
  const haloPulse = useSharedValue(0.6);
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = withRepeat(
      withTiming(360, { duration: 24000, easing: Easing.linear }),
      -1, false
    );
    haloPulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.5, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1, false
    );
  }, [rot, haloPulse]);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(speaking ? 1.18 : 1.08, { duration: speaking ? 600 : 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.92, { duration: speaking ? 600 : 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1, false
    );
  }, [speaking, pulse]);

  const starStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }, { rotate: `${rot.value}deg` }],
  }));
  const haloStyle = useAnimatedStyle(() => ({
    opacity: haloPulse.value,
    transform: [{ scale: 0.85 + haloPulse.value * 0.3 }],
  }));

  // 8-point star polygon — alternating outer (long) and inner (short) points
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.46;       // long-ray tip radius
  const Rmid = size * 0.18;    // short-ray tip radius
  const Rcore = size * 0.10;   // inner notch radius
  const points: string[] = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4 - Math.PI / 2;
    const isPrimary = i % 2 === 0;
    const r = isPrimary ? R : Rmid;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    points.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    // Add intermediate notch points to give the star sharp arms
    const nextAngle = angle + Math.PI / 8;
    const nx = cx + Math.cos(nextAngle) * Rcore;
    const ny = cy + Math.sin(nextAngle) * Rcore;
    points.push(`${nx.toFixed(2)},${ny.toFixed(2)}`);
  }
  const polyPts = points.join(' ');

  return (
    <View
      style={[styles.wrap, { width: size, height: size, shadowColor: color }]}
      testID="jarvis-avatar-orb"
    >
      {/* Halo - soft radial gradient pulsing */}
      <Animated.View style={[StyleSheet.absoluteFill, haloStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={color} stopOpacity="0.55" />
              <Stop offset="40%" stopColor={color} stopOpacity="0.25" />
              <Stop offset="80%" stopColor={color} stopOpacity="0.05" />
              <Stop offset="100%" stopColor={color} stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={cx} cy={cy} r={size * 0.55} fill="url(#halo)" />
        </Svg>
      </Animated.View>

      {/* The Star itself */}
      <Animated.View style={[StyleSheet.absoluteFill, starStyle]}>
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Defs>
            <RadialGradient id="starFill" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="30%" stopColor={color} stopOpacity="0.95" />
              <Stop offset="70%" stopColor={STAR_DEEP} stopOpacity="0.65" />
              <Stop offset="100%" stopColor={STAR_DEEP} stopOpacity="0.25" />
            </RadialGradient>
          </Defs>
          {/* Outer faint glow polygon */}
          <Polygon
            points={polyPts}
            fill={color}
            opacity={0.15}
            transform={`scale(1.4) translate(${-cx * 0.4 / 1.4} ${-cy * 0.4 / 1.4})`}
          />
          {/* Main star */}
          <Polygon
            points={polyPts}
            fill="url(#starFill)"
            stroke={color}
            strokeWidth={1.2}
            strokeOpacity={0.9}
          />
          {/* Bright core */}
          <Circle cx={cx} cy={cy} r={size * 0.06} fill="#FFFFFF" opacity={0.95} />
          <Circle cx={cx} cy={cy} r={size * 0.12} fill={color} opacity={0.35} />
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
    shadowOpacity: 0.95,
    shadowRadius: 22,
    elevation: 14,
  },
});
