/**
 * Stock Tracker - watchlist list with sparklines + AI rec snapshot.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, RefreshControl,
  ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, API } from '../constants/theme';
import Sparkline from '../components/Sparkline';
import { Quote } from '../components/StockTickerCard';

const STORAGE_USER = 'local-user';
const DEFAULT = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL'];

export default function StocksScreen() {
  const router = useRouter();
  const [symbols, setSymbols] = useState<string[]>(DEFAULT);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addSym, setAddSym] = useState('');

  const load = useCallback(async (syms: string[]) => {
    try {
      const r = await fetch(`${API}/stocks/quotes?symbols=${syms.join(',')}`);
      const j = await r.json();
      setQuotes(j.quotes || []);
      // Drop invalid tickers from watchlist automatically
      if (j.invalid && j.invalid.length) {
        const valid = syms.filter(s => !j.invalid.includes(s));
        if (valid.length !== syms.length) {
          setSymbols(valid);
          await saveWatchlist(valid);
          Alert.alert('Invalid tickers removed', `${j.invalid.join(', ')} not recognized.`);
        }
      }
    } catch (e) { console.warn('quotes', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API}/watchlist/${STORAGE_USER}`);
        const j = await r.json();
        const syms = j.symbols && j.symbols.length ? j.symbols : DEFAULT;
        setSymbols(syms);
        load(syms);
      } catch { setSymbols(DEFAULT); load(DEFAULT); }
    })();
  }, [load]);

  const saveWatchlist = async (syms: string[]) => {
    await fetch(`${API}/watchlist`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: STORAGE_USER, symbols: syms }),
    });
  };

  const add = async () => {
    const s = addSym.trim().toUpperCase();
    if (!s || symbols.includes(s)) { setAddSym(''); return; }
    // Validate ticker first
    try {
      const v = await fetch(`${API}/stocks/validate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: s }),
      });
      const j = await v.json();
      if (!j.valid) { Alert.alert('Invalid ticker', `${s}: ${j.reason}`); return; }
    } catch {}
    const next = [...symbols, s];
    setSymbols(next); setAddSym('');
    await saveWatchlist(next); load(next);
  };

  const remove = async (s: string) => {
    const next = symbols.filter(x => x !== s);
    setSymbols(next); setQuotes(quotes.filter(q => q.symbol !== s));
    await saveWatchlist(next);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="stocks-back" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>STOCK TRACKER</Text>
        <Pressable onPress={() => router.push('/stocks/browse' as any)} testID="stocks-browse-btn" style={styles.iconBtn}>
          <Ionicons name="search" size={20} color={theme.colors.neon} />
        </Pressable>
      </View>

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          value={addSym}
          onChangeText={setAddSym}
          placeholder="Add ticker (e.g. AMZN)"
          placeholderTextColor={theme.colors.textTertiary}
          autoCapitalize="characters"
          maxLength={6}
          testID="add-symbol-input"
        />
        <Pressable onPress={add} style={styles.addBtn} testID="add-symbol-btn">
          <Ionicons name="add" size={20} color={theme.colors.bg} />
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        refreshControl={
          <RefreshControl tintColor={theme.colors.blue} refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(symbols); }} />
        }
      >
        {loading ? (
          <ActivityIndicator color={theme.colors.blue} style={{ marginTop: 24 }} />
        ) : (
          quotes.map((q) => {
            const up = q.change_pct >= 0;
            return (
              <Pressable
                key={q.symbol}
                style={styles.row}
                onPress={() => router.push(`/stock/${q.symbol}` as any)}
                testID={`watch-row-${q.symbol}`}
              >
                <View style={{ flex: 1 }}>
                  <View style={styles.rowTop}>
                    <Text style={styles.sym}>{q.symbol}</Text>
                    {!q.is_live && (
                      <View style={styles.simChip}><Text style={styles.simText}>SIM</Text></View>
                    )}
                  </View>
                  <Text style={styles.price}>${q.price.toFixed(2)}</Text>
                </View>
                <View style={{ width: 110, alignItems: 'center' }}>
                  <Sparkline data={q.sparkline} width={100} height={36}
                    color={up ? theme.colors.green : theme.colors.danger} />
                </View>
                <View style={{ alignItems: 'flex-end', width: 80 }}>
                  <Text style={[styles.chg, { color: up ? theme.colors.green : theme.colors.danger }]}>
                    {up ? '+' : ''}{q.change_pct.toFixed(2)}%
                  </Text>
                  <Pressable onPress={() => Alert.alert('Remove', `Remove ${q.symbol}?`, [
                    { text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => remove(q.symbol) }
                  ])} style={styles.delBtn} testID={`del-${q.symbol}`}>
                    <Ionicons name="close" size={14} color={theme.colors.textTertiary} />
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: { padding: 4 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16, letterSpacing: 3 },
  addRow: { flexDirection: 'row', padding: 12, gap: 8, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  addInput: {
    flex: 1, height: 44, paddingHorizontal: 14,
    color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14, letterSpacing: 1,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md,
  },
  addBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, paddingHorizontal: 14, paddingVertical: 12,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sym: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 16, letterSpacing: 1.5 },
  price: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 2 },
  chg: { fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  delBtn: { marginTop: 4, padding: 4 },
  simChip: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: theme.colors.border,
  },
  simText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 8, letterSpacing: 1 },
});
