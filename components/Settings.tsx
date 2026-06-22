import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';

export default function Settings({ session }: { session: Session }) {
  const { colors, name, setTheme } = useTheme();
  const isDark = name === 'dark';

  async function toggleTheme(value: boolean) {
    await setTheme(value ? 'dark' : 'light', session.user.id);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Einstellungen</Text>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Darstellung</Text>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Dark Mode</Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              {isDark ? 'Dunkles Design aktiv' : 'Helles Design aktiv'}
            </Text>
          </View>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#d1d5db', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        <View style={styles.optionRow}>
          {(['light', 'dark'] as const).map((opt) => {
            const selected = name === opt;
            return (
              <Pressable
                key={opt}
                style={[
                  styles.option,
                  { borderColor: selected ? colors.primary : colors.border },
                  selected && { backgroundColor: colors.chipBg },
                ]}
                onPress={() => toggleTheme(opt === 'dark')}
              >
                <Text
                  style={[
                    styles.optionText,
                    { color: selected ? colors.chipText : colors.textMuted },
                  ]}
                >
                  {opt === 'light' ? '☀️ Hell' : '🌙 Dunkel'}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Konto</Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]}>{session.user.email}</Text>
        <Pressable style={[styles.signOut, { backgroundColor: colors.cardAlt }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: colors.danger }]}>Abmelden</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  content: {
    padding: 16,
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  heading: { fontSize: 22, fontWeight: '700' },
  card: { borderRadius: 16, padding: 20, gap: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowLabel: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowSub: { fontSize: 13, marginTop: 2 },
  optionRow: { flexDirection: 'row', gap: 10 },
  option: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  optionText: { fontSize: 14, fontWeight: '600' },
  signOut: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  signOutText: { fontSize: 15, fontWeight: '700' },
});
