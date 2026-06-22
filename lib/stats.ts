import { supabase } from './supabase';
import type { GameStat } from './supabase';

export async function updateGameStats(userId: string, games: string[]): Promise<void> {
  if (!games.length) return;
  try {
    await supabase.rpc('increment_game_stats', { p_user_id: userId, p_games: games });
  } catch {
    // best-effort
  }
}

export async function fetchGameStats(userId: string, limit = 5): Promise<GameStat[]> {
  const { data } = await supabase
    .from('user_game_statistics')
    .select('id, user_id, game_name, select_count, last_selected')
    .eq('user_id', userId)
    .order('select_count', { ascending: false })
    .limit(limit);
  return (data ?? []) as GameStat[];
}
