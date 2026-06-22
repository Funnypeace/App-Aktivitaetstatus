import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase, GameStat } from '../lib/supabase';
import { fetchGameStats } from '../lib/stats';
import { useTheme } from '../lib/theme';

export default function GameStats({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const [stats, setStats] = useState<GameStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchGameStats(userId, 5).then((data) => {
      if (active) {
        setStats(data);
        setLoading(false);
      }
    });

    const channel = supabase
      .channel(`gamestats:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_game_statistics', filter: `user_id=eq.${userId}` },
        () => {
          fetchGameStats(userId, 5).then((data) => {
            if (active) setStats(data);
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  if (loading) {
    return <Text style={[styles.empty, { color: colors.textMuted }]}>Lädt…</Text>;
  }

  if (stats.length === 0) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Noch keine Spielstatistiken vorhanden.
      </Text>
    );
  }

  const max = Math.max(stats[0]?.select_count ?? 1, 1);

  return (
    <View style={styles.wrap}>
      {stats.map((stat, i) => {
        const pct = Math.round((stat.select_count / max) * 100);
        return (
          <View key={stat.id} style={styles.row}>
            <View style={styles.labelRow}>
              <Text style={[styles.rank, { color: colors.textMuted }]}>{i + 1}.</Text>
              <Text style={[styles.gameName, { color: colors.text }]} numberOfLines={1}>
                {stat.game_name}
              </Text>
              {i === 0 ? <Text style={styles.badge}>⭐</Text> : null}
              <Text style={[styles.count, { color: colors.textMuted }]}>{stat.select_count}×</Text>
            </View>
            <View style={[styles.barBg, { backgroundColor: colors.cardAlt }]}>
              <View
                style={[styles.barFill, { backgroundColor: colors.primary, width: `${pct}%` as `${number}%` }]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  empty: { fontSize: 13, paddingVertical: 4 },
  row: { gap: 4 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rank: { fontSize: 12, width: 18 },
  gameName: { flex: 1, fontSize: 13, fontWeight: '600' },
  badge: { fontSize: 14 },
  count: { fontSize: 12 },
  barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
});
