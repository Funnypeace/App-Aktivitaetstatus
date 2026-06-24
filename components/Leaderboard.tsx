import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { getTopRatedGames } from '../lib/reviews';

type Row = { user_id: string; username: string | null; score: number };
type BoardKey = 'activity' | 'achievements' | 'games' | 'social' | 'oldest' | 'level' | 'rated';

const BOARDS: { key: BoardKey; label: string; rpc?: string; unit: string }[] = [
  { key: 'activity',     label: 'Aktiv.',  rpc: 'leaderboard_activity',     unit: 'Events' },
  { key: 'achievements', label: 'Achiev.', rpc: 'leaderboard_achievements', unit: 'Badges' },
  { key: 'games',        label: 'Spiele',  rpc: 'leaderboard_games',        unit: 'Sessions' },
  { key: 'social',       label: 'Social',  rpc: 'leaderboard_social',       unit: 'Nachrichten' },
  { key: 'oldest',       label: 'Älteste', rpc: 'leaderboard_oldest',       unit: '' },
  { key: 'level',        label: 'Level',   unit: 'Level' },
  { key: 'rated',        label: 'Rating',  unit: '' },
];

export default function Leaderboard({ session }: { session: Session }) {
  const { colors } = useTheme();
  const { openProfile } = useNav();
  const myId = session.user.id;

  const [active, setActive] = useState<BoardKey>('activity');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    const board = BOARDS.find((b) => b.key === active)!;

    if (active === 'level') {
      supabase
        .from('profiles')
        .select('id, username, level, xp')
        .order('level', { ascending: false })
        .order('xp', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          if (!mounted) return;
          setRows(
            (data ?? []).map((r: Record<string, unknown>) => ({
              user_id: r.id as string,
              username: r.username as string | null,
              score: Number(r.level),
            }))
          );
          setLoading(false);
        });
    } else if (active === 'rated') {
      getTopRatedGames(20).then((games) => {
        if (!mounted) return;
        setRows(
          games.map((g) => ({
            user_id: g.game_name,
            username: `${g.game_name}  (${g.count}×)`,
            score: g.avg,
          }))
        );
        setLoading(false);
      });
    } else if (board.rpc) {
      supabase
        .rpc(board.rpc, { p_limit: 20 })
        .then(({ data }) => {
          if (!mounted) return;
          setRows(
            (data ?? []).map((r: Record<string, unknown>) => ({
              user_id: r.user_id as string,
              username: r.username as string | null,
              score: Number(r.score),
            }))
          );
          setLoading(false);
        });
    }

    return () => {
      mounted = false;
    };
  }, [active]);

  const board = BOARDS.find((b) => b.key === active)!;

  function formatScore(row: Row): string {
    if (board.key === 'oldest') {
      return new Date(row.score * 1000).toLocaleDateString('de-DE', {
        month: 'short',
        year: 'numeric',
      });
    }
    if (board.key === 'level') return `Level ${row.score}`;
    if (board.key === 'rated') return `⭐ ${row.score.toFixed(1)}`;
    return `${row.score} ${board.unit}`;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Text style={[styles.heading, { color: colors.text }]}>Rangliste</Text>

      <View style={[styles.tabBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {BOARDS.map((b) => (
          <Pressable
            key={b.key}
            style={[styles.tabItem, active === b.key && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActive(b.key)}
          >
            <Text style={[styles.tabLabel, { color: active === b.key ? colors.primary : colors.tabInactive }]}>
              {b.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={rows}
          keyExtractor={(r) => r.user_id}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>Noch keine Einträge.</Text>
          }
          renderItem={({ item, index }) => {
            const isMe = item.user_id === myId;
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
            return (
              <Pressable
                style={[
                  styles.row,
                  { backgroundColor: isMe ? colors.chipBg : colors.card },
                  isMe && { borderWidth: 1, borderColor: colors.primary },
                ]}
                onPress={() => { if (board.key !== 'rated') openProfile(item.user_id); }}
              >
                <Text style={[styles.rankText, { color: colors.textMuted }]}>
                  {medal ?? `${index + 1}.`}
                </Text>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {item.username ?? 'Unbenannt'}
                  {isMe ? ' (Du)' : ''}
                </Text>
                <Text style={[styles.scoreText, { color: colors.primary }]}>
                  {formatScore(item)}
                </Text>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 12,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8, maxWidth: 560, width: '100%', alignSelf: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 0,
  },
  rankText: { width: 30, fontSize: 16, fontWeight: '700' },
  rowName: { flex: 1, fontSize: 15, fontWeight: '500' },
  scoreText: { fontSize: 13, fontWeight: '600' },
  empty: { textAlign: 'center', fontSize: 14, paddingVertical: 32 },
});
