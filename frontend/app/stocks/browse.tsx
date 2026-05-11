/**
 * Stock Browser — searchable list of ALL US stocks (Finnhub catalog ~30K tickers).
 * Tap to toggle inclusion in your watchlist (highlighted = tracked on main screen).
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, Pressable, TextInput, ActivityIndicator,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useRouter } from 'expo-router';
import { theme, API } from '../../constants/theme';

type Item = { symbol: string; name: string; type: string; currency: string };
const USER_ID = 'local-user';

export default function StocksBrowse() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [tracked, setTracked] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState(0);

  const load = useCallback(async (q: string) => {
    setSearching(true);
    try {
      const r = await fetch(`${API}/stocks/catalog?search=${encodeURIComponent(q)}&limit=150`);
      const j = await r.json();
      setItems(j.items || []);
      setTotal(j.total || 0);
    } catch (e) { console.warn('catalog', e); }
    finally { setSearching(false); setLoading(false); }
  }, []);

  // Initial — load empty (top stocks) and current watchlist
  useEffect(() => {
    (async () => {
      const [w] = await Promise.all([
        fetch(`${API}/watchlist/${USER_ID}`).then(r => r.json()).catch(() => ({})),
      ]);
      setTracked(w.symbols || []);
      load('');
    })();
  }, [load]);

  // Debounced search — separate effect so the user doesn't get kicked back when typing.
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => load(query), query ? 350 : 0);
      return () => clearTimeout(t);
    }
  }, [query]);

  const persist = async (next: string[]) => {
    await fetch(`${API}/watchlist`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: USER_ID, symbols: next }),
    });
  };

  const toggle = async (sym: string) => {
    const has = tracked.includes(sym);
    const next = has ? tracked.filter(s => s !== sym) : [...tracked, sym];
    setTracked(next);
    await persist(next);
  };

  const clearAll = async () => {
    Alert.alert('Clear watchlist?', 'Remove all tracked stocks.', [
      { text: 'Cancel' },
      { text: 'Clear', style: 'destructive', onPress: async () => {
        setTracked([]); await persist([]);
      }},
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} testID="browse-back" style={styles.iconBtn}>
            <Icon name="chevron-back" size={22} color={theme.colors.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>BROWSE STOCKS</Text>
            <Text style={styles.subtitle}>{total.toLocaleString()} US TICKERS · {tracked.length} TRACKED</Text>
          </View>
          <Pressable onPress={clearAll} testID="browse-clear" style={styles.iconBtn}>
            <Icon name="trash-outline" size={18} color={theme.colors.textTertiary} />
          </Pressable>
        </View>

        <View style={styles.searchBar}>
          <Icon name="search" size={16} color={theme.colors.textTertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by ticker or company (e.g. apple, NVDA, oil)"
            placeholderTextColor={theme.colors.textTertiary}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            testID="browse-search"
          />
          {searching && <ActivityIndicator size="small" color={theme.colors.neon} />}
        </View>

        {loading ? (
          <ActivityIndicator color={theme.colors.neon} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={items}
            keyExtractor={(it) => it.symbol}
            initialNumToRender={20}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <Text style={styles.empty}>No matches. Try a different search.</Text>
            }
            renderItem={({ item }) => {
              const sel = tracked.includes(item.symbol);
              return (
                <Pressable
                  onPress={() => toggle(item.symbol)}
                  style={[styles.row, sel && styles.rowSel]}
                  testID={`row-${item.symbol}`}
                >
                  <View style={[styles.tickBox, sel && styles.tickBoxSel]}>
                    {sel
                      ? <Icon name="checkmark" size={16} color={theme.colors.bg} />
                      : <Icon name="add" size={16} color={theme.colors.textTertiary} />
                    }
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.sym, sel && { color: theme.colors.neon }]}>{item.symbol}</Text>
                    <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                  </View>
                  <Text style={styles.cur}>{item.currency}</Text>
                </Pressable>
              );
            }}
          />
        )}

        <View style={styles.footer}>
          <Pressable
            onPress={() => router.back()}
            style={styles.doneBtn}
            testID="browse-done"
          >
            <Text style={styles.doneText}>
              DONE · {tracked.length} TRACKED
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: { padding: 4 },
  headerCenter: { alignItems: 'center' },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 14, letterSpacing: 2 },
  subtitle: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, paddingHorizontal: 12, paddingVertical: 10,
    margin: 12,
  },
  searchInput: {
    flex: 1, color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 14,
  },
  empty: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, textAlign: 'center', marginTop: 32, fontSize: 13 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: theme.colors.borderSubtle,
  },
  rowSel: { backgroundColor: 'rgba(212,255,0,0.04)' },
  tickBox: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, borderColor: theme.colors.border,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  tickBoxSel: { backgroundColor: theme.colors.neon, borderColor: theme.colors.neon },
  sym: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14, letterSpacing: 1 },
  name: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 1 },
  cur: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1 },
  footer: { padding: 12, borderTopWidth: 1, borderTopColor: theme.colors.border },
  doneBtn: {
    backgroundColor: theme.colors.neon, paddingVertical: 14,
    borderRadius: theme.radius.md, alignItems: 'center',
  },
  doneText: { color: theme.colors.bg, fontFamily: theme.fonts.bodyBold, fontSize: 13, letterSpacing: 2 },
});
