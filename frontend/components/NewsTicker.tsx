/**
 * NewsTicker — Wall-Street-style scrolling banner.
 * Edge-to-edge, slow continuous left-scroll, mixing stock changes and crisis
 * headlines.  Tap a stock segment to jump straight to that stock; tap a news
 * segment to jump to /world.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { theme, API } from '../constants/theme';

type Quote = { symbol: string; change_pct: number; price: number };
type CrisisItem = { title: string; category: string };

const { width: SCREEN_W } = Dimensions.get('window');
// Pixels per second — true Wall Street is slow & readable.
const SCROLL_SPEED = 38;

export default function NewsTicker({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [news, setNews] = useState<CrisisItem[]>([]);
  const x = useRef(new Animated.Value(0)).current;
  const [contentW, setContentW] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/world/crisis?limit=12`);
        const j = await r.json();
        if (alive) setNews((j.items || []).slice(0, 12));
      } catch { /* offline-friendly */ }
    };
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Build items: alternate stock blocks and news blocks
  const items = useMemo(() => {
    const stockBlocks = quotes.map((q) => ({
      type: 'stock' as const,
      key: `s-${q.symbol}`,
      symbol: q.symbol,
      text: `${q.symbol}  $${q.price.toFixed(2)}`,
      pct: q.change_pct,
    }));
    const newsBlocks = news.map((n, i) => ({
      type: 'news' as const,
      key: `n-${i}`,
      symbol: '',
      text: `${n.category}: ${n.title}`,
      pct: 0,
    }));
    const out: typeof stockBlocks = [];
    const max = Math.max(stockBlocks.length, newsBlocks.length);
    for (let i = 0; i < max; i++) {
      if (stockBlocks[i]) out.push(stockBlocks[i]);
      if (newsBlocks[i]) out.push(newsBlocks[i] as any);
    }
    return out;
  }, [quotes, news]);

  // Duplicate once so the loop is seamless
  const looped = useMemo(() => [...items, ...items], [items]);

  useEffect(() => {
    if (!contentW) return;
    x.setValue(0);
    const half = contentW / 2;
    Animated.loop(
      Animated.timing(x, {
        toValue: -half,
        duration: (half / SCROLL_SPEED) * 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [contentW, x]);

  if (!items.length) return null;

  return (
    <View style={styles.bar} testID="news-ticker">
      {/* Subtle red LIVE chip pinned to the left */}
      <View style={styles.live} pointerEvents="none">
        <View style={styles.liveDot} />
        <Text style={styles.liveText}>LIVE</Text>
      </View>

      <View style={styles.viewport}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: x }] }]}
          onLayout={(e) => setContentW(e.nativeEvent.layout.width)}
        >
          {looped.map((it, i) => {
            const up = it.pct >= 0;
            const onPress = () => {
              if (it.type === 'stock') router.push(`/stock/${it.symbol}` as any);
              else router.push('/world');
            };
            return (
              <Pressable key={`${it.key}-${i}`} onPress={onPress} style={styles.item}>
                {it.type === 'stock' ? (
                  <>
                    <Text style={styles.itemText}>{it.text}</Text>
                    <Text style={[styles.itemPct, { color: up ? theme.colors.green : theme.colors.danger }]}>
                      {' '}{up ? '▲' : '▼'} {Math.abs(it.pct).toFixed(2)}%
                    </Text>
                  </>
                ) : (
                  <Text style={styles.itemNews} numberOfLines={1}>
                    ◉ {it.text}
                  </Text>
                )}
                <Text style={styles.sep}>   ·   </Text>
              </Pressable>
            );
          })}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'relative',
    width: '100%',
    backgroundColor: 'rgba(0,15,30,0.92)',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: 'rgba(0,229,255,0.5)',
    borderBottomColor: 'rgba(0,229,255,0.5)',
    height: 30,
    marginTop: 4,
    marginBottom: 4,
    overflow: 'hidden',
    // Span the full width by negating parent's horizontal padding (16)
    marginHorizontal: -16,
    paddingLeft: 60,
  },
  live: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    paddingHorizontal: 10,
    backgroundColor: '#FF3333',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    zIndex: 2,
    borderRightWidth: 1,
    borderRightColor: '#000814',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  liveText: {
    color: '#fff',
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  viewport: { flex: 1, overflow: 'hidden', justifyContent: 'center' },
  track: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center' },
  itemText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
    letterSpacing: 0.5,
  },
  itemPct: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 12,
  },
  itemNews: {
    color: '#FFE066',
    fontFamily: theme.fonts.body,
    fontSize: 12,
  },
  sep: { color: theme.colors.textTertiary, fontSize: 12 },
});
