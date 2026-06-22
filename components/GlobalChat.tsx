import { useEffect, useRef, useState } from 'react';
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

import { supabase, ChatMessage } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import { checkAndUnlockAchievements } from '../lib/achievements';
import { clockTime } from '../lib/time';

const PAGE = 50;

export default function GlobalChat({
  session,
  username,
}: {
  session: Session;
  username: string | null;
}) {
  const { colors } = useTheme();
  const { openProfile } = useNav();

  // Newest first (FlatList is inverted, so newest renders at the bottom).
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, user_id, username, content, created_at')
        .order('created_at', { ascending: false })
        .limit(PAGE);
      if (!active) return;
      const rows = (data ?? []) as ChatMessage[];
      rows.forEach((m) => seen.current.add(m.id));
      setMessages(rows);
      setHasMore(rows.length === PAGE);
      setLoading(false);
    })();

    const channel = supabase
      .channel('public:chat_messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const row = payload.new as ChatMessage;
          if (seen.current.has(row.id)) return;
          seen.current.add(row.id);
          setMessages((prev) => [row, ...prev]);
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function loadMore() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1].created_at;
    const { data } = await supabase
      .from('chat_messages')
      .select('id, user_id, username, content, created_at')
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(PAGE);
    const rows = (data ?? []) as ChatMessage[];
    rows.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => [...prev, ...rows]);
    setHasMore(rows.length === PAGE);
    setLoadingMore(false);
  }

  async function send() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);

    // Optimistic message with a temporary id.
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      user_id: session.user.id,
      username,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);
    setText('');

    const { data, error } = await supabase
      .from('chat_messages')
      .insert({ user_id: session.user.id, username, content })
      .select('id, user_id, username, content, created_at')
      .single();

    if (error || !data) {
      // revert
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setText(content);
    } else {
      const row = data as ChatMessage;
      seen.current.add(row.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? row : m)));
      logActivity(session.user.id, 'chat', content.slice(0, 60));
      checkAndUnlockAchievements(session.user.id, 'chat');
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

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={messages}
        inverted
        keyExtractor={(m) => m.id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={colors.textMuted} style={{ marginVertical: 12 }} /> : null
        }
        renderItem={({ item }) => {
          const mine = item.user_id === session.user.id;
          return (
            <View style={[styles.msgRow, mine ? styles.msgRowMine : styles.msgRowOther]}>
              <View
                style={[
                  styles.bubble,
                  { backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther },
                ]}
              >
                {!mine ? (
                  <Pressable onPress={() => openProfile(item.user_id)}>
                    <Text style={[styles.author, { color: colors.bubbleOtherText }]}>
                      {item.username?.trim() || 'Unbenannt'}
                    </Text>
                  </Pressable>
                ) : null}
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
          placeholder="Nachricht an alle…"
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

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1, width: '100%' },
  listContent: { padding: 12, gap: 8, maxWidth: 640, width: '100%', alignSelf: 'center' },
  msgRow: { width: '100%', flexDirection: 'row' },
  msgRowMine: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  author: { fontSize: 12, fontWeight: '700', marginBottom: 2, opacity: 0.9 },
  bubbleText: { fontSize: 15 },
  time: { fontSize: 10, marginTop: 4, opacity: 0.7, alignSelf: 'flex-end' },
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
