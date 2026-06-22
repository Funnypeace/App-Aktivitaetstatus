import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { supabase, ActivityEvent } from '../lib/supabase';
import { activityTypeLabel } from '../lib/activity';
import { timeAgo } from '../lib/time';
import { useTheme } from '../lib/theme';

// Shows the latest 10 activity events for a user. Self-contained: loads on
// mount and subscribes to live inserts for that user.
export default function ActivityLog({ userId }: { userId: string }) {
  const { colors } = useTheme();
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('activity_events')
        .select('id, user_id, type, details, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);
      if (active) {
        setEvents((data ?? []) as ActivityEvent[]);
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel(`activity:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'activity_events', filter: `user_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as ActivityEvent;
          setEvents((prev) => [row, ...prev].slice(0, 10));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <View style={styles.wrap}>
      {loading ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Lädt…</Text>
      ) : events.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Noch keine Aktivität.</Text>
      ) : (
        events.map((e) => (
          <View key={e.id} style={[styles.row, { borderBottomColor: colors.border }]}>
            <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(e.created_at)}</Text>
            <View style={styles.detailWrap}>
              <Text style={[styles.type, { color: colors.text }]}>{activityTypeLabel(e.type)}</Text>
              {e.details ? (
                <Text style={[styles.detail, { color: colors.textMuted }]} numberOfLines={1}>
                  {e.details}
                </Text>
              ) : null}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
  empty: {
    fontSize: 13,
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  time: {
    fontSize: 12,
    width: 96,
  },
  detailWrap: {
    flex: 1,
  },
  type: {
    fontSize: 13,
    fontWeight: '600',
  },
  detail: {
    fontSize: 12,
    marginTop: 1,
  },
});
