import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { theme } from '../constants/theme';
import Sparkline from './Sparkline';

export type Quote = {
  symbol: string;
  price: number;
  change: number;
  change_pct: number;
  sparkline: number[];
  is_live?: boolean;
};

export default function StockTickerCard({
  quote,
  onPress,
  compact = false,
}: {
  quote: Quote;
  onPress?: () => void;
  compact?: boolean;
}) {
  const up = quote.change_pct >= 0;
  const color = up ? theme.colors.green : theme.colors.danger;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        { borderColor: up ? 'rgba(0,255,102,0.25)' : 'rgba(255,51,102,0.25)' },
        pressed && { transform: [{ scale: 0.97 }] },
      ]}
      testID={`stock-ticker-card-${quote.symbol}`}
    >
      <View style={styles.row}>
        <Text style={styles.symbol} numberOfLines={1}>{quote.symbol}</Text>
        <Text style={[styles.pct, { color }]}>
          {up ? '+' : ''}{quote.change_pct.toFixed(2)}%
        </Text>
      </View>
      {!compact && (
        <Text style={styles.price}>${quote.price.toFixed(2)}</Text>
      )}
      <View style={styles.spark}>
        <Sparkline data={quote.sparkline} width={compact ? 100 : 120} height={compact ? 26 : 32} color={color} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderRadius: theme.radius.md,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginHorizontal: 4,
    minHeight: 84,
  },
  cardCompact: { minHeight: 64, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  symbol: {
    color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  pct: { fontFamily: theme.fonts.bodyBold, fontSize: 12 },
  price: {
    color: theme.colors.textSecondary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    marginTop: 2,
  },
  spark: { marginTop: 4, alignItems: 'center' },
});
