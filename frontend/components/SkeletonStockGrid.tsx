/**
 * SkeletonStockGrid — animated shimmer placeholders for the 3x3 stock grid
 * shown while the first fetch is still in flight.  Looks more "pro" than a
 * raw ActivityIndicator.
 */
import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, Easing,
} from 'react-native-reanimated';
import { theme } from '../constants/theme';

const Tile = () => {
  const a = useSharedValue(0.35);
  useEffect(() => {
    a.value = withRepeat(
      withSequence(
        withTiming(0.85, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.35, { duration: 900, easing: Easing.inOut(Easing.ease) })
      ),
      -1, false
    );
  }, [a]);
  const style = useAnimatedStyle(() => ({ opacity: a.value }));
  return (
    <Animated.View style={[styles.tile, style]}>
      <View style={styles.label} />
      <View style={styles.price} />
      <View style={styles.spark} />
    </Animated.View>
  );
};

export default function SkeletonStockGrid({ count = 9 }: { count?: number }) {
  return (
    <View style={styles.grid} testID="skeleton-stocks">
      {[...Array(count)].map((_, i) => (
        <View key={i} style={styles.cell}><Tile /></View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -4 },
  cell: { width: '33.333%', padding: 4 },
  tile: {
    height: 80, padding: 8, borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)',
    gap: 6,
  },
  label: { height: 8, width: 38, backgroundColor: 'rgba(0,229,255,0.35)', borderRadius: 2 },
  price: { height: 10, width: 52, backgroundColor: 'rgba(0,229,255,0.25)', borderRadius: 2 },
  spark: { height: 18, width: '100%', backgroundColor: 'rgba(0,229,255,0.12)', borderRadius: 2 },
});
