import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Profile } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import GamingSessions from './GamingSessions';
import Squads from './Squads';

type SubTab = 'sessions' | 'squads';

const PROFILE_COLS =
  'id, username, is_online, games, theme, last_seen, created_at, updated_at, status_emoji, status_text, bio, is_active';

export default function GamingHub({
  session,
  username,
}: {
  session: Session;
  username: string | null;
}) {
  const { colors } = useTheme();
  const [sub, setSub] = useState<SubTab>('sessions');
  const [profiles, setProfiles] = useState<Profile[]>([]);

  const loadProfiles = useCallback(async () => {
    const { data } = await supabase.from('profiles').select(PROFILE_COLS);
    setProfiles((data ?? []) as Profile[]);
  }, []);

  useEffect(() => {
    loadProfiles();

    const channel = supabase
      .channel('gaming-hub:profiles')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (p) => {
        const row = p.new as Profile;
        setProfiles((prev) => prev.map((pr) => (pr.id === row.id ? row : pr)));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [loadProfiles]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Sub-tab toggle */}
      <View style={[styles.segHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Text style={[styles.heading, { color: colors.text }]}>Gaming</Text>
        <View style={[styles.segment, { backgroundColor: colors.cardAlt }]}>
          <Pressable
            style={[styles.segBtn, sub === 'sessions' && { backgroundColor: colors.primary }]}
            onPress={() => setSub('sessions')}
          >
            <Text style={[styles.segText, { color: sub === 'sessions' ? colors.primaryText : colors.textMuted }]}>
              🎮 Sessions
            </Text>
          </Pressable>
          <Pressable
            style={[styles.segBtn, sub === 'squads' && { backgroundColor: colors.primary }]}
            onPress={() => setSub('squads')}
          >
            <Text style={[styles.segText, { color: sub === 'squads' ? colors.primaryText : colors.textMuted }]}>
              👥 Squads
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.content}>
        {sub === 'sessions' ? (
          <GamingSessions session={session} username={username} profiles={profiles} />
        ) : (
          <Squads session={session} username={username} profiles={profiles} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  segHeader: {
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 12 : 44,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  heading: { fontSize: 22, fontWeight: '700' },
  segment: { flexDirection: 'row', borderRadius: 10, padding: 3, alignSelf: 'flex-start' },
  segBtn: { borderRadius: 8, paddingHorizontal: 16, paddingVertical: 7 },
  segText: { fontSize: 14, fontWeight: '700' },
  content: { flex: 1 },
});
