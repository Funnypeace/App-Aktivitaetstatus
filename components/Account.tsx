import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Profile } from '../lib/supabase';

function displayName(profile: Profile): string {
  const name = profile.username?.trim();
  if (name) return name;
  return `Unbenannt (${profile.id.slice(0, 8)})`;
}

function StatusDot({ online }: { online: boolean }) {
  return <View style={[styles.dot, { backgroundColor: online ? '#22c55e' : '#9ca3af' }]} />;
}

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadProfiles = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, is_online, updated_at')
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
    } else {
      setUsername(session.user.email?.split('@')[0] ?? null);
      setIsOnline(false);
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
            if (row.id === session.user.id) setIsOnline(row.is_online);
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
      updated_at: new Date().toISOString(),
    });

    if (error) {
      setIsOnline(previous); // revert on failure
      setError(error.message);
    }
    setSaving(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const others = profiles.filter((p) => p.id !== session.user.id);

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
      renderItem={({ item }) => (
        <View style={styles.userRow}>
          <StatusDot online={item.is_online} />
          <Text style={styles.userName} numberOfLines={1}>
            {displayName(item)}
          </Text>
          <Text style={styles.userStatus}>{item.is_online ? 'Online' : 'Offline'}</Text>
        </View>
      )}
    />
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
  userName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
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
});
