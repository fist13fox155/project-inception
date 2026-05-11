/**
 * Stock detail screen: hourly/quarterly toggle, news, JARVIS AI buy/sell recommendation.
 */
import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { theme, API } from '../../constants/theme';
import Sparkline from '../../components/Sparkline';

type Point = { t: string; price: number };
type News = { title: string; summary: string; source: string; sentiment: string; time: string; url: string };
type Rec = { action: string; confidence: number; horizon: string; reasoning: string; snapshot: any };

export default function StockDetail() {
  const router = useRouter();
  const { symbol } = useLocalSearchParams<{ symbol: string }>();
  const sym = (symbol || '').toString().toUpperCase();
  const [tab, setTab] = useState<'hourly' | 'quarterly'>('hourly');
  const [points, setPoints] = useState<Point[]>([]);
  const [news, setNews] = useState<News[]>([]);
  const [rec, setRec] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = tab === 'hourly' ? `${API}/stocks/intraday/${sym}` : `${API}/stocks/quarterly/${sym}`;
    fetch(url).then(r => r.json()).then(j => setPoints(j.points || []))
      .catch(() => setPoints([]))
      .finally(() => setLoading(false));
  }, [sym, tab]);

  useEffect(() => {
    fetch(`${API}/stocks/news/${sym}`).then(r => r.json()).then(j => setNews(j.items || []))
      .catch(() => setNews([]));
  }, [sym]);

  const getRec = async () => {
    setRecLoading(true);
    try {
      const r = await fetch(`${API}/stocks/recommendation`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: sym }),
      });
      setRec(await r.json());
    } catch (e) { console.warn(e); }
    finally { setRecLoading(false); }
  };

  const prices = points.map(p => p.price);
  const latest = prices[prices.length - 1] || 0;
  const first = prices[0] || latest;
  const changePct = first ? ((latest - first) / first) * 100 : 0;
  const up = changePct >= 0;
  const accent = up ? theme.colors.green : theme.colors.danger;

  const actionColor = (a?: string) =>
    a === 'BUY' ? theme.colors.green : a === 'SELL' ? theme.colors.danger : theme.colors.blue;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="detail-back" style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>{sym}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Chart */}
        <View style={styles.card}>
          <View style={styles.tabs}>
            {(['hourly', 'quarterly'] as const).map((k) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                style={[styles.tab, tab === k && styles.tabActive]}
                testID={`tab-${k}`}
              >
                <Text style={[styles.tabText, tab === k && { color: theme.colors.neon }]}>
                  {k.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={{ alignItems: 'center', marginTop: 12 }}>
            <Text style={styles.price}>${latest.toFixed(2)}</Text>
            <Text style={[styles.chg, { color: accent }]}>
              {up ? '+' : ''}{changePct.toFixed(2)}% ({tab === 'hourly' ? 'Recent' : 'Quarter'})
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={theme.colors.blue} style={{ marginTop: 12 }} />
          ) : (
            <View style={{ marginTop: 12, alignItems: 'center' }}>
              <Sparkline data={prices} width={300} height={120} color={accent} strokeWidth={2} />
            </View>
          )}
        </View>

        {/* JARVIS rec */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>JARVIS RECOMMENDATION</Text>
            <Pressable onPress={getRec} style={styles.refreshBtn} testID="rec-refresh" disabled={recLoading}>
              <Ionicons
                name={recLoading ? 'sync' : 'sparkles-outline'}
                size={14}
                color={theme.colors.neon}
              />
              <Text style={styles.refreshText}>{rec ? 'REGENERATE' : 'ANALYZE'}</Text>
            </Pressable>
          </View>
          {recLoading && <ActivityIndicator color={theme.colors.neon} style={{ marginTop: 12 }} />}
          {rec && !recLoading && (
            <View style={{ marginTop: 12, gap: 8 }}>
              <View style={styles.actionRow}>
                <View style={[styles.actionPill, { borderColor: actionColor(rec.action) }]}>
                  <Text style={[styles.actionPillText, { color: actionColor(rec.action) }]}>{rec.action}</Text>
                </View>
                <Text style={styles.recMeta}>{rec.confidence}% confidence · {rec.horizon} term</Text>
              </View>
              <Text style={styles.recReason}>{rec.reasoning}</Text>
            </View>
          )}
          {!rec && !recLoading && (
            <Text style={styles.hint}>Tap ANALYZE for AI-driven buy/hold/sell guidance based on live price + headlines.</Text>
          )}
        </View>

        {/* News */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>WORLD NEWS · {sym}</Text>
          {news.length === 0 ? (
            <Text style={styles.hint}>Loading market intelligence…</Text>
          ) : (
            <View style={{ marginTop: 8, gap: 10 }}>
              {news.slice(0, 6).map((n, i) => (
                <View key={i} style={styles.newsItem}>
                  <View style={[styles.sentDot, {
                    backgroundColor: /bull/i.test(n.sentiment) ? theme.colors.green
                      : /bear/i.test(n.sentiment) ? theme.colors.danger : theme.colors.textTertiary
                  }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.newsTitle}>{n.title}</Text>
                    <Text style={styles.newsMeta}>{n.source} · {n.sentiment}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
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
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 22, letterSpacing: 4 },
  card: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.lg, padding: 16,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  tabs: { flexDirection: 'row', backgroundColor: theme.colors.bg, borderRadius: theme.radius.full, padding: 4 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: theme.radius.full },
  tabActive: { backgroundColor: 'rgba(212,255,0,0.08)', borderWidth: 1, borderColor: 'rgba(212,255,0,0.35)' },
  tabText: { color: theme.colors.textTertiary, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2 },
  price: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 38, letterSpacing: 1 },
  chg: { fontFamily: theme.fonts.bodyBold, fontSize: 13, marginTop: 2 },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4,
    borderWidth: 1, borderColor: 'rgba(212,255,0,0.35)', borderRadius: theme.radius.full },
  refreshText: { color: theme.colors.neon, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.full, borderWidth: 1 },
  actionPillText: { fontFamily: theme.fonts.bodyBold, fontSize: 13, letterSpacing: 2 },
  recMeta: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 12 },
  recReason: { color: theme.colors.text, fontFamily: theme.fonts.body, fontSize: 13, lineHeight: 20 },
  hint: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 12, marginTop: 8, lineHeight: 18 },
  newsItem: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  sentDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  newsTitle: { color: theme.colors.text, fontFamily: theme.fonts.bodyMedium, fontSize: 13, lineHeight: 18 },
  newsMeta: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10, marginTop: 2 },
});
