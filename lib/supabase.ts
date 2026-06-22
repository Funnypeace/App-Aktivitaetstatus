import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY (see .env.example).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // On native we persist the session with AsyncStorage. On web the client
    // falls back to localStorage automatically (storage left undefined).
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only needed for OAuth redirects, which happen in the browser.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

export type Profile = {
  id: string;
  username: string | null;
  is_online: boolean;
  games: string[];
  theme: 'light' | 'dark';
  last_seen: string;
  created_at: string;
  updated_at: string;
};

export type ActivityEvent = {
  id: string;
  user_id: string;
  type: 'status' | 'games' | 'message' | 'chat' | 'login' | string;
  details: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  read: boolean;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  user_id: string;
  username: string | null;
  content: string;
  created_at: string;
};

export type GameStat = {
  id: string;
  user_id: string;
  game_name: string;
  select_count: number;
  last_selected: string;
};

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: string;
};

export type UserAchievement = {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
};
