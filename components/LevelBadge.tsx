import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../lib/theme';
import { xpNeededForLevel } from '../lib/xp';

type Props = {
  level: number;
  xp: number;
  xp_to_next_level: number;
  compact?: boolean;
};

export default function LevelBadge({ level, xp, xp_to_next_level, compact = false }: Props) {
  const { colors } = useTheme();

  if (compact) {
    return (
      <View style={[styles.compactWrap, { backgroundColor: colors.chipBg }]}>
        <Text style={[styles.compactText, { color: colors.primary }]}>⭐ Lv.{level}</Text>
      </View>
    );
  }

  const xpForCurrentLevel = xpNeededForLevel(level);
  const xpRange = xp_to_next_level - xpForCurrentLevel;
  const xpProgress = xp - xpForCurrentLevel;
  const pct = xpRange > 0 ? Math.min(Math.round((xpProgress / xpRange) * 100), 100) : 100;

  return (
    <View style={styles.fullWrap}>
      <View style={styles.labelRow}>
        <Text style={[styles.levelLabel, { color: colors.text }]}>⭐ Level {level}</Text>
        <Text style={[styles.xpLabel, { color: colors.textMuted }]}>
          {xp} / {xp_to_next_level} XP
        </Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <View
          style={[
            styles.barFill,
            {
              backgroundColor: colors.primary,
              width: `${pct}%` as `${number}%`,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  compactWrap: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  compactText: { fontSize: 11, fontWeight: '700' },
  fullWrap: { gap: 6 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  levelLabel: { fontSize: 16, fontWeight: '700' },
  xpLabel: { fontSize: 12 },
  barTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
});
