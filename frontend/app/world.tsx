/**
 * World Intel — Live crisis feed + terrorist hotspot clocks.
 * Pulls /api/world/crisis (Finnhub general news, categorized) and /api/world/hotspots.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator,
  RefreshControl, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../components/Icon';
import { useRouter } from 'expo-router';
import CommoditiesStrip from '../components/CommoditiesStrip';
import { theme, API } from '../constants/theme';

type CrisisItem = {
  title: string; summary?: string; url: string; source: string;
  image?: string; time?: string; category: string; hotspots: string[];
};
type Hotspot = {
  name: string; zone: string; region: string;
  local_time: string; local_date: string; offset: string; weekday: string;
};

const CATEGORIES: { key: string; label: string; icon: any; color: string }[] = [
  { key: 'all',       label: 'ALL',       icon: 'globe',           color: theme.colors.neon },
  { key: 'military',  label: 'MILITARY',  icon: 'shield',          color: theme.colors.danger },
  { key: 'guerrilla', label: 'GUERRILLA', icon: 'flame',           color: '#FFA000' },
  { key: 'unrest',    label: 'UNREST',    icon: 'people',          color: '#FF6F00' },
  { key: 'crisis',    label: 'CRISIS',    icon: 'alert-circle',    color: theme.colors.blue },
];

const CAT_COLOR: Record<string, string> = {
  MILITARY: theme.colors.danger, GUERRILLA: '#FFA000',
  UNREST: '#FF6F00', CRISIS: theme.colors.blue, OTHER: theme.colors.textSecondary,
};

export default function WorldScreen() {
  const router = useRouter();
  const [cat, setCat] = useState('all');
  const [items, setItems] = useState<CrisisItem[]>([]);
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async (c: string) => {
    try {
      const [r1, r2] = await Promise.all([
        fetch(`${API}/world/crisis?category=${c}&limit=30`),
        fetch(`${API}/world/hotspots`),
      ]);
      const j1 = await r1.json();
      const j2 = await r2.json();
      setItems(j1.items || []);
      setHotspots(j2.hotspots || []);
    } catch (e) { void ('world', e); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { setLoading(true); load(cat); }, [cat, load]);

  // Tick every minute to refresh hotspot clocks visually (local time)
  useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="world-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={22} color={theme.colors.text} />
        </Pressable>
        <Text style={styles.title}>WORLD INTEL</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 32 }}
        refreshControl={<RefreshControl tintColor={theme.colors.neon} refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); load(cat); }} />}
      >
        {/* Hotspot clocks */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="time-outline" size={14} color={theme.colors.danger} />
            <Text style={styles.sectionTitle}>HOTSPOT TIMEZONES</Text>
            <Text style={styles.sectionMeta}>{hotspots.length} CITIES</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 8 }}>
            {hotspots.map((h) => (
              <View key={h.zone} style={styles.clockCard} testID={`clock-${h.zone}`}>
                <Text style={styles.clockTime}>{h.local_time}</Text>
                <Text style={styles.clockOffset}>UTC{h.offset}</Text>
                <Text style={styles.clockCity}>{h.name}</Text>
                <Text style={styles.clockMeta}>{h.weekday} · {h.region}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Crisis feed */}
        <View>
          <View style={styles.sectionHeader}>
            <Icon name="radio" size={14} color={theme.colors.danger} />
            <Text style={styles.sectionTitle}>LIVE CRISIS FEED</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 10 }}>
            {CATEGORIES.map(c => (
              <Pressable
                key={c.key}
                onPress={() => setCat(c.key)}
                style={[styles.catChip, cat === c.key && { borderColor: c.color, backgroundColor: 'rgba(255,255,255,0.05)' }]}
                testID={`cat-${c.key}`}
              >
                <Icon name={c.icon as any} size={13} color={cat === c.key ? c.color : theme.colors.textSecondary} />
                <Text style={[styles.catText, cat === c.key && { color: c.color }]}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {loading ? (
            <ActivityIndicator color={theme.colors.neon} style={{ marginTop: 24 }} />
          ) : items.length === 0 ? (
            <Text style={styles.empty}>No items for this category right now.</Text>
          ) : (
            items.map((it, idx) => (
              <Pressable
                key={idx}
                onPress={() => it.url && Linking.openURL(it.url).catch(() => {})}
                style={styles.newsCard}
                testID={`news-${idx}`}
              >
                <View style={[styles.catTag, { borderColor: CAT_COLOR[it.category] || theme.colors.border }]}>
                  <Text style={[styles.catTagText, { color: CAT_COLOR[it.category] || theme.colors.textSecondary }]}>
                    {it.category}
                  </Text>
                </View>
                <Text style={styles.newsTitle} numberOfLines={3}>{it.title}</Text>
                {it.summary && (
                  <Text style={styles.newsSummary} numberOfLines={2}>{it.summary}</Text>
                )}
                <View style={styles.newsFooter}>
                  <Text style={styles.newsSource}>{it.source}</Text>
                  {it.time && (
                    <Text style={styles.newsTime}>
                      {new Date(it.time).toLocaleString(undefined, {
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </Text>
                  )}
                </View>
                {it.hotspots && it.hotspots.length > 0 && (
                  <View style={styles.hotspotRow}>
                    {it.hotspots.slice(0, 4).map((h, i) => (
                      <View key={i} style={styles.hotspotPill}>
                        <Text style={styles.hotspotText}>{h}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Pressable>
            ))
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
    paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: theme.colors.border,
  },
  iconBtn: { padding: 4 },
  title: { color: theme.colors.text, fontFamily: theme.fonts.heading, fontSize: 16, letterSpacing: 3 },
  section: { marginTop: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  sectionTitle: { color: theme.colors.danger, fontFamily: theme.fonts.bodyBold, fontSize: 11, letterSpacing: 2, flex: 1 },
  sectionMeta: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10, letterSpacing: 1 },
  clockCard: {
    width: 110, paddingVertical: 10, paddingHorizontal: 10,
    borderWidth: 1, borderColor: 'rgba(255,51,102,0.3)', borderRadius: theme.radius.md,
    backgroundColor: 'rgba(255,51,102,0.04)', gap: 2,
  },
  clockTime: { color: theme.colors.danger, fontFamily: theme.fonts.heading, fontSize: 22, letterSpacing: 1 },
  clockOffset: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 1 },
  clockCity: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 12, marginTop: 4 },
  clockMeta: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 9, letterSpacing: 0.5 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: theme.radius.full,
    borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface,
  },
  catText: { color: theme.colors.textSecondary, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1.5 },
  empty: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 13, marginTop: 32, textAlign: 'center' },
  newsCard: {
    backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: theme.radius.md, padding: 14, marginBottom: 10, gap: 6,
  },
  catTag: {
    alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderRadius: 4,
  },
  catTagText: { fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1.5 },
  newsTitle: { color: theme.colors.text, fontFamily: theme.fonts.bodyBold, fontSize: 14, lineHeight: 19 },
  newsSummary: { color: theme.colors.textSecondary, fontFamily: theme.fonts.body, fontSize: 12, lineHeight: 17 },
  newsFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  newsSource: { color: theme.colors.neon, fontFamily: theme.fonts.bodyBold, fontSize: 10, letterSpacing: 1 },
  newsTime: { color: theme.colors.textTertiary, fontFamily: theme.fonts.body, fontSize: 10 },
  hotspotRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  hotspotPill: {
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4,
    backgroundColor: 'rgba(255,51,102,0.1)', borderWidth: 1, borderColor: 'rgba(255,51,102,0.3)',
  },
  hotspotText: { color: theme.colors.danger, fontFamily: theme.fonts.bodyBold, fontSize: 9, letterSpacing: 1 },
});
