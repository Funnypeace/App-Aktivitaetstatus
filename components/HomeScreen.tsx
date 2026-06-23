import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Profile, UserBadge, ChatMessage } from '../lib/supabase';
import { GAMES, MAX_GAMES } from '../lib/games';
import { useTheme } from '../lib/theme';
import { useNav } from '../lib/nav';
import { logActivity } from '../lib/activity';
import { updateGameStats } from '../lib/stats';
import { checkAndUnlockAchievements } from '../lib/achievements';
import { checkAndUnlockBadges } from '../lib/badges';
import { presenceOf } from '../lib/presence';
import { calcCompatibility } from '../lib/compatibility';
import { timeAgo, clockTime } from '../lib/time';
import { addXP } from '../lib/xp';
import { updateQuestProgress } from '../lib/quests';
import { useReactions } from '../lib/reactions';
import ActivityLog from './ActivityLog';
import PresenceDot from './PresenceDot';
import LevelBadge from './LevelBadge';
import DailyQuests from './DailyQuests';
import Streaks from './Streaks';
import GameReviews from './GameReviews';
import Reactions from './Reactions';

const PROFILE_COLS =
  'id, username, is_online, games, theme, last_seen, created_at, updated_at, status_emoji, status_text, bio, is_active, xp, level, xp_to_next_level';

const CHAT_PAGE = 50;
const WIDE_BREAKPOINT = 720;

function displayName(profile: Profile): string {
  const name = profile.username?.trim();
  if (name) return name;
  return `Unbenannt (${profile.id.slice(0, 8)})`;
}

function gamesOf(profile: Profile): string[] {
  return Array.isArray(profile.games) ? profile.games : [];
}

