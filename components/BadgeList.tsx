import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase, UserBadge } from '../lib/supabase';
import { useTheme } from '../lib/theme';

function earnedLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BadgeList({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    (async () => {
      const { data } = await supabase
        .from('user_badges')
        .select('id, user_id, badge_name, icon, earned_at')
        .eq('user_id', userId)
        .order('earned_at', { ascending: true });
      if (!active) return;
      setBadges((data ?? []) as UserBadge[]);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`badges:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as UserBadge;
          setBadges((prev) => (prev.some((b) => b.id === row.id) ? prev : [...prev, row]));
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

  if (badges.length === 0) {
    return <Text style={[styles.empty, { color: colors.textMuted }]}>Noch keine Badges verdient.</Text>;
  }

  return (
    <View style={styles.wrap}>
      {badges.map((b) => (
        <View key={b.id} style={[styles.item, { backgroundColor: colors.cardAlt }]}>
          <Text style={styles.icon}>{b.icon}</Text>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.text }]}>{b.badge_name}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>
              Verdient am {earnedLabel(b.earned_at)}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  empty: { fontSize: 13, paddingVertical: 4 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 12, padding: 10 },
  icon: { fontSize: 24 },
  info: { flex: 1 },
  name: { fontSize: 14, fontWeight: '700' },
  date: { fontSize: 12, marginTop: 1 },
});
