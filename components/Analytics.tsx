import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '../lib/theme';
import { getAnalyticsSummary, AnalyticsSummary } from '../lib/analytics';

export default function Analytics({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    (async () => {
      const s = await getAnalyticsSummary();
      if (active) {
        setSummary(s);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [visible]);

  const maxDay = summary ? Math.max(1, ...summary.eventsPerDay.map((d) => d.count)) : 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.topBar, { borderBottomColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>📊 Analytics</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={[styles.close, { color: colors.primary }]}>Schließen</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={colors.text} />
          </View>
        ) : !summary ? (
          <View style={styles.loader}>
            <Text style={{ color: colors.textMuted }}>Keine Daten verfügbar.</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            {/* Stat cards */}
            <View style={styles.statGrid}>
              <Stat label="Unique Visitors (7 Tage)" value={String(summary.uniqueVisitors7d)} colors={colors} />
              <Stat label="Total Events" value={String(summary.totalEvents)} colors={colors} />
              <Stat label="Active Users (heute)" value={String(summary.activeUsersToday)} colors={colors} />
              <Stat
                label="Ø Session-Dauer"
                value={`${summary.avgSessionMinutes.toFixed(1)} min`}
                colors={colors}
              />
            </View>

            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Meistgenutztes Feature</Text>
              <Text style={[styles.bigValue, { color: colors.text }]}>
                {summary.mostUsedFeature ?? '—'}
              </Text>
            </View>

            {/* Events per day bar chart (last 14 days) */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Events pro Tag (14 Tage)</Text>
              <View style={styles.chart}>
                {summary.eventsPerDay.map((d) => (
                  <View key={d.date} style={styles.barCol}>
                    <Text style={[styles.barCount, { color: colors.textMuted }]}>
                      {d.count > 0 ? d.count : ''}
                    </Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${Math.round((d.count / maxDay) * 100)}%` as `${number}%`,
                            backgroundColor: colors.primary,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: colors.textMuted }]} numberOfLines={1}>
                      {d.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Feature usage table */}
            <View style={[styles.card, { backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Feature Usage (Top 10)</Text>
              {summary.featureUsage.length === 0 ? (
                <Text style={{ color: colors.textMuted }}>Noch keine Events.</Text>
              ) : (
                summary.featureUsage.map((f) => (
                  <View key={f.type} style={styles.usageRow}>
                    <View style={styles.usageHeader}>
                      <Text style={[styles.usageLabel, { color: colors.text }]} numberOfLines={1}>
                        {f.label}
                      </Text>
                      <Text style={[styles.usageCount, { color: colors.textMuted }]}>
                        {f.count} · {f.pct}%
                      </Text>
                    </View>
                    <View style={[styles.usageTrack, { backgroundColor: colors.cardAlt }]}>
                      <View
                        style={[
                          styles.usageFill,
                          { width: `${f.pct}%` as `${number}%`, backgroundColor: colors.primary },
                        ]}
                      />
                    </View>
                  </View>
                ))
              )}
            </View>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function Stat({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.card }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: Platform.OS === 'web' ? 16 : 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '700' },
  close: { fontSize: 15, fontWeight: '600' },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: 16, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: {
    flexGrow: 1,
    flexBasis: '45%',
    borderRadius: 14,
    padding: 16,
    gap: 4,
  },
  statValue: { fontSize: 26, fontWeight: '800' },
  statLabel: { fontSize: 12, fontWeight: '600' },

  card: { borderRadius: 14, padding: 16, gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  cardLabel: { fontSize: 12, fontWeight: '600' },
  bigValue: { fontSize: 22, fontWeight: '800' },

  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, height: 160 },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: 2 },
  barCount: { fontSize: 9 },
  barTrack: { width: '70%', flex: 1, justifyContent: 'flex-end' },
  barFill: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3, minHeight: 2 },
  barLabel: { fontSize: 8 },

  usageRow: { gap: 4 },
  usageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  usageLabel: { fontSize: 13, fontWeight: '600', flex: 1 },
  usageCount: { fontSize: 12, fontWeight: '600' },
  usageTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  usageFill: { height: '100%', borderRadius: 4, minWidth: 2 },
});
