/**
 * DAGRCMD MAP — operator location tracker.
 * Pulls all encrypted location messages from user's channels, decrypts,
 * shows latest position per operator on a Leaflet map (OpenStreetMap, no API key).
 * Tap an operator pin → camera snaps to within 100m of them.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { dagrTheme as T } from '../../constants/dagrTheme';
import { API } from '../../constants/theme';
import { getCredentials, ensureKeyPair, decryptFromSender } from '../../lib/crypto';

type OperatorPing = {
  callsign: string;
  lat: number;
  lng: number;
  acc?: number;
  channel: string;
  channel_id: string;
  timestamp: string;
};

const LEAFLET_HTML = `
<!DOCTYPE html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<style>
  html,body,#map{margin:0;padding:0;height:100%;background:#0a0000}
  .leaflet-tile-pane{filter:brightness(0.6) contrast(1.2) hue-rotate(330deg) saturate(0.8)}
  .pin {
    background: #FF1A1A; color: #0a0000;
    border: 2px solid #FFA000; border-radius: 50%;
    width: 36px; height: 36px; display:flex; align-items:center; justify-content:center;
    font-weight:700; font-family: monospace; font-size: 10px;
    box-shadow: 0 0 12px rgba(255,26,26,0.8);
  }
  .me { background: #00FF66; border-color: #00FF66; color: #0a0000; }
  .pulse {
    position:absolute; top:-3px; left:-3px;
    width:42px; height:42px; border-radius:50%;
    border:2px solid #FF1A1A; animation: ping 1.5s ease-out infinite;
  }
  @keyframes ping {
    0%{transform:scale(0.6);opacity:1}
    100%{transform:scale(1.8);opacity:0}
  }
</style>
</head><body>
<div id="map"></div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
  var map = L.map('map', { zoomControl: false, attributionControl: false })
    .setView([20, 0], 2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  var markers = {};
  function send(t,d){ window.ReactNativeWebView.postMessage(JSON.stringify({t:t,d:d})); }
  function clearAll(){ Object.values(markers).forEach(m=>map.removeLayer(m)); markers={}; }
  function setPin(callsign, lat, lng, isMe){
    var icon = L.divIcon({
      className:'', iconSize:[36,36], iconAnchor:[18,18],
      html: '<div class="pin '+(isMe?'me':'')+'">'+(callsign.substring(0,4))+'<div class="pulse"></div></div>'
    });
    var m = L.marker([lat,lng], { icon: icon }).addTo(map).bindTooltip(callsign,{permanent:false,direction:'top',offset:[0,-20]});
    m.on('click', function(){ send('tap', callsign); });
    markers[callsign] = m;
  }
  function snapTo(lat, lng){ map.flyTo([lat,lng], 17, { duration: 1.2 }); }
  function fitAll(){
    var keys = Object.keys(markers);
    if(!keys.length) return;
    var g = L.featureGroup(keys.map(function(k){return markers[k];}));
    map.fitBounds(g.getBounds().pad(0.3));
  }
  document.addEventListener('message', function(e){
    var msg = JSON.parse(e.data);
    if(msg.t==='pins'){ clearAll(); msg.d.forEach(function(p){ setPin(p.callsign,p.lat,p.lng,p.isMe); }); fitAll(); }
    else if(msg.t==='snap'){ snapTo(msg.d.lat, msg.d.lng); }
  });
  window.addEventListener('message', function(e){
    try{var msg=JSON.parse(e.data); if(msg.t==='pins'){clearAll(); msg.d.forEach(function(p){setPin(p.callsign,p.lat,p.lng,p.isMe);}); fitAll();}
    else if(msg.t==='snap'){ snapTo(msg.d.lat, msg.d.lng); }
    }catch(_){}
  });
  send('ready', true);
</script>
</body></html>
`;

export default function DagrMapScreen() {
  const router = useRouter();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [pings, setPings] = useState<OperatorPing[]>([]);
  const [me, setMe] = useState<{ callsign: string; authCode: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const sendPings = useCallback((list: OperatorPing[]) => {
    const data = list.map(p => ({
      callsign: p.callsign, lat: p.lat, lng: p.lng,
      isMe: p.callsign === me?.callsign,
    }));
    webRef.current?.postMessage(JSON.stringify({ t: 'pins', d: data }));
  }, [me?.callsign]);

  const loadAll = useCallback(async () => {
    const cred = await getCredentials();
    const kp = await ensureKeyPair();
    if (!cred.callsign || !cred.authCode) { router.replace('/dagrcmd'); return; }
    setMe({ callsign: cred.callsign, authCode: cred.authCode });

    try {
      const cr = await fetch(`${API}/dagrcmd/channels/${cred.callsign}`);
      const cj = await cr.json();
      const channels = cj.channels || [];
      const latestPerOp: Record<string, OperatorPing> = {};

      for (const ch of channels) {
        try {
          const mr = await fetch(`${API}/dagrcmd/messages/${ch.id}?callsign=${cred.callsign}&limit=200`);
          const mj = await mr.json();
          for (const m of (mj.messages || []) as any[]) {
            if (m.kind !== 'location') continue;
            const ct = m.ciphertext_for_me || m.ciphertexts?.[cred.callsign];
            if (!ct || !m.sender_pubkey) continue;
            const pt = decryptFromSender(ct.ct, ct.nonce, m.sender_pubkey, kp.secretKey);
            if (!pt) continue;
            let loc: any;
            try { loc = JSON.parse(pt); } catch { continue; }
            const sender = m.sender;
            const prev = latestPerOp[sender];
            if (!prev || new Date(m.timestamp) > new Date(prev.timestamp)) {
              latestPerOp[sender] = {
                callsign: sender, lat: loc.lat, lng: loc.lng, acc: loc.acc,
                channel: ch.name, channel_id: ch.id, timestamp: m.timestamp,
              };
            }
          }
        } catch (e) { console.warn('msg', e); }
      }

      // Add my own current location if we have permission
      try {
        const perm = await Location.getForegroundPermissionsAsync();
        if (perm.granted) {
          const myLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          latestPerOp[cred.callsign] = {
            callsign: cred.callsign,
            lat: myLoc.coords.latitude, lng: myLoc.coords.longitude,
            acc: myLoc.coords.accuracy || 0,
            channel: 'SELF', channel_id: 'self',
            timestamp: new Date().toISOString(),
          };
        }
      } catch {}

      const list = Object.values(latestPerOp).sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setPings(list);
      if (ready) sendPings(list);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  }, [ready, sendPings, router]);

  useEffect(() => { loadAll(); }, [loadAll]);
  useEffect(() => { if (ready) sendPings(pings); }, [ready, pings, sendPings]);

  const snapToOperator = (p: OperatorPing) => {
    webRef.current?.postMessage(JSON.stringify({ t: 'snap', d: { lat: p.lat, lng: p.lng } }));
  };

  const requestPos = async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Location access required to pin yourself.'); return; }
    await loadAll();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="map-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={22} color={T.colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>TACTICAL MAP</Text>
          <Text style={styles.sub}>{pings.length} OPERATORS LIVE</Text>
        </View>
        <Pressable onPress={requestPos} testID="map-refresh" style={styles.iconBtn}>
          <Icon name="locate" size={20} color={T.colors.amber} />
        </Pressable>
      </View>

      <View style={styles.mapBox}>
        <WebView
          ref={webRef}
          originWhitelist={['*']}
          source={{ html: LEAFLET_HTML }}
          onMessage={(e) => {
            try {
              const msg = JSON.parse(e.nativeEvent.data);
              if (msg.t === 'ready') setReady(true);
              else if (msg.t === 'tap') {
                const p = pings.find(x => x.callsign === msg.d);
                if (p) snapToOperator(p);
              }
            } catch {}
          }}
          style={{ flex: 1, backgroundColor: T.colors.bg }}
          javaScriptEnabled
          domStorageEnabled
        />
      </View>

      <View style={styles.list}>
        <Text style={styles.listTitle}>SNAP TO OPERATOR ↓</Text>
        {loading ? (
          <ActivityIndicator color={T.colors.red} style={{ marginTop: 8 }} />
        ) : pings.length === 0 ? (
          <Text style={styles.emptyHint}>
            No operator pings yet. Open a channel and tap the 📍 compass icon to share position.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
            {pings.map((p) => {
              const mine = p.callsign === me?.callsign;
              return (
                <Pressable
                  key={p.callsign}
                  onPress={() => snapToOperator(p)}
                  style={[styles.opCard, mine && styles.opCardMine]}
                  testID={`op-${p.callsign}`}
                >
                  <View style={[styles.opDot, { backgroundColor: mine ? T.colors.green : T.colors.red }]} />
                  <Text style={styles.opCallsign}>{p.callsign}</Text>
                  <Text style={styles.opMeta}>{p.lat.toFixed(3)}, {p.lng.toFixed(3)}</Text>
                  <Text style={styles.opChannel}>{mine ? 'SELF' : p.channel}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.colors.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: T.colors.border,
  },
  iconBtn: { padding: 6 },
  headerCenter: { alignItems: 'center' },
  title: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 18, letterSpacing: 3 },
  sub: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 10, letterSpacing: 1.5, marginTop: 1 },
  mapBox: { flex: 1, backgroundColor: T.colors.bg },
  list: {
    paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: T.colors.border,
    backgroundColor: T.colors.surface,
  },
  listTitle: {
    color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 10, letterSpacing: 2,
    paddingHorizontal: 14, marginBottom: 6,
  },
  emptyHint: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 11, paddingHorizontal: 14, lineHeight: 16 },
  opCard: {
    width: 130, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: T.colors.bg, borderWidth: 1, borderColor: T.colors.borderActive,
    borderRadius: T.radius.sm, gap: 2,
  },
  opCardMine: { borderColor: T.colors.green, backgroundColor: 'rgba(0,255,102,0.04)' },
  opDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 2 },
  opCallsign: { color: T.colors.textPrimary, fontFamily: T.fonts.heading, fontSize: 12, letterSpacing: 1.5 },
  opMeta: { color: T.colors.amber, fontFamily: T.fonts.mono, fontSize: 10 },
  opChannel: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, letterSpacing: 1 },
});
