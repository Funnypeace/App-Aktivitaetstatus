import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getCompatibilityScore, calcCompatibility } from '../lib/compatibility';
import { useTheme } from '../lib/theme';

type Props =
  | { selfId: string; otherId: string; compact?: boolean; gamesA?: undefined; gamesB?: undefined }
  | { selfId: string; otherId: string; compact?: boolean; gamesA: string[]; gamesB: string[] };

export default function CompatibilityBadge({ selfId, otherId, compact = false, gamesA, gamesB }: Props) {
  const { colors } = useTheme();
  const [score, setScore] = useState<number | null>(null);

  useEffect(() => {
    if (selfId === otherId) return;
    if (gamesA !== undefined && gamesB !== undefined) {
      setScore(calcCompatibility(gamesA, gamesB).score);
    } else {
      getCompatibilityScore(selfId, otherId).then(({ score: s }) => setScore(s));
    }
  }, [selfId, otherId, gamesA, gamesB]);

  if (score === null || selfId === otherId) return null;

  const isPerfect = score === 100;
  const scoreColor = isPerfect
    ? '#D97706'
    : score >= 70
    ? colors.online
    : score >= 40
    ? colors.primary
    : colors.textMuted;

  if (compact) {
    if (score < 40) return null;
    return (
      <View style={[styles.badge, { backgroundColor: isPerfect ? '#FEF3C7' : colors.cardAlt }]}>
        <Text style={[styles.badgeText, { color: scoreColor }]}>
          {isPerfect ? '🏆' : '🎮'} {score}%
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: isPerfect ? '#FEF9E6' : colors.cardAlt }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>Gaming Compatibility</Text>
      <Text style={[styles.score, { color: scoreColor }]}>
        {isPerfect ? '🏆 Perfect Match! 100%' : `🎮 ${score}%`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, padding: 10, gap: 2 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  score: { fontSize: 20, fontWeight: '700' },
  badge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
