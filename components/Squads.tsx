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

import { supabase, Squad, SquadMember, SquadChatMessage, Profile } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import { addXP } from '../lib/xp';
import { updateQuestProgress } from '../lib/quests';
import { trackEvent } from '../lib/analytics';
import {
  fetchAllSquads,
  createSquad,
  joinSquad,
  leaveSquad,
  deleteSquad,
  fetchSquadMembers,
  fetchSquadChat,
  sendSquadMessage,
} from '../lib/squads';
import { clockTime } from '../lib/time';
import CompatibilityBadge from './CompatibilityBadge';

const SQUAD_ICONS = ['⚔️', '🛡️', '👥', '🎮', '🔥', '⚡', '🌟', '🦅', '🐉', '🏆', '🎯', '🚀'];

export default function Squads({
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

  const [squads, setSquads] = useState<Squad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSquad, setSelectedSquad] = useState<Squad | null>(null);
  const [members, setMembers] = useState<SquadMember[]>([]);
  const [chat, setChat] = useState<SquadChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const chatSeen = useRef<Set<string>>(new Set());

  // Create form
  const [cName, setCName] = useState('');
  const [cDesc, setCDesc] = useState('');
  const [cIcon, setCIcon] = useState('⚔️');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const myProfile = profiles.find((p) => p.id === myId);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('squads:all')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squads' }, (p) => {
        setSquads((prev) => [p.new as Squad, ...prev]);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'squads' }, (p) => {
        const row = p.new as Squad;
        setSquads((prev) => prev.map((s) => (s.id === row.id ? row : s)));
        setSelectedSquad((prev) => (prev?.id === row.id ? row : prev));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'squads' }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) {
          setSquads((prev) => prev.filter((s) => s.id !== id));
          setSelectedSquad((prev) => (prev?.id === id ? null : prev));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // Subscribe to squad detail when a squad is selected
  useEffect(() => {
    if (!selectedSquad) return;
    const squadId = selectedSquad.id;

    const channel = supabase
      .channel(`squad-detail:${squadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squad_members', filter: `squad_id=eq.${squadId}` }, (p) => {
        setMembers((prev) => [...prev, p.new as SquadMember]);
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'squad_members', filter: `squad_id=eq.${squadId}` }, (p) => {
        const id = (p.old as { id?: string }).id;
        if (id) setMembers((prev) => prev.filter((m) => m.id !== id));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'squad_chat', filter: `squad_id=eq.${squadId}` }, (p) => {
        const row = p.new as SquadChatMessage;
        if (!chatSeen.current.has(row.id)) {
          chatSeen.current.add(row.id);
          setChat((prev) => [row, ...prev]);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedSquad?.id]);

  async function load() {
    const rows = await fetchAllSquads();
    setSquads(rows);
    setLoading(false);
  }

  async function openDetail(squad: Squad) {
    setSelectedSquad(squad);
    setLoadingDetail(true);
    chatSeen.current.clear();
    const [ms, ch] = await Promise.all([fetchSquadMembers(squad.id), fetchSquadChat(squad.id)]);
    ch.forEach((m) => chatSeen.current.add(m.id));
    setMembers(ms);
    setChat(ch);
    setLoadingDetail(false);
  }

  async function handleJoin() {
    if (!selectedSquad) return;
    const ok = await joinSquad(selectedSquad.id, myId);
    if (ok) {
      logActivity(myId, 'squad', `Squad beigetreten: ${selectedSquad.name}`);
      addXP(myId, 15);
      updateQuestProgress(myId, 'join_squad');
      trackEvent('squad_join', { squad: selectedSquad.name });
    }
  }

  async function handleLeave() {
    if (!selectedSquad) return;
    await leaveSquad(selectedSquad.id, myId);
  }

  async function handleDelete() {
    if (!selectedSquad) return;
    await deleteSquad(selectedSquad.id);
    setSelectedSquad(null);
  }

  async function handleCreate() {
    setCreateError('');
    const name = cName.trim();
    if (name.length < 2) { setCreateError('Name muss mindestens 2 Zeichen haben.'); return; }
    if (name.length > 30) { setCreateError('Name darf max. 30 Zeichen haben.'); return; }
    setCreating(true);
    const squad = await createSquad({
      name,
      description: cDesc.trim() || undefined,
      leader_id: myId,
      icon: cIcon,
    });
    if (squad) {
      logActivity(myId, 'squad', `Squad erstellt: ${squad.name}`);
      addXP(myId, 15);
      updateQuestProgress(myId, 'join_squad');
      trackEvent('squad_create', { squad: squad.name });
      setShowCreate(false);
      setCName(''); setCDesc(''); setCIcon('⚔️');
    } else {
      setCreateError('Name bereits vergeben oder Fehler beim Erstellen.');
    }
    setCreating(false);
  }

  async function handleSendChat() {
    const content = chatText.trim();
    if (!content || !selectedSquad || sendingChat) return;
    setSendingChat(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: SquadChatMessage = {
      id: tempId,
      squad_id: selectedSquad.id,
      user_id: myId,
      username,
      content,
      created_at: new Date().toISOString(),
    };
    setChat((prev) => [optimistic, ...prev]);
    setChatText('');

    const result = await sendSquadMessage({ squad_id: selectedSquad.id, user_id: myId, username, content });
    if (result) {
      chatSeen.current.add(result.id);
      setChat((prev) => prev.map((m) => (m.id === tempId ? result : m)));
    } else {
      setChat((prev) => prev.filter((m) => m.id !== tempId));
      setChatText(content);
    }
    setSendingChat(false);
  }

  const displayName = (id: string) => {
    const p = profiles.find((x) => x.id === id);
    return p?.username?.trim() || `Unbenannt (${id.slice(0, 8)})`;
  };

  const myMembership = selectedSquad ? members.find((m) => m.user_id === myId) : null;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={squads}
        keyExtractor={(s) => s.id}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>
            Noch keine Squads. Erstelle deinen ersten!
          </Text>
        }
        renderItem={({ item }) => {
          const isMember = item.leader_id === myId ||
            squads.some(() => false); // simplified: check via member table not loaded here
          return (
            <Pressable
              style={[styles.row, { backgroundColor: colors.card }]}
              onPress={() => openDetail(item)}
            >
              <Text style={styles.squadIcon}>{item.icon}</Text>
              <View style={styles.rowInfo}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                {item.description ? (
                  <Text style={[styles.rowSub, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={[styles.rowSub, { color: colors.textMuted }]}>
                  {item.member_count} Mitglied{item.member_count !== 1 ? 'er' : ''}
                </Text>
              </View>
              {item.leader_id === myId ? (
                <View style={[styles.leaderBadge, { backgroundColor: colors.primary + '22' }]}>
                  <Text style={[styles.leaderText, { color: colors.primary }]}>Leader</Text>
                </View>
              ) : null}
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

      {/* Squad detail modal */}
      <Modal visible={!!selectedSquad} transparent animationType="slide" onRequestClose={() => setSelectedSquad(null)}>
        <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            {selectedSquad ? (
              <>
                {/* Header */}
                <View style={[styles.detailHeader, { borderBottomColor: colors.border }]}>
                  <Text style={styles.detailIcon}>{selectedSquad.icon}</Text>
                  <View style={styles.detailHeaderInfo}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{selectedSquad.name}</Text>
                    <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                      {selectedSquad.member_count} Mitglieder · Leader: {displayName(selectedSquad.leader_id)}
                    </Text>
                  </View>
                </View>

                {loadingDetail ? (
                  <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                  </View>
                ) : (
                  <View style={styles.detailBody}>
                    {/* Members tab */}
                    <ScrollView style={styles.membersPane} contentContainerStyle={{ gap: 4 }}>
                      {selectedSquad.description ? (
                        <Text style={[styles.descText, { color: colors.text }]}>{selectedSquad.description}</Text>
                      ) : null}

                      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Mitglieder</Text>
                      {members.map((m) => {
                        const mp = profiles.find((p) => p.id === m.user_id);
                        return (
                          <Pressable
                            key={m.id}
                            style={[styles.memberRow, { backgroundColor: colors.cardAlt }]}
                            onPress={() => openProfile(m.user_id)}
                          >
                            <View>
                              <Text style={[styles.memberName, { color: colors.text }]}>
                                {m.role === 'leader' ? '👑 ' : ''}{displayName(m.user_id)}
                              </Text>
                            </View>
                            {m.user_id !== myId ? (
                              <CompatibilityBadge
                                selfId={myId}
                                otherId={m.user_id}
                                compact
                                gamesA={myProfile?.games ?? []}
                                gamesB={mp?.games ?? []}
                              />
                            ) : null}
                          </Pressable>
                        );
                      })}

                      {/* Join/Leave/Delete */}
                      {myId === selectedSquad.leader_id ? (
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: colors.danger }]}
                          onPress={handleDelete}
                        >
                          <Text style={[styles.actionText, { color: '#fff' }]}>Squad auflösen</Text>
                        </Pressable>
                      ) : myMembership ? (
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: colors.cardAlt }]}
                          onPress={handleLeave}
                        >
                          <Text style={[styles.actionText, { color: colors.danger }]}>Squad verlassen</Text>
                        </Pressable>
                      ) : (
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                          onPress={handleJoin}
                        >
                          <Text style={[styles.actionText, { color: colors.primaryText }]}>Beitreten</Text>
                        </Pressable>
                      )}

                      <Pressable style={styles.closeBtn} onPress={() => setSelectedSquad(null)}>
                        <Text style={[styles.closeText, { color: colors.textMuted }]}>Schließen</Text>
                      </Pressable>
                    </ScrollView>

                    {/* Chat — only for members */}
                    {myMembership || myId === selectedSquad.leader_id ? (
                      <View style={[styles.chatPane, { borderTopColor: colors.border }]}>
                        <Text style={[styles.sectionLabel, { color: colors.textMuted, padding: 8 }]}>Squad-Chat</Text>
                        <FlatList
                          style={{ flex: 1 }}
                          contentContainerStyle={{ paddingHorizontal: 10, gap: 4 }}
                          data={chat}
                          inverted
                          keyExtractor={(m) => m.id}
                          renderItem={({ item }) => {
                            const mine = item.user_id === myId;
                            return (
                              <View style={[styles.chatBubble, mine ? styles.chatMine : styles.chatOther, { backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther }]}>
                                {!mine ? (
                                  <Text style={[styles.chatAuthor, { color: colors.bubbleOtherText }]}>
                                    {item.username?.trim() || 'Unbenannt'}
                                  </Text>
                                ) : null}
                                <Text style={[styles.chatContent, { color: mine ? colors.bubbleMineText : colors.bubbleOtherText }]}>
                                  {item.content}
                                </Text>
                                <Text style={[styles.chatTime, { color: mine ? colors.bubbleMineText : colors.bubbleOtherText }]}>
                                  {clockTime(item.created_at)}
                                </Text>
                              </View>
                            );
                          }}
                        />
                        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                          <View style={[styles.chatInput, { backgroundColor: colors.cardAlt, borderTopColor: colors.border }]}>
                            <TextInput
                              style={[styles.chatField, { color: colors.text }]}
                              placeholder="Nachricht…"
                              placeholderTextColor={colors.textMuted}
                              value={chatText}
                              onChangeText={setChatText}
                              onSubmitEditing={handleSendChat}
                            />
                            <Pressable
                              style={[styles.chatSend, { backgroundColor: colors.primary }, (!chatText.trim() || sendingChat) && { opacity: 0.5 }]}
                              disabled={!chatText.trim() || sendingChat}
                              onPress={handleSendChat}
                            >
                              <Text style={{ color: colors.primaryText, fontWeight: '700' }}>↑</Text>
                            </Pressable>
                          </View>
                        </KeyboardAvoidingView>
                      </View>
                    ) : (
                      <View style={[styles.chatPane, { borderTopColor: colors.border, alignItems: 'center', justifyContent: 'center' }]}>
                        <Text style={[styles.empty, { color: colors.textMuted }]}>
                          Tritt dem Squad bei, um den Chat zu lesen.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </>
            ) : null}
          </View>
        </View>
      </Modal>

      {/* Create squad modal */}
      <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <KeyboardAvoidingView
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
              <Text style={[styles.modalTitle, { color: colors.text }]}>Neuer Squad</Text>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Icon</Text>
              <View style={styles.iconGrid}>
                {SQUAD_ICONS.map((ic) => (
                  <Pressable
                    key={ic}
                    style={[styles.iconBtn, { backgroundColor: cIcon === ic ? colors.primary + '33' : colors.cardAlt }]}
                    onPress={() => setCIcon(ic)}
                  >
                    <Text style={styles.iconEmoji}>{ic}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Name * (2–30 Zeichen)</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="Squad-Name"
                placeholderTextColor={colors.textMuted}
                value={cName}
                onChangeText={setCName}
                maxLength={30}
              />

              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Beschreibung (optional)</Text>
              <TextInput
                style={[styles.input, styles.inputMulti, { backgroundColor: colors.cardAlt, color: colors.text }]}
                placeholder="Worum geht es in eurem Squad?"
                placeholderTextColor={colors.textMuted}
                value={cDesc}
                onChangeText={setCDesc}
                multiline
                maxLength={300}
              />

              {createError ? (
                <Text style={{ color: colors.danger, fontSize: 13 }}>{createError}</Text>
              ) : null}

              <Pressable
                style={[
                  styles.actionBtn,
                  { backgroundColor: colors.primary },
                  (!cName.trim() || creating) && { opacity: 0.5 },
                ]}
                disabled={!cName.trim() || creating}
                onPress={handleCreate}
              >
                <Text style={[styles.actionText, { color: colors.primaryText }]}>
                  {creating ? 'Erstellen…' : 'Squad erstellen'}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 80 },
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
  squadIcon: { fontSize: 28 },
  rowInfo: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700' },
  rowSub: { fontSize: 12, marginTop: 2 },
  leaderBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  leaderText: { fontSize: 11, fontWeight: '700' },
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
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: 16, overflow: 'hidden' },
  modalContent: { padding: 20, gap: 8 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 2 },
  modalSub: { fontSize: 13 },
  detailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  detailIcon: { fontSize: 36 },
  detailHeaderInfo: { flex: 1 },
  detailBody: { flex: 1, flexDirection: 'column' },
  membersPane: { maxHeight: 260, paddingHorizontal: 12, paddingTop: 8 },
  chatPane: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth, minHeight: 200 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descText: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 8,
    padding: 10,
    marginBottom: 4,
  },
  memberName: { fontSize: 14, fontWeight: '600' },
  actionBtn: { borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  actionText: { fontSize: 15, fontWeight: '700' },
  closeBtn: { alignItems: 'center', paddingVertical: 10 },
  closeText: { fontSize: 14, fontWeight: '500' },
  chatBubble: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7, maxWidth: '80%', marginBottom: 4 },
  chatMine: { alignSelf: 'flex-end' },
  chatOther: { alignSelf: 'flex-start' },
  chatAuthor: { fontSize: 11, fontWeight: '700', marginBottom: 2 },
  chatContent: { fontSize: 14 },
  chatTime: { fontSize: 10, marginTop: 2, opacity: 0.7, alignSelf: 'flex-end' },
  chatInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatField: { flex: 1, fontSize: 14, paddingVertical: 6 },
  chatSend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 8 },
  input: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  inputMulti: { minHeight: 70, textAlignVertical: 'top' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconBtn: { borderRadius: 10, padding: 8 },
  iconEmoji: { fontSize: 22 },
});
