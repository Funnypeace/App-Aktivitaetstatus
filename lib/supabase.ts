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
  status_emoji: string | null;
  status_text: string | null;
  bio: string | null;
  is_active: boolean;
  xp: number;
  level: number;
  xp_to_next_level: number;
  notifications_enabled: boolean;
  notif_levelup: boolean;
  notif_quests: boolean;
  notif_messages: boolean;
  notif_sound: boolean;
  notif_vibration: boolean;
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

export type MessageReaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type ChatReaction = {
  id: string;
  chat_message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type UserBadge = {
  id: string;
  user_id: string;
  badge_name: string;
  icon: string;
  earned_at: string;
};

export type GamingSession = {
  id: string;
  creator_id: string;
  game_name: string;
  title: string;
  description: string | null;
  player_limit: number;
  current_players: number;
  voice_link: string | null;
  status: 'open' | 'full';
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type SessionMember = {
  id: string;
  session_id: string;
  user_id: string;
  joined_at: string;
};

export type Squad = {
  id: string;
  name: string;
  description: string | null;
  leader_id: string;
  icon: string;
  member_count: number;
  created_at: string;
};

export type SquadMember = {
  id: string;
  squad_id: string;
  user_id: string;
  joined_at: string;
  role: 'leader' | 'member';
};

export type SquadChatMessage = {
  id: string;
  squad_id: string;
  user_id: string;
  username: string | null;
  content: string;
  created_at: string;
};

export type DailyQuest = {
  id: string;
  name: string;
  description: string;
  icon: string;
  xp_reward: number;
  condition: string;
  target: number;
};

export type UserDailyQuest = {
  id: string;
  user_id: string;
  quest_id: string;
  date: string;
  progress: number;
  completed: boolean;
  claimed: boolean;
  completed_at: string | null;
};

export type UserStreak = {
  id: string;
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  updated_at: string;
};

export type GameReview = {
  id: string;
  user_id: string;
  game_name: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  updated_at: string;
};

export type UserNotification = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  action_link: string | null;
  read: boolean;
  created_at: string;
};
