import { supabase } from './supabase';
import type { GamingSession, SessionChatMessage } from './supabase';

export async function fetchOpenSessions(): Promise<GamingSession[]> {
  const now = new Date().toISOString();
  const { data } = await supabase
    .from('gaming_sessions')
    .select('*')
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('created_at', { ascending: false });
  return (data ?? []) as GamingSession[];
}

export async function createSession(params: {
  creator_id: string;
  game_name: string;
  title: string;
  description?: string;
  player_limit: number;
  voice_link?: string;
  starts_at?: string;
}): Promise<GamingSession | null> {
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const insert: Record<string, unknown> = { ...params, expires_at };
  if (!insert.description) delete insert.description;
  if (!insert.voice_link) delete insert.voice_link;
  if (!insert.starts_at) delete insert.starts_at;

  const { data, error } = await supabase
    .from('gaming_sessions')
    .insert(insert)
    .select()
    .single();
  if (error || !data) return null;

  const session = data as GamingSession;
  // auto-join creator (trigger keeps current_players in sync)
  await supabase
    .from('session_members')
    .insert({ session_id: session.id, user_id: params.creator_id });
  return session;
}

export async function joinSession(sessionId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('session_members')
    .insert({ session_id: sessionId, user_id: userId });
  return !error;
}

export async function leaveSession(sessionId: string, userId: string): Promise<void> {
  await supabase
    .from('session_members')
    .delete()
    .eq('session_id', sessionId)
    .eq('user_id', userId);
}

export async function deleteSession(sessionId: string): Promise<void> {
  await supabase.from('gaming_sessions').delete().eq('id', sessionId);
}

export async function fetchSessionMemberIds(sessionId: string): Promise<string[]> {
  const { data } = await supabase
    .from('session_members')
    .select('user_id')
    .eq('session_id', sessionId);
  return ((data ?? []) as { user_id: string }[]).map((r) => r.user_id);
}

export async function fetchSessionChat(sessionId: string): Promise<SessionChatMessage[]> {
  const { data } = await supabase
    .from('session_chat')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  return (data ?? []) as SessionChatMessage[];
}

export async function sendSessionMessage(params: {
  session_id: string;
  user_id: string;
  username: string | null;
  content: string;
}): Promise<SessionChatMessage | null> {
  const { data, error } = await supabase
    .from('session_chat')
    .insert(params)
    .select()
    .single();
  if (error || !data) return null;
  return data as SessionChatMessage;
}