export default function HomeScreen({
  session,
  username,
}: {
  session: Session;
  username: string | null;
}) {
  const { colors } = useTheme();
  const { openProfile } = useNav();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;

  // ── Status panel state ───────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingGames, setSavingGames] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [games, setGames] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [badgesByUser, setBadgesByUser] = useState<Record<string, UserBadge[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [draftGames, setDraftGames] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [showStreaks, setShowStreaks] = useState(false);
  const [showQuests, setShowQuests] = useState(false);
  const [reviewGame, setReviewGame] = useState<string | null>(null);

  // ── Chat panel state ─────────────────────────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const { rows: reactionRows, toggle: toggleReaction } = useReactions(
    'chat_reactions',
    'chat_message_id',
    session.user.id
  );

  // ── Profile loading ──────────────────────────────────────────────────
  const loadProfiles = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from('profiles')
      .select(PROFILE_COLS)
      .order('username', { ascending: true });
    if (err) { setError(err.message); return; }
    const rows = (data ?? []) as Profile[];
    setProfiles(rows);
    const me = rows.find((p) => p.id === session.user.id);
    if (me) {
      setProfileUsername(me.username);
      setIsOnline(me.is_online);
      setGames(gamesOf(me));
    } else {
      setProfileUsername(session.user.email?.split('@')[0] ?? null);
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

  // Profile realtime
  useEffect(() => {
    const channel = supabase
      .channel('home:profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
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
          return next.sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''));
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session.user.id]);

  // Badges
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
      .channel('home:user_badges')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_badges' }, (payload) => {
        const row = payload.new as UserBadge;
        setBadgesByUser((prev) => {
          const list = prev[row.user_id] ?? [];
          if (list.some((b) => b.id === row.id)) return prev;
          return { ...prev, [row.user_id]: [...list, row] };
        });
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  // ── Chat loading ─────────────────────────────────────────────────────
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from('chat_messages')
        .select('id, user_id, username, content, created_at')
        .order('created_at', { ascending: false })
        .limit(CHAT_PAGE);
      if (!active) return;
      const rows = (data ?? []) as ChatMessage[];
      rows.forEach((m) => seen.current.add(m.id));
      setMessages(rows);
      setHasMore(rows.length === CHAT_PAGE);
      setChatLoading(false);
    })();
    const channel = supabase
      .channel('home:chat_messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const row = payload.new as ChatMessage;
        if (seen.current.has(row.id)) return;
        seen.current.add(row.id);
        setMessages((prev) => [row, ...prev]);
      })
      .subscribe();
    return () => { active = false; supabase.removeChannel(channel); };
  }, []);

  // ── Status actions ───────────────────────────────────────────────────
  async function onRefresh() {
    setRefreshing(true);
    await loadProfiles();
    setRefreshing(false);
  }

  async function setStatus(next: boolean) {
    setSaving(true);
    setError(null);
    const previous = isOnline;
    setIsOnline(next);
    const { error: err } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username: profileUsername,
      is_online: next,
      games,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (err) {
      setIsOnline(previous);
      setError(err.message);
    } else {
      logActivity(session.user.id, 'status', `${previous ? 'Online' : 'Offline'} → ${next ? 'Online' : 'Offline'}`);
      addXP(session.user.id, 5);
      updateQuestProgress(session.user.id, 'change_status');
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
    const { error: err } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username: profileUsername,
      is_online: isOnline,
      games: next,
      last_seen: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (err) {
      setGames(previous);
      setError(err.message);
    } else {
      logActivity(session.user.id, 'games', next.length ? next.join(', ') : 'Keine Spiele');
      if (next.length > 0) {
        updateGameStats(session.user.id, next);
        checkAndUnlockAchievements(session.user.id, 'games');
        checkAndUnlockBadges(session.user.id);
        addXP(session.user.id, 10);
        updateQuestProgress(session.user.id, 'select_game');
      }
    }
    setSavingGames(false);
  }

  // ── Chat actions ─────────────────────────────────────────────────────
  async function loadMoreChat() {
    if (loadingMore || !hasMore || messages.length === 0) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1].created_at;
    const { data } = await supabase
      .from('chat_messages')
      .select('id, user_id, username, content, created_at')
      .lt('created_at', oldest)
      .order('created_at', { ascending: false })
      .limit(CHAT_PAGE);
    const rows = (data ?? []) as ChatMessage[];
    rows.forEach((m) => seen.current.add(m.id));
    setMessages((prev) => [...prev, ...rows]);
    setHasMore(rows.length === CHAT_PAGE);
    setLoadingMore(false);
  }

  async function sendChat() {
    const content = chatText.trim();
    if (!content || sending) return;
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id: tempId,
      user_id: session.user.id,
      username,
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [optimistic, ...prev]);
    setChatText('');
    const { data, error: err } = await supabase
      .from('chat_messages')
      .insert({ user_id: session.user.id, username, content })
      .select('id, user_id, username, content, created_at')
      .single();
    if (err || !data) {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setChatText(content);
    } else {
      const row = data as ChatMessage;
      seen.current.add(row.id);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? row : m)));
      logActivity(session.user.id, 'chat', content.slice(0, 60));
      checkAndUnlockAchievements(session.user.id, 'chat');
      checkAndUnlockBadges(session.user.id);
      addXP(session.user.id, 10);
      updateQuestProgress(session.user.id, 'send_chat');
    }
    setSending(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────
  const others = profiles.filter((p) => p.id !== session.user.id);
  const me = profiles.find((p) => p.id === session.user.id) ?? null;
  const myBadges = badgesByUser[session.user.id] ?? [];

  const filteredGames = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return GAMES;
    return GAMES.filter((g) => g.toLowerCase().includes(q));
  }, [search]);

  // Safe area: status panel always needs top padding; chat header only when wide
  const statusPaddingTop = Platform.OS === 'web' ? 16 : 52;
  const chatHeaderPaddingTop = isWide ? statusPaddingTop : 10;

  if (loading) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.text} />
      </View>
    );
  }

  // ── Status Panel ─────────────────────────────────────────────────────
  const statusPanel = (
    <ScrollView
      style={styles.fill}
      contentContainerStyle={[styles.statusContent, { paddingTop: statusPaddingTop }]}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />
      }
    >
      {/* Profile card */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.greeting, { color: colors.text }]}>
          Hallo{profileUsername ? `, ${profileUsername}` : ''} 👋
        </Text>

        <View style={styles.statusRow}>
          <View style={[styles.dot, { backgroundColor: isOnline ? colors.online : colors.offline }]} />
          <Text style={[styles.statusText, { color: colors.text }]}>
            {isOnline ? 'Online' : 'Offline'}
          </Text>
          {me?.status_emoji || me?.status_text ? (
            <Text style={[styles.customStatus, { color: colors.textMuted }]} numberOfLines={1}>
              {me?.status_emoji ? `${me.status_emoji} ` : ''}{me?.status_text ?? ''}
            </Text>
          ) : null}
          {saving ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        </View>

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

        {me ? (
          <LevelBadge
            level={me.level ?? 1}
            xp={me.xp ?? 0}
            xp_to_next_level={me.xp_to_next_level ?? 100}
          />
        ) : null}

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionChip, { backgroundColor: colors.chipBg }]} onPress={() => setShowStreaks(true)}>
            <Text style={[styles.actionChipText, { color: colors.text }]}>🔥 Streak</Text>
          </Pressable>
          <Pressable style={[styles.actionChip, { backgroundColor: colors.chipBg }]} onPress={() => setShowQuests(true)}>
            <Text style={[styles.actionChipText, { color: colors.text }]}>📋 Quests</Text>
          </Pressable>
        </View>

        <View style={[styles.gamesBlock, { borderTopColor: colors.border }]}>
          <Text style={[styles.gamesLabel, { color: colors.textMuted }]}>Aktuelle Spiele</Text>
          {games.length > 0 ? (
            <View style={styles.chipRow}>
              {games.map((g) => (
                <Pressable key={g} style={[styles.chip, { backgroundColor: colors.chipBg }]} onPress={() => setReviewGame(g)}>
                  <Text style={[styles.chipText, { color: colors.chipText }]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.gamesEmpty, { color: colors.textMuted }]}>Keine Spiele ausgewählt</Text>
          )}
          <Pressable style={styles.gamesEdit} onPress={openPicker} disabled={savingGames}>
            <Text style={[styles.gamesEditText, { color: colors.primary }]}>
              {savingGames ? 'Speichern…' : 'Spiele auswählen'}
            </Text>
          </Pressable>
        </View>

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Pressable
          style={[styles.button, { backgroundColor: isOnline ? colors.offline : colors.online }, saving && styles.disabled]}
          disabled={saving}
          onPress={() => setStatus(!isOnline)}
        >
          <Text style={styles.buttonText}>
            {isOnline ? 'Auf Offline setzen' : 'Auf Online setzen'}
          </Text>
        </Pressable>
      </View>

      {/* Compact activity log */}
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Meine Aktivität</Text>
        <ActivityLog userId={session.user.id} limit={5} />
      </View>

      {/* Other users */}
      {others.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Andere Nutzer</Text>
          {others.map((item) => {
            const userGames = gamesOf(item);
            const userBadges = badgesByUser[item.id] ?? [];
            const presence = presenceOf(item);
            const hasStatus = item.status_emoji || item.status_text;
            const compat = calcCompatibility(games, userGames);
            const showCompat = compat.score >= 40;
            return (
              <Pressable
                key={item.id}
                style={[styles.userRow, { backgroundColor: colors.card }]}
                onPress={() => openProfile(item.id)}
              >
                <PresenceDot presence={presence} />
                <View style={styles.userInfo}>
                  <View style={styles.userNameRow}>
                    <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                      {displayName(item)}
                      {userBadges.length > 0 ? (
                        <Text> {userBadges.slice(0, 2).map((b) => b.icon).join('')}</Text>
                      ) : null}
                    </Text>
                    {(item.level ?? 1) > 1 ? (
                      <LevelBadge
                        level={item.level}
                        xp={item.xp}
                        xp_to_next_level={item.xp_to_next_level}
                        compact
                      />
                    ) : null}
                  </View>
                  {hasStatus ? (
                    <Text style={[styles.userCustomStatus, { color: colors.textMuted }]} numberOfLines={1}>
                      {item.status_emoji ? `${item.status_emoji} ` : ''}{item.status_text ?? ''}
                    </Text>
                  ) : null}
                  {userGames.length > 0 ? (
                    <View style={styles.gameChipRow}>
                      {userGames.map((g) => (
                        <Pressable key={g} style={[styles.gameChip, { backgroundColor: colors.chipBg }]} onPress={() => setReviewGame(g)}>
                          <Text style={[styles.gameChipText, { color: colors.chipText }]}>{g}</Text>
                        </Pressable>
                      ))}
                    </View>
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
          })}
        </>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Noch keine anderen Nutzer registriert.
        </Text>
      )}
    </ScrollView>
  );

  // ── Chat Panel ────────────────────────────────────────────────────────
  const chatPanel = (
    <KeyboardAvoidingView
      style={styles.fill}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        style={[
          styles.chatHeader,
          { paddingTop: chatHeaderPaddingTop, backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <Text style={[styles.chatHeaderText, { color: colors.text }]}>💬 Global Chat</Text>
      </View>

      {chatLoading ? (
        <View style={styles.chatLoader}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      ) : (
        <FlatList
          style={styles.fill}
          contentContainerStyle={styles.chatListContent}
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          onEndReached={loadMoreChat}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore
              ? <ActivityIndicator color={colors.textMuted} style={{ marginVertical: 12 }} />
              : null
          }
          renderItem={({ item }) => {
            const mine = item.user_id === session.user.id;
            const isTemp = item.id.startsWith('temp-');
            return (
              <View style={[styles.msgCol, mine ? styles.msgRowMine : styles.msgRowOther]}>
                <View style={[styles.bubble, { backgroundColor: mine ? colors.bubbleMine : colors.bubbleOther }]}>
                  {!mine ? (
                    <Pressable onPress={() => openProfile(item.user_id)}>
                      <Text style={[styles.author, { color: colors.bubbleOtherText }]}>
                        {item.username?.trim() || 'Unbenannt'}
                      </Text>
                    </Pressable>
                  ) : null}
                  <Text style={[styles.bubbleText, { color: mine ? colors.bubbleMineText : colors.bubbleOtherText }]}>
                    {item.content}
                  </Text>
                  <Text style={[styles.timeStamp, { color: mine ? colors.bubbleMineText : colors.bubbleOtherText }]}>
                    {clockTime(item.created_at)}
                  </Text>
                </View>
                {!isTemp ? (
                  <Reactions
                    reactions={reactionRows.filter((r) => r.target === item.id)}
                    userId={session.user.id}
                    onToggle={(emoji) => {
                      const isAdding = !reactionRows.some(
                        (r) => r.target === item.id && r.user_id === session.user.id && r.emoji === emoji
                      );
                      toggleReaction(item.id, emoji);
                      if (isAdding) {
                        addXP(session.user.id, 10);
                        updateQuestProgress(session.user.id, 'react');
                      }
                    }}
                    align={mine ? 'flex-end' : 'flex-start'}
                  />
                ) : null}
              </View>
            );
          }}
        />
      )}

      <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        <TextInput
          style={[styles.chatInput, { backgroundColor: colors.cardAlt, color: colors.text }]}
          placeholder="Nachricht an alle…"
          placeholderTextColor={colors.textMuted}
          value={chatText}
          onChangeText={setChatText}
          multiline
          onSubmitEditing={sendChat}
        />
        <Pressable
          style={[
            styles.sendBtn,
            { backgroundColor: colors.primary },
            (!chatText.trim() || sending) && styles.disabled,
          ]}
          disabled={!chatText.trim() || sending}
          onPress={sendChat}
        >
          <Text style={[styles.sendText, { color: colors.primaryText }]}>Senden</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  // ── Layout ────────────────────────────────────────────────────────────
  return (
    <>
      <View style={[styles.screen, { backgroundColor: colors.background, flexDirection: isWide ? 'row' : 'column' }]}>
        <View style={isWide ? styles.statusWide : styles.statusNarrow}>
          {statusPanel}
        </View>

        <View style={[
          isWide ? styles.dividerVertical : styles.dividerHorizontal,
          { backgroundColor: colors.border },
        ]} />

        <View style={isWide ? styles.chatWide : styles.chatNarrow}>
          {chatPanel}
        </View>
      </View>

      <DailyQuests userId={session.user.id} visible={showQuests} onClose={() => setShowQuests(false)} />
      <Streaks userId={session.user.id} visible={showStreaks} onClose={() => setShowStreaks(false)} />
      <GameReviews
        userId={session.user.id}
        gameName={reviewGame}
        visible={!!reviewGame}
        onClose={() => setReviewGame(null)}
      />

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={[styles.modalBackdrop, { backgroundColor: colors.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Spiele auswählen</Text>
            <Text style={[styles.modalHint, { color: colors.textMuted }]}>
              Wähle bis zu {MAX_GAMES} Spiele ({draftGames.length}/{MAX_GAMES})
            </Text>
            <TextInput
              style={[styles.searchInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.cardAlt }]}
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
                    <View style={[styles.checkbox, { borderColor: colors.primary }, selected && { backgroundColor: colors.primary }]}>
                      {selected ? <Text style={styles.checkboxMark}>✓</Text> : null}
                    </View>
                    <Text style={[styles.gameOptionText, { color: colors.text }]}>{g}</Text>
                  </Pressable>
                );
              })}
              {filteredGames.length === 0 ? (
                <Text style={[styles.gamesEmpty, { color: colors.textMuted }]}>Kein Spiel gefunden.</Text>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.cardAlt }]} onPress={() => setPickerOpen(false)}>
                <Text style={[styles.modalCancelText, { color: colors.text }]}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={saveGames}>
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
  fill: { flex: 1 },
  loaderWrap: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },

  // Split layout
  statusNarrow: { flex: 2 },    // 40% of height on mobile
  statusWide: { width: '38%' }, // 38% of width on tablet/web
  chatNarrow: { flex: 3 },      // 60% of height on mobile
  chatWide: { flex: 1 },        // remaining 62% of width on tablet/web
  dividerVertical: { width: StyleSheet.hairlineWidth },
  dividerHorizontal: { height: StyleSheet.hairlineWidth },

  // Status panel
  statusContent: { padding: 12, paddingBottom: 24, gap: 12 },
  card: {
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  greeting: { fontSize: 20, fontWeight: '700' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  dot: { width: 12, height: 12, borderRadius: 6 },
  statusText: { fontSize: 15, fontWeight: '600' },
  customStatus: { fontSize: 13, flexShrink: 1 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badgePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgePillIcon: { fontSize: 13 },
  badgePillText: { fontSize: 12, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  actionChipText: { fontSize: 13, fontWeight: '600' },
  gamesBlock: { gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  gamesLabel: { fontSize: 12, fontWeight: '600' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { fontSize: 12, fontWeight: '600' },
  gamesEmpty: { fontSize: 13 },
  gamesEdit: { alignSelf: 'flex-start', marginTop: 2 },
  gamesEditText: { fontSize: 14, fontWeight: '600' },
  button: { borderRadius: 10, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },
  disabled: { opacity: 0.6 },
  error: { fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '700', paddingHorizontal: 4, marginTop: 4 },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  userInfo: { flex: 1 },
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  userName: { fontSize: 14, fontWeight: '500' },
  userCustomStatus: { fontSize: 12, marginTop: 2 },
  gameChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  gameChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  gameChipText: { fontSize: 11, fontWeight: '600' },
  lastSeen: { fontSize: 12, marginTop: 2 },
  userRight: { alignItems: 'flex-end', gap: 4 },
  userStatus: { fontSize: 12 },
  compatBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  compatText: { fontSize: 11, fontWeight: '700' },
  empty: { textAlign: 'center', fontSize: 14, paddingVertical: 24 },

  // Chat panel
  chatHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  chatHeaderText: { fontSize: 16, fontWeight: '700' },
  chatLoader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  chatListContent: { padding: 10, gap: 6 },
  msgCol: { flexDirection: 'column' },
  msgRowMine: { alignItems: 'flex-end' },
  msgRowOther: { alignItems: 'flex-start' },
  bubble: { maxWidth: '85%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  author: { fontSize: 12, fontWeight: '700', marginBottom: 2, opacity: 0.9 },
  bubbleText: { fontSize: 14 },
  timeStamp: { fontSize: 10, marginTop: 4, opacity: 0.7, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    padding: 10, borderTopWidth: StyleSheet.hairlineWidth,
  },
  chatInput: {
    flex: 1, borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 10 : 8,
    fontSize: 14, maxHeight: 100,
  },
  sendBtn: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' },
  sendText: { fontWeight: '700', fontSize: 14 },

  // Game picker modal
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  modalCard: { width: '100%', maxWidth: 480, maxHeight: '80%', borderRadius: 16, padding: 20, gap: 12 },
  modalTitle: { fontSize: 18, fontWeight: '700' },
  modalHint: { fontSize: 13, marginTop: -6 },
  searchInput: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15,
  },
  gameList: { flexGrow: 0 },
  gameOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  gameOptionDisabled: { opacity: 0.4 },
  gameOptionText: { fontSize: 15 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  checkboxMark: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelText: { fontWeight: '600', fontSize: 15 },
  modalSaveText: { fontWeight: '700', fontSize: 15 },
});
