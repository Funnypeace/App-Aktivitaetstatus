import { useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Session } from '@supabase/supabase-js';

import { supabase } from './lib/supabase';
import { ThemeProvider, ThemeName } from './lib/theme';
import Auth from './components/Auth';
import Main from './components/Main';

// Keep the auth token fresh on native while the app is in the foreground.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const [profileLoaded, setProfileLoaded] = useState(false);
  const [theme, setTheme] = useState<ThemeName>('light');
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Load the user's theme + username whenever the signed-in user changes.
  useEffect(() => {
    const uid = session?.user?.id;
    if (!uid) {
      setProfileLoaded(false);
      return;
    }
    let active = true;
    setProfileLoaded(false);
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('theme, username')
        .eq('id', uid)
        .single();
      if (!active) return;
      setTheme((data?.theme as ThemeName) ?? 'light');
      setUsername(data?.username ?? session?.user?.email?.split('@')[0] ?? null);
      setProfileLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: '#f3f4f6' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={[styles.centered, { backgroundColor: '#f3f4f6' }]}>
        <StatusBar style="dark" />
        <Auth />
      </View>
    );
  }

  if (!profileLoaded) {
    return (
      <View style={[styles.centered, { backgroundColor: '#f3f4f6' }]}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#111827" />
      </View>
    );
  }

  return (
    <ThemeProvider key={session.user.id} initial={theme}>
      <Main session={session} username={username} />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
