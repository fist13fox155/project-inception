/**
 * NewsTicker — horizontally auto-scrolling banner mixing stock changes
 * and breaking news headlines. Tap to open WORLD INTEL.
 */
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import { useRouter } from 'expo-router';
import Icon from './Icon';
import { theme, API } from '../constants/theme';

type Quote = { symbol: string; change_pct: number; price: number };
type CrisisItem = { title: string; category: string };

export default function NewsTicker({ quotes }: { quotes: Quote[] }) {
  const router = useRouter();
  const [news, setNews] = useState<string[]>([]);
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  const [contentW, setContentW] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/world/crisis?limit=8`);
        const j = await r.json();
        const items = (j.items || []) as CrisisItem[];
        setNews(items.map(i => `${i.category}: ${i.title}`).slice(0, 8));
      } catch { /* offline-friendly */ }
    })();
  }, []);

  useEffect(() => {
    if (!contentW || !width || contentW <= width) return;
    x.setValue(0);
    Animated.loop(
      Animated.timing(x, {
        toValue: -contentW,
        duration: contentW * 35, // ~35ms per px
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [contentW, width, x]);

  // Build items: alternate stock blocks and news blocks
  const stockBlocks = quotes.map((q) => ({
    type: 'stock' as const,
    text: `${q.symbol}  $${q.price.toFixed(2)}`,
    pct: q.change_pct,
  }));
  const newsBlocks = news.map((n) => ({ type: 'news' as const, text: n, pct: 0 }));
  const interleaved: typeof stockBlocks = [];
  const maxLen = Math.max(stockBlocks.length, newsBlocks.length);
  for (let i = 0; i < maxLen; i++) {
    if (stockBlocks[i]) interleaved.push(stockBlocks[i]);
    if (newsBlocks[i]) interleaved.push(newsBlocks[i] as any);
  }
  // Duplicate for seamless loop
  const looped = [...interleaved, ...interleaved];

  if (!interleaved.length) return null;

  return (
    <Pressable
      onPress={() => router.push('/world')}
      style={styles.bar}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      testID="news-ticker"
    >
      <View style={styles.label}>
        <Icon name="radio" size={11} color={theme.colors.blue} />
        <Text style={styles.labelText}>LIVE</Text>
      </View>
      <View style={styles.viewport}>
        <Animated.View
          style={[styles.track, { transform: [{ translateX: x }] }]}
          onLayout={(e) => setContentW(e.nativeEvent.layout.width / 2)}
        >
          {looped.map((it, i) => {
            const up = it.pct >= 0;
            return (
              <View key={i} style={styles.item}>
                {it.type === 'stock' ? (
                  <>
                    <Text style={styles.itemText}>{it.text}</Text>
                    <Text style={[styles.itemPct, { color: up ? theme.colors.green : theme.colors.danger }]}>
                      {up ? '▲' : '▼'} {Math.abs(it.pct).toFixed(2)}%
                    </Text>
                  </>
                ) : (
                  <Text style={styles.itemNews} numberOfLines={1}>
                    ◉ {it.text}
                  </Text>
                )}
                <Text style={styles.sep}>·</Text>
              </View>
            );
          })}
        </Animated.View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: theme.radius.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    marginTop: 6,
    marginBottom: 4,
    overflow: 'hidden',
  },
  label: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(0,229,255,0.1)',
    marginRight: 8,
  },
  labelText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.5,
  },
  viewport: { flex: 1, overflow: 'hidden' },
  track: { flexDirection: 'row', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 14 },
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
    color: theme.colors.blue,
    fontFamily: theme.fonts.body,
    fontSize: 12,
    maxWidth: 360,
  },
  sep: { color: theme.colors.textTertiary, marginLeft: 8 },
});
