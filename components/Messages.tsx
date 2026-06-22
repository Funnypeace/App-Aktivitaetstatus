import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Message, Profile } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import { clockTime, timeAgo } from '../lib/time';

function nameOf(p: Profile | undefined, id: string): string {
  const n = p?.username?.trim();
  return n || `Unbenannt (${id.slice(0, 8)})`;
}

export default function Messages({
  session,
  username,
  requestedPeer,
  onConsumedPeer,
}: {
  session: Session;
  username: string | null;
  requestedPeer: string | null;
  onConsumedPeer: () => void;
}) {
  const { colors } = useTheme();
  const { openProfile } = useNav();
  const myId = session.user.id;

  const [profilesById, setProfilesById] = useState<Record<string, Profile>>({});
  const [messages, setMessages] = useState<Message[]>([]); // all my DMs, newest first
  const [loading, setLoading] = useState(true);
  const [peer, setPeer] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const loadAll = useCallback(async () => {
    const [{ data: profs }, { data: msgs }] = await Promise.all([
      supabase.from('profiles').select('id, username, is_online, games, theme, last_seen, created_at, updated_at'),
      supabase
        .from('messages')
        .select('id, sender_id, recipient_id, content, read, created_at')
        .order('created_at', { ascending: false }),
    ]);
    const map: Record<string, Profile> = {};
    (profs ?? []).forEach((p) => (map[(p as Profile).id] = p as Profile));
    setProfilesById(map);
    const rows = (msgs ?? []) as Message[];
    rows.forEach((m) => seen.current.add(m.id));
    setMessages(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadAll();

    const channel = supabase
      .channel('public:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string }).id;
            setMessages((prev) => prev.filter((m) => m.id !== oldId));
            return;
          }
          const row = payload.new as Message;
          if (row.sender_id !== myId && row.recipient_id !== myId) return;
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === row.id);
            if (exists) return prev.map((m) => (m.id === row.id ? row : m));
            seen.current.add(row.id);
            return [row, ...prev];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAll, myId]);

  const markRead = useCallback(
    async (peerId: string) => {
      const unread = messages.filter(
        (m) => m.sender_id === peerId && m.recipient_id === myId && !m.read
      );
      if (unread.length === 0) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender_id === peerId && m.recipient_id === myId && !m.read ? { ...m, read: true } : m
        )
      );
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('sender_id', peerId)
        .eq('recipient_id', myId)
        .eq('read', false);
    },
    [messages, myId]
  );

  function openConversation(peerId: string) {
    setPeer(peerId);
    markRead(peerId);
  }

  // Handle an externally requested conversation (e.g. from a profile's "send message").
  useEffect(() => {
    if (requestedPeer) {
      setPeer(requestedPeer);
      markRead(requestedPeer);
      onConsumedPeer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedPeer]);

  const conversations = useMemo(() => {
    const map = new Map<string, { peerId: string; last: Message; unread: number }>();
    for (const m of messages) {
      const peerId = m.sender_id === myId ? m.recipient_id : m.sender_id;
      const incomingUnread = m.recipient_id === myId && !m.read;
      const entry = map.get(peerId);
      if (!entry) {
        map.set(peerId, { peerId, last: m, unread: incomingUnread ? 1 : 0 });
      } else {
        if (new Date(m.created_at) > new Date(entry.last.created_at)) entry.last = m;
        if (incomingUnread) entry.unread += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if ((a.unread > 0) !== (b.unread > 0)) return a.unread > 0 ? -1 : 1;
      return nameOf(profilesById[a.peerId], a.peerId).localeCompare(
        nameOf(profilesById[b.peerId], b.peerId)
      );
    });
  }, [messages, myId, profilesById]);

  const thread = useMemo(
    () =>
      peer
        ? messages.filter(
            (m) =>
              (m.sender_id === myId && m.recipient_id === peer) ||
              (m.sender_id === peer && m.recipient_id === myId)
          )
        : [],
    [messages, peer, myId]
  );

  async function send() {
    const content = text.trim();
    if (!content || !peer || sending) return;
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      sender_id: myId,
      recipient_id: peer,
      content,
      read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);
    setText('');

    const { data, error } = await supabase
      .from('messages')
      .insert({ sender_id: myId, recipient_id: peer, content })
      .select('id, sender_id, recipient_id, content, read, created_at')
      .single();

    if (error || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(content);
    } else {
      const row = data as Message;
      seen.current.add(row.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? row : m)));
      const peerName = nameOf(profilesById[peer], peer);
      logActivity(myId, 'message', `an ${peerName}`);
    }
    setSending(false);
  }

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  // --- Chat view ---
  if (peer) {
    const peerProfile = profilesById[peer];
    return (
      <KeyboardAvoidingView
        style={[styles.screen, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.chatHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Pressable onPress={() => setPeer(null)} style={styles.backBtn}>
            <Text style={[styles.backText, { color: colors.primary }]}>‹ Zurück</Text>
          </Pressable>
          <Pressable onPress={() => openProfile(peer)} style={styles.chatTitleWrap}>
            <View
              style={[
                styles.dot,
                { backgroundColor: peerProfile?.is_online ? colors.online : colors.offline },
              ]}
            />
            <Text style={[styles.chatTitle, { color: colors.text }]} numberOfLines={1}>
              {nameOf(peerProfile, peer)}
            </Text>
          </Pressable>
          <View style={styles.backBtn} />
        </View>

        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={thread}
          inverted
          keyExtractor={(m) => m.id}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Noch keine Nachrichten. Sag Hallo! 👋
            </Text>
          }
          renderItem={({ item }) => {
            const mine = item.sender_id === myId;
            return (
              <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
                <View
                  style={[
                    styles.bubble,
                    { backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther },
                  ]}
                >
                  <Text
                    style={[
                      styles.bubbleText,
                      { color: mine ? colors.bubbleMineText : colors.bubbleOtherText },
                    ]}
                  >
                    {item.content}
                  </Text>
                  <Text
                    style={[
                      styles.time,
                      { color: mine ? colors.bubbleMineText : colors.bubbleOtherText },
                    ]}
                  >
                    {clockTime(item.created_at)}
                  </Text>
                </View>
              </View>
            );
          }}
        />

        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.text }]}
            placeholder="Nachricht schreiben…"
            placeholderTextColor={colors.textMuted}
            value={text}
            onChangeText={setText}
            multiline
            onSubmitEditing={send}
          />
          <Pressable
            style={[styles.sendBtn, { backgroundColor: colors.primary }, (!text.trim() || sending) && styles.disabled]}
            disabled={!text.trim() || sending}
            onPress={send}
          >
            <Text style={[styles.sendText, { color: colors.primaryText }]}>Senden</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // --- Conversation list ---
  return (
    <FlatList
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.convListContent}
      data={conversations}
      keyExtractor={(c) => c.peerId}
      ListHeaderComponent={
        <Text style={[styles.heading, { color: colors.text }]}>Nachrichten</Text>
      }
      ListEmptyComponent={
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Noch keine Konversationen. Öffne ein Profil und schreibe jemandem!
        </Text>
      }
      renderItem={({ item }) => {
        const p = profilesById[item.peerId];
        return (
          <Pressable
            style={[styles.convRow, { backgroundColor: colors.card }]}
            onPress={() => openConversation(item.peerId)}
          >
            <View
              style={[styles.dot, { backgroundColor: p?.is_online ? colors.online : colors.offline }]}
            />
            <View style={styles.convInfo}>
              <Text style={[styles.convName, { color: colors.text }]} numberOfLines={1}>
                {nameOf(p, item.peerId)}
              </Text>
              <Text style={[styles.convPreview, { color: colors.textMuted }]} numberOfLines={1}>
                {item.last.sender_id === myId ? 'Du: ' : ''}
                {item.last.content}
              </Text>
            </View>
            <View style={styles.convMeta}>
              <Text style={[styles.convTime, { color: colors.textMuted }]}>
                {timeAgo(item.last.created_at)}
              </Text>
              {item.unread > 0 ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.badgeText}>{item.unread}</Text>
                </View>
              ) : null}
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  convListContent: { padding: 16, maxWidth: 560, width: '100%', alignSelf: 'center' },
  heading: { fontSize: 22, fontWeight: '700', marginBottom: 12, paddingTop: Platform.OS === 'web' ? 8 : 40 },
  convRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  convInfo: { flex: 1 },
  convName: { fontSize: 16, fontWeight: '600' },
  convPreview: { fontSize: 13, marginTop: 2 },
  convMeta: { alignItems: 'flex-end', gap: 4 },
  convTime: { fontSize: 11 },
  badge: { minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'web' ? 12 : 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 80 },
  backText: { fontSize: 15, fontWeight: '600' },
  chatTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  chatTitle: { fontSize: 16, fontWeight: '700' },
  list: { flex: 1, width: '100%' },
  listContent: { padding: 12, gap: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  msgRow: { width: '100%', flexDirection: 'row' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleText: { fontSize: 15 },
  time: { fontSize: 10, marginTop: 4, opacity: 0.7, alignSelf: 'flex-end' },
  empty: { textAlign: 'center', fontSize: 14, paddingVertical: 32 },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 15,
    maxHeight: 120,
  },
  sendBtn: { borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, justifyContent: 'center' },
  sendText: { fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.5 },
});
