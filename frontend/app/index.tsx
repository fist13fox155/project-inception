/**
 * Project Inception — Home Dashboard
 * - Login gate redirects to /login if no PIN session
 * - Ethereal cyan pulsing orb background
 * - 3x3 stock grid with auto-cleanup of invalid tickers
 * - Personalized greeting using Architect name
 * - Live news ticker (stocks + crisis headlines)
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { theme, API } from '../constants/theme';
import JarvisOrb from '../components/JarvisOrb';
import StockTickerCard, { Quote } from '../components/StockTickerCard';
import EtherealOrbBackground from '../components/EtherealOrbBackground';
import NewsTicker from '../components/NewsTicker';
import CommoditiesStrip from '../components/CommoditiesStrip';
import SkeletonStockGrid from '../components/SkeletonStockGrid';
import TopMoversCarousel from '../components/TopMoversCarousel';
import {
  isAuthenticated, getArchitectName, clearInceptionAuth, setSession, getVoice,
} from '../lib/prefs';

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'XOM', 'CVX', 'BP'];
const USER_ID = 'local-user';

const ACTIONS = [
  { key: 'document', label1: 'CREATE', label2: 'DOCUMENT', icon: 'document-text-outline' as const, color: theme.colors.green, glow: theme.colors.glowGreen, route: '/document' },
  { key: 'world', label1: 'WORLD', label2: 'NEWS', icon: 'earth-outline' as const, color: theme.colors.blue, glow: theme.colors.glowBlue, route: '/world' },
  { key: 'jarvis', label1: 'TALK TO', label2: 'JARVIS', icon: 'chatbubbles-outline' as const, color: theme.colors.purple, glow: theme.colors.glowPurple, route: '/chat' },
];

export default function Home() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [architect, setArchitect] = useState('Architect');
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Standing by.');
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [feedError, setFeedError] = useState(false);
  const soundRef = useRef<Audio.Sound | null>(null);

  // AUTH GATE
  useEffect(() => {
    (async () => {
      const ok = await isAuthenticated();
      if (!ok) {
        router.replace('/login');
        return;
      }
      const n = await getArchitectName();
      if (n) setArchitect(n);
      setAuthChecked(true);
    })();
  }, []);

  const fetchQuotes = useCallback(async () => {
    setFeedError(false);
    try {
      const wRes = await fetch(`${API}/watchlist/${USER_ID}`);
      const wJson = await wRes.json();
      const stored: string[] = (wJson.symbols || []);

      // Empty watchlist → leave the home blank, the rotating Top Movers
      // carousel renders in place of the grid until the user manually tracks.
      if (!stored.length) {
        setQuotes([]);
        const hour = new Date().getHours();
        const tod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
        let brief = '';
        try {
          const b = await fetch(`${API}/jarvis/market-brief?user_name=${encodeURIComponent(architect)}`);
          const bj = await b.json();
          if (bj.brief) brief = `\n${bj.brief}`;
        } catch {}
        setGreeting(`Good ${tod} ${architect}.\nTap a mover below to start tracking.${brief}`);
        return;
      }

      const r = await fetch(`${API}/stocks/quotes?symbols=${stored.join(',')}`);
      const j = await r.json();

      // Filter out insane / corrupt values — guard against bad Finnhub responses
      const sane: Quote[] = (j.quotes || []).filter((q: Quote) =>
        q && typeof q.price === 'number' && q.price > 0 && q.price < 1_000_000 &&
        typeof q.change_pct === 'number' && Math.abs(q.change_pct) < 100 &&
        Array.isArray(q.sparkline) && q.sparkline.length > 1
      );
      setQuotes(sane);

      // Auto-clean watchlist: remove tickers that came back invalid or insane
      const validSymbols = new Set(sane.map(q => q.symbol));
      const invalid: string[] = j.invalid || [];
      const insane = (j.quotes || []).filter((q: Quote) => !validSymbols.has(q.symbol)).map((q: Quote) => q.symbol);
      const toRemove = new Set([...invalid, ...insane]);
      if (toRemove.size && stored.some(s => toRemove.has(s))) {
        const cleaned = stored.filter(s => !toRemove.has(s));
        await fetch(`${API}/watchlist`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: USER_ID, symbols: cleaned }),
        });
      }

      const avg = sane.reduce((s, q) => s + q.change_pct, 0) / Math.max(1, sane.length);
      const dir = avg >= 0 ? 'up' : 'down';
      const hour = new Date().getHours();
      const tod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

      // Pull a JARVIS market brief (top mover + top gainer + watchlist)
      let brief = '';
      try {
        const b = await fetch(`${API}/jarvis/market-brief?user_name=${encodeURIComponent(architect)}`);
        const bj = await b.json();
        if (bj.brief) brief = `\n${bj.brief}`;
      } catch {}

      setGreeting(
        `Good ${tod} ${architect}.\nMarkets are ${dir} ${Math.abs(avg).toFixed(1)} percent today.${brief}`
      );
    } catch {
      setFeedError(true);
      setGreeting(`Standing by, ${architect}. Live data feed unavailable.`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [architect]);

  useEffect(() => { if (authChecked) fetchQuotes(); }, [authChecked, fetchQuotes]);

  const onRefresh = () => { setRefreshing(true); fetchQuotes(); };

  const speakGreeting = () => {
    Speech.stop();
    if (!voiceMode) {
      Speech.speak(greeting.replace(/\n/g, '. '), {
        rate: 0.9, pitch: 0.95, language: 'en-GB',
        onDone: () => setVoiceMode(false),
        onStopped: () => setVoiceMode(false),
      });
      setVoiceMode(true);
    } else {
      setVoiceMode(false);
    }
  };

  const logout = async () => {
    await setSession(false);
    router.replace('/login');
  };

  if (!authChecked) {
    return (
      <SafeAreaView style={styles.safe}>
        <EtherealOrbBackground />
        <ActivityIndicator color={theme.colors.blue} style={{ marginTop: 120 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <EtherealOrbBackground />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor={theme.colors.blue} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Icon name="globe-outline" size={18} color={theme.colors.blue} />
            <Text style={styles.logoText} numberOfLines={1}>PROJECT INCEPTION</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={() => router.push('/dagrcmd')}
              testID="open-dagrcmd"
              style={styles.dagrBadge}
            >
              <Icon name="shield-half" size={14} color="#FF3333" />
              <Text style={styles.dagrText}>DAGRCMD</Text>
            </Pressable>
            <Pressable onPress={logout} testID="logout" style={styles.logoutBtn}>
              <Icon name="log-out-outline" size={16} color={theme.colors.blue} />
            </Pressable>
          </View>
        </View>

        {/* News + Stocks ticker */}
        <NewsTicker quotes={quotes} />

        {/* Today's Movers — always visible, swipeable */}
        <TopMoversCarousel onPickSymbol={async (sym) => {
          const cur = await fetch(`${API}/watchlist/${USER_ID}`).then(r => r.json()).catch(() => ({ symbols: [] }));
          const list: string[] = cur.symbols || [];
          if (!list.includes(sym)) {
            await fetch(`${API}/watchlist`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ user_id: USER_ID, symbols: [...list, sym] }),
            }).catch(() => {});
            fetchQuotes();
          }
        }} />

        {/* My Watchlist — header + grid (or empty-state CTA) */}
        <View style={styles.sectionHeader}>
          <Icon name="bar-chart-outline" size={12} color={theme.colors.blue} />
          <Text style={styles.sectionHeaderText}>MY WATCHLIST</Text>
          <Text style={styles.sectionHeaderCount}>{quotes.length} TRACKED</Text>
        </View>

        {loading ? (
          <SkeletonStockGrid count={6} />
        ) : feedError && !quotes.length ? (
          <View style={styles.degradedBox} testID="stocks-degraded">
            <Icon name="alert-circle" size={18} color={theme.colors.amber} />
            <Text style={styles.degradedText}>LIVE DATA UNAVAILABLE</Text>
            <Text style={styles.degradedHint}>Pull to refresh</Text>
          </View>
        ) : !quotes.length ? (
          <Pressable
            onPress={() => router.push('/stocks/browse' as any)}
            style={styles.emptyWatchlist}
            testID="empty-watchlist"
          >
            <Icon name="add-circle-outline" size={22} color={theme.colors.blue} />
            <Text style={styles.emptyWatchlistText}>NOTHING TRACKED YET</Text>
            <Text style={styles.emptyWatchlistHint}>
              Swipe a mover above or tap BROWSE FULL MARKET to add stocks here.
            </Text>
            <View style={styles.emptyWatchlistCta}>
              <Icon name="search" size={12} color={theme.colors.blue} />
              <Text style={styles.emptyWatchlistCtaText}>BROWSE FULL MARKET</Text>
            </View>
          </Pressable>
        ) : (
          <View style={styles.tickerGrid}>
            {quotes.map((q) => (
              <View key={q.symbol} style={styles.tickerCell}>
                <StockTickerCard quote={q} onPress={() => router.push(`/stock/${q.symbol}` as any)} compact />
              </View>
            ))}
            <Pressable
              onPress={() => router.push('/stocks/browse' as any)}
              style={[styles.tickerCell, styles.addTileWrap]}
              testID="add-stock-tile"
            >
              <View style={styles.addTile}>
                <Icon name="add-circle-outline" size={26} color={theme.colors.blue} />
                <Text style={styles.addTileText}>ADD STOCK</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* Energy & Commodities */}
        <CommoditiesStrip />

        {/* JARVIS Greeting */}
        <Pressable
          onPress={speakGreeting}
          disabled={voiceBusy}
          style={[styles.jarvisSection, voiceBusy && { opacity: 0.85 }]}
          testID="jarvis-greeting"
        >
          <JarvisOrb size={110} color={theme.colors.blue} speaking={voiceMode} />
          <View style={styles.bubble}>
            <View style={styles.bubbleTail} />
            <Text style={styles.jarvisLabel}>JARVIS</Text>
            <Text style={styles.bubbleText}>{greeting}</Text>
            <View style={styles.bubbleActions}>
              {voiceBusy && !voiceMode ? (
                <ActivityIndicator size="small" color={theme.colors.blue} />
              ) : (
                <Icon name={voiceMode ? 'volume-high' : 'volume-mute'} size={14} color={theme.colors.blue} />
              )}
              <Text style={styles.bubbleHint}>
                {voiceBusy && !voiceMode ? 'CONNECTING…' : voiceMode ? 'NARRATING · TAP TO STOP' : 'TAP FOR BRITISH NARRATION'}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Action Cards */}
        <View style={styles.actionsRow}>
          {ACTIONS.map((a) => (
            <Pressable
              key={a.key}
              testID={`action-card-${a.key}`}
              onPress={() => { Speech.stop(); router.push(a.route as any); }}
              style={({ pressed }) => [
                styles.actionCard,
                { borderColor: a.glow, shadowColor: a.color },
                pressed && { transform: [{ scale: 0.96 }], borderColor: a.color },
              ]}
            >
              <View style={[styles.iconBubble, { borderColor: a.color, shadowColor: a.color }]}>
                <Icon name={a.icon} size={26} color={a.color} />
              </View>
              <Text style={styles.actionLabel1} numberOfLines={1}>{a.label1}</Text>
              <Text style={styles.actionLabel2} numberOfLines={1}>{a.label2}</Text>
            </Pressable>
          ))}
        </View>

        {/* Bottom nav */}
        <View style={styles.bottomNav}>
          <Pressable style={styles.navBtn} onPress={() => router.push('/world')} testID="nav-world">
            <Icon name="earth-outline" size={20} color={theme.colors.danger} />
            <Text style={[styles.navText, { color: theme.colors.danger }]}>WORLD</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => router.push('/library')} testID="nav-library">
            <Icon name="folder-open-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.navText}>LIBRARY</Text>
          </Pressable>
          <Pressable style={styles.navBtn} onPress={() => router.push('/settings')} testID="nav-settings">
            <Icon name="settings-outline" size={20} color={theme.colors.textSecondary} />
            <Text style={styles.navText}>SETTINGS</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#000814' },
  scroll: { paddingHorizontal: 16, paddingBottom: 32 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 16,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.heading,
    fontSize: 16,
    letterSpacing: 3,
  },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.blue },
  liveText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  dagrBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,51,51,0.12)',
    borderWidth: 1.5, borderColor: '#FF3333',
    shadowColor: '#FF3333',
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dagrText: { color: '#FF3333', fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  logoutBtn: {
    alignItems: 'center', justifyContent: 'center',
    width: 34, height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(0,229,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)',
  },
  logoutText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.2 },
  degradedBox: {
    marginTop: 16, padding: 18, borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,196,0,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,196,0,0.35)',
    alignItems: 'center', gap: 6,
  },
  degradedText: { color: theme.colors.amber, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  degradedHint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 11 },
  browseAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: 10, paddingVertical: 10,
    borderRadius: theme.radius.md,
    backgroundColor: 'rgba(0,229,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.3)',
  },
  browseAllText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 18, marginBottom: 6,
  },
  sectionHeaderText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    flex: 1,
  },
  sectionHeaderCount: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  emptyWatchlist: {
    alignItems: 'center',
    padding: 18,
    gap: 6,
    borderRadius: theme.radius.lg,
    backgroundColor: 'rgba(0,229,255,0.04)',
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,229,255,0.4)',
  },
  emptyWatchlistText: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 4,
  },
  emptyWatchlistHint: {
    color: theme.colors.textTertiary,
    fontFamily: theme.fonts.body,
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
    maxWidth: 280,
  },
  emptyWatchlistCta: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(0,229,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(0,229,255,0.4)',
  },
  emptyWatchlistCtaText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  iconBtnSmall: { padding: 4 },
  tickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -4,
  },
  tickerCell: { width: '33.333%', padding: 4 },
  addTileWrap: { },
  addTile: {
    height: 80, alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(0,229,255,0.06)', borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(0,229,255,0.5)', borderRadius: theme.radius.md,
  },
  addTileText: { color: theme.colors.blue, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  loaderBox: { height: 84, alignItems: 'center', justifyContent: 'center' },
  jarvisSection: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  bubble: {
    flex: 1,
    backgroundColor: 'rgba(0,8,20,0.7)',
    borderColor: 'rgba(0,229,255,0.35)',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: theme.colors.blue,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 28,
    width: 14, height: 14,
    backgroundColor: 'rgba(0,8,20,0.7)',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,229,255,0.35)',
    transform: [{ rotate: '45deg' }],
  },
  jarvisLabel: {
    color: theme.colors.blue,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  bubbleText: {
    color: theme.colors.text,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  bubbleHint: { color: theme.colors.textTertiary, fontSize: 9, letterSpacing: 1.5, fontFamily: theme.fonts.bodyBold },
  actionsRow: { flexDirection: 'row', gap: 8, marginTop: 24 },
  actionCard: {
    flex: 1,
    backgroundColor: 'rgba(0,8,20,0.55)',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  iconBubble: {
    width: 48, height: 48, borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: 'rgba(255,255,255,0.02)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionLabel1: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
  actionLabel2: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,229,255,0.18)',
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16 },
  navText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
});
