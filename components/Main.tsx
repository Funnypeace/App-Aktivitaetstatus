import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/theme';
import { NavProvider } from '../lib/nav';
import { logActivity } from '../lib/activity';
import Account from './Account';
import Messages from './Messages';
import GlobalChat from './GlobalChat';
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

  // Record a login event + refresh last_seen once per mounted session.
  useEffect(() => {
    logActivity(myId, 'login', 'App geöffnet');
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

  const nav = {
    openProfile: (userId: string) => setProfileUserId(userId),
    openConversation: (userId: string) => {
      setRequestedPeer(userId);
      setTab('messages');
    },
  };

  return (
    <NavProvider value={nav}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style={name === 'dark' ? 'light' : 'dark'} />
        <View style={styles.screen}>
          {tab === 'home' ? <Account session={session} /> : null}
          {tab === 'messages' ? (
            <Messages
              session={session}
              username={username}
              requestedPeer={requestedPeer}
              onConsumedPeer={() => setRequestedPeer(null)}
            />
          ) : null}
          {tab === 'chat' ? <GlobalChat session={session} username={username} /> : null}
          {tab === 'settings' ? <Settings session={session} /> : null}
        </View>

        <TabBar active={tab} onChange={setTab} unread={unread} />

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
    </NavProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  screen: { flex: 1, width: '100%' },
});
