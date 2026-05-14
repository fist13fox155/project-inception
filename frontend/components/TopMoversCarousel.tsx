/**
 * TopMoversCarousel — shown on the home screen when the user hasn't tracked
 * any stocks yet.  Auto-rotates every 4s through the day's biggest gainers
 * (green) and losers (red) on a fixed universe of large-caps.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, {
  useSharedValue, useAnimatedStyle, withTiming, Easing,
} from 'react-native-reanimated';
import Icon from './Icon';
import { theme, API } from '../constants/theme';

type Mover = { symbol: string; price: number; change_pct: number; change: number };

const ROTATE_MS = 4000;

export default function TopMoversCarousel({ onPickSymbol }: { onPickSymbol?: (s: string) => void }) {
  const router = useRouter();
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const fade = useSharedValue(1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(`${API}/stocks/top-movers?limit=6`);
        const j = await r.json();
        if (!alive) return;
        setGainers(j.gainers || []);
        setLosers(j.losers || []);
      } catch { /* offline */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  // Auto-rotate
  useEffect(() => {
    const total = (gainers.length + losers.length);
    if (total < 2) return;
    const id = setInterval(() => {
      fade.value = withTiming(0, { duration: 250, easing: Easing.out(Easing.ease) });
      setTimeout(() => {
        setIdx(i => (i + 1) % total);
        fade.value = withTiming(1, { duration: 350, easing: Easing.out(Easing.ease) });
      }, 260);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [gainers.length, losers.length, fade]);

  const animStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={theme.colors.blue} />
      </View>
    );
  }
  if (!gainers.length && !losers.length) return null;

  const combined = [
    ...gainers.map(g => ({ ...g, kind: 'gainer' as const })),
    ...losers.map(l => ({ ...l, kind: 'loser' as const })),
  ];
  const cur = combined[idx % combined.length];
  const isGain = cur.kind === 'gainer';

  return (
    <View style={styles.wrap} testID="top-movers-carousel">
      <View style={styles.header}>
        <Icon name="sparkles" size={12} color={theme.colors.blue} />
        <Text style={styles.headerText}>TODAY'S MOVERS · TAP TO TRACK</Text>
        <View style={styles.dots}>
          {combined.map((_, i) => (
            <View key={i} style={[styles.dot, i === idx && styles.dotActive]} />
          ))}
        </View>
      </View>

      <Animated.View style={animStyle}>
        <Pressable
          onPress={() => onPickSymbol ? onPickSymbol(cur.symbol) : router.push(`/stock/${cur.symbol}` as any)}
          style={[
            styles.card,
            { borderColor: isGain ? theme.colors.green : theme.colors.danger,
              shadowColor: isGain ? theme.colors.green : theme.colors.danger },
          ]}
          testID="mover-card"
        >
          <View style={styles.cardLeft}>
            <Text style={[styles.kind, { color: isGain ? theme.colors.green : theme.colors.danger }]}>
              {isGain ? '▲ TOP GAINER' : '▼ TOP LOSER'}
            </Text>
            <Text style={styles.symbol}>{cur.symbol}</Text>
            <Text style={styles.price}>${cur.price.toFixed(2)}</Text>
          </View>
          <View style={styles.cardRight}>
            <Text style={[styles.pct, { color: isGain ? theme.colors.green : theme.colors.danger }]}>
              {isGain ? '+' : ''}{cur.change_pct.toFixed(2)}%
            </Text>
            <Text style={[styles.delta, { color: isGain ? theme.colors.green : theme.colors.danger }]}>
              {isGain ? '+' : ''}${cur.change.toFixed(2)}
            </Text>
            <View style={styles.cta}>
              <Icon name="add-circle-outline" size={14} color={theme.colors.blue} />
              <Text style={styles.ctaText}>TRACK</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12 },
  placeholder: { height: 110, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
  },
  headerText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    flex: 1,
  },
  dots: { flexDirection: 'row', gap: 3 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,229,255,0.25)' },
  dotActive: { backgroundColor: theme.colors.blue, width: 14 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,8,20,0.7)',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16, paddingVertical: 14,
    gap: 14,
    shadowOpacity: 0.35,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 12,
    elevation: 6,
  },
  cardLeft: { flex: 1 },
  kind: { fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  symbol: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 22, letterSpacing: 2 },
  price: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 13, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  pct: { fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 1 },
  delta: { fontFamily: theme.fonts.bodyBold, fontSize: 11, marginTop: 2 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)',
  },
  ctaText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
});
