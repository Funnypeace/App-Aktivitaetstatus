import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase, Achievement, UserAchievement } from '../lib/supabase';
import { useTheme } from '../lib/theme';

export default function AchievementList({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const [{ data: achs }, { data: ua }] = await Promise.all([
        supabase.from('achievements').select('id, name, description, icon, condition'),
        supabase.from('user_achievements').select('achievement_id').eq('user_id', userId),
      ]);
      if (!active) return;
      setAchievements((achs ?? []) as Achievement[]);
      setUnlocked(new Set((ua ?? []).map((u) => (u as { achievement_id: string }).achievement_id)));
      setLoading(false);
    })();

    const channel = supabase
      .channel(`userachievements:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_achievements', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as UserAchievement;
          setUnlocked((prev) => new Set([...prev, row.achievement_id]));
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

  const unlockedCount = achievements.filter((a) => unlocked.has(a.id)).length;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.progress, { color: colors.textMuted }]}>
        {unlockedCount} / {achievements.length} freigeschaltet
      </Text>
      <View style={styles.grid}>
        {achievements.map((ach) => {
          const isUnlocked = unlocked.has(ach.id);
          return (
            <View
              key={ach.id}
              style={[
                styles.item,
                {
                  backgroundColor: isUnlocked ? colors.card : colors.cardAlt,
                  borderColor: isUnlocked ? colors.primary : colors.border,
                  opacity: isUnlocked ? 1 : 0.45,
                },
              ]}
            >
              <Text style={styles.icon}>{ach.icon}</Text>
              <Text style={[styles.achName, { color: colors.text }]} numberOfLines={1}>
                {ach.name}
              </Text>
              <Text style={[styles.achDesc, { color: colors.textMuted }]} numberOfLines={2}>
                {ach.description}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  empty: { fontSize: 13, paddingVertical: 4 },
  progress: { fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  item: {
    width: '47%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 3,
  },
  icon: { fontSize: 22 },
  achName: { fontSize: 12, fontWeight: '700' },
  achDesc: { fontSize: 11 },
});
