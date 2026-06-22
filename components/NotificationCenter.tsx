import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { supabase, UserNotification } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { NOTIFICATION_META, NotificationType } from '../lib/notifications';
import { timeAgo } from '../lib/time';

function metaFor(type: string) {
  return (
    NOTIFICATION_META[type as NotificationType] ?? {
      icon: '🔔',
      accent: '#9CA3AF',
      defaultTitle: 'Benachrichtigung',
      category: 'social' as const,
    }
  );
}

export default function NotificationCenter({
  userId,
  visible,
  onClose,
}: {
  userId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    setItems((data ?? []) as UserNotification[]);
    setLoading(false);
  }

  useEffect(() => {
    if (visible) load();
  }, [visible]);

  async function markRead(id: string) {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    await supabase.from('user_notifications').update({ read: true }).eq('id', id);
  }

  async function markAllRead() {
    const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await supabase
      .from('user_notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);
  }

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>🔔 Benachrichtigungen</Text>
            {unreadCount > 0 ? (
              <Pressable onPress={markAllRead}>
                <Text style={[styles.markAll, { color: colors.primary }]}>Alle gelesen</Text>
              </Pressable>
            ) : null}
          </View>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Noch keine Benachrichtigungen.
            </Text>
          ) : (
            <ScrollView contentContainerStyle={styles.list}>
              {items.map((n) => {
                const meta = metaFor(n.type);
                return (
                  <Pressable
                    key={n.id}
                    style={[
                      styles.row,
                      { backgroundColor: colors.cardAlt, borderLeftColor: meta.accent },
                      !n.read && { borderLeftWidth: 4 },
                    ]}
                    onPress={() => !n.read && markRead(n.id)}
                  >
                    <Text style={styles.rowIcon}>{meta.icon}</Text>
                    <View style={styles.rowBody}>
                      <View style={styles.rowTitleLine}>
                        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                          {n.title}
                        </Text>
                        {!n.read ? (
                          <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                        ) : null}
                      </View>
                      <Text style={[styles.rowMsg, { color: colors.textMuted }]} numberOfLines={2}>
                        {n.message}
                      </Text>
                      <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                        {timeAgo(n.created_at)}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>Schließen</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 480, maxHeight: '85%', borderRadius: 16, overflow: 'hidden' },
  header: {
    padding: 20,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { fontSize: 20, fontWeight: '700' },
  markAll: { fontSize: 13, fontWeight: '600' },
  loader: { padding: 40, alignItems: 'center' },
  empty: { textAlign: 'center', fontSize: 14, paddingVertical: 32 },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 10,
    borderLeftWidth: 0,
    padding: 12,
  },
  rowIcon: { fontSize: 20, marginTop: 1 },
  rowBody: { flex: 1, gap: 2 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { fontSize: 14, fontWeight: '700', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  rowMsg: { fontSize: 13, lineHeight: 18 },
  rowTime: { fontSize: 11, marginTop: 2 },
  closeBtn: { alignItems: 'center', paddingVertical: 14 },
  closeText: { fontSize: 14, fontWeight: '500' },
});
