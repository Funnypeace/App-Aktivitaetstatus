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

import { supabase, Profile } from '../lib/supabase';
import { GAMES, MAX_GAMES } from '../lib/games';

function displayName(profile: Profile): string {
  const name = profile.username?.trim();
  if (name) return name;
  return `Unbenannt (${profile.id.slice(0, 8)})`;
}

// Supabase liefert die jsonb-Spalte als Array; defensiv gegen null/Unfug.
function gamesOf(profile: Profile): string[] {
  return Array.isArray(profile.games) ? profile.games : [];
}

function StatusDot({ online }: { online: boolean }) {
  return <View style={[styles.dot, { backgroundColor: online ? '#22c55e' : '#9ca3af' }]} />;
}

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGames, setSavingGames] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [games, setGames] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Spiele-Auswahl (Modal)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftGames, setDraftGames] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const loadProfiles = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_online, games, updated_at')
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

  // Initial load
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
            // keep own status card in sync too
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
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setIsOnline(previous); // revert on failure
      setError(error.message);
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
      if (prev.length >= MAX_GAMES) return prev; // Limit erreicht
      return [...prev, game];
    });
  }

  async function saveGames() {
    setSavingGames(true);
    setError(null);
    const previous = games;
    const next = draftGames;
    setGames(next); // optimistic
    setPickerOpen(false);

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username,
      is_online: isOnline,
      games: next,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setGames(previous); // revert on failure
      setError(error.message);
    }
    setSavingGames(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const others = profiles.filter((p) => p.id !== session.user.id);

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GAMES;
    return GAMES.filter((g) => g.toLowerCase().includes(q));
  }, [search]);

  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.card}>
        <Text style={styles.greeting}>Hallo{username ? `, ${username}` : ''} 👋</Text>
        <Text style={styles.email}>{session.user.email}</Text>

        <View style={styles.statusRow}>
          <StatusDot online={isOnline} />
          <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
          {saving ? <ActivityIndicator size="small" color="#6b7280" /> : null}
        </View>

        <View style={styles.gamesBlock}>
          <Text style={styles.gamesLabel}>Aktuelle Spiele</Text>
          {games.length > 0 ? (
            <View style={styles.chipRow}>
              {games.map((g) => (
                <View key={g} style={styles.chip}>
                  <Text style={styles.chipText}>{g}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.gamesEmpty}>Keine Spiele ausgewählt</Text>
          )}
          <Pressable style={styles.gamesEdit} onPress={openPicker} disabled={savingGames}>
            <Text style={styles.gamesEditText}>
              {savingGames ? 'Speichern…' : 'Spiele auswählen'}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[
            styles.button,
            { backgroundColor: isOnline ? '#9ca3af' : '#22c55e' },
            saving && styles.disabled,
          ]}
          disabled={saving}
          onPress={() => setStatus(!isOnline)}
        >
          <Text style={styles.buttonText}>
            {isOnline ? 'Auf Offline setzen' : 'Auf Online setzen'}
          </Text>
        </Pressable>

        <Pressable style={styles.signOut} onPress={signOut}>
          <Text style={styles.signOutText}>Abmelden</Text>
        </Pressable>
      </View>

      <Text style={styles.sectionTitle}>Andere Nutzer</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={others}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <Text style={styles.empty}>Noch keine anderen Nutzer registriert.</Text>
        }
        renderItem={({ item }) => {
          const userGames = gamesOf(item);
          return (
            <View style={styles.userRow}>
              <StatusDot online={item.is_online} />
              <View style={styles.userInfo}>
                <Text style={styles.userName} numberOfLines={1}>
                  {displayName(item)}
                  {userGames.length > 0 ? (
                    <Text style={styles.userGames}> ({userGames.join(', ')})</Text>
                  ) : null}
                </Text>
              </View>
              <Text style={styles.userStatus}>{item.is_online ? 'Online' : 'Offline'}</Text>
            </View>
          );
        }}
      />

      <Modal
        visible={pickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Spiele auswählen</Text>
            <Text style={styles.modalHint}>
              Wähle bis zu {MAX_GAMES} Spiele ({draftGames.length}/{MAX_GAMES})
            </Text>

            <TextInput
              style={styles.searchInput}
              placeholder="Spiel suchen…"
              placeholderTextColor="#9ca3af"
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
                    <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                      {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.gameOptionText}>{g}</Text>
                  </Pressable>
                );
              })}
              {filteredGames.length === 0 ? (
                <Text style={styles.gamesEmpty}>Kein Spiel gefunden.</Text>
              ) : null}
            </ScrollView>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.modalCancel]}
                onPress={() => setPickerOpen(false)}
              >
                <Text style={styles.modalCancelText}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, styles.modalSave]} onPress={saveGames}>
                <Text style={styles.modalSaveText}>Speichern</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
  },
  content: {
    alignItems: 'center',
    paddingTop: Platform.OS === 'web' ? 24 : 56,
    paddingBottom: 32,
    paddingHorizontal: 16,
  },
  loaderWrap: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerWrap: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 24,
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  email: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: -8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  statusText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  gamesBlock: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  gamesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    backgroundColor: '#eef2ff',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipText: {
    color: '#4338ca',
    fontSize: 13,
    fontWeight: '600',
  },
  gamesEmpty: {
    fontSize: 13,
    color: '#9ca3af',
  },
  gamesEdit: {
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  gamesEditText: {
    color: '#4f46e5',
    fontSize: 14,
    fontWeight: '600',
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
  disabled: {
    opacity: 0.6,
  },
  signOut: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  signOutText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
  error: {
    color: '#dc2626',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#374151',
    paddingHorizontal: 4,
  },
  userRow: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  userGames: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6b7280',
  },
  userStatus: {
    fontSize: 13,
    color: '#6b7280',
  },
  empty: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 14,
    paddingVertical: 24,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '80%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  modalHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: -6,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  gameList: {
    flexGrow: 0,
  },
  gameOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  gameOptionDisabled: {
    opacity: 0.4,
  },
  gameOptionText: {
    fontSize: 15,
    color: '#111827',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#c7d2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: '#4f46e5',
    borderColor: '#4f46e5',
  },
  checkboxMark: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  modalBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: '#f3f4f6',
  },
  modalCancelText: {
    color: '#374151',
    fontWeight: '600',
    fontSize: 15,
  },
  modalSave: {
    backgroundColor: '#4f46e5',
  },
  modalSaveText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 15,
  },
});
