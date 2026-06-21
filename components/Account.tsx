import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Session } from '@supabase/supabase-js';

import { supabase, Profile } from '../lib/supabase';

export default function Account({ session }: { session: Session }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('profiles')
      .select('username, is_online, updated_at')
      .eq('id', session.user.id)
      .maybeSingle<Pick<Profile, 'username' | 'is_online' | 'updated_at'>>();

    if (error) {
      setError(error.message);
    } else if (data) {
      setUsername(data.username);
      setIsOnline(data.is_online);
    } else {
      // No row yet (e.g. trigger disabled) — fall back to a sensible default.
      setUsername(session.user.email?.split('@')[0] ?? null);
      setIsOnline(false);
    }
    setLoading(false);
  }, [session.user.id, session.user.email]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function setStatus(next: boolean) {
    setSaving(true);
    setError(null);
    const previous = isOnline;
    setIsOnline(next); // optimistic

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      username: username,
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

  if (loading) {
    return <ActivityIndicator size="large" color="#111827" />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.greeting}>Hallo{username ? `, ${username}` : ''} 👋</Text>
      <Text style={styles.email}>{session.user.email}</Text>

      <View style={styles.statusRow}>
        <View
          style={[styles.dot, { backgroundColor: isOnline ? '#22c55e' : '#9ca3af' }]}
        />
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
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    maxWidth: 380,
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
    width: 16,
    height: 16,
    borderRadius: 8,
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
});
