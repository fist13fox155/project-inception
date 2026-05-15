/**
 * DAGRCMD Channel — encrypted chat with text + push-to-talk audio + location pings.
 * Real-time via WebSocket. Server only sees ciphertext.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from '../../../components/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Audio } from 'expo-av';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'react-native';
import { dagrTheme as T } from '../../../constants/dagrTheme';
import { API, BACKEND_URL } from '../../../constants/theme';
import {
  getCredentials, ensureKeyPair, encryptForChannel, decryptFromSender,
} from '../../../lib/crypto';

type Channel = { id: string; name: string; owner: string; members: string[]; join_code: string };
type EncMsg = {
  id: string; channel_id: string; sender: string; sender_pubkey: string;
  kind: 'text' | 'audio' | 'location' | 'image' | 'video' | 'live';
  ciphertexts: Record<string, { ct: string; nonce: string }>;
  ciphertext_for_me?: { ct: string; nonce: string };
  meta?: any; timestamp: string;
};
type DecodedMsg = EncMsg & { plaintext: string | null };
type OfficerInfo = { callsign: string; public_key: string; rank?: string; unit?: string };

export default function ChannelScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const channelId = (id || '').toString();

  const [me, setMe] = useState<{ callsign: string; authCode: string } | null>(null);
  const [secretKey, setSecretKey] = useState('');
  const [channel, setChannel] = useState<Channel | null>(null);
  const [officers, setOfficers] = useState<OfficerInfo[]>([]);
  const [messages, setMessages] = useState<DecodedMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [wsStatus, setWsStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const [playingId, setPlayingId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const decryptOne = useCallback((m: EncMsg, mySecret: string): DecodedMsg => {
    const ctEntry = m.ciphertext_for_me || m.ciphertexts?.[me?.callsign || ''];
    if (!ctEntry || !m.sender_pubkey) return { ...m, plaintext: null };
    const pt = decryptFromSender(ctEntry.ct, ctEntry.nonce, m.sender_pubkey, mySecret);
    return { ...m, plaintext: pt };
  }, [me?.callsign]);

  // bootstrap
  useEffect(() => {
    (async () => {
      const cred = await getCredentials();
      const kp = await ensureKeyPair();
      if (!cred.callsign || !cred.authCode) { router.replace('/dagrcmd'); return; }
      setMe({ callsign: cred.callsign, authCode: cred.authCode });
      setSecretKey(kp.secretKey);

      // Channel + members + officers
      const cr = await fetch(`${API}/dagrcmd/channels/${cred.callsign}`);
      const cj = await cr.json();
      const ch: Channel | undefined = (cj.channels || []).find((c: Channel) => c.id === channelId);
      if (!ch) { Alert.alert('Channel not found'); router.back(); return; }
      setChannel(ch);

      const or = await fetch(`${API}/dagrcmd/officers?callsigns=${ch.members.join(',')}`);
      const oj = await or.json();
      setOfficers(oj.officers || []);

      // History
      const mr = await fetch(`${API}/dagrcmd/messages/${channelId}?callsign=${cred.callsign}&limit=80`);
      const mj = await mr.json();
      const msgs: EncMsg[] = mj.messages || [];
      setMessages(msgs.map(m => ({
        ...m,
        plaintext: (() => {
          const e = m.ciphertext_for_me;
          if (!e || !m.sender_pubkey) return null;
          return decryptFromSender(e.ct, e.nonce, m.sender_pubkey, kp.secretKey);
        })(),
      })));
      setLoading(false);
    })();
  }, [channelId]);

  // WebSocket
  useEffect(() => {
    if (!me) return;
    const wsUrl = BACKEND_URL.replace(/^http/, 'ws') +
      `/api/ws/dagrcmd/${encodeURIComponent(me.callsign)}?auth_code=${encodeURIComponent(me.authCode)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    setWsStatus('connecting');
    ws.onopen = () => setWsStatus('open');
    ws.onclose = () => setWsStatus('closed');
    ws.onerror = () => setWsStatus('closed');
    ws.onmessage = (evt) => {
      try {
        const payload = JSON.parse(evt.data);
        if (payload.type === 'message' && payload.data?.channel_id === channelId) {
          const d = payload.data as EncMsg;
          // Pull this user's ciphertext only
          const ctEntry = d.ciphertexts?.[me.callsign];
          const enriched: DecodedMsg = {
            ...d,
            ciphertext_for_me: ctEntry,
            plaintext: ctEntry && d.sender_pubkey
              ? decryptFromSender(ctEntry.ct, ctEntry.nonce, d.sender_pubkey, secretKey)
              : null,
          };
          setMessages((prev) => prev.find(m => m.id === d.id) ? prev : [...prev, enriched]);
        } else if (payload.type === 'delete' && payload.channel_id === channelId && payload.message_id) {
          setMessages((prev) => prev.filter(m => m.id !== payload.message_id));
        } else if ((payload.type === 'channel_deleted' || payload.type === 'channel_member_left' && payload.callsign === me.callsign) && payload.channel_id === channelId) {
          Alert.alert(
            'Channel closed',
            payload.type === 'channel_deleted'
              ? `Channel was deleted by ${payload.by || 'owner'}.`
              : 'You have left this channel.',
            [{ text: 'OK', onPress: () => router.replace('/dagrcmd/comms') }]
          );
        }
      } catch {}
    };
    return () => { try { ws.close(); } catch {} };
  }, [me, channelId, secretKey]);

  useEffect(() => { scrollRef.current?.scrollToEnd({ animated: true }); }, [messages]);

  const send = async (kind: 'text' | 'audio' | 'location' | 'image' | 'video' | 'live', payload: string, meta: any = {}) => {
    if (!me || !channel || !payload) return;
    setSending(true);
    try {
      const kp = await ensureKeyPair();
      const recipients = officers
        .filter(o => o.public_key)
        .map(o => ({ callsign: o.callsign, publicKey: o.public_key }));
      const ciphertexts = encryptForChannel(payload, recipients, kp.secretKey);
      const r = await fetch(`${API}/dagrcmd/messages`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel_id: channel.id, sender: me.callsign, sender_pubkey: kp.publicKey,
          kind, ciphertexts, meta,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e: any) { Alert.alert('Send failed', String(e?.message || e)); }
    finally { setSending(false); }
  };

  const sendText = () => {
    const t = input.trim();
    if (!t) return;
    setInput('');
    send('text', t);
  };

  const sendLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) { Alert.alert('Location permission required'); return; }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const data = JSON.stringify({
        lat: loc.coords.latitude, lng: loc.coords.longitude,
        acc: Math.round(loc.coords.accuracy || 0),
      });
      await send('location', data);
    } catch (e: any) { Alert.alert('Location failed', String(e?.message || e)); }
  };

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) { Alert.alert('Mic permission required'); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      await rec.startAsync();
      setRecording(rec);
    } catch (e) { void (e); }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      const status = await recording.getStatusAsync();
      setRecording(null);
      if (!uri) return;
      // Read as base64
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const durMs = (status as any)?.durationMillis || 0;
      await send('audio', b64, { audio_ms: durMs });
    } catch (e) { void (e); }
  };

  const playAudio = async (m: DecodedMsg) => {
    if (!m.plaintext) return;
    try {
      setPlayingId(m.id);
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      const path = `${dir}voice_${m.id}.m4a`;
      // Write the decrypted base64 audio to a file so expo-av can play it natively
      const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }) as any);
      if (!info.exists) {
        await FileSystem.writeAsStringAsync(path, m.plaintext, { encoding: FileSystem.EncodingType.Base64 });
      }
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
      const { sound } = await Audio.Sound.createAsync(
        { uri: path },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.setOnPlaybackStatusUpdate((s: any) => {
        if (s.didJustFinish) { setPlayingId(null); sound.unloadAsync().catch(() => {}); }
        if (s.error) { setPlayingId(null); }
      });
    } catch (e) {
      void ('audio play failed', e);
      setPlayingId(null);
      Alert.alert('Playback failed', 'Could not play this transmission.');
    }
  };

  const stopAudio = () => setPlayingId(null);

  const sendImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Photo library access required.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.5,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]?.base64) return;
      const b64 = res.assets[0].base64!;
      const w = res.assets[0].width || 0;
      const h = res.assets[0].height || 0;
      await send('image', b64, { w, h });
    } catch (e: any) { Alert.alert('Image failed', String(e?.message || e)); }
  };

  const sendVideo = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { Alert.alert('Permission needed', 'Library access required.'); return; }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        quality: 0.5,
        videoMaxDuration: 15,
      });
      if (res.canceled || !res.assets?.[0]?.uri) return;
      const uri = res.assets[0].uri;
      // Read as base64
      const info = await FileSystem.getInfoAsync(uri);
      if (info.size && info.size > 8 * 1024 * 1024) {
        Alert.alert('Too large', 'Video must be under 8MB. Shorter clip please.');
        return;
      }
      const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      const dur = res.assets[0].duration || 0;
      await send('video', b64, { dur_ms: dur, ext: 'mp4' });
    } catch (e: any) { Alert.alert('Video failed', String(e?.message || e)); }
  };

  // === LIVE CALL MODE ===
  // Continuous 2.5-sec audio chunk recording → encrypted broadcast.
  // All channel members with the app open hear the call automatically.
  const [liveCallOn, setLiveCallOn] = useState(false);
  const liveRecRef = useRef<Audio.Recording | null>(null);
  const liveActiveRef = useRef(false);

  const stopLiveCall = useCallback(async () => {
    liveActiveRef.current = false;
    setLiveCallOn(false);
    try { await liveRecRef.current?.stopAndUnloadAsync(); } catch {}
    liveRecRef.current = null;
    await send('text', '📞 CALL ENDED', {});
  }, []);

  const liveLoop = useCallback(async () => {
    if (!liveActiveRef.current) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.LOW_QUALITY);
      await rec.startAsync();
      liveRecRef.current = rec;
      await new Promise(r => setTimeout(r, 2500));
      if (!liveActiveRef.current) { try { await rec.stopAndUnloadAsync(); } catch {} return; }
      try { await rec.stopAndUnloadAsync(); } catch {}
      const uri = rec.getURI();
      const status: any = await rec.getStatusAsync().catch(() => ({}));
      if (uri) {
        try {
          const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
          await send('live', b64, { audio_ms: status?.durationMillis || 2500 });
        } catch {}
      }
    } catch (e) { void ('live loop', e); }
    if (liveActiveRef.current) setTimeout(liveLoop, 50);
  }, []);

  const startLiveCall = async () => {
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) { Alert.alert('Mic permission required'); return; }
    if (recording) { Alert.alert('Stop PTT first'); return; }
    liveActiveRef.current = true;
    setLiveCallOn(true);
    await send('text', '📞 LIVE CALL STARTED', {});
    liveLoop();
  };

  // Auto-play incoming live-call audio chunks
  useEffect(() => {
    if (!messages.length) return;
    const latest = messages[messages.length - 1];
    if (latest.kind !== 'live' || !latest.plaintext) return;
    if (latest.sender === me?.callsign) return; // don't echo own audio
    (async () => {
      try {
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
        const path = `${dir}live_${latest.id}.m4a`;
        await FileSystem.writeAsStringAsync(path, latest.plaintext!, { encoding: FileSystem.EncodingType.Base64 });
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, allowsRecordingIOS: false });
        const { sound } = await Audio.Sound.createAsync({ uri: path }, { shouldPlay: true });
        sound.setOnPlaybackStatusUpdate((s: any) => {
          if (s.didJustFinish || s.error) sound.unloadAsync().catch(() => {});
        });
      } catch (e) { void ('live playback', e); }
    })();
  }, [messages, me?.callsign]);

  const deleteMsg = async (m: DecodedMsg) => {
    if (!me) return;
    if (m.sender !== me.callsign) { Alert.alert('Cannot delete', 'You can only delete your own messages.'); return; }
    Alert.alert('Delete transmission?', 'This removes it for everyone in the channel.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          const r = await fetch(
            `${API}/dagrcmd/messages/${m.id}?callsign=${encodeURIComponent(me.callsign)}&auth_code=${encodeURIComponent(me.authCode)}`,
            { method: 'DELETE' }
          );
          if (!r.ok) throw new Error(await r.text());
          setMessages(prev => prev.filter(x => x.id !== m.id));
        } catch (e: any) { Alert.alert('Delete failed', String(e?.message || e)); }
      }},
    ]);
  };

  const deleteChannelFromHeader = () => {
    if (!me || !channel) return;
    const isOwner = channel.owner === me.callsign;
    Alert.alert(
      isOwner ? `DELETE ${channel.name}?` : `LEAVE ${channel.name}?`,
      isOwner
        ? 'You are the owner.\nThis will permanently delete the channel and ALL messages for every member.'
        : `You will leave this channel.\nOwner: ${channel.owner}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isOwner ? 'Delete' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              const r = await fetch(
                `${API}/dagrcmd/channels/${channel.id}?callsign=${encodeURIComponent(me.callsign)}&auth_code=${encodeURIComponent(me.authCode)}`,
                { method: 'DELETE' }
              );
              if (!r.ok) throw new Error(await r.text());
              router.replace('/dagrcmd/comms');
            } catch (e: any) { Alert.alert('Failed', String(e?.message || e)); }
          },
        },
      ]
    );
  };

  if (loading || !me || !channel) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={T.colors.red} style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} testID="ch-back" style={styles.iconBtn}>
          <Icon name="chevron-back" size={22} color={T.colors.textPrimary} />
        </Pressable>
        <Pressable
          onLongPress={deleteChannelFromHeader}
          delayLongPress={500}
          style={styles.headerCenter}
          testID="channel-title"
        >
          <Text style={styles.title}>{channel.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, {
              backgroundColor: wsStatus === 'open' ? T.colors.green
                : wsStatus === 'closed' ? T.colors.red : T.colors.amber,
            }]} />
            <Text style={styles.statusText}>
              {wsStatus === 'open' ? 'LIVE · E2E' : wsStatus === 'closed' ? 'OFFLINE' : 'CONNECTING'}
            </Text>
            <Text style={styles.statusMeta}> · {officers.length} OPS · HOLD TO {channel.owner === me.callsign ? 'DELETE' : 'LEAVE'}</Text>
          </View>
        </Pressable>
        <Pressable
          onPress={liveCallOn ? stopLiveCall : startLiveCall}
          style={[styles.callBtn, liveCallOn && styles.callBtnEnd]}
          testID="call-btn"
        >
          <Icon name={liveCallOn ? 'close' : 'radio'} size={18} color={T.colors.bg} />
          <Text style={[styles.callBtnText, liveCallOn && { color: T.colors.bg }]}>
            {liveCallOn ? 'END' : 'CALL'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => router.push(`/dagrcmd/video?ch=${channel.id}` as any)}
          style={styles.videoCallBtn}
          testID="video-call-btn"
        >
          <Icon name="play-circle" size={18} color="#fff" />
        </Pressable>
        <Pressable onPress={sendLocation} style={styles.iconBtn} testID="loc-btn">
          <Icon name="locate" size={20} color={T.colors.amber} />
        </Pressable>
      </View>

      {liveCallOn && (
        <View style={styles.callBar} testID="live-call-bar">
          <View style={styles.callDot} />
          <Text style={styles.callBarText}>📞 LIVE AUDIO CALL · BROADCASTING ENCRYPTED · TAP "END" TO HANG UP</Text>
        </View>
      )}

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
      >
        <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={{ padding: 12, gap: 6 }}>
          {messages.length === 0 && (
            <Text style={styles.emptyHint}>
              {'>'} CHANNEL OPEN. ALL TRAFFIC ENCRYPTED END-TO-END.{'\n'}
              {'>'} START WITH A TEXT, HOLD MIC TO TRANSMIT VOICE, TAP COMPASS TO PING POSITION.
            </Text>
          )}
          {messages.map((m) => {
            const mine = m.sender === me.callsign;
            const failed = m.plaintext === null;
            return (
              <View key={m.id} style={[styles.msgRow, mine && styles.msgRowMine]}>
                <Pressable
                  onLongPress={() => deleteMsg(m)}
                  delayLongPress={400}
                  style={[styles.msgBubble, mine ? styles.msgMine : styles.msgOther, failed && styles.msgFailed]}
                  testID={`bubble-${m.id}`}
                >
                  {!mine && <Text style={styles.msgSender}>{m.sender}</Text>}
                  {m.kind === 'text' && (
                    <Text style={styles.msgText}>{failed ? '[encrypted · undecryptable]' : m.plaintext}</Text>
                  )}
                  {m.kind === 'image' && !failed && m.plaintext && (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${m.plaintext}` }}
                      style={{ width: 200, height: 200, borderRadius: 6, marginVertical: 4 }}
                      resizeMode="cover"
                    />
                  )}
                  {m.kind === 'audio' && (
                    <Pressable onPress={() => playAudio(m)} style={styles.audioRow} testID={`audio-${m.id}`}>
                      <Icon name={playingId === m.id ? 'pause-circle' : 'play-circle'} size={26} color={T.colors.red} />
                      <View>
                        <Text style={styles.msgText}>VOICE TRANSMISSION</Text>
                        <Text style={styles.msgMeta}>{Math.round((m.meta?.audio_ms || 0) / 100) / 10}s · tap to replay</Text>
                      </View>
                    </Pressable>
                  )}
                  {m.kind === 'video' && !failed && m.plaintext && (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Icon name="play-circle" size={16} color={T.colors.amber} />
                        <Text style={styles.msgText}>VIDEO {(m.meta?.dur_ms ? `· ${Math.round(m.meta.dur_ms / 1000)}s` : '')}</Text>
                      </View>
                      <Pressable
                        onPress={async () => {
                          try {
                            const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
                            const path = `${dir}vid_${m.id}.${m.meta?.ext || 'mp4'}`;
                            const info = await FileSystem.getInfoAsync(path).catch(() => ({ exists: false }) as any);
                            if (!info.exists) {
                              await FileSystem.writeAsStringAsync(path, m.plaintext!, { encoding: FileSystem.EncodingType.Base64 });
                            }
                            const Sharing = await import('expo-sharing');
                            if (await Sharing.isAvailableAsync()) {
                              await Sharing.shareAsync(path, { mimeType: 'video/mp4' });
                            }
                          } catch (e: any) { Alert.alert('Video failed', String(e?.message || e)); }
                        }}
                        style={styles.videoBox}
                      >
                        <Text style={styles.videoText}>▶ OPEN VIDEO</Text>
                      </Pressable>
                    </View>
                  )}
                  {m.kind === 'live' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Icon name="radio" size={16} color={T.colors.green} />
                      <Text style={styles.msgText}>LIVE CALL · {Math.round(((m.meta?.audio_ms || 2500) / 100)) / 10}s</Text>
                    </View>
                  )}
                  {m.kind === 'location' && !failed && (() => {
                    try {
                      const loc = JSON.parse(m.plaintext!);
                      return (
                        <View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Icon name="location" size={16} color={T.colors.amber} />
                            <Text style={styles.msgText}>POSITION PING</Text>
                          </View>
                          <Text style={styles.coords}>{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</Text>
                          <Text style={styles.msgMeta}>± {loc.acc}m</Text>
                        </View>
                      );
                    } catch { return <Text style={styles.msgText}>[malformed location]</Text>; }
                  })()}
                  <Text style={styles.msgTime}>{new Date(m.timestamp).toLocaleTimeString()}{mine ? ' · hold to delete' : ''}</Text>
                </Pressable>
              </View>
            );
          })}
        </ScrollView>

        <View style={styles.inputBar}>
          <Pressable
            testID="ptt-btn"
            onPressIn={startRecording}
            onPressOut={stopRecording}
            style={[styles.pttBtn, recording && styles.pttBtnActive]}
          >
            <Icon name={recording ? 'radio' : 'mic'} size={22}
              color={recording ? T.colors.amber : T.colors.red} />
          </Pressable>
          <Pressable onPress={sendImage} testID="img-btn" style={styles.attachBtn}>
            <Icon name="add" size={18} color={T.colors.amber} />
          </Pressable>
          <Pressable onPress={sendVideo} testID="vid-btn" style={styles.attachBtn}>
            <Icon name="play-circle" size={18} color={T.colors.amber} />
          </Pressable>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={recording ? 'TX LIVE · release to send…' : 'Encrypted message…'}
            placeholderTextColor={T.colors.textMuted}
            multiline
            testID="ch-input"
          />
          <Pressable
            testID="ch-send"
            disabled={!input.trim() || sending}
            onPress={sendText}
            style={[styles.sendBtn, (!input.trim() || sending) && { opacity: 0.4 }]}
          >
            <Icon name="send" size={18} color={T.colors.bg} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
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
  callBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: T.colors.green,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: T.radius.full,
  },
  callBtnEnd: { backgroundColor: T.colors.red },
  callBtnText: { color: T.colors.bg, fontFamily: T.fonts.bodyBold, fontSize: 11, letterSpacing: 1.5 },
  videoCallBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: T.colors.blue,
    alignItems: 'center', justifyContent: 'center',
  },
  headerCenter: { alignItems: 'center', flex: 1 },
  title: { color: T.colors.red, fontFamily: T.fonts.heading, fontSize: 16, letterSpacing: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, letterSpacing: 1.5 },
  statusMeta: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, letterSpacing: 1.5 },
  scroll: { flex: 1 },
  emptyHint: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 11, lineHeight: 18, marginTop: 32 },
  msgRow: { alignItems: 'flex-start' },
  msgRowMine: { alignItems: 'flex-end' },
  msgBubble: {
    maxWidth: '85%', paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: T.radius.sm, borderWidth: 1, marginVertical: 2,
  },
  msgMine: { backgroundColor: 'rgba(255,26,26,0.12)', borderColor: T.colors.borderActive },
  msgOther: { backgroundColor: T.colors.surface, borderColor: T.colors.border },
  msgFailed: { borderStyle: 'dashed', opacity: 0.6 },
  msgSender: { color: T.colors.amber, fontFamily: T.fonts.heading, fontSize: 10, letterSpacing: 1.5, marginBottom: 4 },
  msgText: { color: T.colors.textPrimary, fontFamily: T.fonts.mono, fontSize: 13, letterSpacing: 0.5, lineHeight: 18 },
  msgMeta: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, marginTop: 2 },
  msgTime: { color: T.colors.textMuted, fontFamily: T.fonts.mono, fontSize: 9, marginTop: 4, alignSelf: 'flex-end' },
  audioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  coords: { color: T.colors.amber, fontFamily: T.fonts.mono, fontSize: 13, marginTop: 4, letterSpacing: 1 },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 8, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: T.colors.border, backgroundColor: T.colors.surface,
  },
  pttBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: T.colors.bg, borderWidth: 1, borderColor: T.colors.borderActive,
    alignItems: 'center', justifyContent: 'center',
  },
  pttBtnActive: { backgroundColor: 'rgba(255,160,0,0.15)', borderColor: T.colors.amber },
  input: {
    flex: 1, minHeight: 48, maxHeight: 120,
    color: T.colors.textPrimary, fontFamily: T.fonts.mono, fontSize: 14,
    backgroundColor: T.colors.bg, borderWidth: 1, borderColor: T.colors.border,
    borderRadius: T.radius.sm, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10,
  },
  sendBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: T.colors.red,
    alignItems: 'center', justifyContent: 'center',
  },
  attachBtn: {
    width: 36, height: 48, alignItems: 'center', justifyContent: 'center',
  },
  callBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,255,102,0.12)', borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,255,102,0.4)',
    paddingHorizontal: 14, paddingVertical: 6,
  },
  callDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: T.colors.green },
  callBarText: { color: T.colors.green, fontFamily: T.fonts.mono, fontSize: 10, letterSpacing: 1.5 },
  videoBox: {
    marginTop: 6, backgroundColor: 'rgba(255,160,0,0.08)',
    borderWidth: 1, borderColor: T.colors.amber, borderRadius: T.radius.sm,
    paddingVertical: 10, paddingHorizontal: 14, alignItems: 'center',
  },
  videoText: { color: T.colors.amber, fontFamily: T.fonts.heading, fontSize: 12, letterSpacing: 2 },
});
