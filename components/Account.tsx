import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Profile, UserBadge } from '../lib/supabase';
import { GAMES, MAX_GAMES } from '../lib/games';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import { updateGameStats } from '../lib/stats';
import { checkAndUnlockAchievements } from '../lib/achievements';
import { checkAndUnlockBadges } from '../lib/badges';
import { presenceOf } from '../lib/presence';
import { calcCompatibility } from '../lib/compatibility';
import { timeAgo } from '../lib/time';
import ActivityLog from './ActivityLog';
import PresenceDot from './PresenceDot';

const PROFILE_COLS =
  'id, username, is_online, games, theme, last_seen, created_at, updated_at, status_emoji, status_text, bio, is_active';

function displayName(profile: Profile): string {
  const name = profile.username?.trim();
  if (name) return name;
  return `Unbenannt (${profile.id.slice(0, 8)})`;
}

function gamesOf(profile: Profile): string[] {
  return Array.isArray(profile.games) ? profile.games : [];
}

export default function Account({ session }: { session: Session }) {
  const { colors } = useTheme();
  const { openProfile } = useNav();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGames, setSavingGames] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [games, setGames] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [badgesByUser, setBadgesByUser] = useState<Record<string, UserBadge[]>>({});
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftGames, setDraftGames] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const loadProfiles = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .order('username', { ascending: true });

    if (error) {
      setError(error.message);
      return;
    }

    const rows = (data ?? []) as Profile[];
    setProfiles(rows);

    const me = rows.find((p) => p.id === session.user.id);
    if (me) {
      setUsername(me.username);
      setIsOnline(me.is_online);
      setGames(gamesOf(me));
    } else {
      setUsername(session.user.email?.split('@')[0] ?? null);
      setIsOnline(false);
      setGames([]);
    }
  }, [session.user.id, session.user.email]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadProfiles();
      setLoading(false);
    })();
  }, [loadProfiles]);

  // Live updates via Supabase Realtime: patch local state on any change.
  useEffect(() => {
    const channel = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        (payload) => {
          setProfiles((prev) => {
            if (payload.eventType === 'DELETE') {
              const oldId = (payload.old as { id?: string }).id;
              return prev.filter((p) => p.id !== oldId);
            }
            const row = payload.new as Profile;
            const exists = prev.some((p) => p.id === row.id);
            const next = exists
              ? prev.map((p) => (p.id === row.id ? row : p))
              : [...prev, row];
            if (row.id === session.user.id) {
              setIsOnline(row.is_online);
              setGames(gamesOf(row));
            }
            return next.sort((a, b) =>
              (a.username ?? '').localeCompare(b.username ?? '')
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.user.id]);

  // Load all users' badges once and keep them live for the list + own header.
  useEffect(() => {
    let active = true;
    async function loadBadges() {
      const { data } = await supabase
        .from('user_badges')
        .select('id, user_id, badge_name, icon, earned_at')
        .order('earned_at', { ascending: true });
      if (!active) return;
      const map: Record<string, UserBadge[]> = {};
      for (const b of (data ?? []) as UserBadge[]) {
        (map[b.user_id] ??= []).push(b);
      }
      setBadgesByUser(map);
    }
    loadBadges();

    const channel = supabase
      .channel('public:user_badges')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'user_badges' },
        (payload) => {
          const row = payload.new as UserBadge;
          setBadgesByUser((prev) => {
            const list = prev[row.user_id] ?? [];
            if (list.some((b) => b.id === row.id)) return prev;
            return { ...prev, [row.user_id]: [...list, row] };
          });
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await loadProfiles();
    setRefreshing(false);
  }

  async function setStatus(next: boolean) {
    setSaving(true);
    setError(null);
    const previous = isOnline;
    setIsOnline(next); // optimistic

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username,
      is_online: next,
      games,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setIsOnline(previous);
      setError(error.message);
    } else {
      logActivity(
        session.user.id,
        'status',
        `${previous ? 'Online' : 'Offline'} → ${next ? 'Online' : 'Offline'}`
      );
    }
    setSaving(false);
  }

  function openPicker() {
    setDraftGames(games);
    setSearch('');
    setPickerOpen(true);
  }

  function toggleDraftGame(game: string) {
    setDraftGames((prev) => {
      if (prev.includes(game)) return prev.filter((g) => g !== game);
      if (prev.length >= MAX_GAMES) return prev;
      return [...prev, game];
    });
  }

  async function saveGames() {
    setSavingGames(true);
    setError(null);
    const previous = games;
    const next = draftGames;
    setGames(next);
    setPickerOpen(false);

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username,
      is_online: isOnline,
      games: next,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setGames(previous);
      setError(error.message);
    } else {
      logActivity(session.user.id, 'games', next.length ? next.join(', ') : 'Keine Spiele');
      if (next.length > 0) {
        updateGameStats(session.user.id, next);
        checkAndUnlockAchievements(session.user.id, 'games');
        checkAndUnlockBadges(session.user.id);
      }
    }
    setSavingGames(false);
  }

  const others = profiles.filter((p) => p.id !== session.user.id);
  const me = profiles.find((p) => p.id === session.user.id) ?? null;
  const myBadges = badgesByUser[session.user.id] ?? [];

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GAMES;
    return GAMES.filter((g) => g.toLowerCase().includes(q));
  }, [search]);

  const header = (
    <View style={styles.headerWrap}>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          Hallo{username ? `, ${username}` : ''} 👋
        </Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{session.user.email}</Text>

        <View style={styles.statusRow}>
          <View
            style={[styles.dot, { backgroundColor: isOnline ? colors.online : colors.offline }]}
          />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          {me?.status_emoji || me?.status_text ? (
            <Text style={[styles.customStatus, { color: colors.textMuted }]} numberOfLines={1}>
              {me?.status_emoji ? `${me.status_emoji} ` : ''}
              {me?.status_text ?? ''}
            </Text>
          ) : null}
          {saving ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        </View>

        {me?.bio ? (
          <Text style={[styles.bio, { color: colors.textMuted }]} numberOfLines={3}>
            {me.bio}
          </Text>
        ) : null}

        {myBadges.length > 0 ? (
          <View style={styles.badgeRow}>
            {myBadges.slice(0, 3).map((b) => (
              <View key={b.id} style={[styles.badgePill, { backgroundColor: colors.chipBg }]}>
                <Text style={styles.badgePillIcon}>{b.icon}</Text>
                <Text style={[styles.badgePillText, { color: colors.chipText }]}>{b.badge_name}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.gamesBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.gamesLabel, { color: colors.textMuted }]}>Aktuelle Spiele</Text>
          {games.length > 0 ? (
            <View style={styles.chipRow}>
              {games.map((g) => (
                <View key={g} style={[styles.chip, { backgroundColor: colors.chipBg }]}>
                  <Text style={[styles.chipText, { color: colors.chipText }]}>{g}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.gamesEmpty, { color: colors.textMuted }]}>
              Keine Spiele ausgewählt
            </Text>
          )}
          <Pressable style={styles.gamesEdit} onPress={openPicker} disabled={savingGames}>
            <Text style={[styles.gamesEditText, { color: colors.primary }]}>
              {savingGames ? 'Speichern…' : 'Spiele auswählen'}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: isOnline ? colors.offline : colors.online },
            saving && styles.disabled,
          ]}
          disabled={saving}
          onPress={() => setStatus(!isOnline)}
        >
          <Text style={styles.buttonText}>
            {isOnline ? 'Auf Offline setzen' : 'Auf Online setzen'}
          </Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Meine Aktivität</Text>
        <ActivityLog userId={session.user.id} />
      </View>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Andere Nutzer</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={[styles.screen, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        data={others}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text}
          />
        }
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Noch keine anderen Nutzer registriert.
          </Text>
        }
        renderItem={({ item }) => {
          const userGames = gamesOf(item);
          const userBadges = badgesByUser[item.id] ?? [];
          const presence = presenceOf(item);
          const hasStatus = item.status_emoji || item.status_text;
          const compat = calcCompatibility(games, userGames);
          const showCompat = compat.score >= 40;
          return (
            <Pressable
              style={[styles.userRow, { backgroundColor: colors.card }]}
              onPress={() => openProfile(item.id)}
            >
              <PresenceDot presence={presence} />
              <View style={styles.userInfo}>
                <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                  {displayName(item)}
                  {userBadges.length > 0 ? (
                    <Text> {userBadges.slice(0, 2).map((b) => b.icon).join('')}</Text>
                  ) : null}
                  {userGames.length > 0 ? (
                    <Text style={[styles.userGames, { color: colors.textMuted }]}>
                      {' '}
                      ({userGames.join(', ')})
                    </Text>
                  ) : null}
                </Text>
                {hasStatus ? (
                  <Text style={[styles.userCustomStatus, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.status_emoji ? `${item.status_emoji} ` : ''}
                    {item.status_text ?? ''}
                  </Text>
                ) : null}
                {presence === 'offline' ? (
                  <Text style={[styles.lastSeen, { color: colors.textMuted }]}>
                    zuletzt {timeAgo(item.last_seen)}
                  </Text>
                ) : null}
              </View>
              <View style={styles.userRight}>
                <Text style={[styles.userStatus, { color: colors.textMuted }]}>
                  {presence === 'active' ? 'Aktiv' : presence === 'online' ? 'Online' : 'Offline'}
                </Text>
                {showCompat ? (
                  <View style={[styles.compatBadge, { backgroundColor: compat.score === 100 ? '#FEF3C7' : colors.cardAlt }]}>
                    <Text style={[styles.compatText, { color: compat.score === 100 ? '#D97706' : colors.primary }]}>
                      {compat.score === 100 ? '🏆' : '🎮'} {compat.score}%
                    </Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Spiele auswählen</Text>
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>
              Wähle bis zu {MAX_GAMES} Spiele ({draftGames.length}/{MAX_GAMES})
            </Text>

            <TextInput
              style={[
                styles.searchInput,
                { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardAlt },
              ]}
              placeholder="Spiel suchen…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <ScrollView style={styles.gameList} keyboardShouldPersistTaps="handled">
              {filteredGames.map((g) => {
                const selected = draftGames.includes(g);
                const disabled = !selected && draftGames.length >= MAX_GAMES;
                return (
                  <Pressable
                    key={g}
                    style={[styles.gameOption, disabled && styles.gameOptionDisabled]}
                    onPress={() => toggleDraftGame(g)}
                    disabled={disabled}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        { borderColor: colors.primary },
                        selected && { backgroundColor: colors.primary },
                      ]}
                    >
                      {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.gameOptionText, { color: colors.text }]}>{g}</Text>
                  </Pressable>
                );
              })}
              {filteredGames.length === 0 ? (
                <Text style={[styles.gamesEmpty, { color: colors.textMuted }]}>
                  Kein Spiel gefunden.
                </Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.cardAlt }]}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Abbrechen</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                onPress={saveGames}
              >
                <Text style={[styles.modalSaveText, { color: colors.primaryText }]}>Speichern</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%' },
  content: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  loaderWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  headerWrap: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 },
  card: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  greeting: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 13, marginTop: -8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  statusText: { fontSize: 17, fontWeight: '600' },
  customStatus: { fontSize: 14, flexShrink: 1 },
  bio: { fontSize: 13, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgePill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgePillIcon: { fontSize: 13 },
  badgePillText: { fontSize: 12, fontWeight: '600' },
  userCustomStatus: { fontSize: 12, marginTop: 2 },
  gamesBlock: { gap: 8, borderTopWidth: 1, paddingTop: 12 },
  gamesLabel: { fontSize: 13, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  gamesEmpty: { fontSize: 13 },
  gamesEdit: { alignSelf: 'flex-start', marginTop: 2 },
  gamesEditText: { fontSize: 14, fontWeight: '600' },
  button: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 },
  error: { fontSize: 13 },
  sectionTitle: { fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  userRow: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  userInfo: { flex: 1 },
  userName: { fontSize: 15, fontWeight: '500' },
  userGames: { fontSize: 13, fontWeight: '400' },
  lastSeen: { fontSize: 12, marginTop: 2 },
  userRight: { alignItems: 'flex-end', gap: 4 },
  userStatus: { fontSize: 13 },
  compatBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  compatText: { fontSize: 11, fontWeight: '700' },
  empty: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 24,
  },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '80%', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHint: { fontSize: 13, marginTop: -6 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  gameList: { flexGrow: 0 },
  gameOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  gameOptionDisabled: { opacity: 0.4 },
  gameOptionText: { fontSize: 15 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxMark: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontWeight: '600', fontSize: 15 },
  modalSaveText: { fontWeight: '700', fontSize: 15 },
});
