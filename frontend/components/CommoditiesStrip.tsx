/**
 * CommoditiesStrip — horizontal scrolling strip showing real-time oil, gas,
 * coal, propane, gasoline, diesel prices via Finnhub ETF proxies.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
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

export default function CommoditiesStrip() {
  const [items, setItems] = useState<Commodity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`${API}/stocks/commodities`);
        const j = await r.json();
        if (alive) setItems(j.commodities || []);
      } catch { /* offline */ }
      finally { if (alive) setLoading(false); }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (loading) {
    return (
      <View style={styles.placeholder} testID="commodities-loading">
        <ActivityIndicator color={theme.colors.blue} size="small" />
      </View>
    );
  }
  if (!items.length) return null;

  return (
    <View testID="commodities-strip">
      <Text style={styles.header}>⛽ ENERGY · COMMODITIES</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {items.map((c) => {
          const up = c.change_pct >= 0;
          return (
            <View key={c.key} style={styles.card}>
              <Text style={styles.label}>{c.label.toUpperCase()}</Text>
              <Text style={styles.price}>${c.price.toFixed(2)}</Text>
              <Text style={[styles.pct, { color: up ? theme.colors.green : theme.colors.danger }]}>
                {up ? '▲' : '▼'} {Math.abs(c.change_pct).toFixed(2)}%
              </Text>
              <Text style={styles.unit}>per {c.unit}</Text>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: { height: 50, alignItems: 'center', justifyContent: 'center' },
  header: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
  },
  scroll: { gap: 8, paddingRight: 8 },
  card: {
    backgroundColor: 'rgba(0,8,20,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
    borderRadius: theme.radius.md,
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 124,
  },
  label: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 1.2,
  },
  price: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 17,
    letterSpacing: 1,
    marginTop: 2,
  },
  pct: {
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    marginTop: 2,
  },
  unit: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.body,
    fontSize: 9,
    marginTop: 1,
  },
});
