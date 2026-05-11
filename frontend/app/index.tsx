/**
 * Project Inception — Home Dashboard
 * Header (logo + LIVE), stock tickers row, JARVIS orb + greeting bubble, action cards.
 */
import React, { useCallback, useEffect, useState } from 'react';
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
import { theme, API } from '../constants/theme';
import JarvisOrb from '../components/JarvisOrb';
import StockTickerCard, { Quote } from '../components/StockTickerCard';

const DEFAULT_SYMBOLS = ['AAPL', 'TSLA', 'NVDA'];
const USER_ID = 'local-user';

const ACTIONS = [
  { key: 'document', label1: 'CREATE', label2: 'DOCUMENT', icon: 'document-text-outline' as const, color: theme.colors.green, glow: theme.colors.glowGreen, route: '/document' },
  { key: 'stocks', label1: 'STOCK', label2: 'TRACKER', icon: 'bar-chart-outline' as const, color: theme.colors.blue, glow: theme.colors.glowBlue, route: '/stocks' },
  { key: 'jarvis', label1: 'TALK TO', label2: 'JARVIS', icon: 'chatbubbles-outline' as const, color: theme.colors.purple, glow: theme.colors.glowPurple, route: '/chat' },
];

export default function Home() {
  const router = useRouter();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [greeting, setGreeting] = useState('Good morning Architect.\nMarkets coming online…\nReady to build your pitch deck?');
  const [voiceMode, setVoiceMode] = useState(false);

  const fetchQuotes = useCallback(async () => {
    try {
      // Load user watchlist first
      const wRes = await fetch(`${API}/watchlist/${USER_ID}`);
      const wJson = await wRes.json();
      const syms = (wJson.symbols && wJson.symbols.length ? wJson.symbols : DEFAULT_SYMBOLS).slice(0, 9);
      const r = await fetch(`${API}/stocks/quotes?symbols=${syms.join(',')}`);
      const j = await r.json();
      setQuotes(j.quotes || []);
      const avg = (j.quotes || []).reduce((s: number, q: Quote) => s + q.change_pct, 0) / Math.max(1, (j.quotes || []).length);
      const dir = avg >= 0 ? 'up' : 'down';
      const hour = new Date().getHours();
      const tod = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
      setGreeting(`Good ${tod} Architect.\nMarkets are ${dir} ${Math.abs(avg).toFixed(1)} percent today.\nReady to build your pitch deck?`);
    } catch (e) {
      console.warn('fetch quotes', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchQuotes(); }, [fetchQuotes]);

  const onRefresh = () => { setRefreshing(true); fetchQuotes(); };

  const speakGreeting = () => {
    Speech.stop();
    if (!voiceMode) {
      Speech.speak(greeting.replace(/\n/g, '. '), { rate: 0.95, pitch: 1.0 });
      setVoiceMode(true);
    } else {
      setVoiceMode(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl tintColor={theme.colors.neon} refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <Icon name="globe-outline" size={22} color={theme.colors.text} />
            <Text style={styles.logoText}>PROJECT INCEPTION</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              onPress={() => router.push('/dagrcmd')}
              testID="open-dagrcmd"
              style={styles.dagrBadge}
            >
              <Icon name="shield-half" size={11} color="#FF3333" />
              <Text style={styles.dagrText}>DAGRCMD</Text>
            </Pressable>
            <View style={styles.liveBadge} testID="live-indicator">
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
          </View>
        </View>

        {/* Stock Tickers - 3x3 grid */}
        {loading ? (
          <View style={styles.loaderBox}>
            <ActivityIndicator color={theme.colors.neon} />
          </View>
        ) : (
          <View style={styles.tickerGrid}>
            {quotes.slice(0, 9).map((q) => (
              <View key={q.symbol} style={styles.tickerCell}>
                <StockTickerCard quote={q} onPress={() => router.push(`/stock/${q.symbol}` as any)} compact />
              </View>
            ))}
            {quotes.length < 9 && (
              <Pressable
                onPress={() => router.push('/stocks/browse' as any)}
                style={[styles.tickerCell, styles.addTile]}
                testID="add-stock-tile"
              >
                <Icon name="add-circle-outline" size={26} color={theme.colors.neon} />
                <Text style={styles.addTileText}>ADD STOCK</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* JARVIS Greeting */}
        <Pressable onPress={speakGreeting} style={styles.jarvisSection} testID="jarvis-greeting">
          <JarvisOrb size={110} speaking={voiceMode} />
          <View style={styles.bubble}>
            <View style={styles.bubbleTail} />
            <Text style={styles.jarvisLabel}>JARVIS</Text>
            <Text style={styles.bubbleText}>{greeting}</Text>
            <View style={styles.bubbleActions}>
              <Icon name={voiceMode ? 'volume-high' : 'volume-mute'} size={14} color={theme.colors.neon} />
              <Text style={styles.bubbleHint}>{voiceMode ? 'NARRATING' : 'TAP TO HEAR'}</Text>
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
              <Text style={styles.actionLabel1}>{a.label1}</Text>
              <Text style={styles.actionLabel2}>{a.label2}</Text>
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
  safe: { flex: 1, backgroundColor: theme.colors.bg },
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
    backgroundColor: 'rgba(0,255,102,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,255,102,0.25)',
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.green },
  liveText: { color: theme.colors.green, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  dagrBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: theme.radius.full,
    backgroundColor: 'rgba(255,51,51,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,51,51,0.35)',
  },
  dagrText: { color: '#FF3333', fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  tickerRow: { flexDirection: 'row', marginHorizontal: -4, marginTop: 4 },
  tickerGrid: {
    flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, marginHorizontal: -4,
  },
  tickerCell: { width: '33.333%', padding: 4 },
  addTile: {
    height: 80, alignItems: 'center', justifyContent: 'center', gap: 4,
    backgroundColor: 'rgba(212,255,0,0.04)', borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(212,255,0,0.4)', borderRadius: theme.radius.md, marginHorizontal: 4,
  },
  addTileText: { color: theme.colors.neon, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.2, textAlign: 'center' },
  loaderBox: { flex: 1, height: 84, alignItems: 'center', justifyContent: 'center', minWidth: 200 },
  browseTile: {
    width: 130, height: 84, marginHorizontal: 4,
    backgroundColor: 'rgba(212,255,0,0.05)', borderWidth: 1,
    borderColor: 'rgba(212,255,0,0.4)', borderStyle: 'dashed',
    borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  browseTileText: { color: theme.colors.neon, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
  jarvisSection: {
    marginTop: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  bubble: {
    flex: 1,
    backgroundColor: theme.colors.surfaceElevated,
    borderColor: 'rgba(212,255,0,0.25)',
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: theme.colors.neon,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 28,
    width: 14, height: 14,
    backgroundColor: theme.colors.surfaceElevated,
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(212,255,0,0.25)',
    transform: [{ rotate: '45deg' }],
  },
  jarvisLabel: {
    color: theme.colors.neon,
    fontFamily: theme.fonts.bodyBold,
    fontSize: 10,
    letterSpacing: 2,
    marginBottom: 6,
  },
  bubbleText: {
    color: theme.colors.neon,
    fontFamily: theme.fonts.body,
    fontSize: 14,
    lineHeight: 20,
  },
  bubbleActions: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  bubbleHint: { color: theme.colors.textTertiary, fontSize: 9, letterSpacing: 1.5, fontFamily: theme.fonts.bodyBold },
  actionsRow: { flexDirection: 'row', gap: 10, marginTop: 28 },
  actionCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderRadius: theme.radius.lg,
    paddingVertical: 18,
    paddingHorizontal: 10,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  iconBubble: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.02)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  actionLabel1: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 12, letterSpacing: 2 },
  actionLabel2: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 12, letterSpacing: 2 },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 28,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  navBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 16 },
  navText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
});
