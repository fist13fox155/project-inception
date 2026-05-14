/**
 * TopMoversCarousel — swipeable horizontal scroll of today's top gainers + losers.
 * User can flick left/right or scroll; pagination dots reflect the active card.
 * Tap a card to TRACK that stock.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import Icon from './Icon';
import { theme, API } from '../constants/theme';

type Mover = { symbol: string; price: number; change_pct: number; change: number };
type Card = Mover & { kind: 'gainer' | 'loser' };

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_GAP = 10;

export default function TopMoversCarousel({ onPickSymbol }: { onPickSymbol?: (s: string) => void }) {
  const router = useRouter();
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<FlatList<Card>>(null);

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

  const combined: Card[] = useMemo(() => [
    ...gainers.map(g => ({ ...g, kind: 'gainer' as const })),
    ...losers.map(l => ({ ...l, kind: 'loser' as const })),
  ], [gainers, losers]);

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator color={theme.colors.blue} />
      </View>
    );
  }
  if (!combined.length) return null;

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (CARD_W + CARD_GAP));
    setActiveIdx(Math.max(0, Math.min(combined.length - 1, idx)));
  };

  const track = async (sym: string) => {
    if (onPickSymbol) {
      onPickSymbol(sym);
    } else {
      router.push(`/stock/${sym}` as any);
    }
  };

  const renderCard = ({ item }: { item: Card }) => {
    const isGain = item.kind === 'gainer';
    const accent = isGain ? theme.colors.green : theme.colors.danger;
    return (
      <Pressable
        onPress={() => router.push(`/stock/${item.symbol}` as any)}
        style={[
          styles.card,
          { width: CARD_W, borderColor: accent, shadowColor: accent },
        ]}
        testID={`mover-${item.symbol}`}
      >
        <View style={styles.cardLeft}>
          <Text style={[styles.kind, { color: accent }]}>
            {isGain ? '▲ TOP GAINER' : '▼ TOP LOSER'}
          </Text>
          <Text style={styles.symbol} numberOfLines={1} adjustsFontSizeToFit>
            {item.symbol}
          </Text>
          <Text style={styles.price}>${item.price.toFixed(2)}</Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.pct, { color: accent }]}>
            {isGain ? '+' : ''}{item.change_pct.toFixed(2)}%
          </Text>
          <Text style={[styles.delta, { color: accent }]}>
            {isGain ? '+' : ''}${item.change.toFixed(2)}
          </Text>
          <Pressable
            onPress={(e) => { e.stopPropagation(); track(item.symbol); }}
            style={styles.cta}
            testID={`track-${item.symbol}`}
          >
            <Icon name="add-circle-outline" size={14} color={theme.colors.blue} />
            <Text style={styles.ctaText}>TRACK</Text>
          </Pressable>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.wrap} testID="top-movers-carousel">
      <View style={styles.header}>
        <Icon name="sparkles" size={12} color={theme.colors.blue} />
        <Text style={styles.headerText}>TODAY'S MOVERS · SWIPE TO BROWSE</Text>
        <Text style={styles.countText}>{activeIdx + 1} / {combined.length}</Text>
      </View>

      <FlatList
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={combined}
        keyExtractor={(it) => it.symbol}
        renderItem={renderCard}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingRight: 16 }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      />

      <View style={styles.dots}>
        {combined.map((_, i) => (
          <View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 12, marginHorizontal: -16, paddingLeft: 16 },
  placeholder: { height: 130, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingRight: 16, marginBottom: 8,
  },
  headerText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.8,
    flex: 1,
  },
  countText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,8,20,0.78)',
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
  symbol: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 24, letterSpacing: 2 },
  price: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 13, marginTop: 2 },
  cardRight: { alignItems: 'flex-end' },
  pct: { fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 1 },
  delta: { fontFamily: theme.fonts.bodyBold, fontSize: 11, marginTop: 2 },
  cta: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderWidth: 1, borderColor: theme.colors.blue,
  },
  ctaText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
    paddingRight: 16,
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,229,255,0.25)' },
  dotActive: { backgroundColor: theme.colors.blue, width: 16 },
});
