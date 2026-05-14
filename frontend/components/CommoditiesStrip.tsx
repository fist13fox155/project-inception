/**
 * CommoditiesStrip — Swipeable carousel of real-time energy commodities
 * (oil, gas, coal, propane, gasoline, diesel, uranium, etc.) styled to match
 * the Today's Movers carousel.  Auto-refreshes every 20s, no manual reload.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ActivityIndicator,
  FlatList, Dimensions, NativeSyntheticEvent, NativeScrollEvent,
} from 'react-native';
import Icon from './Icon';
import { theme, API } from '../constants/theme';

type Commodity = {
  key: string;
  label: string;
  unit: string;
  symbol: string;
  price: number;
  change_pct: number;
  notes: string;
};

const { width: SCREEN_W } = Dimensions.get('window');
const CARD_W = SCREEN_W - 32;
const CARD_GAP = 10;

export default function CommoditiesStrip() {
  const [items, setItems] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const listRef = useRef<FlatList<Commodity>>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/stocks/commodities`);
        const j = await r.json();
        if (!alive) return;
        setItems(j.commodities || []);
        setLastUpdated(new Date());
      } catch { /* offline */ }
      finally { if (alive) setLoading(false); }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / (CARD_W + CARD_GAP));
    setActiveIdx(Math.max(0, Math.min(items.length - 1, idx)));
  };

  const updatedLabel = useMemo(() => {
    if (!lastUpdated) return '';
    const h = lastUpdated.getHours().toString().padStart(2, '0');
    const m = lastUpdated.getMinutes().toString().padStart(2, '0');
    const s = lastUpdated.getSeconds().toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }, [lastUpdated]);

  if (loading) {
    return (
      <View style={styles.placeholder} testID="commodities-loading">
        <ActivityIndicator color={theme.colors.blue} size="small" />
      </View>
    );
  }
  if (!items.length) return null;

  const renderCard = ({ item }: { item: Commodity }) => {
    const up = item.change_pct >= 0;
    const accent = up ? theme.colors.green : theme.colors.danger;
    return (
      <View
        style={[
          styles.card,
          { width: CARD_W, borderColor: accent, shadowColor: accent },
        ]}
        testID={`commodity-${item.key}`}
      >
        <View style={styles.cardLeft}>
          <Text style={styles.kind}>⛽ ENERGY · {item.symbol}</Text>
          <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {item.label}
          </Text>
          <Text style={styles.price}>${item.price.toFixed(2)} <Text style={styles.unit}>/ {item.unit}</Text></Text>
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.pct, { color: accent }]}>
            {up ? '+' : ''}{item.change_pct.toFixed(2)}%
          </Text>
          <Text style={[styles.dir, { color: accent }]}>
            {up ? '▲ RISING' : '▼ FALLING'}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.wrap} testID="commodities-strip">
      <View style={styles.header}>
        <Icon name="flame" size={12} color={theme.colors.blue} />
        <Text style={styles.headerText}>ENERGY · COMMODITIES · SWIPE</Text>
        <Text style={styles.countText}>{activeIdx + 1} / {items.length}</Text>
      </View>

      <FlatList
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        data={items}
        keyExtractor={(it) => it.key}
        renderItem={renderCard}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        contentContainerStyle={{ paddingRight: 16 }}
        ItemSeparatorComponent={() => <View style={{ width: CARD_GAP }} />}
      />

      <View style={styles.footer}>
        <View style={styles.dots}>
          {items.map((_, i) => (
            <View key={i} style={[styles.dot, i === activeIdx && styles.dotActive]} />
          ))}
        </View>
        {!!updatedLabel && (
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE · {updatedLabel}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, marginHorizontal: -16, paddingLeft: 16 },
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
  kind: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 2, marginBottom: 4 },
  label: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 1.5 },
  price: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 13, marginTop: 4 },
  unit: { color: theme.colors.textTertiary, fontSize: 11 },
  cardRight: { alignItems: 'flex-end' },
  pct: { fontFamily: theme.fonts.heading, fontSize: 20, letterSpacing: 1 },
  dir: { fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, marginTop: 2 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingRight: 16,
  },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(0,229,255,0.25)' },
  dotActive: { backgroundColor: theme.colors.blue, width: 16 },
  live: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,255,102,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,255,102,0.4)',
  },
  liveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.green },
  liveText: { color: theme.colors.green, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.2 },
});
