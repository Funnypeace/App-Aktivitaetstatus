import { supabase } from './supabase';
import type { Squad, SquadMember, SquadChatMessage } from './supabase';

export async function fetchAllSquads(): Promise<Squad[]> {
  const { data } = await supabase
    .from('squads')
    .select('*')
    .order('member_count', { ascending: false });
  return (data ?? []) as Squad[];
}

export async function createSquad(params: {
  name: string;
  description?: string;
  leader_id: string;
  icon: string;
}): Promise<Squad | null> {
  const insert: Record<string, unknown> = { ...params };
  if (!insert.description) delete insert.description;

  const { data, error } = await supabase
    .from('squads')
    .insert(insert)
    .select()
    .single();
  if (error || !data) return null;

  const squad = data as Squad;
  // auto-join leader (trigger keeps member_count in sync)
  await supabase
    .from('squad_members')
    .insert({ squad_id: squad.id, user_id: params.leader_id, role: 'leader' });
  return squad;
}

export async function joinSquad(squadId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('squad_members')
    .insert({ squad_id: squadId, user_id: userId, role: 'member' });
  return !error;
}

export async function leaveSquad(squadId: string, userId: string): Promise<void> {
  await supabase
    .from('squad_members')
    .delete()
    .eq('squad_id', squadId)
    .eq('user_id', userId);
}

export async function deleteSquad(squadId: string): Promise<void> {
  await supabase.from('squads').delete().eq('id', squadId);
}

export async function fetchSquadMembers(squadId: string): Promise<SquadMember[]> {
  const { data } = await supabase
    .from('squad_members')
    .select('*')
    .eq('squad_id', squadId)
    .order('joined_at', { ascending: true });
  return (data ?? []) as SquadMember[];
}

export async function fetchSquadChat(squadId: string, limit = 50): Promise<SquadChatMessage[]> {
  const { data } = await supabase
    .from('squad_chat')
    .select('*')
    .eq('squad_id', squadId)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []) as SquadChatMessage[];
}

export async function sendSquadMessage(params: {
  squad_id: string;
  user_id: string;
  username: string | null;
  content: string;
}): Promise<SquadChatMessage | null> {
  const { data, error } = await supabase
    .from('squad_chat')
    .insert(params)
    .select()
    .single();
  if (error || !data) return null;
  return data as SquadChatMessage;
}
