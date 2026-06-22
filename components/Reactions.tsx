import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '../lib/theme';
import { REACTION_EMOJIS, ReactionRow } from '../lib/reactions';

// Reaction bar for a single message. `reactions` are the rows for THIS target.
export default function Reactions({
  reactions,
  userId,
  onToggle,
  align = 'flex-start',
}: {
  reactions: ReactionRow[];
  userId: string;
  onToggle: (emoji: string) => void;
  align?: 'flex-start' | 'flex-end';
}) {
  const { colors } = useTheme();
  const [pickerOpen, setPickerOpen] = useState(false);

  const groups = useMemo(() => {
    const m = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const g = m.get(r.emoji) ?? { count: 0, mine: false };
      g.count += 1;
      if (r.user_id === userId) g.mine = true;
      m.set(r.emoji, g);
    }
    return Array.from(m.entries());
  }, [reactions, userId]);

  return (
    <View style={[styles.wrap, { justifyContent: align }]}>
      {groups.map(([emoji, g]) => (
        <Pressable
          key={emoji}
          onPress={() => onToggle(emoji)}
          style={[
            styles.chip,
            { backgroundColor: g.mine ? colors.chipBg : colors.cardAlt, borderColor: g.mine ? colors.primary : 'transparent' },
          ]}
        >
          <Text style={styles.chipEmoji}>{emoji}</Text>
          <Text style={[styles.chipCount, { color: g.mine ? colors.chipText : colors.textMuted }]}>
            {g.count}
          </Text>
        </Pressable>
      ))}

      <Pressable style={[styles.addBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setPickerOpen(true)}>
        <Text style={[styles.addText, { color: colors.textMuted }]}>＋</Text>
      </Pressable>

      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={() => setPickerOpen(false)}>
          <View style={[styles.picker, { backgroundColor: colors.card }]}>
            {REACTION_EMOJIS.map((e) => (
              <Pressable
                key={e}
                style={styles.pickerItem}
                onPress={() => {
                  onToggle(e);
                  setPickerOpen(false);
                }}
              >
                <Text style={styles.pickerEmoji}>{e}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  chipEmoji: { fontSize: 12 },
  chipCount: { fontSize: 11, fontWeight: '700' },
  addBtn: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  addText: { fontSize: 13, fontWeight: '700' },
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  picker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    borderRadius: 16,
    padding: 16,
    maxWidth: 320,
    justifyContent: 'center',
  },
  pickerItem: { padding: 8 },
  pickerEmoji: { fontSize: 28 },
});
