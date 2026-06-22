import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, GamingSession, Profile } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import {
  fetchOpenSessions,
  createSession,
  joinSession,
  leaveSession,
  deleteSession,
  fetchSessionMemberIds,
} from '../lib/sessions';
import { clockTime } from '../lib/time';
import CompatibilityBadge from './CompatibilityBadge';

const PLAYER_LIMIT_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 15, 20];

export default function GamingSessions({
  session,
  username,
  profiles,
}: {
  session: Session;
  username: string | null;
  profiles: Profile[];
}) {
  const { colors } = useTheme();
  const { openProfile } = useNav();
  const myId = session.user.id;

  const [sessions, setSessions] = useState<GamingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSession, setSelectedSession] = useState<GamingSession | null>(null);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  // Create form state
  const [cGame, setCGame] = useState('');
  const [cTitle, setCTitle] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cLimit, setCLimit] = useState(4);
  const [cVoice, setCVoice] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('gaming_sessions:all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gaming_sessions' }, (p) => {
        const row = p.new as GamingSession;
        if (!seen.current.has(row.id)) {
          seen.current.add(row.id);
          setSessions((prev) => [row, ...prev]);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'gaming_sessions' }, (p) => {
        const row = p.new as GamingSession;
        setSessions((prev) => prev.map((s) => (s.id === row.id ? row : s)));
        setSelectedSession((prev) => (prev?.id === row.id ? row : prev));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'gaming_sessions' }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) {
          setSessions((prev) => prev.filter((s) => s.id !== id));
          setSelectedSession((prev) => (prev?.id === id ? null : prev));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const rows = await fetchOpenSessions();
    rows.forEach((s) => seen.current.add(s.id));
    setSessions(rows);
    setLoading(false);
  }

  async function openDetail(s: GamingSession) {
    setSelectedSession(s);
    setLoadingMembers(true);
    const ids = await fetchSessionMemberIds(s.id);
    setMemberIds(ids);
    setLoadingMembers(false);
  }

  async function handleJoin() {
    if (!selectedSession) return;
    const ok = await joinSession(selectedSession.id, myId);
    if (ok) {
      setMemberIds((prev) => [...prev, myId]);
      logActivity(myId, 'session', `Session beigetreten: ${selectedSession.title}`);
    }
  }

  async function handleLeave() {
    if (!selectedSession) return;
    await leaveSession(selectedSession.id, myId);
    setMemberIds((prev) => prev.filter((id) => id !== myId));
  }

  async function handleDelete() {
    if (!selectedSession) return;
    await deleteSession(selectedSession.id);
    setSelectedSession(null);
  }

  async function handleCreate() {
    if (!cGame.trim() || !cTitle.trim()) return;
    setCreating(true);
    const s = await createSession({
      creator_id: myId,
      game_name: cGame.trim(),
      title: cTitle.trim(),
      description: cDesc.trim() || undefined,
      player_limit: cLimit,
      voice_link: cVoice.trim() || undefined,
    });
    if (s) {
      logActivity(myId, 'session', `Session erstellt: ${s.title}`);
      setShowCreate(false);
      setCGame(''); setCTitle(''); setCDesc(''); setCLimit(4); setCVoice('');
    }
    setCreating(false);
  }

  const displayName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.username?.trim() || `Unbenannt (${id.slice(0, 8)})`;
  };

  const myProfile = profiles.find((p) => p.id === myId);

  const filtered = filter.trim()
    ? sessions.filter((s) => s.game_name.toLowerCase().includes(filter.toLowerCase()))
    : sessions;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Search / filter */}
      <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TextInput
          style={[styles.searchInput, { backgroundColor: colors.cardAlt, color: colors.text }]}
          placeholder="Spiel filtern…"
          placeholderTextColor={colors.textMuted}
          value={filter}
          onChangeText={setFilter}
        />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={filtered}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Keine offenen Sessions. Erstelle eine!
          </Text>
        }
        renderItem={({ item }) => {
          const isCreator = item.creator_id === myId;
          const isFull = item.status === 'full';
          return (
            <Pressable
              style={[styles.row, { backgroundColor: colors.card }]}
              onPress={() => openDetail(item)}
            >
              <View style={styles.rowLeft}>
                <Text style={styles.rowIcon}>🎮</Text>
                <View style={styles.rowInfo}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.game_name} · von {displayName(item.creator_id)}
                  </Text>
                  {item.starts_at ? (
                    <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                      Startet {clockTime(item.starts_at)}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.rowRight}>
                <View style={[styles.statusBadge, { backgroundColor: isFull ? colors.danger + '22' : colors.online + '22' }]}>
                  <Text style={[styles.statusText, { color: isFull ? colors.danger : colors.online }]}>
                    {item.current_players}/{item.player_limit}
                  </Text>
                </View>
                {isFull ? (
                  <Text style={[styles.fullTag, { color: colors.danger }]}>Voll</Text>
                ) : null}
                {isCreator ? (
                  <Text style={[styles.myTag, { color: colors.primary }]}>Meine</Text>
                ) : null}
              </View>
            </Pressable>
          );
        }}
      />

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => setShowCreate(true)}
      >
        <Text style={[styles.fabText, { color: colors.primaryText }]}>＋</Text>
      </Pressable>

      {/* Session detail modal */}
      <Modal visible={!!selectedSession} transparent animationType="slide" onRequestClose={() => setSelectedSession(null)}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            {selectedSession ? (
              <ScrollView contentContainerStyle={styles.modalContent}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedSession.title}</Text>
                <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                  🎮 {selectedSession.game_name}
                </Text>
                {selectedSession.description ? (
                  <Text style={[styles.modalDesc, { color: colors.text }]}>{selectedSession.description}</Text>
                ) : null}

                <View style={[styles.infoRow, { backgroundColor: colors.cardAlt }]}>
                  <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Spieler</Text>
                  <Text style={[styles.infoValue, { color: colors.text }]}>
                    {selectedSession.current_players} / {selectedSession.player_limit}
                  </Text>
                </View>

                {selectedSession.starts_at ? (
                  <View style={[styles.infoRow, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Startzeit</Text>
                    <Text style={[styles.infoValue, { color: colors.text }]}>
                      {clockTime(selectedSession.starts_at)}
                    </Text>
                  </View>
                ) : null}

                {selectedSession.voice_link ? (
                  <View style={[styles.infoRow, { backgroundColor: colors.cardAlt }]}>
                    <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Voice</Text>
                    <Text style={[styles.infoValue, { color: colors.primary }]} numberOfLines={1}>
                      {selectedSession.voice_link}
                    </Text>
                  </View>
                ) : null}

                <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Mitglieder</Text>
                {loadingMembers ? (
                  <ActivityIndicator color={colors.textMuted} />
                ) : (
                  memberIds.map((id) => {
                    const mp = profiles.find((p) => p.id === id);
                    return (
                      <Pressable
                        key={id}
                        style={[styles.memberRow, { backgroundColor: colors.cardAlt }]}
                        onPress={() => openProfile(id)}
                      >
                        <Text style={[styles.memberName, { color: colors.text }]}>
                          {id === selectedSession.creator_id ? '👑 ' : ''}
                          {displayName(id)}
                        </Text>
                        {id !== myId ? (
                          <CompatibilityBadge
                            selfId={myId}
                            otherId={id}
                            compact
                            gamesA={myProfile?.games ?? []}
                            gamesB={mp?.games ?? []}
                          />
                        ) : null}
                      </Pressable>
                    );
                  })
                )}

                {/* Actions */}
                {myId === selectedSession.creator_id ? (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                    onPress={handleDelete}
                  >
                    <Text style={[styles.actionText, { color: '#fff' }]}>Session löschen</Text>
                  </Pressable>
                ) : memberIds.includes(myId) ? (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.cardAlt }]}
                    onPress={handleLeave}
                  >
                    <Text style={[styles.actionText, { color: colors.danger }]}>Session verlassen</Text>
                  </Pressable>
                ) : selectedSession.status === 'full' ? (
                  <View style={[styles.actionBtn, { backgroundColor: colors.cardAlt, opacity: 0.5 }]}>
                    <Text style={[styles.actionText, { color: colors.textMuted }]}>Session voll</Text>
                  </View>
                ) : (
                  <Pressable
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleJoin}
                  >
                    <Text style={[styles.actionText, { color: colors.primaryText }]}>Beitreten</Text>
                  </Pressable>
                )}

                <Pressable style={styles.closeBtn} onPress={() => setSelectedSession(null)}>
                  <Text style={[styles.closeText, { color: colors.textMuted }]}>Schließen</Text>
                </Pressable>
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Create session modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neue Session</Text>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Spiel *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="z.B. Valorant, WoW …"
                placeholderTextColor={colors.textMuted}
                value={cGame}
                onChangeText={setCGame}
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Titel *</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="Session-Titel"
                placeholderTextColor={colors.textMuted}
                value={cTitle}
                onChangeText={setCTitle}
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Beschreibung</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="Was ist das Ziel? Skill-Level?"
                placeholderTextColor={colors.textMuted}
                value={cDesc}
                onChangeText={setCDesc}
                multiline
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                Spieleranzahl: {cLimit}
              </Text>
              <View style={styles.limitRow}>
                {PLAYER_LIMIT_OPTIONS.map((n) => (
                  <Pressable
                    key={n}
                    style={[
                      styles.limitBtn,
                      { backgroundColor: cLimit === n ? colors.primary : colors.cardAlt },
                    ]}
                    onPress={() => setCLimit(n)}
                  >
                    <Text style={{ color: cLimit === n ? colors.primaryText : colors.text, fontWeight: '600', fontSize: 13 }}>
                      {n}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Voice-Link (optional)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="Discord / TeamSpeak / …"
                placeholderTextColor={colors.textMuted}
                value={cVoice}
                onChangeText={setCVoice}
                autoCapitalize="none"
              />

              <Pressable
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary, marginTop: 8 },
                  (!cGame.trim() || !cTitle.trim() || creating) && { opacity: 0.5 },
                ]}
                disabled={!cGame.trim() || !cTitle.trim() || creating}
                onPress={handleCreate}
              >
                <Text style={[styles.actionText, { color: colors.primaryText }]}>
                  {creating ? 'Erstellen…' : 'Session erstellen'}
                </Text>
              </Pressable>

              <Pressable style={styles.closeBtn} onPress={() => setShowCreate(false)}>
                <Text style={[styles.closeText, { color: colors.textMuted }]}>Abbrechen</Text>
              </Pressable>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchBar: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  list: { flex: 1 },
  listContent: { padding: 12, gap: 8, maxWidth: 600, width: '100%', alignSelf: 'center' },
  empty: { textAlign: 'center', paddingVertical: 40, fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  rowLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowIcon: { fontSize: 24 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2 },
  rowRight: { alignItems: 'flex-end', gap: 4 },
  statusBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },
  fullTag: { fontSize: 11, fontWeight: '600' },
  myTag: { fontSize: 11, fontWeight: '600' },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
  fabText: { fontSize: 24, fontWeight: '300', lineHeight: 28 },
  backdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '88%', borderRadius: 16, overflow: 'hidden' },
  modalContent: { padding: 20, gap: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  modalSub: { fontSize: 14, marginBottom: 4 },
  modalDesc: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', borderRadius: 8, padding: 10 },
  infoLabel: { fontSize: 13, fontWeight: '600' },
  infoValue: { fontSize: 13 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  memberName: { fontSize: 14, fontWeight: '600' },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  actionText: { fontSize: 15, fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 12 },
  closeText: { fontSize: 14, fontWeight: '500' },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  limitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  limitBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
});
