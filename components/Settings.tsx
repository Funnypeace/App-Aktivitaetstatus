import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import NotificationCenter from './NotificationCenter';

type NotifPrefs = {
  notifications_enabled: boolean;
  notif_levelup: boolean;
  notif_quests: boolean;
  notif_messages: boolean;
  notif_sound: boolean;
  notif_vibration: boolean;
};

const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  notifications_enabled: true,
  notif_levelup: true,
  notif_quests: true,
  notif_messages: true,
  notif_sound: true,
  notif_vibration: true,
};

const STATUS_EMOJIS = ['🎮', '🍕', '☕', '😴', '🎬', '🏃', '🎵', '📚', '💻', '🌙', '🔥', '❤️', '😎', '🤔', '🎉'];
const STATUS_MAX = 30;
const BIO_MAX = 200;

export default function Settings({ session }: { session: Session }) {
  const { colors, name, setTheme } = useTheme();
  const isDark = name === 'dark';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [statusEmoji, setStatusEmoji] = useState<string | null>(null);
  const [statusText, setStatusText] = useState('');
  const [bio, setBio] = useState('');

  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  const [showCenter, setShowCenter] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select(
          'status_emoji, status_text, bio, notifications_enabled, notif_levelup, notif_quests, notif_messages, notif_sound, notif_vibration'
        )
        .eq('id', session.user.id)
        .single();
      if (!active) return;
      setStatusEmoji(data?.status_emoji ?? null);
      setStatusText(data?.status_text ?? '');
      setBio(data?.bio ?? '');
      if (data) {
        setNotifPrefs({
          notifications_enabled: data.notifications_enabled ?? true,
          notif_levelup: data.notif_levelup ?? true,
          notif_quests: data.notif_quests ?? true,
          notif_messages: data.notif_messages ?? true,
          notif_sound: data.notif_sound ?? true,
          notif_vibration: data.notif_vibration ?? true,
        });
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [session.user.id]);

  async function toggleNotifPref(key: keyof NotifPrefs, value: boolean) {
    setNotifPrefs((prev) => ({ ...prev, [key]: value })); // optimistic
    await supabase
      .from('profiles')
      .update({ [key]: value })
      .eq('id', session.user.id);
  }

  async function toggleTheme(value: boolean) {
    await setTheme(value ? 'dark' : 'light', session.user.id);
  }

  function pickEmoji(emoji: string) {
    setStatusEmoji((prev) => (prev === emoji ? null : emoji));
  }

  async function saveStatusBio() {
    setSaving(true);
    setSavedAt(null);
    const { error } = await supabase
      .from('profiles')
      .update({
        status_emoji: statusEmoji,
        status_text: statusText.trim() || null,
        bio: bio.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (!error) setSavedAt(Date.now());
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <>
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.heading, { color: colors.text }]}>Einstellungen</Text>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Status & Bio</Text>

        {loading ? (
          <ActivityIndicator color={colors.textMuted} />
        ) : (
          <>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Status-Emoji</Text>
            <View style={styles.emojiRow}>
              {STATUS_EMOJIS.map((e) => {
                const selected = statusEmoji === e;
                return (
                  <Pressable
                    key={e}
                    style={[
                      styles.emojiBtn,
                      { borderColor: selected ? colors.primary : colors.border },
                      selected && { backgroundColor: colors.chipBg },
                    ]}
                    onPress={() => pickEmoji(e)}
                  >
                    <Text style={styles.emojiText}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Status-Text ({statusText.length}/{STATUS_MAX})
            </Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardAlt }]}
              placeholder="z. B. Playing WoW"
              placeholderTextColor={colors.textMuted}
              value={statusText}
              onChangeText={(t) => setStatusText(t.slice(0, STATUS_MAX))}
              maxLength={STATUS_MAX}
            />

            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
              Bio ({bio.length}/{BIO_MAX})
            </Text>
            <TextInput
              style={[styles.input, styles.textArea, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardAlt }]}
              placeholder="Erzähl etwas über dich…"
              placeholderTextColor={colors.textMuted}
              value={bio}
              onChangeText={(t) => setBio(t.slice(0, BIO_MAX))}
              maxLength={BIO_MAX}
              multiline
            />

            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && styles.disabled]}
              onPress={saveStatusBio}
              disabled={saving}
            >
              <Text style={[styles.saveText, { color: colors.primaryText }]}>
                {saving ? 'Speichern…' : 'Speichern'}
              </Text>
            </Pressable>
            {savedAt ? (
              <Text style={[styles.savedHint, { color: colors.success }]}>Gespeichert ✓</Text>
            ) : null}
          </>
        )}
      </View>

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
        <Text style={[styles.cardTitle, { color: colors.text }]}>Benachrichtigungen</Text>

        <View style={styles.row}>
          <View style={styles.rowLabel}>
            <Text style={[styles.rowTitle, { color: colors.text }]}>Aktiviert</Text>
            <Text style={[styles.rowSub, { color: colors.textMuted }]}>
              Alle In-App-Benachrichtigungen
            </Text>
          </View>
          <Switch
            value={notifPrefs.notifications_enabled}
            onValueChange={(v) => toggleNotifPref('notifications_enabled', v)}
            trackColor={{ false: '#d1d5db', true: colors.primary }}
            thumbColor="#ffffff"
          />
        </View>

        {([
          ['notif_levelup', 'Level-Ups', '🎉'],
          ['notif_quests', 'Quests & Achievements', '🏆'],
          ['notif_messages', 'Nachrichten', '💬'],
          ['notif_sound', 'Sound', '🔊'],
          ...(Platform.OS !== 'web' ? [['notif_vibration', 'Vibration', '📳'] as const] : []),
        ] as const).map(([key, label, icon]) => (
          <View key={key} style={styles.row}>
            <View style={styles.rowLabel}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>
                {icon} {label}
              </Text>
            </View>
            <Switch
              value={notifPrefs[key as keyof NotifPrefs]}
              onValueChange={(v) => toggleNotifPref(key as keyof NotifPrefs, v)}
              disabled={!notifPrefs.notifications_enabled}
              trackColor={{ false: '#d1d5db', true: colors.primary }}
              thumbColor="#ffffff"
            />
          </View>
        ))}

        <Pressable
          style={[styles.signOut, { backgroundColor: colors.cardAlt }]}
          onPress={() => setShowCenter(true)}
        >
          <Text style={[styles.signOutText, { color: colors.primary }]}>
            🔔 Verlauf anzeigen
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Konto</Text>
        <Text style={[styles.rowSub, { color: colors.textMuted }]}>{session.user.email}</Text>
        <Pressable style={[styles.signOut, { backgroundColor: colors.cardAlt }]} onPress={signOut}>
          <Text style={[styles.signOutText, { color: colors.danger }]}>Abmelden</Text>
        </Pressable>
      </View>
    </ScrollView>

    <NotificationCenter
      userId={session.user.id}
      visible={showCenter}
      onClose={() => setShowCenter(false)}
    />
    </>
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
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: -6 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { borderWidth: 1, borderRadius: 10, padding: 8, minWidth: 42, alignItems: 'center' },
  emojiText: { fontSize: 20 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 90, textAlignVertical: 'top' },
  saveBtn: { borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 15, fontWeight: '700' },
  savedHint: { fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: -6 },
  disabled: { opacity: 0.6 },
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
