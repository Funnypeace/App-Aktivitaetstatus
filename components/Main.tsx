import { useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';

import { supabase, Message, ChatMessage } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { NavProvider } from '../lib/nav';
import { logLogin } from '../lib/activity';
import { checkAndUnlockAchievements } from '../lib/achievements';
import { checkAndUnlockBadges } from '../lib/badges';
import { setActive } from '../lib/presence';
import { checkAndUpdateStreak } from '../lib/streaks';
import { trackEvent, setAnalyticsUser } from '../lib/analytics';
import { showNotification, AppNotification } from '../lib/notifications';
import { NotificationProvider } from './NotificationToast';
import HomeScreen from './HomeScreen';
import Messages from './Messages';
import GlobalChat from './GlobalChat';
import GamingHub from './GamingHub';
import Leaderboard from './Leaderboard';
import Settings from './Settings';
import ProfileModal from './ProfileModal';
import TabBar, { TabKey } from './TabBar';

export default function Main({
  session,
  username,
}: {
  session: Session;
  username: string | null;
}) {
  const { colors, name } = useTheme();
  const myId = session.user.id;

  const [tab, setTab] = useState<TabKey>('home');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [requestedPeer, setRequestedPeer] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  // Keep the active tab readable inside async Realtime callbacks without
  // re-subscribing whenever the tab changes.
  const tabRef = useRef<TabKey>(tab);
  tabRef.current = tab;
  const nameCache = useRef<Map<string, string>>(new Map());

  // Guard against React Strict Mode double-invocation and rapid re-mounts.
  // logLogin itself also deduplicates via a 30-minute DB window.
  const loginLogged = useRef(false);
  useEffect(() => {
    if (loginLogged.current) return;
    loginLogged.current = true;
    logLogin(myId);
    checkAndUnlockAchievements(myId, 'login');
    checkAndUnlockBadges(myId);
    checkAndUpdateStreak(myId);
    setAnalyticsUser(myId);
    trackEvent('app_open');
  }, [myId]);

  // Analytics: log app_close on web unload / native background.
  useEffect(() => {
    let cleanup = () => {};
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onUnload = () => { trackEvent('app_close'); };
      window.addEventListener('beforeunload', onUnload);
      cleanup = () => window.removeEventListener('beforeunload', onUnload);
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'background' || state === 'inactive') trackEvent('app_close');
      });
      cleanup = () => sub.remove();
    }
    return cleanup;
  }, []);

  // Presence tracking: mark the app active while foregrounded, inactive when
  // backgrounded/closed. A heartbeat keeps last_seen fresh.
  useEffect(() => {
    setActive(myId, true);
    const heartbeat = setInterval(() => setActive(myId, true), 2 * 60 * 1000);

    let cleanupPlatform = () => {};
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibility = () => setActive(myId, document.visibilityState === 'visible');
      const onUnload = () => setActive(myId, false);
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('beforeunload', onUnload);
      cleanupPlatform = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('beforeunload', onUnload);
      };
    } else {
      const sub = AppState.addEventListener('change', (state) => {
        setActive(myId, state === 'active');
      });
      cleanupPlatform = () => sub.remove();
    }

    return () => {
      clearInterval(heartbeat);
      cleanupPlatform();
      setActive(myId, false);
    };
  }, [myId]);

  // Track total unread DMs for the tab badge.
  useEffect(() => {
    let active = true;
    async function refreshUnread() {
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', myId)
        .eq('read', false);
      if (active) setUnread(count ?? 0);
    }
    refreshUnread();

    const channel = supabase
      .channel('unread:messages')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => refreshUnread()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [myId]);

  // In-app notifications driven by Realtime: incoming DMs, global chat, and
  // people joining sessions/squads the user owns. Self-triggered events
  // (level-ups, quests, badges) are raised directly from the lib layer.
  useEffect(() => {
    async function resolveName(id: string): Promise<string> {
      const cached = nameCache.current.get(id);
      if (cached) return cached;
      const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', id)
        .single();
      const name = data?.username?.trim() || 'Jemand';
      nameCache.current.set(id, name);
      return name;
    }

    const channel = supabase
      .channel('notifications:realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          const m = payload.new as Message;
          if (m.recipient_id !== myId || m.sender_id === myId) return;
          if (tabRef.current === 'messages') return; // already reading DMs
          const name = await resolveName(m.sender_id);
          showNotification('new_message', `${name} sent you a message`, {
            actionLink: `dm:${m.sender_id}`,
            actionLabel: 'Öffnen',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const c = payload.new as ChatMessage;
          if (c.user_id === myId || tabRef.current === 'chat' || tabRef.current === 'home') return;
          const name = c.username?.trim() || 'Jemand';
          showNotification('chat', `${name}: ${c.content.slice(0, 60)}`, {
            actionLink: 'tab:chat',
            actionLabel: 'Öffnen',
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'session_members' },
        async (payload) => {
          const row = payload.new as { session_id: string; user_id: string };
          if (row.user_id === myId) return;
          const { data: s } = await supabase
            .from('gaming_sessions')
            .select('creator_id, title')
            .eq('id', row.session_id)
            .single();
          if (!s || s.creator_id !== myId) return;
          const name = await resolveName(row.user_id);
          showNotification('session_joined', `${name} joined your Gaming Session "${s.title}"!`);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'squad_members' },
        async (payload) => {
          const row = payload.new as { squad_id: string; user_id: string };
          if (row.user_id === myId) return;
          const { data: sq } = await supabase
            .from('squads')
            .select('leader_id, name')
            .eq('id', row.squad_id)
            .single();
          if (!sq || sq.leader_id !== myId) return;
          const name = await resolveName(row.user_id);
          showNotification('squad', `${name} joined your Squad "${sq.name}"!`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myId]);

  function changeTab(next: TabKey) {
    if (next !== tab) trackEvent('tab_switch', { tab: next });
    setTab(next);
  }

  const nav = {
    openProfile: (userId: string) => setProfileUserId(userId),
    openConversation: (userId: string) => {
      setRequestedPeer(userId);
      setTab('messages');
    },
  };

  function handleNotificationAction(n: AppNotification) {
    const link = n.actionLink;
    if (!link) return;
    if (link.startsWith('dm:')) {
      nav.openConversation(link.slice(3));
    } else if (link === 'tab:chat') {
      setTab('chat');
    }
  }

  return (
    <NavProvider value={nav}>
      <NotificationProvider userId={myId} onAction={handleNotificationAction}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
        <View style={styles.screen}>
          {tab === 'home' ? <HomeScreen session={session} username={username} /> : null}
          {tab === 'messages' ? (
            <Messages
              session={session}
              username={username}
              requestedPeer={requestedPeer}
              onConsumedPeer={() => setRequestedPeer(null)}
            />
          ) : null}
          {tab === 'chat' ? <GlobalChat session={session} username={username} /> : null}
          {tab === 'gaming' ? <GamingHub session={session} username={username} /> : null}
          {tab === 'leaderboard' ? <Leaderboard session={session} /> : null}
          {tab === 'settings' ? <Settings session={session} /> : null}
        </View>

        <TabBar active={tab} onChange={changeTab} unread={unread} />

          <ProfileModal
            userId={profileUserId}
            selfId={myId}
            onClose={() => setProfileUserId(null)}
            onSendMessage={(userId) => {
              setProfileUserId(null);
              nav.openConversation(userId);
            }}
          />
        </View>
      </NotificationProvider>
    </NavProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  screen: { flex: 1, width: '100%' },
});
