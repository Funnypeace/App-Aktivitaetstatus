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

import { supabase, Profile } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { memberSince, timeAgo } from '../lib/time';
import ActivityLog from './ActivityLog';
import GameStats from './GameStats';
import AchievementList from './AchievementList';

function gamesOf(profile: Profile): string[] {
  return Array.isArray(profile.games) ? profile.games : [];
}

export default function ProfileModal({
  userId,
  selfId,
  onClose,
  onSendMessage,
}: {
  userId: string | null;
  selfId: string;
  onClose: () => void;
  onSendMessage: (userId: string) => void;
}) {
  const { colors } = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, is_online, games, theme, last_seen, created_at, updated_at')
        .eq('id', userId)
        .single();
      if (active) {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const games = profile ? gamesOf(profile) : [];
  const name = profile?.username?.trim() || (profile ? `Unbenannt (${profile.id.slice(0, 8)})` : '');
  const isSelf = userId === selfId;

  return (
    <Modal
      visible={!!userId}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {loading || !profile ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={styles.headerRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: profile.is_online ? colors.online : colors.offline },
                  ]}
                />
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              <Text style={[styles.member, { color: colors.textMuted }]}>
                {memberSince(profile.created_at)}
              </Text>

              <Text style={[styles.status, { color: colors.text }]}>
                {profile.is_online ? '🟢 Online' : '⚪ Offline'}
              </Text>
              <Text style={[styles.lastSeen, { color: colors.textMuted }]}>
                Zuletzt gesehen {timeAgo(profile.last_seen)}
              </Text>

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Aktuelle Spiele</Text>
              {games.length > 0 ? (
                <View style={styles.chipRow}>
                  {games.map((g) => (
                    <View key={g} style={[styles.chip, { backgroundColor: colors.chipBg }]}>
                      <Text style={[styles.chipText, { color: colors.chipText }]}>{g}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={[styles.muted, { color: colors.textMuted }]}>Keine Spiele ausgewählt</Text>
              )}

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Gaming-Stats</Text>
              <GameStats userId={profile.id} />

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Achievements</Text>
              <AchievementList userId={profile.id} />

              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>
                Letzte Aktivität
              </Text>
              <ActivityLog userId={profile.id} />

              {!isSelf ? (
                <Pressable
                  style={[styles.sendBtn, { backgroundColor: colors.primary }]}
                  onPress={() => onSendMessage(profile.id)}
                >
                  <Text style={[styles.sendText, { color: colors.primaryText }]}>
                    Nachricht senden
                  </Text>
                </Pressable>
              ) : null}

              <Pressable style={styles.closeBtn} onPress={onClose}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>Schließen</Text>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '88%',
    borderRadius: 16,
    overflow: 'hidden',
  },
  loader: {
    padding: 48,
    alignItems: 'center',
  },
  content: {
    padding: 24,
    gap: 6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  name: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
  },
  member: {
    fontSize: 13,
  },
  status: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 10,
  },
  lastSeen: {
    fontSize: 13,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  chip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  muted: {
    fontSize: 13,
    marginTop: 2,
  },
  sendBtn: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  sendText: {
    fontWeight: '700',
    fontSize: 15,
  },
  closeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 4,
  },
  closeText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
