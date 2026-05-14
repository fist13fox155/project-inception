/**
 * Browse Full Market — Project-Inception themed market explorer.
 *
 * Three discovery modes:
 *   1. GAINERS — today's biggest movers up
 *   2. LOSERS  — today's biggest movers down
 *   3. SEARCH  — type a symbol or company name to track it
 *
 * Each row shows symbol, price, % change, sparkline; tapping opens the stock
 * detail; the right-side pill lets the user TRACK / UNTRACK without leaving
 * the screen.  All UI uses the cyan Project Inception accent palette.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Icon from '../../components/Icon';
import EtherealOrbBackground from '../../components/EtherealOrbBackground';
import { theme, API } from '../../constants/theme';

type Mover = { symbol: string; price: number; change_pct: number; change: number };
type SearchHit = { symbol: string; description?: string; type?: string };

const USER_ID = 'local-user';
type Tab = 'gainers' | 'losers' | 'search';

export default function BrowseMarket() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('gainers');
  const [gainers, setGainers] = useState<Mover[]>([]);
  const [losers, setLosers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tracked, setTracked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  const loadAll = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([
        fetch(`${API}/stocks/top-movers?limit=20`).then(r => r.json()),
        fetch(`${API}/watchlist/${USER_ID}`).then(r => r.json()),
      ]);
      setGainers(m.gainers || []);
      setLosers(m.losers || []);
      setTracked(new Set(w.symbols || []));
    } catch { /* offline */ }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Debounced search
  useEffect(() => {
    if (tab !== 'search') return;
    const q = query.trim();
    if (q.length < 1) { setSearchHits([]); return; }
    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`${API}/stocks/catalog?search=${encodeURIComponent(q)}&limit=40`);
        const j = await r.json();
        setSearchHits(j.items || []);
      } catch {
        setSearchHits([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => clearTimeout(handle);
  }, [query, tab]);

  const toggleTrack = async (sym: string) => {
    const next = new Set(tracked);
    if (next.has(sym)) next.delete(sym);
    else next.add(sym);
    setTracked(next); // optimistic
    try {
      await fetch(`${API}/watchlist`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: USER_ID, symbols: [...next] }),
      });
    } catch {
      // revert on failure
      setTracked(new Set(tracked));
    }
  };

  const onRefresh = () => { setRefreshing(true); loadAll(); };

  const moverRows = useMemo(() => {
    if (tab === 'gainers') return gainers;
    if (tab === 'losers') return losers;
    return [];
  }, [tab, gainers, losers]);

  const renderRow = (m: Mover, kind: 'gainer' | 'loser') => {
    const accent = kind === 'gainer' ? theme.colors.green : theme.colors.danger;
    const isTracked = tracked.has(m.symbol);
    return (
      <Pressable
        key={m.symbol}
        onPress={() => router.push(`/stock/${m.symbol}` as any)}
        style={styles.row}
        testID={`row-${m.symbol}`}
      >
        <View style={[styles.rank, { borderColor: accent }]}>
          <Text style={[styles.rankText, { color: accent }]}>{kind === 'gainer' ? '▲' : '▼'}</Text>
        </View>
        <View style={styles.symCol}>
          <Text style={styles.symText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{m.symbol}</Text>
          <Text style={styles.priceText}>${m.price.toFixed(2)}</Text>
        </View>
        <View style={styles.pctCol}>
          <Text style={[styles.pctText, { color: accent }]}>
            {kind === 'gainer' ? '+' : ''}{m.change_pct.toFixed(2)}%
          </Text>
          <Text style={[styles.deltaText, { color: accent }]}>
            {kind === 'gainer' ? '+' : ''}${m.change.toFixed(2)}
          </Text>
        </View>
        <Pressable
          onPress={() => toggleTrack(m.symbol)}
          style={[
            styles.trackChip,
            { borderColor: isTracked ? theme.colors.danger : theme.colors.blue,
              backgroundColor: isTracked ? 'rgba(255,51,51,0.1)' : 'rgba(0,229,255,0.1)' },
          ]}
          testID={`track-chip-${m.symbol}`}
        >
          <Icon
            name={isTracked ? 'checkmark-circle' : 'add-circle-outline'}
            size={14}
            color={isTracked ? theme.colors.danger : theme.colors.blue}
          />
          <Text style={[styles.trackChipText, { color: isTracked ? theme.colors.danger : theme.colors.blue }]}>
            {isTracked ? 'TRACKED' : 'TRACK'}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <EtherealOrbBackground />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} testID="back">
            <Icon name="chevron-back" size={22} color={theme.colors.blue} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>BROWSE MARKET</Text>
            <Text style={styles.subtitle}>{tracked.size} TRACKED</Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={styles.headerDot} />
            <Text style={styles.headerBadgeText}>LIVE</Text>
          </View>
        </View>

        {/* Tab switcher */}
        <View style={styles.tabBar}>
          {([
            { id: 'gainers', label: 'GAINERS', icon: 'add-circle-outline', color: theme.colors.green },
            { id: 'losers',  label: 'LOSERS',  icon: 'alert-circle',        color: theme.colors.danger },
            { id: 'search',  label: 'SEARCH',  icon: 'search',              color: theme.colors.blue },
          ] as { id: Tab; label: string; icon: any; color: string }[]).map((t) => (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={[
                styles.tab,
                tab === t.id && { borderColor: t.color, backgroundColor: 'rgba(0,229,255,0.06)' },
              ]}
              testID={`tab-${t.id}`}
            >
              <Icon name={t.icon} size={14} color={tab === t.id ? t.color : theme.colors.textTertiary} />
              <Text style={[styles.tabText, { color: tab === t.id ? t.color : theme.colors.textTertiary }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Search bar (only when search tab) */}
        {tab === 'search' && (
          <View style={styles.searchBar} testID="search-bar">
            <Icon name="search" size={16} color={theme.colors.blue} />
            <TextInput
              style={styles.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Search by ticker or company…"
              placeholderTextColor={theme.colors.textTertiary}
              autoCapitalize="characters"
              autoCorrect={false}
              testID="search-input"
            />
            {!!query && (
              <Pressable onPress={() => setQuery('')} testID="clear-search">
                <Icon name="close" size={16} color={theme.colors.textTertiary} />
              </Pressable>
            )}
          </View>
        )}

        {/* List */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={theme.colors.blue} />
            <Text style={styles.loaderText}>SYNCING MARKET DATA…</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.list}
            keyboardShouldPersistTaps="handled"
            refreshControl={
              <RefreshControl tintColor={theme.colors.blue} refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {tab === 'search' ? (
              searching ? (
                <View style={styles.loaderBox}><ActivityIndicator color={theme.colors.blue} /></View>
              ) : query.length < 1 ? (
                <View style={styles.emptyBox}>
                  <Icon name="search" size={28} color={theme.colors.blue} />
                  <Text style={styles.emptyText}>Type a ticker or company to begin</Text>
                </View>
              ) : !searchHits.length ? (
                <View style={styles.emptyBox}>
                  <Icon name="alert-circle" size={28} color={theme.colors.amber} />
                  <Text style={styles.emptyText}>No matches for "{query}"</Text>
                </View>
              ) : (
                searchHits.map((h) => {
                  const isTracked = tracked.has(h.symbol);
                  return (
                    <Pressable
                      key={h.symbol}
                      onPress={() => router.push(`/stock/${h.symbol}` as any)}
                      style={styles.row}
                      testID={`hit-${h.symbol}`}
                    >
                      <View style={[styles.rank, { borderColor: theme.colors.blue }]}>
                        <Text style={[styles.rankText, { color: theme.colors.blue }]}>·</Text>
                      </View>
                      <View style={styles.symCol}>
                        <Text style={styles.symText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{h.symbol}</Text>
                        <Text style={styles.priceText} numberOfLines={1}>{h.description || h.type || 'Equity'}</Text>
                      </View>
                      <Pressable
                        onPress={() => toggleTrack(h.symbol)}
                        style={[
                          styles.trackChip,
                          { borderColor: isTracked ? theme.colors.danger : theme.colors.blue,
                            backgroundColor: isTracked ? 'rgba(255,51,51,0.1)' : 'rgba(0,229,255,0.1)' },
                        ]}
                      >
                        <Icon
                          name={isTracked ? 'checkmark-circle' : 'add-circle-outline'}
                          size={14}
                          color={isTracked ? theme.colors.danger : theme.colors.blue}
                        />
                        <Text style={[styles.trackChipText, { color: isTracked ? theme.colors.danger : theme.colors.blue }]}>
                          {isTracked ? 'TRACKED' : 'TRACK'}
                        </Text>
                      </Pressable>
                    </Pressable>
                  );
                })
              )
            ) : (
              moverRows.length
                ? moverRows.map((m) => renderRow(m, tab === 'gainers' ? 'gainer' : 'loser'))
                : <View style={styles.emptyBox}>
                    <Icon name="alert-circle" size={24} color={theme.colors.amber} />
                    <Text style={styles.emptyText}>Market data unavailable. Pull to refresh.</Text>
                  </View>
            )}
            <View style={{ height: 32 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000814' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(0,229,255,0.15)',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)',
  },
  title: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
  },
  subtitle: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 9,
    letterSpacing: 2,
    marginTop: 2,
  },
  headerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.35)',
  },
  headerDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.blue },
  headerBadgeText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },

  tabBar: { flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,8,20,0.6)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.15)',
  },
  tabText: { fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 16, marginTop: 4, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,8,20,0.7)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.35)',
  },
  searchInput: {
    flex: 1, color: theme.colors.text,
    fontFamily: theme.fonts.bodyBold, fontSize: 14,
    letterSpacing: 1,
  },

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: 'rgba(0,8,20,0.6)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.2)',
    borderRadius: theme.radius.md,
    paddingVertical: 10, paddingHorizontal: 10,
  },
  rank: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  rankText: { fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  symCol: { flex: 1, marginRight: 4 },
  symText: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 14, letterSpacing: 1.2 },
  priceText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 11, marginTop: 2 },
  pctCol: { alignItems: 'flex-end', marginRight: 6 },
  pctText: { fontFamily: theme.fonts.bodyBold, fontSize: 14 },
  deltaText: { fontFamily: theme.fonts.body, fontSize: 10, marginTop: 2 },
  trackChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: theme.radius.full,
    borderWidth: 1,
  },
  trackChipText: { fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.2 },

  loaderBox: { paddingVertical: 30, alignItems: 'center', gap: 10 },
  loaderText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 2 },
  emptyBox: { paddingVertical: 30, alignItems: 'center', gap: 12 },
  emptyText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 13, textAlign: 'center', maxWidth: 280 },
});
