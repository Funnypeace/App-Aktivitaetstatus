import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { UserStreak } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { getUserStreak, getActivityHeatmap } from '../lib/streaks';

const WEEKS = 12;

function heatColor(count: number, border: string): string {
  if (count === 0) return border;
  if (count <= 3) return '#9be9a8';
  if (count <= 9) return '#40c463';
  return '#216e39';
}

function buildGrid(
  heatmap: Record<string, number>
): { date: string; count: number }[][] {
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - WEEKS * 7 + 1);

  const cols: { date: string; count: number }[][] = [];
  let col: { date: string; count: number }[] = [];

  for (let i = 0; i < WEEKS * 7; i++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    col.push({ date: key, count: heatmap[key] ?? 0 });
    if (col.length === 7) {
      cols.push(col);
      col = [];
    }
  }
  if (col.length) cols.push(col);
  return cols;
}

export default function Streaks({
  userId,
  visible,
  onClose,
}: {
  userId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [streak, setStreak] = useState<UserStreak | null>(null);
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let active = true;
    setLoading(true);
    Promise.all([getUserStreak(userId), getActivityHeatmap(userId, WEEKS)]).then(
      ([s, h]) => {
        if (!active) return;
        setStreak(s);
        setHeatmap(h);
        setLoading(false);
      }
    );
    return () => {
      active = false;
    };
  }, [visible, userId]);

  const grid = useMemo(() => buildGrid(heatmap), [heatmap]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.title, { color: colors.text }]}>🔥 Streak & Aktivität</Text>

          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.content}>
              <View style={[styles.statsRow, { backgroundColor: colors.cardAlt }]}>
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {streak?.current_streak ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    🔥 Aktuell
                  </Text>
                </View>
                <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {streak?.longest_streak ?? 0}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>
                    🏆 Längster
                  </Text>
                </View>
              </View>

              <Text style={[styles.heatLabel, { color: colors.textMuted }]}>
                Aktivität – letzte {WEEKS} Wochen
              </Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.grid}>
                  {grid.map((col, ci) => (
                    <View key={ci} style={styles.gridCol}>
                      {col.map((cell) => (
                        <View
                          key={cell.date}
                          style={[
                            styles.cell,
                            { backgroundColor: heatColor(cell.count, colors.border) },
                          ]}
                        />
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.legend}>
                <Text style={[styles.legendText, { color: colors.textMuted }]}>Weniger</Text>
                {[0, 1, 4, 10].map((v) => (
                  <View
                    key={v}
                    style={[styles.legendCell, { backgroundColor: heatColor(v, colors.border) }]}
                  />
                ))}
                <Text style={[styles.legendText, { color: colors.textMuted }]}>Mehr</Text>
              </View>
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
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  title: { fontSize: 20, fontWeight: '700' },
  loader: { padding: 40, alignItems: 'center' },
  content: { gap: 16 },
  statsRow: { flexDirection: 'row', borderRadius: 12, padding: 16 },
  statBox: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 32, fontWeight: '700' },
  statLabel: { fontSize: 13 },
  statDivider: { width: 1, marginVertical: 4 },
  heatLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: { flexDirection: 'row', gap: 3 },
  gridCol: { gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 2 },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    justifyContent: 'center',
  },
  legendText: { fontSize: 10 },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
  closeBtn: { alignItems: 'center', paddingVertical: 8 },
  closeText: { fontSize: 14, fontWeight: '500' },
});
